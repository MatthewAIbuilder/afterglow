import type { Activity, Comment, Crew, CrewInvite, CrewPicks, CrewUpdate, CrewUpdateInput, MeetSpot, Profile, ProfileInput, ReportReason, SharedMemory, SocialUser, Standing, AdminCounts, AdminActivity, AdminPresence, Drop, DropInput, DropStatus, Flair, LivePatch, Privileges, ReportRecord, SupportMessage, SupportTopic } from './models';

/**
 * The boundary every social backend implements. The app only talks to
 * profiles, shared memories, reports and blocks through this; Firebase stays
 * inside its adapter (features/social/firebase/), and tests use an in-memory
 * version. Like the music services, nothing outside features/social/ imports
 * an adapter.
 */
export type SocialAvailability = { ok: true } | { ok: false; reason: 'not-set-up' };

export type ShareInput = {
  /** The memory's local id, kept with the shared copy so it can be found again. */
  memoryId: string;
  videoUri: string;
  thumbUri?: string;
  festivalId?: string;
  night?: string;
  artistId?: string;
  capturedAt: string;
  durationSec?: number;
  width?: number;
  height?: number;
};

export type FollowCounts = { followers: number; following: number };

export type ReportTarget = { kind: 'profile' | 'memory' | 'comment'; id: string; ownerUid: string };

export interface SocialService {
  availability(): SocialAvailability;
  /** Called with the signed-in user (or null) now and whenever it changes. Returns an unsubscribe. */
  onAuthChange(listener: (user: SocialUser | null) => void): () => void;
  signUp(email: string, password: string): Promise<SocialUser>;
  signIn(email: string, password: string): Promise<SocialUser>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Deletes your profile, shared memories, blocks and the account itself. Needs your password again. */
  deleteAccount(password: string): Promise<void>;

  profileOf(uid: string): Promise<Profile | null>;
  profileByHandle(handle: string): Promise<Profile | null>;
  /** Saves your profile, claiming the handle; `festivals` and `sounds` are published only when switched on. */
  saveProfile(input: ProfileInput, published: { festivals: string[]; sounds: Profile['sounds'] }): Promise<Profile>;
  /** Replace (a local image uri) or remove (null) your profile photo. */
  setAvatar(uri: string | null): Promise<Profile>;
  /** Set or remove the wide photo behind the top of your profile. */
  setCover(uri: string | null): Promise<Profile>;
  handleAvailable(handle: string): Promise<boolean>;
  /**
   * Become one of the first FOUNDERS_MAX people, if there's a spot left: your
   * number (kept if you already have one), or null when they're all taken.
   * Needs your profile.
   */
  claimFounder(): Promise<number | null>;
  /** Send the email that confirms your address (needed for the support account's dashboard). */
  sendVerification(): Promise<void>;
  /** Read your sign-in again (after confirming your email); you, or null when signed out. */
  reloadUser(): Promise<SocialUser | null>;

  /** Send a message to Afterglow support. */
  contactSupport(input: { topic: SupportTopic; text: string; platform?: string; version?: string }): Promise<SupportMessage>;
  /** Your own messages to support, newest first, with any replies. */
  mySupport(max: number): Promise<SupportMessage[]>;

