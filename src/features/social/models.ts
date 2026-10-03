import type { SoundTag } from '../../data/models';

/**
 * Social profiles: what other Afterglow people can see about you. Plain
 * data, the same shape in the app and in the database.
 *
 * PUBLIC to anyone signed in to Afterglow: your handle, name, bio and photo,
 * and only what you switch on: the festivals you're going to, your top
 * sounds, and each memory you choose to share. Everything else (your taste,
 * ratings, reactions, music library, unshared memories, where you filmed)
 * stays private on your phone.
 */
export type SocialUser = { uid: string; email?: string; /** Whether the email address has been confirmed. */ emailVerified?: boolean };

export type Profile = {
  uid: string;
  /** Unique, lowercase: letters, numbers, dots and underscores. */
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  /** A wide photo behind the top of your profile. */
  coverUrl?: string;
  /** Festivals you're going to, shown only when you switch it on. */
  festivals: string[];
  /** Your top sounds, shown only when you switch it on. */
  sounds: SoundTag[];
  /** Your switches, so the published lists can follow your plans without re-saving. */
  showFestivals: boolean;
  showSound: boolean;
  createdAt: string;
  updatedAt: string;
};

/** What you edit. `showFestivals` / `showSound` decide whether those lists are published at all. */
export type ProfileInput = {
  handle: string;
  displayName: string;
  bio: string;
  showFestivals: boolean;
  showSound: boolean;
};

/** A memory you shared, as others see it. Where you filmed it is never included. */
export type SharedMemory = {
  id: string;
  uid: string;
  handle: string;
  videoUrl: string;
  thumbUrl?: string;
  festivalId?: string;
  night?: string;
  artistId?: string;
  capturedAt: string;
  durationSec?: number;
  /** The video's size, so upright clips get a tall player. */
  width?: number;
  height?: number;
  createdAt: string;
};

export type ReportReason = 'offensive' | 'harassment' | 'spam' | 'not-theirs' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'offensive', label: 'Offensive or explicit' },
  { key: 'harassment', label: 'Harassment or hate' },
  { key: 'spam', label: 'Spam or misleading' },
  { key: 'not-theirs', label: 'Not their video' },
  { key: 'other', label: 'Something else' },
];

/** Something that happened to you: someone followed you, or liked a video you shared. */
export type Activity =
  | { kind: 'follow'; id: string; from: string; createdAt: string }
  | { kind: 'like'; id: string; from: string; memoryId: string; createdAt: string }
  | { kind: 'comment'; id: string; from: string; memoryId: string; text: string; createdAt: string };

/**
 * A festival crew: a few friends planning one festival together. Anyone
 * signed in who has the crew's link can see its name and join (the id is the
 * invite); only members see each other's picks.
 */
/** An invitation to join a crew, sent in the app to someone you know there. They join from the crew page; joining or saying no removes it. */
export type CrewInvite = {
  /** `crewId_to` */
  id: string;
  crewId: string;
  festivalId: string;
  crewName: string;
  /** Who invited them (a member of the crew). */
  from: string;
  to: string;
  /** When it was sent (server time, ISO 8601). */
  at: string;
};

export type Crew = {
  id: string;
  festivalId: string;
  name: string;
  /** Who started it (or was handed it when they left). Can rename it and remove people. */
  owner: string;
  /** Members' uids in the order they joined, the owner among them. At most CREW_MAX. */
  members: string[];
  createdAt: string;
};

/** One member's starred sets at the crew's festival, shared with the crew only. */
export type CrewPicks = { uid: string; artists: string[]; updatedAt: string };

/** A crew holds at most this many people. */
export const CREW_MAX = 12;
/** Crew names are at most this long. */
export const CREW_NAME_MAX = 40;
/** At most this many picks are shared per member. */
export const CREW_PICKS_MAX = 100;

/**
 * A crew update: where you are and what you're seeing, for your crew only.
 * From a video (filmed then) or a quick check-in (tapped then).
 *
 * Two times, kept apart on purpose. `at` is when it happened on your phone:
 * when the video was filmed or the check-in tapped. That's the time the crew
 * sees, and the one that decides which update is newest. `sentAt` is when it
 * reached the crew, stamped by the server; festival signal can hold an update
 * back for hours, and the app says so instead of passing it off as new.
 */
export type CrewUpdate = {
  id: string;
  crewId: string;
  uid: string;
  /**
   * A video, a check-in, a reply to someone's update (`replyTo`, words in
   * `note`), or a photo (the picture in `thumbUrl`; photos only ever go to
   * crews, never to Discover or profiles).
   */
  kind: 'video' | 'checkin' | 'reply' | 'photo';
  /** When it happened on the phone (ISO 8601). */
  at: string;
  /** When it reached the crew (ISO 8601, from the server). */
  sentAt: string;
  festivalId: string;
  artistId?: string;
  stage?: string;
  /** A check-in's or reply's words ("Meet at our spot"), at most CREW_NOTE_MAX. */
  note?: string;
  /** A reply: the id of the update it answers, in the same crew. */
  replyTo?: string;
  /** A check-in that says "Can't find you": the crew should look out for you (or head to the meeting spot). */
  lost?: boolean;
  /** A check-in about how you are: "I'm OK", or "not feeling great, come find me". Sent only when you tap it. */
  care?: CrewCare;
  videoUrl?: string;
  thumbUrl?: string;
  /** When the video was also shared to Discover: that copy's id. */
  sharedId?: string;
  durationSec?: number;
  width?: number;
  height?: number;
};

