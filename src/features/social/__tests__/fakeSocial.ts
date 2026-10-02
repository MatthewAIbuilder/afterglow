import { type Comment, CREW_MAX, CREW_NOTE_MAX, CREW_PICKS_MAX, CREW_STAGE_MAX, type Activity, type Crew, type CrewPicks, type CrewUpdate, type Profile, type ProfileInput, type ReportReason, type SharedMemory, type SocialUser } from '../models';
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
  /** Follows as `from>to`, in the order made. */
  const follows = new Map<string, { from: string; to: string; createdAt: string }>();
  /** Likes as `memoryId_uid`. */
  const likes = new Map<string, { memoryId: string; owner: string; uid: string; createdAt: string }>();
  const crews = new Map<string, Crew>();
  /** Picks as `crewId/uid`. */
  const picks = new Map<string, CrewPicks>();
  const comments = new Map<string, Comment>();
  /** Crew updates as `crewId/updateId`. */
  const updates = new Map<string, CrewUpdate>();
  /** Switch the "network" off to see what happens with no signal: crew updates fail to send. */
  const network = { down: false };
  /** Crew-only video files uploaded, as `crewId/uid/updateId`. */
  const crewFiles = new Set<string>();
  const reports: { by: string; target: ReportTarget; reason: ReportReason; note?: string }[] = [];
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
      return;
    }
    dropPicks(id, uid);
    dropUpdates(id, uid);
    crews.set(id, { ...c, members, owner: c.owner === uid ? members[0] : c.owner });
  };

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
      current = { uid, email: e };
      emit();
      return current;
    },
    async signIn(email, password) {
      const a = accounts.get(email.trim().toLowerCase());
      if (!a || a.password !== password) throw new SocialError('wrong-password');
      current = { uid: a.uid, email: email.trim().toLowerCase() };
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
      for (const [k, l] of likes) if (l.uid === u.uid || l.owner === u.uid) likes.delete(k);
      for (const [k, c] of comments) if (c.uid === u.uid || c.owner === u.uid) comments.delete(k);
      for (const id of [...crews.keys()]) leave(id, u.uid);
      accounts.delete(u.email ?? '');
      current = null;
      emit();
    },
    async profileOf(uid) {
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
        festivals: input.showFestivals ? published.festivals : [],
        sounds: input.showSound ? published.sounds : [],
        showFestivals: input.showFestivals,
        showSound: input.showSound,
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
    async searchProfiles(raw) {
      const q = raw.trim().replace(/^@+/, '').toLowerCase();
      if (q.length < 2) return [];
      return [...profiles.values()].filter((p) => p.handle.startsWith(q) || p.displayName.toLowerCase().startsWith(q));
    },
    async profilesGoingTo(festivalId, max) {
      return [...profiles.values()].filter((p) => p.festivals.includes(festivalId)).slice(0, max);
    },
    async shareMemory(input: ShareInput, onProgress) {
      const u = me();
      const p = profiles.get(u.uid);
      if (!p) throw new SocialError('no-profile');
      if ((opts.fileBytes?.(input.videoUri) ?? 0) > MAX_SHARE_BYTES) throw new SocialError('too-large');
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
        capturedAt: input.capturedAt,
        durationSec: input.durationSec,
        width: input.width,
        height: input.height,
        createdAt: now(),
      };
      memories.set(id, m);
      onProgress?.(1);
      return m;
    },
    async unshareMemory(id) {
      const u = me();
      const m = memories.get(id);
      if (!m) return;
      if (m.uid !== u.uid) throw new SocialError('not-signed-in');
      memories.delete(id);
      for (const [k, l] of likes) if (l.memoryId === id) likes.delete(k);
      for (const [k, c] of comments) if (c.memoryId === id) comments.delete(k);
    },
    async memoriesOf(uid) {
      return [...memories.values()].filter((m) => m.uid === uid).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    },
    async festivalMemories(festivalId, max) {
      return [...memories.values()].filter((m) => m.festivalId === festivalId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async recentMemories(max) {
      return [...memories.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async sharedMemory(id) {
      return memories.get(id) ?? null;
    },
    async follow(uid) {
      const u = me();
      if (uid === u.uid || !profiles.has(uid) || !profiles.has(u.uid)) throw new SocialError('unknown');
      if ((blocks.get(uid) ?? []).includes(u.uid)) throw new SocialError('unknown');
      const k = `${u.uid}>${uid}`;
      if (!follows.has(k)) follows.set(k, { from: u.uid, to: uid, createdAt: `${now()}#${String(++n).padStart(6, '0')}` });
    },
    async unfollow(uid) {
      follows.delete(`${me().uid}>${uid}`);
    },
    async removeFollower(uid) {
      follows.delete(`${uid}>${me().uid}`);
    },
    async following(uid, max) {
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
    async activity(max) {
      const u = me();
      const items: Activity[] = [
        ...[...comments.values()]
          .filter((c) => c.owner === u.uid && c.uid !== u.uid)
          .map((c): Activity => ({ kind: 'comment', id: c.id, from: c.uid, memoryId: c.memoryId, text: c.text, createdAt: c.createdAt })),
        ...[...follows.values()].filter((f) => f.to === u.uid).map((f): Activity => ({ kind: 'follow', id: `${f.from}_${f.to}`, from: f.from, createdAt: f.createdAt })),
        ...[...likes.values()].filter((l) => l.owner === u.uid).map((l): Activity => ({ kind: 'like', id: `${l.memoryId}_${l.uid}`, from: l.uid, memoryId: l.memoryId, createdAt: l.createdAt })),
      ];
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
    },
    async createCrew(festivalId, raw) {
      const u = me();
      if (!profiles.has(u.uid)) throw new SocialError('no-profile');
      if (crewNameProblem(raw)) throw new SocialError('unknown');
      const c: Crew = { id: `crew-${++n}`, festivalId, name: cleanCrewName(raw), owner: u.uid, members: [u.uid], createdAt: now() };
      crews.set(c.id, c);
      return c;
    },
    async crew(id) {
      me();
      return crews.get(id) ?? null;
    },
    async myCrews() {
      const u = me();
      return [...crews.values()].filter((c) => c.members.includes(u.uid));
    },
    async joinCrew(id) {
      const u = me();
      const c = crewOf(id);
      if (c.members.includes(u.uid)) return c;
      if (!profiles.has(u.uid)) throw new SocialError('no-profile');
      if ((blocks.get(c.owner) ?? []).includes(u.uid)) throw new SocialError('unknown');
      if (c.members.length >= CREW_MAX) throw new SocialError('crew-full');
      const next = { ...c, members: [...c.members, u.uid] };
      crews.set(id, next);
      return next;
    },
    async leaveCrew(id) {
      leave(id, me().uid);
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
      const next = { ...c, members: c.members.filter((m) => m !== uid) };
      crews.set(id, next);
      return next;
    },
    async setCrewPicks(id, artists) {
      memberOf(id);
      const uid = me().uid;
      picks.set(`${id}/${uid}`, { uid, artists: [...new Set(artists)].slice(0, CREW_PICKS_MAX), updatedAt: now() });
    },
    async crewPicks(id) {
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
      if (network.down) throw new SocialError('network');
      memberOf(crewId);
      return [...updates.values()]
        .filter((u) => u.crewId === crewId && Date.parse(u.at) >= sinceMs)
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, max);
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
    async report(target, reason, note) {
      reports.push({ by: me().uid, target, reason, note });
    },
    async blocked() {
      return current ? (blocks.get(current.uid) ?? []) : [];
    },
    async setBlocked(uid, on) {
      const u = me();
      const list = blocks.get(u.uid) ?? [];
      blocks.set(u.uid, on ? [...new Set([...list, uid])] : list.filter((x) => x !== uid));
    },
  };
  return { service, accounts, profiles, handles, memories, blocks, follows, likes, crews, picks, updates, crewFiles, comments, network, reports, currentUser: () => current };
}
