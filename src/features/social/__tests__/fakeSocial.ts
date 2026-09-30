import type { Activity, Profile, ProfileInput, ReportReason, SharedMemory, SocialUser } from '../models';
import { MAX_SHARE_BYTES, SocialError, type ReportTarget, type ShareInput, type SocialService } from '../service';
import { cleanProfileInput, handleProblem, normalizeHandle, profileProblems } from '../validate';

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
    async activity(max) {
      const u = me();
      const items: Activity[] = [
        ...[...follows.values()].filter((f) => f.to === u.uid).map((f): Activity => ({ kind: 'follow', id: `${f.from}_${f.to}`, from: f.from, createdAt: f.createdAt })),
        ...[...likes.values()].filter((l) => l.owner === u.uid).map((l): Activity => ({ kind: 'like', id: `${l.memoryId}_${l.uid}`, from: l.uid, memoryId: l.memoryId, createdAt: l.createdAt })),
      ];
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
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
  return { service, accounts, profiles, handles, memories, blocks, follows, likes, reports, currentUser: () => current };
}
