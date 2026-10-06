import { cleanSocials } from '../socials';
import { cleanPast } from '../../memories/past';
import { cleanShow } from '../../memories/show';
import { cleanWith } from '../../memories/b2b';
import { cleanClip } from '../../memories/trim';
import { cleanBackdrop } from '../../profile/backdrops';
import { SOUND_TAGS, type SoundTag } from '../../../data/models';
import { ARTISTS_SHOWN, CHAT_MAX, type CrewMessage, CREW_MAX, CREW_NOTE_MAX, CREW_PICKS_MAX, CREW_STAGE_MAX, type Crew, type CrewInvite, type CrewPicks, type CrewUpdate, type Comment, type ClipComment, MEET_SPOT_MAX, type MeetSpot, COMMENT_MAX, FLAIR_KINDS, FOUNDERS_MAX, LEVEL_MAX, REPORT_REASONS, DROP_STATUSES, type Drop, type DropFile, type LivePatch, type Privileges, type Profile, type ReportRecord, type SharedMemory, type Standing, type SupportMessage, type SupportTopic, type Sprout, type SetTimesTip, TIP_PHOTO_MAX, TIP_TEXT_MAX, type SupportReply, type VideoTag } from '../models';
import { SocialError, type SocialErrorKind } from '../service';
import { cleanHunt, cleanName, type Hunt, isHuntId, isStickerCode, type Sticker } from '../../finds/finds';

/**
 * Database documents to the app's shapes, without trusting them: a field of
 * the wrong type is dropped, never passed on. Pure, and tested.
 */
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const strs = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : []);
const https = (v: unknown) => (typeof v === 'string' && v.startsWith('https://') ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

export function profileFromDoc(uid: string, d: unknown): Profile | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const handle = str(o.handle);
  if (!handle) return null;
  return {
    uid,
    handle,
    displayName: str(o.displayName) ?? handle,
    bio: str(o.bio) ?? '',
    avatarUrl: https(o.avatarUrl),
    coverUrl: https(o.coverUrl),
    festivals: strs(o.festivals, 50),
    sounds: strs(o.sounds, 3).filter((s): s is SoundTag => (SOUND_TAGS as readonly string[]).includes(s)),
    artists: strs(o.artists, ARTISTS_SHOWN),
    showFestivals: o.showFestivals === true,
    showSound: o.showSound === true,
    ...(Object.keys(cleanSocials(o)).length ? { socials: cleanSocials(o) } : {}),
    showArtists: o.showArtists !== false,
    backdrop: cleanBackdrop(o.backdrop),
    createdAt: str(o.createdAt) ?? '',
    updatedAt: str(o.updatedAt) ?? '',
  };
}

/** The fields added after the first rules (favourite artists, the animated background, your socials). */
export const NEWER_PROFILE_FIELDS = ['artists', 'showArtists', 'backdrop', 'instagram', 'snapchat', 'tiktok'] as const;

/**
 * A profile as it's written: optional fields only when set (the database
 * refuses empty values). `legacy` leaves out the newer fields, for a
 * database whose rules don't know them yet.
 */
export function profileToDoc(p: Profile, legacy = false): Record<string, unknown> {
  const { uid: _uid, avatarUrl, coverUrl, backdrop, socials, ...fields } = p;
  const out: Record<string, unknown> = {
    ...fields,
    // Usernames as their own fields (instagram, snapchat, tiktok; the rules list no `socials`).
    ...(socials ?? {}),
    nameLower: p.displayName.toLowerCase(),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(coverUrl ? { coverUrl } : {}),
    ...(backdrop ? { backdrop } : {}),
  };
  if (legacy) for (const k of NEWER_PROFILE_FIELDS) delete out[k];
  return out;
}

export function videoTagFromDoc(id: string, d: unknown): VideoTag | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const memoryId = str(o.memoryId);
  const owner = str(o.owner);
  const uid = str(o.uid);
  const status = o.status === 'approved' ? 'approved' : o.status === 'pending' ? 'pending' : undefined;
  if (!memoryId || !owner || !uid || !status) return null;
  return { id, memoryId, owner, uid, status, createdAt: str(o.createdAt) ?? '' };
}

