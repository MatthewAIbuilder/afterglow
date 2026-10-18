import { cleanTrack } from '../../memories/track';
import { throwbackShares } from '../../memories/throwbackLimit';
import { ARTISTS_SHOWN, CHAT_MAX, type CrewMessage, type ClipComment, type Comment, validClipId, CREW_MAX, CREW_NOTE_MAX, CREW_PICKS_MAX, CREW_STAGE_MAX, type Activity, type Crew, type CrewInvite, type CrewPicks, type CrewUpdate, MEET_SPOT_MAX, type MeetSpot, type AdminPresence, type Drop, type LivePatch, type AppSettings, DEFAULT_APP_SETTINGS, type Profile, type ProfileInput, type ReportReason, type SharedMemory, type SocialUser, type Flair, FOUNDERS_MAX, type SupportMessage, SUPPORT_MAX, type Sprout, type DirectChat, directRoom, isDirectRoom, otherInRoom, SUPPORT_REPLIES_MAX, type SetTimesTip, type VideoTag, VIDEO_TAGS_MAX } from '../models';
import { cleanBackdrop } from '../../profile/backdrops';
import { cleanArtistName } from '../../../data/extraArtists';
import { canGiveThemes, isGiftTheme } from '../../themes/gifts';
import { cleanPublicGarden, type PublicResident } from '../../sprouts/publicGarden';
import { isKind, keptKinds, kindOf } from '../../sprouts/sprouts';
import { GARDEN_BACKUP_MAX } from '../../sprouts/backup';
import { cleanDecor, type DecorId } from '../../sprouts/decor';
import { cleanNote, cleanPublicKandi, cleanWord, isCharm, isPattern, KANDI_ID, type Kandi, type PublicKandi } from '../../kandi/kandi';
import { SUPPORT_EMAIL } from '../../../config/app';
import { nextPresence } from '../../admin/presence';
import type { Hunt, Sticker } from '../../finds/finds';
import { cleanOrg, cleanPostInput, findsByCode, isCounter, type Org, type OrgPost, type OrgRequest, orgToDoc, utcDay } from '../../organizers/organizers';
import { isTapFestivalId } from '../../partners/partners';
import { MAX_SHARE_BYTES, SocialError, type ReportTarget, type ShareInput, type SocialService } from '../service';
import { cleanComment, cleanCrewName, cleanProfileInput, commentProblem, crewNameProblem, handleProblem, normalizeHandle, profileProblems } from '../validate';

/**
 * An in-memory social backend for tests, following the same rules as the
 * Firebase adapter and the security rules: one owner per handle, you can
 * only change your own things, deleting an account removes everything of
 * it. No network, no real accounts.
 */