  // The support account only (refused for anyone else):
  /** Every support message, newest first. */
  supportInbox(max: number): Promise<SupportMessage[]>;
  /** Reply to a message (it becomes answered). */
  answerSupport(id: string, reply: string): Promise<void>;
  /** Mark a message closed, or open again. */
  setSupportStatus(id: string, status: 'open' | 'closed'): Promise<void>;
  /** Reports, newest first. */
  reports(max: number): Promise<ReportRecord[]>;
  /** Mark a report dealt with. */
  resolveReport(id: string): Promise<void>;
  /** Take down a shared video or a comment that breaks the guidelines. */
  takeDown(kind: 'memory' | 'comment', id: string): Promise<void>;
  /** The headline numbers, counted on the server; `since` is a week ago. */
  adminCounts(since: string): Promise<AdminCounts>;
  /** When profiles, videos, comments, likes, follows and crews were made since then (newest first, up to `max` each), for the charts. */
  adminActivity(since: string, max: number): Promise<AdminActivity>;
  /** Every account's last-active record, most recently active first, up to `max`. Support account only. */
  adminPresence(max: number): Promise<AdminPresence[]>;
  /** HQ uploads: lineup or set-times pictures, PDFs or text, with a note. Support account only. */
  addDrop(input: DropInput, onProgress?: (share: number) => void): Promise<Drop>;
  drops(max: number): Promise<Drop[]>;
  setDropStatus(id: string, status: DropStatus): Promise<void>;
  deleteDrop(id: string): Promise<void>;
  /** Catalogue updates published from HQ: anyone may read them (every app applies them); only the support account writes them. */
  livePatches(): Promise<LivePatch[]>;
  publishPatch(input: { title: string; festivalId: string; file: string; dropId?: string }): Promise<LivePatch>;
  unpublishPatch(id: string): Promise<void>;
  /** Give or take back Afterglow Plus (null takes it back) and a flair (null takes it back). Support account only. */
  setPlus(uid: string, plus: { until?: string } | null): Promise<void>;
  setFlair(uid: string, flair: Flair | null): Promise<void>;
  /** Everyone with Plus or a flair. */
  privileged(): Promise<Privileges[]>;
  /** Notes that you opened the app now (your own `activity` record; merged with what's there). Never for the support account. */
  markActive(input: { platform: string; version: string; hasProfile: boolean; now: Date }): Promise<void>;
  /** For each festival: how many show they're going, and how many videos were shared there. */
  adminFestivals(ids: string[]): Promise<Record<string, { going: number; videos: number }>>;
  /** Someone's founder number and flair, for their border and caption. */
  standingOf(uid: string): Promise<Standing>;
  /** Show your glow level on your profile (a number from 1), or take it off (null). */
  setLevel(level: number | null): Promise<void>;
  searchProfiles(query: string): Promise<Profile[]>;
  /** Profiles that show this festival among the ones they're going to (only people who switched that on), at most `max`. */
  profilesGoingTo(festivalId: string, max: number): Promise<Profile[]>;

  shareMemory(input: ShareInput, onProgress?: (share: number) => void): Promise<SharedMemory>;
  unshareMemory(sharedId: string): Promise<void>;
  memoriesOf(uid: string): Promise<SharedMemory[]>;
  /** Shared memories tagged with this festival, newest first (community clips in Discover). */
  festivalMemories(festivalId: string, max: number): Promise<SharedMemory[]>;
  /** The newest shared memories from every festival (community clips in your mix). */
  recentMemories(max: number): Promise<SharedMemory[]>;
  sharedMemory(id: string): Promise<SharedMemory | null>;

  /** Follow someone (not yourself). Following twice is the same as once. */
  follow(uid: string): Promise<void>;
  unfollow(uid: string): Promise<void>;
  /** Save your private friend code (the one in your QR code). Only the rules ever read it. */
  setFriendCode(code: string): Promise<void>;
  /**
   * Become friends with someone whose QR code you scanned: you follow each
   * other. Already following either way is fine. Refused (not `network`)
   * when the code isn't their current one or they blocked you.
   */
  addFriend(uid: string, code: string): Promise<void>;
  /** Stop someone following you (used when you block them). */
  removeFollower(uid: string): Promise<void>;
  /** Who this person follows / who follows them, newest first, at most `max`. */
  following(uid: string, max: number): Promise<string[]>;
  followers(uid: string, max: number): Promise<string[]>;
  followCounts(uid: string): Promise<FollowCounts>;
  /** Shared memories from these people, newest first (Following in Discover). */
  memoriesBy(uids: string[], max: number): Promise<SharedMemory[]>;

  /** Like someone else's shared video (`owner` is who shared it). Liking twice is the same as once. */
  like(memoryId: string, owner: string): Promise<void>;
  unlike(memoryId: string): Promise<void>;
  likeCount(memoryId: string): Promise<number>;
  /** Who liked a video, newest first. */
  likedBy(memoryId: string, max: number): Promise<string[]>;
  /** Comment on someone's shared video, or your own (`owner` is who shared it). Needs your profile. */
  comment(memoryId: string, owner: string, text: string): Promise<Comment>;
  /** A video's comments, oldest first, at most `max`. */
  comments(memoryId: string, max: number): Promise<Comment[]>;
  commentCount(memoryId: string): Promise<number>;
  /** Remove a comment: your own, or any on your video. */
  deleteComment(id: string): Promise<void>;
  /** What happened to you lately (new followers, likes and comments on your videos), newest first. */
  activity(max: number): Promise<Activity[]>;