export function memoryFromDoc(id: string, d: unknown): SharedMemory | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const uid = str(o.uid);
  const videoUrl = https(o.videoUrl);
  const capturedAt = str(o.capturedAt);
  if (!uid || !videoUrl || !capturedAt) return null;
  return {
    id,
    uid,
    handle: str(o.handle) ?? '',
    videoUrl,
    thumbUrl: https(o.thumbUrl),
    festivalId: str(o.festivalId),
    night: str(o.night),
    artistId: str(o.artistId),
    withArtistIds: str(o.artistId) ? cleanWith(o.withArtistIds, str(o.artistId)) : undefined,
    past: str(o.festivalId) ? undefined : cleanPast({ name: o.pastName, year: o.pastYear, city: o.pastCity, seriesId: o.seriesId }),
    show: str(o.festivalId) || str(o.pastName) ? undefined : cleanShow({ name: o.showName, date: o.showDate, city: o.showCity, showId: o.showId }),
    clip: cleanClip({ start: o.clipStart, end: o.clipEnd }),
    capturedAt,
    durationSec: num(o.durationSec),
    width: num(o.width),
    height: num(o.height),
    createdAt: str(o.createdAt) ?? '',
  };
}

export function crewFromDoc(id: string, d: unknown): Crew | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const festivalId = str(o.festivalId);
  const owner = str(o.owner);
  const members = strs(o.members, CREW_MAX);
  if (!festivalId || !owner || !members.includes(owner)) return null;
  return { id, festivalId, name: str(o.name) ?? '', owner, members, createdAt: str(o.createdAt) ?? '' };
}

export function crewPicksFromDoc(uid: string, d: unknown): CrewPicks | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  return { uid, artists: strs(o.artists, CREW_PICKS_MAX), updatedAt: str(o.updatedAt) ?? '' };
}

/** A comment document; anything missing or of the wrong type drops it. */
export function commentFromDoc(id: string, d: unknown): Comment | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const memoryId = str(o.memoryId);
  const owner = str(o.owner);
  const uid = str(o.uid);
  const handle = str(o.handle);
  const text = str(o.text);
  const createdAt = str(o.createdAt);
  if (!memoryId || !owner || !uid || !handle || !text || !createdAt) return null;
  return { id, memoryId, owner, uid, handle, text: text.slice(0, COMMENT_MAX), createdAt };
}

/** A comment on a clip in Discover; `createdAt` is the server's time (a Timestamp). Anything missing drops it. */
export function clipCommentFromDoc(id: string, d: unknown): ClipComment | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const clipId = str(o.clipId);
  const uid = str(o.uid);
  const handle = str(o.handle);
  const text = str(o.text);
  const createdAt = timeOf(o.createdAt) ?? str(o.createdAt);
  if (!clipId || !uid || !handle || !text || !createdAt) return null;
  return { id, clipId, uid, handle, text: text.slice(0, COMMENT_MAX), createdAt };
}

/** A server time (a Firestore Timestamp, or milliseconds) as ISO 8601. */
function timeOf(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString();
  if (v && typeof v === 'object' && 'toMillis' in v && typeof (v as { toMillis: unknown }).toMillis === 'function') {
    return new Date((v as { toMillis: () => number }).toMillis()).toISOString();
  }
  return undefined;
}

/** A crew invite document; anything missing drops it. A missing server time (still being written) reads as now. */
export function crewInviteFromDoc(id: string, d: unknown): CrewInvite | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const crewId = str(o.crewId);
  const festivalId = str(o.festivalId);
  const from = str(o.from);
  const to = str(o.to);
  if (!crewId || !festivalId || !from || !to) return null;
  return { id, crewId, festivalId, crewName: (str(o.crewName) ?? '').slice(0, 40), from, to, at: timeOf(o.createdAt) ?? new Date().toISOString() };
}

/** A profile as its Firestore fields (see profileToDoc). */
export const profileFields = (p: Profile): Record<string, unknown> => profileToDoc(p);

/** A sprout document. */
export function sproutFromDoc(id: string, d: unknown): Sprout | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const from = str(o.from);
  const kind = str(o.kind);
  if (!from || !kind) return null;
  const to = str(o.to);
  const note = str(o.note);
  const festivalId = str(o.festivalId);
  const claimedAt = timeOf(o.claimedAt);
  const artistId = str(o.artistId);
  const artistName = str(o.artistName);
  return {
    id,
    kind,
    from,
    ...(artistId && artistName ? { artistId, artistName: artistName.slice(0, 60) } : {}),
    createdAt: timeOf(o.createdAt) ?? new Date().toISOString(),
    ...(to ? { to } : {}),
    ...(note ? { note: note.slice(0, 60) } : {}),
    ...(festivalId ? { festivalId } : {}),
    ...(claimedAt ? { claimedAt } : {}),
  };
}