export function fakeSocial(opts: { available?: boolean; fileBytes?: (uri: string) => number } = {}) {
  const accounts = new Map<string, { uid: string; password: string }>();
  const profiles = new Map<string, Profile>();
  const handles = new Map<string, string>();
  const memories = new Map<string, SharedMemory & { memoryId: string }>();
  const blocks = new Map<string, string[]>();
  const videoTags = new Map<string, VideoTag>();
  /** Follows as `from>to`, in the order made. */
  const follows = new Map<string, { from: string; to: string; createdAt: string }>();
  /** Likes as `memoryId_uid`. */
  const likes = new Map<string, { memoryId: string; owner: string; uid: string; createdAt: string }>();
  const crews = new Map<string, Crew>();
  /** Crew invites as `crewId_to`. */
  const crewInvites = new Map<string, CrewInvite>();
  const sprouts = new Map<string, Sprout>();
  /** Gift themes granted, as `uid_theme`. */
  const themeGrants = new Set<string>();
  /** Gardens as shown on profiles. */
  const gardens = new Map<string, { residents: PublicResident[]; kandi: PublicKandi[]; decor: DecorId[] }>();
  /** Glows on gardens: owner uid → who left one → when. */
  const glows = new Map<string, Map<string, string>>();
  const gardenBackups = new Map<string, string>();
  /** Kandi, by id. */
  const kandi = new Map<string, Kandi>();
  /** Picks as `crewId/uid`. */
  const picks = new Map<string, CrewPicks>();
  const comments = new Map<string, Comment>();
  /** Comments on clips in Discover. */
  const clipComments = new Map<string, ClipComment>();
  /** Crew updates as `crewId/updateId`. */
  const updates = new Map<string, CrewUpdate>();
  /** Switch the "network" off to see what happens with no signal: crew updates fail to send. */
  const network = { down: false, noReads: false };
  /** `network.noReads`: reads get nothing too, like opening the app in airplane mode (profiles, crews, stars, chats). */
  const readable = () => {
    if (network.noReads) throw new SocialError('network');
  };
  /** Each person's friend code (what their QR code carries). */
  const friendCodes = new Map<string, string>();
  /** Founder numbers, in the order people claimed them, and flairs (set by hand, like the Firebase console). */
  const founders = new Map<string, number>();
  const flairs = new Map<string, Flair>();
  /** Afterglow Plus members (set by hand, like the Firebase console). */
  const plus = new Set<string>();
  const levels = new Map<string, number>();
  /** Throwbacks each account has shared (the free plan's count). */
  const usage = new Map<string, number>();
  const counter = { founders: 0 };
  /** Crew-only video files uploaded, as `crewId/uid/updateId`. */
  const crewFiles = new Set<string>();
  /** Crew chat messages as `crewId/messageId`. */
  const chat = new Map<string, CrewMessage>();
  /** Crew invite link codes. */
  const crewCodes = new Map<string, string>();
  /** Who agreed to the chat rules when they joined or started a crew, as `crewId/uid`. */
  const agreed = new Set<string>();
  /** When each member last read each crew's chat, as `crewId/uid` -> ISO. */
  const reads = new Map<string, string>();
  const readWatchers = new Set<{ crewId: string; listener: (r: Record<string, string>) => void }>();
  const readsOf = (crewId: string) => Object.fromEntries([...reads].filter(([k]) => k.startsWith(`${crewId}/`)).map(([k, v]) => [k.slice(crewId.length + 1), v]));
  const readsChanged = (crewId: string) => {
    for (const w of readWatchers) if (w.crewId === crewId) w.listener(readsOf(crewId));
  };
  const chatWatchers = new Set<{ crewId: string; max: number; listener: (m: CrewMessage[]) => void }>();
  const chatOf = (crewId: string, max: number) =>
    [...chat.values()].filter((m) => m.crewId === crewId).sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id.localeCompare(a.id)).slice(0, max);
  const chatChanged = (crewId: string) => {
    for (const w of chatWatchers) if (w.crewId === crewId) w.listener(chatOf(crewId, w.max));
  };
  const dropReads = (id: string, uid?: string) => {
    for (const k of [...reads.keys()]) if (k.startsWith(`${id}/`) && (!uid || k === `${id}/${uid}`)) reads.delete(k);
  };
  const dropChat = (id: string, uid?: string) => {
    dropReads(id, uid);
    for (const [k, m] of chat) if (k.startsWith(`${id}/`) && (!uid || m.uid === uid)) chat.delete(k);
    chatChanged(id);
  };
  /** Each crew's meeting spot. */
  const meets = new Map<string, MeetSpot>();
  const reports: { id: string; by: string; target: ReportTarget; reason: ReportReason; note?: string; createdAt: string; status: 'open' | 'resolved' }[] = [];
  /** Support messages, and which emails have been confirmed (the support account needs it). */
  const support = new Map<string, SupportMessage>();
  const verified = new Set<string>();
  /** Each account's last-active record (`activity/{uid}`). */
  const presence = new Map<string, AdminPresence>();
  /** HQ uploads, published catalogue updates, and when Plus ends for those given it with an end. */
  const drops = new Map<string, Drop>();
  const stickers = new Map<string, Sticker>();
  const hunts = new Map<string, Hunt>();
  /** Who found what: `${uid}_${code}` → when they scanned it. */
  const finds = new Map<string, number>();
  const patches = new Map<string, LivePatch>();
  let appSettings: AppSettings = { ...DEFAULT_APP_SETTINGS };
  const setTimes = new Map<string, SetTimesTip>();
  const plusUntil = new Map<string, string>();
  const admin = () => !!current?.email && current.email === SUPPORT_EMAIL && verified.has(current.email);
  const needAdmin = () => {
    if (!admin()) throw new SocialError('unknown');
  };
  /** Organizers' pages, who may sign in to each (email -> org id), their requests and numbers (`org_day_key` -> n). */
  const orgs = new Map<string, Org>();
  const orgMembers = new Map<string, string>();
  const orgRequests = new Map<string, OrgRequest>();
  const orgViews = new Map<string, number>();
  /** `ticketTaps/<festival>_<day>` -> taps. */
  const ticketTaps = new Map<string, number>();
  const orgPosts = new Map<string, OrgPost>();
  /** The organizer the signed-in (confirmed) email runs. */
  const orgOfMe = () => (current?.email && verified.has(current.email) ? orgMembers.get(current.email.toLowerCase()) : undefined);
  const needOrg = (orgId: string | undefined) => {
    const linked = !!orgId && !!current && !!orgs.get(orgId)?.uids.includes(current.uid);
    if (!admin() && (!orgId || (orgOfMe() !== orgId && !linked))) throw new SocialError('unknown');
  };
  const listeners = new Set<(u: SocialUser | null) => void>();
  let current: SocialUser | null = null;
  let n = 0;
  const emit = () => listeners.forEach((l) => l(current));
  const me = () => {
    if (!current) throw new SocialError('not-signed-in');
    return current;
  };
  const now = () => new Date().toISOString();
  const crewOf = (id: string) => {
    const c = crews.get(id);
    if (!c) throw new SocialError('not-found');
    return c;
  };
  const memberOf = (id: string) => {
    const c = crewOf(id);
    if (!c.members.includes(me().uid)) throw new SocialError('unknown');
    return c;
  };
  // 1-to-1 chats: rooms like crews' (`dm_<a>_<b>`), between two people who follow each other.
  const dms = new Map<string, DirectChat & { org?: string }>();
  const dmWatchers = new Set<{ uid: string; listener: (chats: DirectChat[]) => void }>();
  const dmsOf = (uid: string) => [...dms.values()].filter((d) => d.members.includes(uid));
  const mutual = (a: string, b: string) => follows.has(`${a}>${b}`) && follows.has(`${b}>${a}`);
  const blockedBy = (who: string, uid: string) => (blocks.get(who) ?? []).includes(uid);
  /** In this chat room: a crew you're in, or your 1-to-1 chat (and, to write, still friends both ways and not blocked). */
  const inRoom = (id: string, writing = false) => {
    if (!isDirectRoom(id)) return void memberOf(id);
    const d = dms.get(id);
    const u = me().uid;
    if (!d || !d.members.includes(u)) throw new SocialError('unknown');
    const other = otherInRoom(id, u);
    if (writing && ((!mutual(u, other) && !orgChat(d)) || blockedBy(other, u))) throw new SocialError('unknown');
  };
  /** A chat with an organizer's account: `org` names it and one of the two runs it (firestore.rules orgChat). */
  const orgChat = (d: { members: readonly string[]; org?: string }) => !!d.org && !!orgs.get(d.org)?.uids.some((u) => d.members.includes(u));
  const dropPicks = (id: string, uid?: string) => {
    for (const k of picks.keys()) if (k.startsWith(`${id}/`) && (!uid || k === `${id}/${uid}`)) picks.delete(k);
  };
  const dropUpdates = (id: string, uid?: string) => {
    for (const [k, u] of updates) if (k.startsWith(`${id}/`) && (!uid || u.uid === uid)) updates.delete(k);
  };
  const leave = (id: string, uid: string) => {
    const c = crews.get(id);
    if (!c || !c.members.includes(uid)) return;
    const members = c.members.filter((m) => m !== uid);
    if (!members.length) {
      crews.delete(id);
      dropPicks(id);
      dropUpdates(id);
      dropChat(id);
      crewCodes.delete(id);
      return;
    }
    dropPicks(id, uid);
    dropUpdates(id, uid);
    dropChat(id, uid);
    crews.set(id, { ...c, members, owner: c.owner === uid ? members[0] : c.owner });
  };

  /** Push addresses registered: uid -> this phone's token and language. */
  const pushes = new Map<string, { token: string; lang: string }>();
  const service: SocialService = {
    availability: () => (opts.available === false ? { ok: false, reason: 'not-set-up' } : { ok: true }),
    onAuthChange(l) {
      listeners.add(l);
      l(current);
      return () => listeners.delete(l);
    },
    async signUp(email, password) {
      const e = email.trim().toLowerCase();
      if (accounts.has(e)) throw new SocialError('email-in-use');
      if (password.length < 6) throw new SocialError('weak-password');
      const uid = `uid-${++n}`;
      accounts.set(e, { uid, password });
      current = { uid, email: e, emailVerified: verified.has(e) };
      emit();
      return current;
    },
    async signIn(email, password) {
      const a = accounts.get(email.trim().toLowerCase());
      if (!a || a.password !== password) throw new SocialError('wrong-password');
      current = { uid: a.uid, email: email.trim().toLowerCase(), emailVerified: verified.has(email.trim().toLowerCase()) };
      emit();
      return current;
    },
    async signOut() {
      current = null;
      emit();
    },
    async sendPasswordReset() {},
    async deleteAccount(password) {
      const u = me();
      const a = accounts.get(u.email ?? '');
      if (!a || a.password !== password) throw new SocialError('wrong-password');
      for (const [id, m] of memories) if (m.uid === u.uid) memories.delete(id);
      const p = profiles.get(u.uid);
      if (p) handles.delete(p.handle);
      profiles.delete(u.uid);
      blocks.delete(u.uid);
      for (const [k, f] of follows) if (f.from === u.uid || f.to === u.uid) follows.delete(k);
      friendCodes.delete(u.uid);
      founders.delete(u.uid);
      presence.delete(u.uid);
      levels.delete(u.uid);
      for (const [k, l] of likes) if (l.uid === u.uid || l.owner === u.uid) likes.delete(k);
      for (const [k, c] of comments) if (c.uid === u.uid || c.owner === u.uid) comments.delete(k);
      for (const [k, c] of clipComments) if (c.uid === u.uid) clipComments.delete(k);
      for (const id of [...crews.keys()]) leave(id, u.uid);
      for (const [k, i] of crewInvites) if (i.from === u.uid || i.to === u.uid) crewInvites.delete(k);
      for (const [k, sp] of sprouts) if (sp.from === u.uid || sp.to === u.uid) sprouts.delete(k);
      for (const k of [...finds.keys()]) if (k.startsWith(`${u.uid}_`)) finds.delete(k);
      for (const [k, t] of [...setTimes.entries()]) if (t.uid === u.uid) setTimes.delete(k);
      for (const [k, m] of [...support.entries()]) if (m.uid === u.uid) support.delete(k);
      accounts.delete(u.email ?? '');
      current = null;
      emit();
    },
    async profileOf(uid) {
      readable();
      return profiles.get(uid) ?? null;
    },
    async profileByHandle(handle) {
      const uid = handles.get(normalizeHandle(handle));
      return uid ? (profiles.get(uid) ?? null) : null;
    },
    async handleAvailable(handle) {
      const h = normalizeHandle(handle);
      if (handleProblem(h)) return false;
      const owner = handles.get(h);
      return !owner || owner === current?.uid;
    },
    async saveProfile(raw: ProfileInput, published) {
      const u = me();
      const input = cleanProfileInput(raw);
      if (Object.keys(profileProblems(input)).length) throw new SocialError('unknown');
      const owner = handles.get(input.handle);
      if (owner && owner !== u.uid) throw new SocialError('handle-taken');
      const before = profiles.get(u.uid);
      if (before && before.handle !== input.handle) handles.delete(before.handle);
      handles.set(input.handle, u.uid);
      const at = now();
      const p: Profile = {
        uid: u.uid,
        handle: input.handle,
        displayName: input.displayName,
        bio: input.bio,
        avatarUrl: before?.avatarUrl,
        coverUrl: before?.coverUrl,
        festivals: input.showFestivals ? published.festivals : [],
        shows: input.showFestivals ? (published.shows ?? before?.shows ?? []).slice(0, 30) : [],
        sounds: input.showSound ? published.sounds : [],
        artists: input.showArtists !== false ? (published.artists ?? before?.artists ?? []).slice(0, ARTISTS_SHOWN) : [],
        showFestivals: input.showFestivals,
        showSound: input.showSound,
        ...((input.socials ?? before?.socials) && Object.keys(input.socials ?? before?.socials ?? {}).length ? { socials: input.socials ?? before?.socials } : {}),
        showArtists: input.showArtists !== false,
        backdrop: before?.backdrop,
        createdAt: before?.createdAt ?? at,
        updatedAt: at,
      };
      profiles.set(u.uid, p);
      return p;
    },
    async setAvatar(uri) {
      const u = me();
      const p = profiles.get(u.uid);
      if (!p) throw new SocialError('no-profile');
      const next = { ...p, avatarUrl: uri ? `https://example.test/avatars/${u.uid}.jpg` : undefined };
      profiles.set(u.uid, next);
      return next;
    },
    async setCover(uri) {
      const u = me();
      const p = profiles.get(u.uid);
      if (!p) throw new SocialError('no-profile');
      const next = { ...p, coverUrl: uri ? `https://example.test/covers/${u.uid}.jpg` : undefined };
      profiles.set(u.uid, next);
      return next;
    },
    async setBackdrop(id) {
      const u = me();
      const p = profiles.get(u.uid);
      if (!p) throw new SocialError('no-profile');
      const backdrop = cleanBackdrop(id ?? undefined);
      // Like the rules: a gift background only with a grant (or for the developer).
      if (backdrop && isGiftTheme(backdrop) && !themeGrants.has(`${u.uid}_${backdrop}`) && !canGiveThemes(p.handle)) throw new SocialError('unknown');
      const next = { ...p, backdrop };
      profiles.set(u.uid, next);
      return next;
    },
    async searchProfiles(raw) {
      const q = raw.trim().replace(/^@+/, '').toLowerCase();
      if (q.length < 2) return [];
      return [...profiles.values()].filter((p) => p.handle.startsWith(q) || p.displayName.toLowerCase().startsWith(q));
    },
    async profilesGoingTo(festivalId, max) {
      return [...profiles.values()].filter((p) => p.festivals.includes(festivalId)).slice(0, max);
    },
    async shareMemory(input: ShareInput, onProgress) {
      if (network.down) throw new SocialError('network');
      const u = me();
      const p = profiles.get(u.uid);
      if (!p) throw new SocialError('no-profile');
      if ((opts.fileBytes?.(input.videoUri) ?? 0) > MAX_SHARE_BYTES) throw new SocialError('too-large');
      const throwback = !input.festivalId && !!input.past;
      if (throwback && !throwbackShares({ plus: plus.has(u.uid), used: usage.get(u.uid) ?? 0 }).canShare) throw new SocialError('throwback-limit');
      if (throwback) usage.set(u.uid, (usage.get(u.uid) ?? 0) + 1);
      onProgress?.(0.5);
      const id = `shared-${++n}`;
      const m = {
        id,
        uid: u.uid,
        handle: p.handle,
        memoryId: input.memoryId,
        videoUrl: `https://example.test/memories/${u.uid}/${id}.mp4`,
        thumbUrl: input.thumbUri ? `https://example.test/memories/${u.uid}/${id}.jpg` : undefined,
        festivalId: input.festivalId,
        night: input.night,
        artistId: input.artistId,
        withArtistIds: input.artistId ? input.withArtistIds : undefined,
        ...(input.artistId && cleanArtistName(input.artistName) ? { artistName: cleanArtistName(input.artistName) } : {}),
        past: input.festivalId ? undefined : input.past,
        show: input.festivalId || input.past ? undefined : input.show,
        clip: input.clip,
        ...(cleanTrack(input.track) ? { track: cleanTrack(input.track) } : {}),
        capturedAt: input.capturedAt,
        durationSec: input.durationSec,
        width: input.width,
        height: input.height,
        createdAt: now(),
      };
      memories.set(id, m);
      for (const uid of [...new Set(input.people ?? [])].filter((x) => x !== u.uid && profiles.has(x)).slice(0, VIDEO_TAGS_MAX))
        videoTags.set(`${id}_${uid}`, { id: `${id}_${uid}`, memoryId: id, owner: u.uid, uid, status: 'approved', createdAt: now() });
      onProgress?.(1);
      return m;
    },
    async videoTags(memoryId) {
      readable();
      const u = me();
      return [...videoTags.values()].filter((v) => v.memoryId === memoryId && (v.status === 'approved' || v.owner === u.uid || v.uid === u.uid));
    },
    async setVideoTags(memoryId, uids) {
      if (network.down) throw new SocialError('network');
      const u = me();
      const m = memories.get(memoryId);
      if (!m || m.uid !== u.uid) throw new SocialError('not-signed-in');
      const want = [...new Set(uids)].filter((x) => x !== u.uid && profiles.has(x) && !blockedBy(x, u.uid)).slice(0, VIDEO_TAGS_MAX);
      for (const [k, v] of videoTags) if (v.memoryId === memoryId && !want.includes(v.uid)) videoTags.delete(k);
      for (const uid of want) {
        const id = `${memoryId}_${uid}`;
        if (!videoTags.has(id)) videoTags.set(id, { id, memoryId, owner: u.uid, uid, status: 'approved', createdAt: now() });
      }
    },
    async answerVideoTag(memoryId, yes) {
      if (network.down) throw new SocialError('network');
      const id = `${memoryId}_${me().uid}`;
      const v = videoTags.get(id);
      if (!v) return;
      if (yes) videoTags.set(id, { ...v, status: 'approved' });
      else videoTags.delete(id);
    },
    async taggedMemoriesOf(uid) {
      readable();
      me();
      return [...videoTags.values()]
        .filter((v) => v.uid === uid && v.status === 'approved')
        .map((v) => memories.get(v.memoryId))
        .filter((m): m is NonNullable<typeof m> => !!m)
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    },
    async retagShared(id, tags) {
      if (network.down) throw new SocialError('network');
      const u = me();
      const m = memories.get(id);
      if (!m || m.uid !== u.uid) throw new SocialError('not-signed-in');
      const wasThrowback = !m.festivalId && !!m.past;
      const past = wasThrowback ? (tags.past ?? m.past) : undefined;
      const festivalId = wasThrowback ? undefined : tags.festivalId;
      const next = {
        ...m,
        festivalId,
        night: festivalId ? tags.night : undefined,
        artistId: tags.artistId,
        withArtistIds: tags.artistId && tags.withArtistIds?.length ? tags.withArtistIds.slice(0, 3) : undefined,
        artistName: tags.artistId ? cleanArtistName(tags.artistName) : undefined,
        past,
        show: festivalId || past ? undefined : tags.show,
        track: 'track' in tags ? cleanTrack(tags.track) : m.track,
      };
      memories.set(id, next);
      return next;
    },
    async unshareMemory(id) {
      if (network.down) throw new SocialError('network');
      const u = me();
      const m = memories.get(id);
      if (!m) return;
      if (m.uid !== u.uid) throw new SocialError('not-signed-in');
      memories.delete(id);
      for (const [k, v] of videoTags) if (v.memoryId === id) videoTags.delete(k);
      if (m.past && !m.festivalId) usage.set(u.uid, Math.max(0, (usage.get(u.uid) ?? 0) - 1));
      for (const [k, l] of likes) if (l.memoryId === id) likes.delete(k);
      for (const [k, c] of comments) if (c.memoryId === id) comments.delete(k);
    },
    async memoriesOf(uid) {
      return [...memories.values()].filter((m) => m.uid === uid).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    },
    async festivalMemories(festivalId, max) {
      return [...memories.values()].filter((m) => m.festivalId === festivalId || m.past?.seriesId === festivalId || (!!m.show?.showId && festivalId === `show:${m.show.showId}`)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async artistMemories(artistId, max) {
      return [...memories.values()].filter((m) => m.artistId === artistId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async recentMemories(max) {
      return [...memories.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async sharedMemory(id) {
      if (network.noReads) throw new SocialError('network');
      return memories.get(id) ?? null;
    },
    async follow(uid) {
      const u = me();
      if (uid === u.uid || !profiles.has(uid) || !profiles.has(u.uid)) throw new SocialError('unknown');
      if ((blocks.get(uid) ?? []).includes(u.uid)) throw new SocialError('unknown');
      const k = `${u.uid}>${uid}`;
      if (!follows.has(k)) follows.set(k, { from: u.uid, to: uid, createdAt: `${now()}#${String(++n).padStart(6, '0')}` });
    },
    async claimFounder() {
      const u = me();
      if (network.down) throw new SocialError('network');
      if (!profiles.has(u.uid)) throw new SocialError('unknown');
      const had = founders.get(u.uid);
      if (had) return had;
      // The count only goes up: a founder who leaves never frees their number.
      if (counter.founders >= FOUNDERS_MAX) return null;
      const number = ++counter.founders;
      founders.set(u.uid, number);
      return number;
    },
    async standingOf(uid) {
      const founder = founders.get(uid);
      const flair = flairs.get(uid);
      const level = levels.get(uid);
      return { ...(founder ? { founder } : {}), ...(flair ? { flair } : {}), ...(plus.has(uid) ? { plus: true } : {}), ...(level ? { level } : {}) };
    },
    async throwbackUsage() {
      if (network.down) throw new SocialError('network');
      return usage.get(me().uid) ?? 0;
    },
    async setLevel(level) {
      const u = me();
      if (level === null) levels.delete(u.uid);
      else levels.set(u.uid, level);
    },
    async sendVerification() {
      me();
    },
    async reloadUser() {
      if (!current) return null;
      current = { ...current, emailVerified: !!current.email && verified.has(current.email) };
      return current;
    },
    async contactSupport(input) {
      const u = me();
      if (network.down) throw new SocialError('network');
      const text = input.text.trim().slice(0, SUPPORT_MAX);
      if (!text) throw new SocialError('unknown');
      const p = profiles.get(u.uid);
      const m: SupportMessage = {
        id: `s${++n}`,
        uid: u.uid,
        topic: input.topic,
        text,
        status: 'open',
        createdAt: `${now()}#${String(n).padStart(6, '0')}`,
        ...(p ? { handle: p.handle, name: p.displayName } : {}),
        ...(u.email ? { email: u.email } : {}),
        ...(input.platform ? { platform: input.platform } : {}),
        ...(input.version ? { version: input.version } : {}),
      };
      support.set(m.id, m);
      return m;
    },
    async mySupport(max) {
      const u = me();
      return [...support.values()].filter((m) => m.uid === u.uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async supportInbox(max) {
      needAdmin();
      return [...support.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async answerSupport(id, reply) {
      needAdmin();
      const m = support.get(id);
      if (!m) throw new SocialError('not-found');
      const at = now();
      const was = m.replies ?? (m.reply ? [{ text: m.reply, ...(m.repliedAt ? { at: m.repliedAt } : {}) }] : []);
      support.set(id, { ...m, reply: reply.trim(), repliedAt: at, replies: [...was, { text: reply.trim(), at }].slice(-SUPPORT_REPLIES_MAX), status: 'answered' });
    },
    async setSupportStatus(id, status) {
      needAdmin();
      const m = support.get(id);
      if (m) support.set(id, { ...m, status });
    },
    async reports(max) {
      needAdmin();
      // Like the server: every open one (up to max), and the newest max of all.
      const newest = [...reports].reverse();
      const shown = new Set([...newest.filter((r) => r.status === 'open').slice(0, max), ...newest.slice(0, max)]);
      return newest
        .filter((r) => shown.has(r))
        .map((r) => ({ id: r.id, by: r.by, kind: r.target.kind, targetId: r.target.id, ownerUid: r.target.ownerUid, reason: r.reason, note: r.note ?? '', createdAt: r.createdAt, status: r.status }));
    },
    async resolveReport(id) {
      needAdmin();
      const r = reports.find((x) => x.id === id);
      if (r) r.status = 'resolved';
    },
    async takeDown(kind, id) {
      needAdmin();
      if (kind === 'comment') comments.delete(id);
      else if (kind === 'clipComment') clipComments.delete(id);
      else if (kind === 'chat') {
        chat.delete(id);
        chatChanged(id.split('/')[0]);
      } else memories.delete(id);
    },
    async reportedMessage(target) {
      needAdmin();
      return chat.get(target) ?? null;
    },
    async reportedComment(id) {
      needAdmin();
      return comments.get(id) ?? null;
    },
    async reportedClipComment(id) {
      needAdmin();
      return clipComments.get(id) ?? null;
    },
    async adminCounts(since) {
      needAdmin();
      const all = [...profiles.values()];
      const vids = [...memories.values()];
      return {
        people: all.length,
        peopleThisWeek: all.filter((p) => p.createdAt >= since).length,
        videos: vids.length,
        videosThisWeek: vids.filter((m) => m.createdAt >= since).length,
        follows: follows.size,
        likes: likes.size,
        comments: comments.size,
        crews: crews.size,
        founders: counter.founders,
        supportOpen: [...support.values()].filter((m) => m.status === 'open').length,
        supportTotal: support.size,
        reports: reports.length,
        reportsOpen: reports.filter((r) => r.status === 'open').length,
        accounts: presence.size,
        crewInvites: crewInvites.size,
      };
    },
    async adminActivity(since, max) {
      needAdmin();
      const recent = (list: string[]) => list.filter((t) => t >= since).sort().reverse().slice(0, max);
      return {
        signups: recent([...profiles.values()].map((p) => p.createdAt)),
        videos: [...memories.values()]
          .filter((m) => m.createdAt >= since)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, max)
          .map((m) => ({ createdAt: m.createdAt, uid: m.uid, handle: m.handle, artistId: m.artistId, festivalId: m.festivalId, durationSec: m.durationSec })),
        comments: recent([...comments.values()].map((c) => c.createdAt)),
        likes: recent([...likes.values()].map((l) => l.createdAt)),
        follows: recent([...follows.values()].map((f) => f.createdAt)),
        crews: recent([...crews.values()].map((c) => c.createdAt).filter((t): t is string => typeof t === 'string')),
      };
    },
    async adminPresence(max) {
      needAdmin();
      return [...presence.values()].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)).slice(0, max);
    },
    async addDrop(input, onProgress) {
      const u = me();
      needAdmin();
      if (network.down) throw new SocialError('network');
      const id = `drop-${++n}`;
      const files = input.files.map((f, i) => ({ name: f.name, type: f.type, size: f.size ?? 0, path: `drops/${id}/${i + 1}-${f.name}`, url: `https://files.example/${id}/${i + 1}-${encodeURIComponent(f.name)}` }));
      onProgress?.(1);
      const d: Drop = { id, by: u.uid, note: input.note.trim(), files, status: 'waiting', createdAt: `${now()}#${String(n).padStart(6, '0')}`, ...(input.festivalId ? { festivalId: input.festivalId } : {}), ...(input.festivalName ? { festivalName: input.festivalName } : {}), ...(input.text?.trim() ? { text: input.text.trim() } : {}) };
      drops.set(id, d);
      return d;
    },
    async drops(max) {
      needAdmin();
      return [...drops.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async setDropStatus(id, status) {
      needAdmin();
      const d = drops.get(id);
      if (d) drops.set(id, { ...d, status });
    },
    async deleteDrop(id) {
      needAdmin();
      drops.delete(id);
    },
    async sendSetTimes(festivalId, tip) {
      const u = me();
      if (network.down) throw new SocialError('network');
      const id = `${u.uid}_${festivalId}`;
      if (setTimes.get(id)?.status === 'new') throw new SocialError('already-sent');
      const text = tip.text?.trim();
      setTimes.set(id, { id, uid: u.uid, festivalId, status: 'new', at: `${now()}#${String(++n).padStart(6, '0')}`, ...(text ? { text } : {}), ...(tip.photo ? { photo: tip.photo } : {}) });
    },
    async mySetTimes() {
      const u = me();
      if (network.down) throw new SocialError('network');
      return [...setTimes.values()].filter((t) => t.uid === u.uid);
    },
    async setTimesTips(max) {
      needAdmin();
      return [...setTimes.values()].filter((t) => t.status === 'new').sort((a, b) => b.at.localeCompare(a.at)).slice(0, max);
    },
    async markSetTimesLive(id) {
      needAdmin();
      const t = setTimes.get(id);
      if (!t) return;
      const { photo: _gone, ...rest } = t;
      setTimes.set(id, { ...rest, status: 'live' });
    },
    async declineSetTimes(id) {
      needAdmin();
      setTimes.delete(id);
    },
    async livePatches() {
      if (network.down) throw new SocialError('network');
      return [...patches.values()].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    },
    async publishPatch(input) {
      const u = me();
      needAdmin();
      const p: LivePatch = { id: `patch-${++n}`, title: input.title, festivalId: input.festivalId, file: input.file, by: u.uid, publishedAt: `${now()}#${String(n).padStart(6, '0')}`, ...(input.dropId ? { dropId: input.dropId } : {}) };
      patches.set(p.id, p);
      return p;
    },
    async unpublishPatch(id) {
      needAdmin();
      patches.delete(id);
    },
    async appSettings() {
      if (network.down) throw new SocialError('network');
      return { ...appSettings };
    },
    async setAppSettings(next) {
      me();
      needAdmin();
      appSettings = { careGuide: next.careGuide === true };
    },
    async setPlus(uid, on) {
      needAdmin();
      if (!on) {
        plus.delete(uid);
        plusUntil.delete(uid);
      } else {
        plus.add(uid);
        if (on.until) plusUntil.set(uid, on.until);
        else plusUntil.delete(uid);
      }
    },
    async setFlair(uid, flair) {
      needAdmin();
      if (flair) flairs.set(uid, { kind: flair.kind, caption: flair.caption.trim() });
      else flairs.delete(uid);
    },
    async privileged() {
      const uids = new Set([...plus, ...flairs.keys()]);
      return [...uids].map((uid) => ({ uid, ...(plus.has(uid) ? { plus: plusUntil.has(uid) ? { until: plusUntil.get(uid) } : {} } : {}), ...(flairs.has(uid) ? { flair: flairs.get(uid) } : {}) }));
    },
    async markActive(input) {
      const u = me();
      if (network.down) throw new SocialError('network');
      presence.set(u.uid, { uid: u.uid, ...nextPresence(presence.get(u.uid), input) });
    },
    async adminFestivals(ids, ticketsSince) {
      needAdmin();
      return Object.fromEntries(
        ids.map((id) => [
          id,
          {
            going: [...profiles.values()].filter((p) => p.festivals.includes(id)).length,
            videos: [...memories.values()].filter((m) => m.festivalId === id).length,
            ...(ticketsSince ? { tickets: [...ticketTaps].filter(([k]) => k.startsWith(`${id}_`) && k.slice(id.length + 1) >= ticketsSince).reduce((n, [, v]) => n + v, 0) } : {}),
          },
        ]),
      );
    },
    async countTicketTap(festivalId) {
      if (!current || !isTapFestivalId(festivalId)) return;
      if (network.down) throw new SocialError('network');
      const k = `${festivalId}_${utcDay(new Date())}`;
      ticketTaps.set(k, (ticketTaps.get(k) ?? 0) + 1);
    },
    async setFriendCode(code) {
      if (network.down) throw new SocialError('network');
      friendCodes.set(me().uid, code);
    },
    async addFriend(uid, code) {
      const u = me();
      if (network.down) throw new SocialError('network');
      if (uid === u.uid || !profiles.has(uid) || !profiles.has(u.uid)) throw new SocialError('unknown');
      if ((blocks.get(uid) ?? []).includes(u.uid)) throw new SocialError('unknown');
      if (friendCodes.get(uid) !== code) throw new SocialError('unknown');
      for (const [from, to] of [
        [u.uid, uid],
        [uid, u.uid],
      ]) {
        const k = `${from}>${to}`;
        if (!follows.has(k)) follows.set(k, { from, to, createdAt: `${now()}#${String(++n).padStart(6, '0')}` });
      }
    },
    async unfollow(uid) {
      follows.delete(`${me().uid}>${uid}`);
    },
    async removeFollower(uid) {
      follows.delete(`${uid}>${me().uid}`);
    },
    async following(uid, max) {
      readable();
      return [...follows.values()].filter((f) => f.from === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max).map((f) => f.to);
    },
    async followers(uid, max) {
      return [...follows.values()].filter((f) => f.to === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max).map((f) => f.from);
    },
    async followCounts(uid) {
      const all = [...follows.values()];
      return { followers: all.filter((f) => f.to === uid).length, following: all.filter((f) => f.from === uid).length };
    },
    async memoriesBy(uids, max) {
      const who = new Set(uids);
      return [...memories.values()].filter((m) => who.has(m.uid)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async like(memoryId, owner) {
      const u = me();
      const m = memories.get(memoryId);
      if (!m || m.uid !== owner || owner === u.uid) throw new SocialError('unknown');
      if ((blocks.get(owner) ?? []).includes(u.uid)) throw new SocialError('unknown');
      const k = `${memoryId}_${u.uid}`;
      if (!likes.has(k)) likes.set(k, { memoryId, owner, uid: u.uid, createdAt: `${now()}#${String(++n).padStart(6, '0')}` });
    },
    async unlike(memoryId) {
      likes.delete(`${memoryId}_${me().uid}`);
    },
    async likeCount(memoryId) {
      return [...likes.values()].filter((l) => l.memoryId === memoryId).length;
    },
    async likedBy(memoryId, max) {
      return [...likes.values()].filter((l) => l.memoryId === memoryId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max).map((l) => l.uid);
    },
    async comment(memoryId, owner, raw) {
      const u = me();
      const p = profiles.get(u.uid);
      if (!p) throw new SocialError('no-profile');
      const m = memories.get(memoryId);
      if (!m || m.uid !== owner || commentProblem(raw)) throw new SocialError('unknown');
      if ((blocks.get(owner) ?? []).includes(u.uid)) throw new SocialError('unknown');
      const c: Comment = { id: `comment-${++n}`, memoryId, owner, uid: u.uid, handle: p.handle, text: cleanComment(raw), createdAt: `${now()}#${String(n).padStart(6, '0')}` };
      comments.set(c.id, c);
      return c;
    },
    async comments(memoryId, max) {
      return [...comments.values()].filter((c) => c.memoryId === memoryId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, max);
    },
    async commentCount(memoryId) {
      return [...comments.values()].filter((c) => c.memoryId === memoryId).length;
    },
    async deleteComment(id) {
      const u = me();
      const c = comments.get(id);
      if (!c) return;
      if (c.uid !== u.uid && c.owner !== u.uid) throw new SocialError('not-signed-in');
      comments.delete(id);
    },
    async clipComment(clipId, raw) {
      const u = me();
      if (network.down) throw new SocialError('network');
      const p = profiles.get(u.uid);
      if (!p) throw new SocialError('no-profile');
      if (!validClipId(clipId) || commentProblem(raw)) throw new SocialError('unknown');
      const c: ClipComment = { id: `clip-comment-${++n}`, clipId, uid: u.uid, handle: p.handle, text: cleanComment(raw), createdAt: `${now()}#${String(n).padStart(6, '0')}` };
      clipComments.set(c.id, c);
      return c;
    },
    async clipComments(clipId, max, after) {
      me();
      readable();
      const all = [...clipComments.values()].filter((c) => c.clipId === clipId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const from = after ? all.findIndex((c) => c.createdAt > after.createdAt) : 0;
      return from < 0 ? [] : all.slice(from, from + max);
    },
    async clipCommentCount(clipId) {
      me();
      readable();
      return [...clipComments.values()].filter((c) => c.clipId === clipId).length;
    },
    async deleteClipComment(id) {
      const u = me();
      const c = clipComments.get(id);
      if (!c) return;
      if (c.uid !== u.uid) throw new SocialError('not-signed-in');
      clipComments.delete(id);
    },
    async activity(max) {
      const u = me();
      // Like the real one: a tag from before tags showed straight away shows now.
      for (const [k, v] of videoTags) if (v.uid === u.uid && v.status === 'pending') videoTags.set(k, { ...v, status: 'approved' });
      const items: Activity[] = [
        ...[...comments.values()]
          .filter((c) => c.owner === u.uid && c.uid !== u.uid)
          .map((c): Activity => ({ kind: 'comment', id: c.id, from: c.uid, memoryId: c.memoryId, text: c.text, createdAt: c.createdAt })),
        ...[...follows.values()].filter((f) => f.to === u.uid).map((f): Activity => ({ kind: 'follow', id: `${f.from}_${f.to}`, from: f.from, createdAt: f.createdAt })),
        ...[...likes.values()].filter((l) => l.owner === u.uid).map((l): Activity => ({ kind: 'like', id: `${l.memoryId}_${l.uid}`, from: l.uid, memoryId: l.memoryId, createdAt: l.createdAt })),
        ...[...videoTags.values()].filter((v) => v.uid === u.uid).map((v): Activity => ({ kind: 'tag', id: v.id, from: v.owner, memoryId: v.memoryId, createdAt: v.createdAt })),
        ...[...kandi.values()].filter((k) => k.to === u.uid).map((k): Activity => ({ kind: 'kandi', id: k.id, from: k.from, word: k.word, createdAt: k.createdAt })),
        ...[...(glows.get(u.uid) ?? new Map<string, string>())].map(([from, at]): Activity => ({ kind: 'glow', id: `${u.uid}_${from}`, from, createdAt: at })),
      ];
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async createCrew(festivalId, raw) {
      const u = me();
      if (!profiles.has(u.uid)) throw new SocialError('no-profile');
      if (crewNameProblem(raw)) throw new SocialError('unknown');
      const c: Crew = { id: `crew-${++n}`, festivalId, name: cleanCrewName(raw), owner: u.uid, members: [u.uid], createdAt: now() };
      crews.set(c.id, c);
      agreed.add(`${c.id}/${u.uid}`);
      return c;
    },
    async crew(id) {
      readable();
      me();
      return crews.get(id) ?? null;
    },
    async myCrews() {
      readable();
      const u = me();
      return [...crews.values()].filter((c) => c.members.includes(u.uid));
    },
    async joinCrew(id, code) {
      const u = me();
      const c = crewOf(id);
      if (c.members.includes(u.uid)) return c;
      if (!profiles.has(u.uid)) throw new SocialError('no-profile');
      // Invite only: an invite in the app, or the link's current code.
      if (!crewInvites.has(`${id}_${u.uid}`) && (!code || crewCodes.get(id) !== code)) throw new SocialError('not-invited');
      if ((blocks.get(c.owner) ?? []).includes(u.uid)) throw new SocialError('unknown');
      if (c.members.length >= CREW_MAX) throw new SocialError('crew-full');
      const next = { ...c, members: [...c.members, u.uid] };
      crews.set(id, next);
      agreed.add(`${id}/${u.uid}`);
      crewInvites.delete(`${id}_${u.uid}`);
      return next;
    },
    async crewInviteCode(crewId) {
      memberOf(crewId);
      if (!crewCodes.has(crewId)) crewCodes.set(crewId, `code${crewId.replace(/[^A-Za-z0-9]/g, '')}${++n}abcdefgh`);
      return crewCodes.get(crewId)!;
    },
    async newCrewInviteCode(crewId) {
      const c = memberOf(crewId);
      if (c.owner !== me().uid) throw new SocialError('unknown');
      crewCodes.set(crewId, `code${crewId.replace(/[^A-Za-z0-9]/g, '')}${++n}ijklmnop`);
      return crewCodes.get(crewId)!;
    },
    async inviteToCrew(crewId, uid) {
      const u = me();
      const c = crews.get(crewId);
      if (!c || !c.members.includes(u.uid)) throw new SocialError('not-found');
      if (uid === u.uid || c.members.includes(uid)) return;
      if (!profiles.has(uid) || (blocks.get(uid) ?? []).includes(u.uid)) throw new SocialError('unknown');
      crewInvites.set(`${crewId}_${uid}`, { id: `${crewId}_${uid}`, crewId, festivalId: c.festivalId, crewName: c.name, from: u.uid, to: uid, at: now() });
    },
    async crewInvites(max) {
      readable();
      const u = me();
      return [...crewInvites.values()].filter((i) => i.to === u.uid).sort((a, b) => b.at.localeCompare(a.at)).slice(0, max);
    },
    async sentCrewInvites(crewId) {
      const u = me();
      return [...crewInvites.values()].filter((i) => i.crewId === crewId && i.from === u.uid).map((i) => i.to);
    },
    async declineCrewInvite(crewId) {
      crewInvites.delete(`${crewId}_${me().uid}`);
    },
    async leaveCrew(id) {
      leave(id, me().uid);
    },
    async endCrew(id) {
      const c = crews.get(id);
      if (!c) return;
      if (c.owner !== me().uid) throw new SocialError('unknown');
      crews.delete(id);
      dropPicks(id);
      dropUpdates(id);
      dropChat(id);
      crewCodes.delete(id);
      meets.delete(id);
    },
    async renameCrew(id, raw) {
      const c = memberOf(id);
      if (c.owner !== me().uid || crewNameProblem(raw)) throw new SocialError('unknown');
      const next = { ...c, name: cleanCrewName(raw) };
      crews.set(id, next);
      return next;
    },
    async removeFromCrew(id, uid) {
      const c = memberOf(id);
      if (c.owner !== me().uid || uid === c.owner) throw new SocialError('unknown');
      dropPicks(id, uid);
      dropUpdates(id, uid);
      dropChat(id, uid);
      const next = { ...c, members: c.members.filter((m) => m !== uid) };
      crews.set(id, next);
      // A new invite link: the old one stops working.
      if (crewCodes.has(id)) crewCodes.set(id, `code${id.replace(/[^A-Za-z0-9]/g, '')}${++n}renewed1`);
      agreed.delete(`${id}/${uid}`);
      return next;
    },
    async setCrewPicks(id, artists) {
      memberOf(id);
      const uid = me().uid;
      picks.set(`${id}/${uid}`, { uid, artists: [...new Set(artists)].slice(0, CREW_PICKS_MAX), updatedAt: now() });
    },
    async crewPicks(id) {
      readable();
      memberOf(id);
      return [...picks.entries()].filter(([k]) => k.startsWith(`${id}/`)).map(([, p]) => p);
    },
    async postCrewUpdate(crewId, input, onProgress) {
      if (network.down) throw new SocialError('network');
      memberOf(crewId);
      const key = `${crewId}/${input.id}`;
      const existing = updates.get(key);
      if (existing) return existing;
      const at = Date.parse(input.at);
      if (!Number.isFinite(at) || at > Date.now() + 5 * 60_000) throw new SocialError('unknown');
      if (input.kind === 'video' && !input.videoUrl && !input.videoUri) throw new SocialError('unknown');
      if (input.kind === 'reply' && (!input.replyTo || !input.note?.trim() || !updates.has(`${crewId}/${input.replyTo}`))) throw new SocialError('unknown');
      const uploaded = input.kind === 'video' && !input.videoUrl;
      const u: CrewUpdate = {
        id: input.id,
        crewId,
        uid: me().uid,
        kind: input.kind,
        at: new Date(at).toISOString(),
        sentAt: now(),
        festivalId: input.festivalId,
        ...(input.artistId ? { artistId: input.artistId } : {}),
        ...(input.stage ? { stage: input.stage.slice(0, CREW_STAGE_MAX) } : {}),
        ...(input.note ? { note: input.note.slice(0, CREW_NOTE_MAX) } : {}),
        ...(input.kind === 'reply' ? { replyTo: input.replyTo } : {}),
        ...(input.kind === 'checkin' && input.lost ? { lost: true } : {}),
        ...(input.kind === 'checkin' && input.care ? { care: input.care } : {}),
        ...(input.kind === 'photo' ? { thumbUrl: input.thumbUrl ?? `https://files.example/crews/${crewId}/${input.id}.jpg` } : {}),
        ...(input.kind === 'video' ? { videoUrl: input.videoUrl ?? `https://files.example/crews/${crewId}/${input.id}.mp4` } : {}),
        ...(input.thumbUrl || (uploaded && input.thumbUri) ? { thumbUrl: input.thumbUrl ?? `https://files.example/crews/${crewId}/${input.id}.jpg` } : {}),
        ...(input.sharedId ? { sharedId: input.sharedId } : {}),
        ...(input.durationSec ? { durationSec: input.durationSec } : {}),
        ...(input.width && input.height ? { width: input.width, height: input.height } : {}),
      };
      updates.set(key, u);
      if (uploaded) crewFiles.add(`${crewId}/${u.uid}/${input.id}`);
      onProgress?.(1);
      return u;
    },
    async crewUpdates(crewId, sinceMs, max) {
      readable();
      if (network.down) throw new SocialError('network');
      memberOf(crewId);
      return [...updates.values()]
        .filter((u) => u.crewId === crewId && Date.parse(u.at) >= sinceMs)
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, max);
    },
    async sendCrewMessages(crewId, inputs) {
      if (network.down) throw new SocialError('network');
      inRoom(crewId, true);
      const done: string[] = [];
      for (const input of inputs) {
        const key = `${crewId}/${input.id}`;
        const text = input.text.trim().slice(0, CHAT_MAX);
        if (!chat.has(key) && text) chat.set(key, { id: input.id, crewId, uid: me().uid, text, at: input.at, sentAt: now() });
        if (chat.has(key)) done.push(input.id);
      }
      chatChanged(crewId);
      return done;
    },
    watchCrewChat(crewId, max, listener, onError) {
      try {
        inRoom(crewId);
      } catch (e) {
        onError?.(e as SocialError);
        return () => {};
      }
      const w = { crewId, max, listener };
      chatWatchers.add(w);
      // Nothing read yet with no signal: Firestore stays quiet until it has something.
      if (!network.noReads) listener(chatOf(crewId, max));
      return () => {
        chatWatchers.delete(w);
      };
    },
    async registerPush(token, lang) {
      pushes.set(me().uid, { token, lang });
    },
    async unregisterPush(token) {
      const uid = me().uid;
      if (pushes.get(uid)?.token === token) pushes.delete(uid);
    },
    async markCrewChatRead(crewId) {
      if (network.down) throw new SocialError('network');
      inRoom(crewId);
      reads.set(`${crewId}/${me().uid}`, now());
      readsChanged(crewId);
    },
    watchCrewReads(crewId, listener, onError) {
      try {
        inRoom(crewId);
      } catch (e) {
        onError?.(e as SocialError);
        return () => {};
      }
      const w = { crewId, listener };
      readWatchers.add(w);
      listener(readsOf(crewId));
      return () => {
        readWatchers.delete(w);
      };
    },
    async deleteCrewMessage(crewId, id) {
      const m = chat.get(`${crewId}/${id}`);
      if (!m) return;
      const owner = isDirectRoom(crewId) ? undefined : crewOf(crewId).owner;
      if (m.uid !== me().uid && owner !== me().uid) throw new SocialError('unknown');
      chat.delete(`${crewId}/${id}`);
      chatChanged(crewId);
    },
    async openDirectChat(uid, org) {
      const u = me();
      if (network.down) throw new SocialError('network');
      const members = [u.uid, uid].sort() as [string, string];
      const id = directRoom(u.uid, uid);
      const made = dms.get(id);
      const allowed = made ? true : mutual(u.uid, uid) || orgChat({ members, org });
      if (uid === u.uid || !allowed || blockedBy(uid, u.uid) || blockedBy(u.uid, uid)) throw new SocialError('unknown');
      if (!made) {
        dms.set(id, { id, members, ...(org ? { org } : {}) });
        for (const w of dmWatchers) w.listener(dmsOf(w.uid));
      }
      return id;
    },
    watchDirectChats(listener) {
      const w = { uid: me().uid, listener };
      dmWatchers.add(w);
      listener(dmsOf(w.uid));
      return () => {
        dmWatchers.delete(w);
      };
    },
    async meetSpot(crewId) {
      readable();
      if (network.down) throw new SocialError('network');
      memberOf(crewId);
      return meets.get(crewId) ?? null;
    },
    async setMeetSpot(crewId, raw) {
      if (network.down) throw new SocialError('network');
      memberOf(crewId);
      const text = raw.replace(/\s+/g, ' ').trim().slice(0, MEET_SPOT_MAX);
      if (!text) {
        meets.delete(crewId);
        return null;
      }
      const spot = { text, by: me().uid, at: now() };
      meets.set(crewId, spot);
      return spot;
    },
    async forgetCrewVideos(crewId, ids) {
      if (network.down) throw new SocialError('network');
      const u = me();
      for (const id of ids) crewFiles.delete(`${crewId}/${u.uid}/${id}`);
    },
    async deleteCrewUpdate(crewId, id) {
      const u = updates.get(`${crewId}/${id}`);
      if (!u) return;
      if (u.uid !== me().uid) throw new SocialError('not-signed-in');
      updates.delete(`${crewId}/${id}`);
    },
    async giveSprout(input) {
      if (network.down) throw new SocialError('network');
      const u = me();
      if (!profiles.has(u.uid)) throw new SocialError('no-profile');
      // Like the rules: only the developer's handle gives a theme with a sprout, and only a gift theme.
      if (input.theme && (!canGiveThemes(profiles.get(u.uid)!.handle) || !isGiftTheme(input.theme))) throw new SocialError('unknown');
      const there = sprouts.get(input.id);
      if (there) {
        if (there.from === u.uid) return;
        throw new SocialError('unknown');
      }
      // Like the rules: given on (`via`) from one given to you, of this kind (or plain) and artist, not given on already;
      // a hat only from its keepers or given on.
      const kind = isKind(input.kind) ? kindOf(input.kind) : undefined;
      if (input.via) {
        const via = sprouts.get(input.via);
        if (!via || via.to !== u.uid || (via.kind !== input.kind && via.kind !== 'seedling') || (via.artistId ?? '') !== (input.artistId ?? '') || via.passedOn) throw new SocialError('unknown');
        sprouts.set(via.id, { ...via, passedOn: input.id });
      } else if (kind?.seed && !keptKinds(u.uid).includes(kind.id)) throw new SocialError('unknown');
      sprouts.set(input.id, { id: input.id, kind: input.kind, from: u.uid, createdAt: now(), ...(input.via ? { via: input.via } : {}), ...(input.note ? { note: input.note } : {}), ...(input.festivalId ? { festivalId: input.festivalId } : {}), ...(input.artistId && input.artistName ? { artistId: input.artistId, artistName: input.artistName } : {}), ...(input.theme ? { theme: input.theme } : {}) });
    },
    async claimSprout(id) {
      if (network.down) throw new SocialError('network');
      const u = me();
      const s = sprouts.get(id);
      if (!s) throw new SocialError('not-found');
      if (s.to === u.uid || s.from === u.uid) return s;
      if (s.to) throw new SocialError('sprout-taken');
      if (Date.parse(now()) - Date.parse(s.createdAt) > 30 * 86_400_000 || (blocks.get(s.from) ?? []).includes(u.uid)) throw new SocialError('sprout-gone');
      const claimed = { ...s, to: u.uid, claimedAt: now() };
      sprouts.set(id, claimed);
      return claimed;
    },
    async sprout(id) {
      if (network.down) throw new SocialError('network');
      return sprouts.get(id) ?? null;
    },
    async sproutsGiven(max) {
      const u = me();
      return [...sprouts.values()].filter((s) => s.from === u.uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async publishGarden(residents, kandiList, decor) {
      if (network.down) throw new SocialError('network');
      const u = me();
      if (residents) gardens.set(u.uid, { residents: cleanPublicGarden(residents), kandi: cleanPublicKandi(kandiList ?? []), decor: cleanDecor(decor ?? []) });
      else gardens.delete(u.uid);
    },
    async gardenOf(uid) {
      if (network.down) throw new SocialError('network');
      me();
      return gardens.get(uid) ?? null;
    },
    async glowGarden(uid, on) {
      if (network.down) throw new SocialError('network');
      const u = me();
      if (uid === u.uid || !profiles.has(u.uid) || !gardens.has(uid) || (blocks.get(uid) ?? []).includes(u.uid)) throw new SocialError('unknown');
      const mine = glows.get(uid) ?? new Map<string, string>();
      if (on && !mine.has(u.uid)) mine.set(u.uid, new Date().toISOString());
      if (!on) mine.delete(u.uid);
      glows.set(uid, mine);
    },
    async glowedGarden(uid) {
      if (network.down) throw new SocialError('network');
      const u = me();
      return !!glows.get(uid)?.has(u.uid);
    },
    async gardenGlows() {
      if (network.down) throw new SocialError('network');
      const u = me();
      return [...(glows.get(u.uid) ?? new Map<string, string>())].map(([from, at]) => ({ from, at })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100);
    },
    async saveGardenBackup(data) {
      if (network.down) throw new SocialError('network');
      const u = me();
      if (typeof data !== 'string' || data.length > GARDEN_BACKUP_MAX) throw new SocialError('unknown');
      gardenBackups.set(u.uid, data);
    },
    async gardenBackup() {
      if (network.down) throw new SocialError('network');
      const u = me();
      return gardenBackups.get(u.uid) ?? null;
    },
    async giveKandi(input) {
      if (network.down) throw new SocialError('network');
      const u = me();
      const word = cleanWord(input.word);
      if (!profiles.has(u.uid)) throw new SocialError('no-profile');
      if (!word || !isPattern(input.beads) || input.to === u.uid || !profiles.has(input.to) || (blocks.get(input.to) ?? []).includes(u.uid)) throw new SocialError('unknown');
      const note = cleanNote(input.note);
      const k: Kandi = { id: `k${kandi.size + 1}`, from: u.uid, to: input.to, word, beads: input.beads, ...(note ? { note } : {}), ...(isCharm(input.charm) ? { charm: input.charm } : {}), createdAt: now() };
      kandi.set(k.id, k);
      return k;
    },
    async leaveOpenKandi(input) {
      if (network.down) throw new SocialError('network');
      const u = me();
      if (!profiles.has(u.uid)) throw new SocialError('no-profile');
      const word = cleanWord(input.word);
      if (!KANDI_ID.test(input.id) || !word || !isPattern(input.beads)) throw new SocialError('unknown');
      const there = kandi.get(input.id);
      if (there) {
        if (there.from === u.uid) return;
        throw new SocialError('unknown');
      }
      const note = cleanNote(input.note);
      kandi.set(input.id, { id: input.id, from: u.uid, to: '', word, beads: input.beads, ...(note ? { note } : {}), ...(isCharm(input.charm) ? { charm: input.charm } : {}), createdAt: now() });
    },
    async kandiById(id) {
      if (network.down) throw new SocialError('network');
      const u = me();
      const k = kandi.get(id);
      // Like the rules: anyone signed in reads kandi nobody has picked up; otherwise only the two of them.
      if (!k || (k.to && k.to !== u.uid && k.from !== u.uid)) return null;
      return k;
    },
    async claimKandi(id) {
      if (network.down) throw new SocialError('network');
      const u = me();
      if (!profiles.has(u.uid)) throw new SocialError('no-profile');
      const k = kandi.get(id);
      if (!k) throw new SocialError('not-found');
      if (k.to === u.uid) return k;
      if (k.to) throw new SocialError('kandi-taken');
      if (k.from === u.uid || (blocks.get(k.from) ?? []).includes(u.uid)) throw new SocialError('unknown');
      const got = { ...k, to: u.uid, createdAt: now() };
      kandi.set(id, got);
      return got;
    },
    async myKandi(max) {
      if (network.down) throw new SocialError('network');
      const u = me();
      return [...kandi.values()].filter((k) => k.to === u.uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async removeKandi(id) {
      if (network.down) throw new SocialError('network');
      const u = me();
      const k = kandi.get(id);
      if (k && (k.to === u.uid || k.from === u.uid)) kandi.delete(id);
    },
    async grantTheme(sproutId, theme) {
      if (network.down) throw new SocialError('network');
      const u = me();
      const s = sprouts.get(sproutId);
      if (!s || s.to !== u.uid || s.theme !== theme) throw new SocialError('unknown');
      themeGrants.add(`${u.uid}_${theme}`);
    },
    async sproutsReceived(max) {
      const u = me();
      return [...sprouts.values()].filter((s) => s.to === u.uid).sort((a, b) => (b.claimedAt ?? '').localeCompare(a.claimedAt ?? '')).slice(0, max);
    },
    async sticker(code) {
      if (network.down) throw new SocialError('network');
      return stickers.get(code) ?? null;
    },
    async hunt(id) {
      if (network.down) throw new SocialError('network');
      return hunts.get(id) ?? null;
    },
    async recordFind(code, at) {
      const u = me();
      if (network.down) throw new SocialError('network');
      if (finds.has(`${u.uid}_${code}`)) return;
      const s = stickers.get(code);
      if (!s || (s.takenDownAt !== undefined && (at > s.takenDownAt || Date.parse(now()) > s.takenDownAt + 3 * 86_400_000))) throw new SocialError('not-found');
      if (s.until !== undefined && (at > s.until || Date.parse(now()) > s.until + 3 * 86_400_000)) throw new SocialError('sticker-ended');
      finds.set(`${u.uid}_${code}`, at);
      // A first find of an organizer's sticker adds one to its count.
      if (s.orgId) {
        const k = `${s.orgId}_${utcDay(new Date())}_f_${code}`;
        orgViews.set(k, (orgViews.get(k) ?? 0) + 1);
      }
    },
    async addSticker(input) {
      me();
      if (input.orgId) needOrg(input.orgId);
      else needAdmin();
      if (input.huntId && input.orgId && hunts.get(input.huntId)?.orgId !== input.orgId) throw new SocialError('unknown');
      if (network.down) throw new SocialError('network');
      let slot: number | undefined;
      if (input.huntId) {
        const h = hunts.get(input.huntId);
        if (!h) throw new SocialError('not-found');
        slot = h.items.length;
        hunts.set(h.id, { ...h, items: [...h.items, { creature: input.creature, name: input.name }] });
      }
      const s: Sticker = { code: input.code, name: input.name, creature: input.creature, createdAt: Date.now() + ++n, ...(input.huntId ? { huntId: input.huntId, slot } : {}), ...(input.until !== undefined ? { until: input.until } : {}), ...(input.festivalId ? { festivalId: input.festivalId } : {}), ...(input.orgId ? { orgId: input.orgId } : {}), ...(input.gift ? { gift: true as const } : {}), ...(input.note ? { note: input.note } : {}) };
      stickers.set(input.code, s);
      return s;
    },
    async stickers(max) {
      needAdmin();
      return [...stickers.values()].filter((s) => s.takenDownAt === undefined).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, max);
    },
    async deleteSticker(code) {
      const s = stickers.get(code);
      if (s?.orgId) needOrg(s.orgId);
      else needAdmin();
      const h = s?.huntId ? hunts.get(s.huntId) : undefined;
      if (h && s?.slot !== undefined && h.items[s.slot]) hunts.set(h.id, { ...h, items: h.items.map((it, i) => (i === s.slot ? { ...it, gone: true as const } : it)) });
      // Kept, marked taken down: scans from before still count.
      if (s) stickers.set(code, { ...s, takenDownAt: Date.parse(now()) });
    },
    async myFinds(max) {
      const u = me();
      if (network.down) throw new SocialError('network');
      return [...finds].filter(([k]) => k.startsWith(`${u.uid}_`)).slice(0, max).map(([k, at]) => ({ code: k.slice(u.uid.length + 1), at }));
    },
    async addHunt(input) {
      if (input.orgId) needOrg(input.orgId);
      else needAdmin();
      if (network.down) throw new SocialError('network');
      const h: Hunt = { id: input.id, name: input.name, items: [], ...(input.until !== undefined ? { until: input.until } : {}), ...(input.festivalId ? { festivalId: input.festivalId } : {}), ...(input.orgId ? { orgId: input.orgId } : {}) };
      hunts.set(input.id, h);
      return h;
    },
    async hunts(max) {
      needAdmin();
      return [...hunts.values()].reverse().slice(0, max);
    },
    async deleteHunt(id) {
      needAdmin();
      hunts.delete(id);
    },
    async stickerFinds(code) {
      needAdmin();
      return [...finds.keys()].filter((k) => k.endsWith(`_${code}`)).length;
    },
    async orgs() {
      if (network.down) throw new SocialError('network');
      return [...orgs.values()];
    },
    async myOrg() {
      // Reading your own membership needs no confirmed email (writing does).
      return current?.email ? (orgMembers.get(current.email.toLowerCase()) ?? null) : null;
    },
    async saveOrg(org) {
      me();
      if (network.down) throw new SocialError('network');
      const had = orgs.get(org.id);
      if (!had) needAdmin();
      else needOrg(org.id);
      // As stored and read back: checked, and promotions only ever HQ's.
      const handle = had ? had.handle : org.handle;
      orgs.set(org.id, { ...cleanOrg(org.id, orgToDoc(org))!, promoted: had?.promoted ?? {}, uids: had?.uids ?? [], ...(handle ? { handle } : {}), updatedAt: now() });
    },
    async sendOrgRequest(input) {
      const u = me();
      needOrg(input.orgId);
      if (network.down) throw new SocialError('network');
      const r: OrgRequest = { id: `q${++n}`, orgId: input.orgId, by: u.uid, kind: input.kind, text: input.text.trim(), status: 'open', createdAt: `${now()}#${String(n).padStart(6, '0')}`, ...(input.eventId ? { eventId: input.eventId } : {}), ...(input.days ? { days: input.days } : {}), ...(input.about ? { about: input.about } : {}) };
      orgRequests.set(r.id, r);
      return r;
    },
    async orgRequests(orgId, max) {
      if (orgId) needOrg(orgId);
      else needAdmin();
      return [...orgRequests.values()].filter((r) => !orgId || r.orgId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async answerOrgRequest(id, status, reply) {
      needAdmin();
      const r = orgRequests.get(id);
      if (!r) throw new SocialError('not-found');
      const { reply: _old, ...rest } = r;
      orgRequests.set(id, { ...rest, status, answeredAt: now(), ...(reply?.trim() ? { reply: reply.trim() } : {}) });
    },
    async setPromotion(orgId, eventId, until) {
      needAdmin();
      const o = orgs.get(orgId);
      if (!o) throw new SocialError('not-found');
      const promoted = { ...o.promoted };
      if (until) promoted[eventId] = until;
      else delete promoted[eventId];
      orgs.set(orgId, { ...o, promoted });
    },
    async setOrgAccount(orgId, uid, on) {
      const u = me();
      if (!admin() && (uid !== u.uid || orgOfMe() !== orgId)) throw new SocialError('unknown');
      const o = orgs.get(orgId);
      if (!o) throw new SocialError('not-found');
      orgs.set(orgId, { ...o, uids: on ? [...new Set([...o.uids, uid])] : o.uids.filter((x) => x !== uid) });
    },
    async setOrgImage(orgId, kind, uri) {
      needOrg(orgId);
      const o = orgs.get(orgId);
      if (!o) throw new SocialError('not-found');
      const field = kind === 'logo' ? 'logoUrl' : 'iconUrl';
      const { [field]: _old, ...rest } = o;
      const url = uri ? `https://files.example/orgs/${orgId}/${kind}-${++n}.png` : undefined;
      orgs.set(orgId, { ...rest, ...(url ? { [field]: url } : {}) } as Org);
      return url;
    },
    async setOrgHandle(orgId, handle) {
      needAdmin();
      const o = orgs.get(orgId);
      if (!o) throw new SocialError('not-found');
      const { handle: _old, ...rest } = o;
      orgs.set(orgId, { ...rest, ...(handle ? { handle } : {}) });
    },
    async orgMembers(orgId) {
      needAdmin();
      return [...orgMembers].filter(([, o]) => o === orgId).map(([e]) => e);
    },
    async setOrgMember(email, orgId) {
      needAdmin();
      if (orgId) orgMembers.set(email.trim().toLowerCase(), orgId);
      else orgMembers.delete(email.trim().toLowerCase());
    },
    async countOrgView(orgId, key) {
      if (!current || !isCounter(key) || !orgs.has(orgId)) return;
      const k = `${orgId}_${utcDay(new Date())}_${key}`;
      orgViews.set(k, (orgViews.get(k) ?? 0) + 1);
    },
    async orgViews(orgId, since) {
      needOrg(orgId);
      const byDay = new Map<string, Record<string, number>>();
      for (const [k, v] of orgViews) {
        if (!k.startsWith(`${orgId}_`)) continue;
        const [day, key] = [k.slice(orgId.length + 1, orgId.length + 11), k.slice(orgId.length + 12)];
        if (day >= since) byDay.set(day, { ...byDay.get(day), [key]: v });
      }
      return [...byDay].map(([day, counts]) => ({ day, counts })).sort((a, b) => a.day.localeCompare(b.day));
    },
    async orgStickers(orgId, max) {
      needOrg(orgId);
      return [...stickers.values()].filter((s) => s.orgId === orgId && s.takenDownAt === undefined).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, max);
    },
    async orgHunts(orgId, max) {
      needOrg(orgId);
      return [...hunts.values()].filter((h) => h.orgId === orgId).reverse().slice(0, max);
    },
    async orgFinds(orgId) {
      return findsByCode(await service.orgViews(orgId, '2026-01-01'));
    },
    async uploadOrgPoster(orgId, uri) {
      if (network.down) throw new SocialError('network');
      const u = me();
      needOrg(orgId);
      return `https://files.example/orgs/${orgId}/${u.uid}/poster-${++n}.jpg?from=${encodeURIComponent(uri)}`;
    },
    async postOrgUpdate(orgId, raw) {
      if (network.down) throw new SocialError('network');
      const u = me();
      needOrg(orgId);
      const input = cleanPostInput(raw);
      if (!input) throw new SocialError('unknown');
      const post: OrgPost = { id: `post${++n}`, orgId, uid: u.uid, ...input, createdAt: `${now()}#${String(n).padStart(6, '0')}` };
      orgPosts.set(post.id, post);
      return post;
    },
    async orgPosts(orgIds, max) {
      if (network.down) throw new SocialError('network');
      me();
      const ids = new Set(orgIds.slice(0, 30));
      return [...orgPosts.values()].filter((p) => ids.has(p.orgId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async deleteOrgPost(id) {
      if (network.down) throw new SocialError('network');
      const p = orgPosts.get(id);
      if (!p) return;
      needOrg(p.orgId);
      orgPosts.delete(id);
    },
    async takeBackSprout(id, via) {
      if (network.down) throw new SocialError('network');
      const u = me();
      const s = sprouts.get(id);
      if (s?.to) throw new SocialError('sprout-taken');
      if (s && s.from === u.uid) sprouts.delete(id);
      const v = via ? sprouts.get(via) : undefined;
      if (v && v.to === u.uid && v.passedOn === id) {
        const { passedOn: _, ...rest } = v;
        sprouts.set(via!, rest);
      }
    },
    async report(target, reason, note) {
      reports.push({ id: `r${++n}`, by: me().uid, target, reason, note, createdAt: `${now()}#${String(n).padStart(6, '0')}`, status: 'open' });
    },
    async blocked() {
      readable();
      return current ? (blocks.get(current.uid) ?? []) : [];
    },
    async setBlocked(uid, on) {
      const u = me();
      const list = blocks.get(u.uid) ?? [];
      blocks.set(u.uid, on ? [...new Set([...list, uid])] : list.filter((x) => x !== uid));
    },
  };
  /** An invite link's code for a crew, as a member would share it (for tests). */
  const codeOf = (crewId: string) => {
    if (!crewCodes.has(crewId)) crewCodes.set(crewId, `code${crewId.replace(/[^A-Za-z0-9]/g, '')}${++n}abcdefgh`);
    return crewCodes.get(crewId)!;
  };
  /** Someone reads a crew's chat now (for tests). */
  const readAs = (crewId: string, uid: string) => {
    reads.set(`${crewId}/${uid}`, now());
    readsChanged(crewId);
  };
  return { service, gardens, glows, gardenBackups, kandi, videoTags, codeOf, readAs, accounts, profiles, handles, memories, blocks, follows, likes, crews, crewInvites, sprouts, themeGrants, stickers, hunts, finds, picks, updates, crewFiles, meets, chat, reads, crewCodes, agreed, comments, clipComments, network, friendCodes, founders, flairs, plus, levels, usage, counter, reports, support, verified, presence, drops, patches, dms, setTimes, orgs, orgMembers, orgRequests, orgViews, orgPosts, currentUser: () => current, ticketTaps, pushes };
}