  /** Start a crew for a festival, with you as its only member. Needs your profile. */
  createCrew(festivalId: string, name: string): Promise<Crew>;
  /** A crew by its id (anyone signed in with the link can see its name and who's in it). */
  crew(id: string): Promise<Crew | null>;
  /** The crews you're in. */
  myCrews(): Promise<Crew[]>;
  /** Join a crew (needs your profile; refused when it's full). Joining twice is the same as once. */
  joinCrew(id: string): Promise<Crew>;
  /** Invite someone on Afterglow to a crew you're in (they need a profile; not if they've blocked you). Inviting again is the same as once. */
  inviteToCrew(crewId: string, uid: string): Promise<void>;
  /** Crew invites sent to you, newest first. */
  crewInvites(max: number): Promise<CrewInvite[]>;
  /** Who you've invited to a crew (uids). */
  sentCrewInvites(crewId: string): Promise<string[]>;
  /** Say no to an invite (or tidy one up after joining). */
  declineCrewInvite(crewId: string): Promise<void>;
  /** Leave a crew, taking your picks with you. The last one out ends it; an owner who leaves hands it on. */
  leaveCrew(id: string): Promise<void>;
  /** The owner ends the crew for everyone: everyone's picks, updates and the meeting spot go with it. */
  endCrew(id: string): Promise<void>;
  /** The owner renames the crew. */
  renameCrew(id: string, name: string): Promise<Crew>;
  /** The owner removes someone from the crew (and their picks). */
  removeFromCrew(id: string, uid: string): Promise<Crew>;
  /** Share your starred sets with a crew you're in (replaces what you shared before). */
  setCrewPicks(id: string, artists: string[]): Promise<void>;
  /** Everyone's shared picks in a crew you're in. */
  crewPicks(id: string): Promise<CrewPicks[]>;
  /**
   * Send an update to a crew you're in. A video not already shared is
   * uploaded for the crew only. Sending the same id again (a retry after a
   * dropped connection) returns what's already there.
   */
  postCrewUpdate(crewId: string, input: CrewUpdateInput, onProgress?: (share: number) => void): Promise<CrewUpdate>;
  /** A crew's updates that happened since `sinceMs`, newest first (by when they happened), at most `max`. */
  crewUpdates(crewId: string, sinceMs: number, max: number): Promise<CrewUpdate[]>;
  /** Take back one of your updates. */
  deleteCrewUpdate(crewId: string, id: string): Promise<void>;
  /** Remove the crew-only video files you uploaded with these updates (after you've left or been taken out of the crew). */
  forgetCrewVideos(crewId: string, updateIds: readonly string[]): Promise<void>;
  /** The crew's meeting spot, if one's set. Members only. */
  meetSpot(crewId: string): Promise<MeetSpot | null>;
  /** Set the crew's meeting spot (any member), or clear it with an empty text. */
  setMeetSpot(crewId: string, text: string): Promise<MeetSpot | null>;

  report(target: ReportTarget, reason: ReportReason, note?: string): Promise<void>;
  blocked(): Promise<string[]>;
  setBlocked(uid: string, blocked: boolean): Promise<void>;
}

export type SocialErrorKind =
  | 'email-in-use'
  | 'invalid-email'
  | 'weak-password'
  | 'wrong-password'
  | 'no-account'
  | 'too-many-attempts'
  | 'handle-taken'
  | 'not-signed-in'
  | 'no-profile'
  | 'too-large'
  | 'crew-full'
  | 'not-found'
  | 'network'
  | 'unavailable'
  | 'unknown';

export class SocialError extends Error {
  readonly kind: SocialErrorKind;
  constructor(kind: SocialErrorKind, message: string = kind) {
    super(message);
    this.name = 'SocialError';
    this.kind = kind;
  }
}

export const socialErrorKind = (e: unknown): SocialErrorKind => (e instanceof SocialError ? e.kind : 'unknown');

/** Each error in plain words. */
export const SOCIAL_ERROR_COPY: Record<SocialErrorKind, string> = {
  'email-in-use': 'There’s already an account with that email. Sign in instead.',
  'invalid-email': 'That email doesn’t look right.',
  'weak-password': 'Choose a longer password (at least 8 characters).',
  'wrong-password': 'That email and password don’t match.',
  'no-account': 'That email and password don’t match.',
  'too-many-attempts': 'Too many tries. Wait a few minutes and try again.',
  'handle-taken': 'Someone already has that handle.',
  'not-signed-in': 'Sign in to do that.',
  'no-profile': 'Create your profile first.',
  'too-large': 'That video is too big to share. Try a shorter clip.',
  'crew-full': 'That crew is full.',
  'not-found': 'That doesn’t exist any more.',
  network: 'Couldn’t reach Afterglow. Check your connection and try again.',
  unavailable: 'Profiles aren’t available in this version of Afterglow yet.',
  unknown: 'Something went wrong. Try again.',
};

/** Shared videos are at most this big (the storage rules enforce it too). */
export const MAX_SHARE_BYTES = 150 * 1024 * 1024;