/** A crew update document. `atMs` (when it happened on the phone) is required; a missing server time reads as that time. */
export function crewUpdateFromDoc(crewId: string, id: string, d: unknown): CrewUpdate | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const uid = str(o.uid);
  const festivalId = str(o.festivalId);
  const kind = o.kind === 'video' || o.kind === 'checkin' || o.kind === 'reply' || o.kind === 'photo' ? o.kind : undefined;
  const at = typeof o.atMs === 'number' && Number.isFinite(o.atMs) ? new Date(o.atMs).toISOString() : undefined;
  if (!uid || !festivalId || !kind || !at) return null;
  const videoUrl = https(o.videoUrl);
  if (kind === 'video' && !videoUrl) return null;
  if (kind === 'photo' && !https(o.thumbUrl)) return null;
  if (kind === 'reply' && (!str(o.replyTo) || !str(o.note))) return null;
  return {
    id,
    crewId,
    uid,
    kind,
    at,
    sentAt: timeOf(o.sentAt) ?? at,
    festivalId,
    ...(str(o.artistId) ? { artistId: str(o.artistId) } : {}),
    ...(str(o.stage) ? { stage: str(o.stage)!.slice(0, CREW_STAGE_MAX) } : {}),
    ...(str(o.note) ? { note: str(o.note)!.slice(0, CREW_NOTE_MAX) } : {}),
    ...(kind === 'reply' ? { replyTo: str(o.replyTo) } : {}),
    ...(kind === 'checkin' && o.lost === true ? { lost: true } : {}),
    ...(kind === 'checkin' && (o.care === 'ok' || o.care === 'help') ? { care: o.care } : {}),
    ...(videoUrl ? { videoUrl } : {}),
    ...(https(o.thumbUrl) ? { thumbUrl: https(o.thumbUrl) } : {}),
    ...(str(o.sharedId) ? { sharedId: str(o.sharedId) } : {}),
    ...(num(o.durationSec) ? { durationSec: num(o.durationSec) } : {}),
    ...(num(o.width) && num(o.height) ? { width: num(o.width), height: num(o.height) } : {}),
  };
}

/** A crew chat message. `atMs` (when it was written) and words are required; a missing server time reads as that time. */
export function crewMessageFromDoc(crewId: string, id: string, d: unknown): CrewMessage | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const uid = str(o.uid);
  const text = str(o.text)?.trim();
  const at = typeof o.atMs === 'number' && Number.isFinite(o.atMs) ? new Date(o.atMs).toISOString() : undefined;
  if (!uid || !text || !at) return null;
  return { id, crewId, uid, text: text.slice(0, CHAT_MAX), at, sentAt: timeOf(o.sentAt) ?? at };
}

/** A crew's meeting spot document; empty or malformed is none. */
export function meetSpotFromDoc(d: unknown): MeetSpot | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const text = str(o.text)?.trim();
  const by = str(o.by);
  if (!text || !by) return null;
  return { text: text.slice(0, MEET_SPOT_MAX), by, at: timeOf(o.at) ?? '' };
}

/** Firebase's error codes as the app's kinds. */
export function firebaseErrorKind(e: unknown): SocialErrorKind {
  const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'email-in-use';
    case 'auth/invalid-email':
      return 'invalid-email';
    case 'auth/weak-password':
      return 'weak-password';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'wrong-password';
    case 'auth/user-not-found':
      return 'no-account';
    case 'auth/too-many-requests':
      return 'too-many-attempts';
    case 'auth/network-request-failed':
    case 'unavailable':
    case 'deadline-exceeded':
    case 'storage/retry-limit-exceeded':
      return 'network';
    default:
      return 'unknown';
  }
}

export const asSocialError = (e: unknown) => (e instanceof SocialError ? e : new SocialError(firebaseErrorKind(e)));

/** A video's content type from its file name. */
export function videoType(uri: string, fileType?: string): string {
  const ext = uri.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'm4v') return 'video/x-m4v';
  if (ext === 'mp4') return 'video/mp4';
  // No name to go by (a video chosen on the website is a link into the page): what the file says it is.
  const t = (fileType ?? '').toLowerCase().split(';')[0].trim();
  if (t === 'video/quicktime' || t === 'video/x-m4v') return t;
  return 'video/mp4';
}

/** The end of a name range query: everything that starts with `q`. */
export const prefixEnd = (q: string) => `${q}`;