/** How a crewmate says they are, when they choose to: fine, or would like someone to come. */
export type CrewCare = 'ok' | 'help';

/** What you send: the id is made on your phone, so sending again after a dropped connection never doubles it. */
export type CrewUpdateInput = Omit<CrewUpdate, 'crewId' | 'uid' | 'sentAt' | 'videoUrl' | 'thumbUrl'> & {
  /** A video already shared to Discover: the crew update points at that copy. */
  videoUrl?: string;
  thumbUrl?: string;
  /** Otherwise the files on this phone, uploaded for the crew only. */
  videoUri?: string;
  thumbUri?: string;
};

/** A crew's meeting spot, in words ("by the big tree left of Main Stage"), and who set it when. */
export type MeetSpot = { text: string; by: string; at: string };
/** Meeting spots are at most this long. */
export const MEET_SPOT_MAX = 80;

/** Check-in words are at most this long. */
export const CREW_NOTE_MAX = 80;
/** Stage names in an update are at most this long. */
export const CREW_STAGE_MAX = 60;

/** A comment on a shared video. Anyone signed in can read them; you write as yourself, with a profile. */
export type Comment = {
  id: string;
  memoryId: string;
  /** Who shared the video (they can remove any comment on it). */
  owner: string;
  uid: string;
  /** The commenter's @handle when they wrote it. */
  handle: string;
  text: string;
  createdAt: string;
};

/** Comments are at most this long. */
export const COMMENT_MAX = 300;

/** The first this many people to make a profile are founders, numbered in the order they arrived. */
export const FOUNDERS_MAX = 100;

/** Who a special border and caption is for, set by Afterglow (never by the person): artists, the team, partners. */
export type FlairKind = 'artist' | 'team' | 'partner';
export const FLAIR_KINDS: readonly FlairKind[] = ['artist', 'team', 'partner'];
/** A special border and caption ("Artist", "Afterglow team"), given out by hand in the Firebase console. */
export type Flair = { kind: FlairKind; caption: string };

/** What sets a profile apart: founder number, and any flair. Anyone can see it; nobody can give it to themselves. */
export type Standing = {
  founder?: number;
  flair?: Flair;
  /** Afterglow Plus: their videos show without the edge glow and its AFTERGLOW label. */
  plus?: boolean;
};

/** What a support message is about. */
export type SupportTopic = 'help' | 'bug' | 'idea' | 'festival' | 'other';
export const SUPPORT_TOPICS: { key: SupportTopic; label: string }[] = [
  { key: 'help', label: 'I need help' },
  { key: 'bug', label: 'Something’s broken' },
  { key: 'idea', label: 'An idea' },
  { key: 'festival', label: 'A festival' },
  { key: 'other', label: 'Something else' },
];
/** Support messages are at most this long. */
export const SUPPORT_MAX = 1000;
export type SupportStatus = 'open' | 'answered' | 'closed';

/** A message to Afterglow support, and the reply when there is one. */
export type SupportMessage = {
  id: string;
  uid: string;
  handle?: string;
  name?: string;
  /** The sender's sign-in email, so support can also write back by email. */
  email?: string;
  topic: SupportTopic;
  text: string;
  platform?: string;
  version?: string;
  status: SupportStatus;
  createdAt: string;
  reply?: string;
  repliedAt?: string;
};

/** A report, as the support account sees it. */
export type ReportRecord = {
  id: string;
  by: string;
  kind: 'profile' | 'memory' | 'comment';
  targetId: string;
  ownerUid: string;
  reason: ReportReason;
  note: string;
  createdAt: string;
  status: 'open' | 'resolved';
};

/** The dashboard's numbers, all counted on the server. */
export type AdminCounts = {
  people: number;
  peopleThisWeek: number;
  videos: number;
  videosThisWeek: number;
  follows: number;
  likes: number;
  comments: number;
  crews: number;
  founders: number;
  supportOpen: number;
  reports: number;
  /** Signed-in accounts that have opened the app since activity was first recorded (with or without a profile). */
  accounts: number;
  /** Reports not yet marked dealt with. */
  reportsOpen: number;
  supportTotal: number;
  crewInvites: number;
};

/**
 * When a signed-in account last used Afterglow, kept in `activity/{uid}`:
 * only that account and the support account can read it. `days` are the
 * phone's own calendar days it opened the app on (newest last, at most
 * `ACTIVE_DAYS_KEPT`), so the dashboard can tell active from inactive and
 * work out who came back. Nothing about what anyone did is in it.
 */
export type AdminPresence = {
  uid: string;
  firstSeenAt: string;
  lastSeenAt: string;
  days: string[];
  platform?: string;
  version?: string;
  hasProfile: boolean;
};
export const ACTIVE_DAYS_KEPT = 90;

/** A shared video as the dashboard sees it: when, by whom, of whom, where. */
export type AdminVideo = { createdAt: string; uid: string; handle?: string; artistId?: string; festivalId?: string; durationSec?: number };

/** Moments things happened, newest first, for the dashboard's day-by-day charts. */
export type AdminActivity = {
  signups: string[];
  videos: AdminVideo[];
  comments: string[];
  likes: string[];
  follows: string[];
  crews: string[];
};