/** A founder number and a flair, read from their documents; anything malformed is left out. */
export function standingFromDocs(founder: unknown, flair: unknown, plus?: unknown, level?: unknown): Standing {
  const f = founder as { number?: unknown } | undefined;
  const fl = flair as { kind?: unknown; caption?: unknown } | undefined;
  const number = typeof f?.number === 'number' && Number.isInteger(f.number) && f.number >= 1 && f.number <= FOUNDERS_MAX ? f.number : undefined;
  const kind = FLAIR_KINDS.find((k) => k === fl?.kind);
  const caption = typeof fl?.caption === 'string' ? fl.caption.trim().slice(0, 40) : '';
  // Plus is on while its document says active (and, when it has one, until it ends).
  const p = plus as { active?: unknown; until?: unknown } | undefined;
  const until = p?.until && typeof p.until === 'object' && 'toMillis' in p.until ? (p.until as { toMillis: () => number }).toMillis() : typeof p?.until === 'string' ? Date.parse(p.until) : undefined;
  const isPlus = p?.active === true && (until === undefined || !Number.isFinite(until) || until > Date.now());
  const lv = (level as { level?: unknown } | undefined)?.level;
  const shown = typeof lv === 'number' && Number.isInteger(lv) && lv >= 1 && lv <= LEVEL_MAX ? lv : undefined;
  return { ...(number ? { founder: number } : {}), ...(kind && caption ? { flair: { kind, caption } } : {}), ...(isPlus ? { plus: true } : {}), ...(shown ? { level: shown } : {}) };
}

/** A time written as ISO 8601 text, or by the server. */
const whenOf = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : timeOf(v));

const TOPICS: readonly SupportTopic[] = ['help', 'bug', 'idea', 'festival', 'other'];

/** A support message from its document; anything malformed is null. */
export function supportFromDoc(id: string, d: unknown): SupportMessage | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const uid = str(o.uid);
  const text = str(o.text);
  const topic = TOPICS.find((t) => t === o.topic);
  const createdAt = whenOf(o.createdAt);
  if (!uid || !text || !topic || !createdAt) return null;
  const status = o.status === 'answered' || o.status === 'closed' ? o.status : 'open';
  const replies = supportReplies(o);
  return {
    id,
    uid,
    topic,
    text: text.slice(0, 1000),
    status,
    createdAt,
    ...(str(o.handle) ? { handle: str(o.handle) } : {}),
    ...(str(o.name) ? { name: str(o.name) } : {}),
    ...(str(o.email) ? { email: str(o.email) } : {}),
    ...(str(o.platform) ? { platform: str(o.platform) } : {}),
    ...(str(o.version) ? { version: str(o.version) } : {}),
    ...(str(o.reply) ? { reply: str(o.reply) } : {}),
    ...(whenOf(o.repliedAt) ? { repliedAt: whenOf(o.repliedAt) } : {}),
    ...(replies.length ? { replies } : {}),
  };
}

/** A support message's replies, oldest first; one answered before replies were a list has its one reply. */
function supportReplies(o: Record<string, unknown>): SupportReply[] {
  if (Array.isArray(o.replies)) {
    return o.replies.flatMap((r) => {
      const x = r as Record<string, unknown> | null;
      const text = str(x?.text);
      const at = whenOf(x?.at);
      return text ? [{ text: text.slice(0, 2000), ...(at ? { at } : {}) }] : [];
    });
  }
  const reply = str(o.reply);
  const at = whenOf(o.repliedAt);
  return reply ? [{ text: reply, ...(at ? { at } : {}) }] : [];
}

/** A report from its document; anything malformed is null. */
export function reportFromDoc(id: string, d: unknown): ReportRecord | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const kind = o.kind === 'profile' || o.kind === 'memory' || o.kind === 'comment' || o.kind === 'clipComment' || o.kind === 'chat' ? o.kind : undefined;
  const reason = REPORT_REASONS.find((r) => r.key === o.reason)?.key;
  const by = str(o.by);
  const targetId = str(o.targetId);
  const createdAt = whenOf(o.createdAt);
  if (!kind || !reason || !by || !targetId || !createdAt) return null;
  return { id, by, kind, targetId, ownerUid: str(o.ownerUid) ?? '', reason, note: str(o.note) ?? '', createdAt, status: o.status === 'resolved' ? 'resolved' : 'open' };
}

/** An HQ upload from its document; anything malformed is null. */
export function dropFromDoc(id: string, d: unknown): Drop | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const by = str(o.by);
  const createdAt = whenOf(o.createdAt);
  if (!by || !createdAt) return null;
  const files: DropFile[] = Array.isArray(o.files)
    ? o.files.flatMap((f) => {
        const x = f as Record<string, unknown>;
        const name = str(x?.name);
        const path = str(x?.path);
        const url = str(x?.url);
        return name && path && url?.startsWith('https://') ? [{ name, path, url, type: str(x.type) ?? '', size: typeof x.size === 'number' ? x.size : 0 }] : [];
      })
    : [];
  const status = DROP_STATUSES.find((s) => s === o.status) ?? 'waiting';
  return {
    id,
    by,
    note: str(o.note) ?? '',
    files,
    status,
    createdAt,
    ...(str(o.festivalId) ? { festivalId: str(o.festivalId) } : {}),
    ...(str(o.festivalName) ? { festivalName: str(o.festivalName) } : {}),
    ...(str(o.text) ? { text: str(o.text) } : {}),
  };
}

/** A published catalogue update from its document; anything malformed is null. */
export function patchFromDoc(id: string, d: unknown): LivePatch | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const title = str(o.title);
  const festivalId = str(o.festivalId);
  const file = str(o.file);
  const by = str(o.by);
  const publishedAt = whenOf(o.publishedAt);
  if (!title || !festivalId || !file || !by || !publishedAt) return null;
  return { id, title, festivalId, file, by, publishedAt, ...(str(o.dropId) ? { dropId: str(o.dropId) } : {}) };
}

/** Who has Plus and who has a flair, joined by person. */
export function privilegesFrom(plus: { id: string; data: unknown }[], flairs: { id: string; data: unknown }[]): Privileges[] {
  const out = new Map<string, Privileges>();
  for (const p of plus) {
    const s = standingFromDocs(undefined, undefined, p.data);
    if (!s.plus) continue;
    const until = (p.data as { until?: unknown })?.until;
    const ms = until && typeof until === 'object' && 'toMillis' in until ? (until as { toMillis: () => number }).toMillis() : typeof until === 'string' ? Date.parse(until) : undefined;
    out.set(p.id, { uid: p.id, plus: ms && Number.isFinite(ms) ? { until: new Date(ms).toISOString() } : {} });
  }
  for (const f of flairs) {
    const s = standingFromDocs(undefined, f.data);
    if (s.flair) out.set(f.id, { ...(out.get(f.id) ?? { uid: f.id }), flair: s.flair });
  }
  return [...out.values()];
}

const millisOf = (v: unknown) => {
  const t = timeOf(v);
  return t ? Date.parse(t) : undefined;
};

/** One of your finds from its document (`finds/<uid>_<code>`): its code and when you scanned it. */
export function accountFindFromDoc(d: unknown): { code: string; at: number } | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as { code?: unknown; at?: unknown };
  const at = millisOf(o.at);
  return isStickerCode(o.code) && at !== undefined ? { code: o.code, at } : null;
}

/** A sticker from its document. */
export function stickerFromDoc(code: string, d: unknown): Sticker | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const name = cleanName(o.name);
  const creature = str(o.creature);
  if (!name || !creature) return null;
  const until = millisOf(o.until);
  const createdAt = millisOf(o.createdAt);
  // Taken down: a time from the server (or now, for a write still on its way).
  const takenDownAt = o.takenDown === true ? (millisOf(o.takenDownAt) ?? Date.now()) : undefined;
  const slot = typeof o.slot === 'number' ? o.slot : undefined;
  return {
    code,
    name,
    creature,
    ...(isHuntId(o.huntId) && slot !== undefined ? { huntId: o.huntId, slot } : {}),
    ...(until !== undefined ? { until } : {}),
    ...(str(o.festivalId) ? { festivalId: str(o.festivalId) } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(takenDownAt !== undefined ? { takenDownAt } : {}),
  };
}

/** Set times a fan sent, from their document (anything unusable dropped). */
export function setTimesTipFromDoc(id: string, d: unknown): SetTimesTip | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  const uid = str(o.uid);
  const festivalId = str(o.festivalId);
  const at = whenOf(o.createdAt);
  if (!uid || !festivalId || !at) return null;
  const text = str(o.text)?.slice(0, TIP_TEXT_MAX);
  const photo = str(o.photo);
  return {
    id,
    uid,
    festivalId,
    status: o.status === 'live' ? 'live' : 'new',
    at,
    ...(text ? { text } : {}),
    ...(photo && photo.startsWith('data:image/jpeg;base64,') && photo.length <= TIP_PHOTO_MAX ? { photo } : {}),
  };
}

/** A hunt from its document. */
export function huntFromDoc(id: string, d: unknown): Hunt | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Record<string, unknown>;
  return cleanHunt(id, { ...o, until: millisOf(o.until) }) ?? null;
}
