import type { CrewVotes } from '../crews/votes';
import { t, type Language } from '../../i18n';
import type { Track } from '../memories/track';
import type { PastEvent } from '../memories/past';
import type { ShowTag } from '../memories/show';
import type { ClipWindow } from '../memories/trim';
import type { Hunt, HuntInput, Sticker, StickerInput } from '../finds/finds';
import type { PublicResident } from '../sprouts/publicGarden';
import type { Kandi, KandiInput, OpenKandiInput, PublicKandi } from '../kandi/kandi';
import type { DecorId } from '../sprouts/decor';
import type { Org, OrgCounter, OrgDay, OrgPost, OrgPostInput, OrgRequest, OrgRequestInput, OrgRequestStatus } from '../organizers/organizers';
import type { Published, Activity, ClipComment, Comment, Crew, CrewInvite, CrewMessage, CrewMessageInput, CrewMeetup, CrewMeetupInput, CrewPicks, CrewUpdate, CrewUpdateInput, MeetSpot, CrewCover, Profile, ProfileInput, ReportReason, SharedMemory, SocialUser, Standing, AdminCounts, AdminActivity, AdminPresence, Drop, DropInput, DropStatus, Flair, AppSettings, LivePatch, Privileges, ReportRecord, SupportMessage, SupportTopic, Sprout, SproutInput, DirectChat, SetTimesTip, VideoTag } from './models';
import type { ProviderProof } from './providerAuth';

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
  /** Playing back to back with `artistId`. */
  withArtistIds?: string[];
  /** The artist's name as typed, when they aren't on Afterglow yet. */
  artistName?: string;
  /** A festival from before Afterglow, instead of `festivalId`. */
  past?: PastEvent;
  /** People in the video, tagged once it's shared (it shows on their profiles; they can hide it). */
  people?: string[];
  /** A one-night show, instead of a festival. */
  show?: ShowTag;
  /** The part that plays, when it was trimmed. */
  clip?: ClipWindow;
  /** The song playing in it, when you kept the one Shazam found. */
  track?: Track;
  capturedAt: string;
  durationSec?: number;
  width?: number;
  height?: number;
};

/** What can change on a video once it's shared: where it's from and who was playing. */
export type SharedTags = Pick<ShareInput, 'festivalId' | 'night' | 'artistId' | 'withArtistIds' | 'artistName' | 'past' | 'show' | 'track'>;

export type FollowCounts = { followers: number; following: number };

export type ReportTarget = { kind: 'profile' | 'memory' | 'comment' | 'clipComment' | 'chat'; id: string; ownerUid: string };

export interface SocialService {
  availability(): SocialAvailability;
  /** Called with the signed-in user (or null) now and whenever it changes. Returns an unsubscribe. */
  onAuthChange(listener: (user: SocialUser | null) => void): () => void;
  signUp(email: string, password: string): Promise<SocialUser>;
  signIn(email: string, password: string): Promise<SocialUser>;
  /** Sign in (or up) with Apple or Google; `isNew` when this made the account. */
  signInWithProvider(proof: ProviderProof): Promise<{ user: SocialUser; isNew: boolean }>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Deletes your profile, shared memories, blocks and the account itself. Needs your password again, or Apple or Google again for an account that signs in with them. */
  deleteAccount(proof: string | ProviderProof): Promise<void>;

  profileOf(uid: string): Promise<Profile | null>;
  profileByHandle(handle: string): Promise<Profile | null>;
  /** Saves your profile, claiming the handle; `festivals`, `sounds` and `artists` are published only when switched on. */
  saveProfile(input: ProfileInput, published: Published): Promise<Profile>;
  /** Replace (a local image uri) or remove (null) your profile photo. */
  setAvatar(uri: string | null): Promise<Profile>;
  /** Set or remove the wide photo behind the top of your profile. */
  setCover(uri: string | null): Promise<Profile>;
  /** Choose an animated background for the top of your profile (a `BACKDROPS` id, `'none'`), or null for the cover photo again. */
  setBackdrop(id: string | null): Promise<Profile>;
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
  /** Reply to a message (it becomes answered); every reply is kept. */
  answerSupport(id: string, reply: string): Promise<void>;
  /** Mark a message closed, or open again. */
  setSupportStatus(id: string, status: 'open' | 'closed'): Promise<void>;
  /** Reports, newest first: every open one (up to `max`) and the newest `max` of all. */
  reports(max: number): Promise<ReportRecord[]>;
  /** Mark a report dealt with. */
  resolveReport(id: string): Promise<void>;
  /** Take down a shared video or a comment that breaks the guidelines. */
  takeDown(kind: 'memory' | 'comment' | 'clipComment' | 'chat', id: string): Promise<void>;
  /** A reported crew chat message (`crewId/messageId`), for the support account to read. */
  reportedMessage(target: string): Promise<CrewMessage | null>;
  /** A reported comment, for the support account to read before taking it down. */
  reportedComment(id: string): Promise<Comment | null>;
  /** A reported comment on a clip in Discover. */
  reportedClipComment(id: string): Promise<ClipComment | null>;
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
  /** Set times sent by a fan for a festival: text and/or a shrunk photo. One waiting per festival per person ('already-sent'). */
  sendSetTimes(festivalId: string, tip: { text?: string; photo?: string }): Promise<void>;
  /** The set times you've sent, waiting or live. */
  mySetTimes(): Promise<SetTimesTip[]>;
  /** HQ: set times fans sent and waiting, newest first. Support account only. */
  setTimesTips(max: number): Promise<SetTimesTip[]>;
  /** HQ: they're live (thanks the sender; the photo is dropped). Support account only. */
  markSetTimesLive(id: string): Promise<void>;
  /** HQ: not used (the sender can send again). Support account only. */
  declineSetTimes(id: string): Promise<void>;
  /** Catalogue updates published from HQ: anyone may read them (every app applies them); only the support account writes them. */
  livePatches(): Promise<LivePatch[]>;
  /** App-wide switches set from HQ: anyone may read them; only the support account changes them. */
  appSettings(): Promise<AppSettings>;
  setAppSettings(next: AppSettings): Promise<void>;
  publishPatch(input: { title: string; festivalId: string; file: string; dropId?: string }): Promise<LivePatch>;
  unpublishPatch(id: string): Promise<void>;
  /** Give or take back Afterglow Plus (null takes it back) and a flair (null takes it back). Support account only. */
  setPlus(uid: string, plus: { until?: string } | null): Promise<void>;
  setFlair(uid: string, flair: Flair | null): Promise<void>;
  /** Everyone with Plus or a flair. */
  privileged(): Promise<Privileges[]>;
  /** Notes that you opened the app now (your own `activity` record; merged with what's there). Never for the support account. */
  markActive(input: { platform: string; version: string; hasProfile: boolean; now: Date }): Promise<void>;
  /**
   * For each festival: how many show they're going, how many videos were
   * shared there, and how many "Get tickets" taps it had since `ticketsSince`
   * ("YYYY-MM-DD"; left out when those counts can't be read yet).
   */
  adminFestivals(ids: string[], ticketsSince?: string): Promise<Record<string, { going: number; videos: number; tickets?: number }>>;
  /** Count a "Get tickets" tap on a festival (signed in only; a number per festival and day, nothing about who). */
  countTicketTap(festivalId: string): Promise<void>;
  /** Someone's founder number and flair, for their border and caption. */
  standingOf(uid: string): Promise<Standing>;
  /** How many throwbacks (past festival videos) you've shared, which the free plan limits. */
  throwbackUsage(): Promise<number>;
  /** Show your glow level on your profile (a number from 1), or take it off (null). */
  setLevel(level: number | null): Promise<void>;
  searchProfiles(query: string): Promise<Profile[]>;
  /** Profiles that show this festival among the ones they're going to (only people who switched that on), at most `max`. */
  profilesGoingTo(festivalId: string, max: number): Promise<Profile[]>;

  shareMemory(input: ShareInput, onProgress?: (share: number) => void): Promise<SharedMemory>;
  unshareMemory(sharedId: string): Promise<void>;
  /** Change where your shared video is from and who was playing. A throwback stays one (its year and name can change). */
  retagShared(sharedId: string, tags: SharedTags): Promise<SharedMemory>;
  /** Who's tagged in a video: everyone who said yes, and (for the video's owner) who hasn't answered yet. */
  videoTags(memoryId: string): Promise<VideoTag[]>;
  /** Your video: tag these people (it shows on their profiles straight away); anyone left out is untagged. */
  setVideoTags(memoryId: string, uids: string[]): Promise<void>;
  /** Tagged in someone's video: say yes (it shows on your profile) or no (the tag goes). Also how you untag yourself. */
  answerVideoTag(memoryId: string, yes: boolean): Promise<void>;
  /** Videos someone is tagged in and said yes to, newest first. */
  taggedMemoriesOf(uid: string): Promise<SharedMemory[]>;
  memoriesOf(uid: string): Promise<SharedMemory[]>;
  /** Shared memories tagged with this festival (or, for "show:<id>", that one-night show), newest first (community clips in Discover). */
  festivalMemories(festivalId: string, max: number): Promise<SharedMemory[]>;
  /** Everyone's shared videos of an artist, newest first (a database without that index yet has none). */
  artistMemories(artistId: string, max: number): Promise<SharedMemory[]>;
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
  /** You joined from their invite link: recorded once, for one inviter (features/invites). Needs your profile. */
  claimInvite(by: string): Promise<void>;
  /** Who invited you, if you joined from someone's link. */
  myInviter(): Promise<{ by: string; at: string } | null>;
  /** Friends who joined from your invite link, newest first. */
  myInvites(max: number): Promise<{ uid: string; at: string }[]>;
  /** HQ: how many friends each person brought, most first. Support account only. */
  inviteCounts(): Promise<{ by: string; count: number }[]>;
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
  /** Comment on a clip in Discover (`clipId` is the clip's own id). Needs your profile. Online only, like video comments. */
  clipComment(clipId: string, text: string): Promise<ClipComment>;
  /** A clip's comments, oldest first, at most `max`; `after` (the last one already read) reads the next page. */
  clipComments(clipId: string, max: number, after?: ClipComment): Promise<ClipComment[]>;
  clipCommentCount(clipId: string): Promise<number>;
  /** Remove your own comment on a clip (the support account removes others with `takeDown`). */
  deleteClipComment(id: string): Promise<void>;
  /** What happened to you lately (new followers, likes and comments on your videos), newest first. */
  activity(max: number): Promise<Activity[]>;

  /** Start a crew for a festival, with you as its only member. Needs your profile. */
  createCrew(festivalId: string, name: string): Promise<Crew>;
  /** A crew by its id (anyone signed in with the link can see its name and who's in it). */
  crew(id: string): Promise<Crew | null>;
  /** The crews you're in. */
  myCrews(): Promise<Crew[]>;
  /**
   * Join a crew. Crews are invite only: you need an invite sent to you in the
   * app, or the code from an invite link (`code`). Joining means agreeing to
   * the crew chat rules, and that's recorded with the join. Needs your
   * profile; refused when the crew is full (`crew-full`) or without an invite
   * (`not-invited`). Joining twice is the same as once.
   */
  joinCrew(id: string, code?: string): Promise<Crew>;
  /** The code for a crew's invite link (members only); made the first time it's asked for. */
  crewInviteCode(crewId: string): Promise<string>;
  /** The owner makes a new invite link; the old one stops working. */
  newCrewInviteCode(crewId: string): Promise<string>;
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
  /**
   * Send messages to a crew's chat (members only), all in one small write so
   * a scrap of signal is enough. Each keeps `at`, when it was written; the
   * crew sees that time. Ids are made on the phone, so sending again after a
   * dropped connection never doubles a message. Resolves with the ids that
   * are in the chat now. With no signal (or a write that doesn't get through
   * within `CHAT_SEND_TIMEOUT_MS`) it throws `network`, and it's safe to try
   * again.
   */
  sendCrewMessages(crewId: string, inputs: readonly CrewMessageInput[]): Promise<string[]>;
  /**
   * Follow a crew's chat: called with its newest `max` messages (newest
   * first, by when they reached the crew) now and whenever they change.
   * Returns a stop function.
   */
  watchCrewChat(crewId: string, max: number, listener: (messages: CrewMessage[]) => void, onError?: (e: SocialError) => void): () => void;
  /** Note that you've read a crew's chat up to now (server time), so crewmates can see "Seen by". */
  markCrewChatRead(crewId: string): Promise<void>;
  /** Follow when each member last read a crew's chat: uid -> ISO time, now and whenever it changes. Returns a stop function. */
  watchCrewReads(crewId: string, listener: (reads: Record<string, string>) => void, onError?: (e: SocialError) => void): () => void;
  /** Remove a chat message: your own, or anyone's in a crew you own. */
  deleteCrewMessage(crewId: string, id: string): Promise<void>;
  /**
   * This phone's push address (an Expo push token), kept where the people who
   * may notify you can read it: in each of your crews and 1-to-1 chats, and on
   * its own for friends both ways and support. Crew chat, crew updates, the
   * meeting spot, crew invites and support replies then reach your phone.
   */
  registerPush(token: string, lang: Language): Promise<void>;
  /** Take this phone's push address away again, everywhere it was kept (before signing out). */
  unregisterPush(token: string): Promise<void>;
  /**
   * Open the 1-to-1 chat with a friend (made the first time): only between two
   * people who follow each other, and not if they've blocked you. With `org`
   * (the organizer one of the two runs), anyone may start it. Returns its
   * room id, which the crew chat functions above take.
   */
  openDirectChat(uid: string, org?: string): Promise<string>;
  /** Follow your 1-to-1 chats, now and whenever one starts. Returns a stop function. */
  watchDirectChats(listener: (chats: DirectChat[]) => void, onError?: (e: SocialError) => void): () => void;
  /** Everyone's votes on the lineup in a crew (members only). */
  crewVotes(crewId: string): Promise<CrewVotes[]>;
  /** Your votes in a crew (the whole set, replacing what was there). */
  setCrewVotes(crewId: string, votes: Pick<CrewVotes, 'lineup' | 'clashes'>): Promise<void>;
  /** The crew's meetups (members only), soonest first. */
  crewMeetups(crewId: string): Promise<CrewMeetup[]>;
  /** Set a meetup for the crew, as yourself; the crew gets a push. */
  addMeetup(crewId: string, input: CrewMeetupInput): Promise<CrewMeetup>;
  /** Call off a meetup (whoever set it, or the crew's owner). */
  removeMeetup(crewId: string, meetupId: string): Promise<void>;
  /** The crew's meeting spot, if one's set. Members only. */
  meetSpot(crewId: string): Promise<MeetSpot | null>;
  /** Set the crew's meeting spot (any member), or clear it with an empty text. */
  setMeetSpot(crewId: string, text: string): Promise<MeetSpot | null>;
  /** The crew's group photo, if one's set. Members only. */
  crewCover(crewId: string): Promise<CrewCover | null>;
  /** Set the crew's group photo (any member; `uri` is a JPEG on the phone), or remove it with null. Returns the new cover. */
  setCrewCover(crewId: string, uri: string | null): Promise<CrewCover | null>;

  /**
   * Give a sprout: saves the one whose code you're showing (its id was made
   * on your phone). Needs your profile. Giving the same id again is the same
   * as once.
   */
  giveSprout(input: SproutInput): Promise<void>;
  /**
   * Pick up a sprout someone gave you. `not-found` when it isn't there (yet:
   * the giver may still be waiting for signal); `sprout-gone` when it can't
   * be picked up (more than 30 days old, or the giver blocked you);
   * `sprout-taken` when someone else picked it up. Picking up your own
   * sprout again returns it.
   */
  claimSprout(id: string): Promise<Sprout>;
  /** One sprout, if it exists (for its note, and whether it's been picked up). */
  sprout(id: string): Promise<Sprout | null>;
  /** Sprouts you gave, newest first. */
  sproutsGiven(max: number): Promise<Sprout[]>;
  /** Sprouts you picked up, newest first. */
  sproutsReceived(max: number): Promise<Sprout[]>;
  /**
   * A gift theme that came with a sprout you picked up is yours: saved where
   * the database can check it (your profile may then show its background).
   * Saying so again is the same as once.
   */
  grantTheme(sproutId: string, theme: string): Promise<void>;
  /** Show your garden on your profile as it is now (who lives there and the kandi in it, nothing private), or take it down (null). */
  publishGarden(residents: PublicResident[] | null, kandi?: PublicKandi[], decor?: DecorId[]): Promise<void>;
  /** Someone's garden as they show it; null when they don't. */
  gardenOf(uid: string): Promise<{ residents: PublicResident[]; kandi: PublicKandi[]; decor: DecorId[] } | null>;
  /** Leave a glow on someone's shown garden (once each: again changes nothing), or take yours back. Not on your own; not if they blocked you. */
  glowGarden(uid: string, on: boolean): Promise<void>;
  /** Whether you've left a glow on this garden. */
  glowedGarden(uid: string): Promise<boolean>;
  /** Glows on your own garden: who left them, newest first (at most 100). */
  gardenGlows(): Promise<{ from: string; at: string }[]>;
  /** Keep a private copy of your garden (as saved on the phone) with your account, so a new phone, a cleared browser or a reinstall gets it back. Only you can read it. */
  saveGardenBackup(data: string): Promise<void>;
  /** Your garden's private copy; null when there's none yet. */
  gardenBackup(): Promise<string | null>;
  /** Leave kandi in someone's garden (they need a profile, and not to have blocked you). */
  giveKandi(input: KandiInput): Promise<Kandi>;
  /** Make kandi given by code: whoever picks it up first gets it (saying so again with the same id is the same as once). */
  leaveOpenKandi(input: OpenKandiInput): Promise<void>;
  /** One kandi by its code; null when it isn't there (taken back). */
  kandiById(id: string): Promise<Kandi | null>;
  /** Pick up kandi given by code: it's yours (`kandi-taken` when someone else has it). */
  claimKandi(id: string): Promise<Kandi>;
  /** Kandi left for you, newest first. */
  myKandi(max: number): Promise<Kandi[]>;
  /** Take kandi out of your garden (or take back one you gave). */
  removeKandi(id: string): Promise<void>;
  /** Take back a sprout nobody has picked up (one that isn't there is fine; `sprout-taken` once someone has it). A hat passed on (`via`) is yours again. */
  takeBackSprout(id: string, via?: string): Promise<void>;

  /** A sticker by its code, or null. Anyone can read one, signed in or not. */
  sticker(code: string): Promise<Sticker | null>;
  /** A hunt, or null. Anyone can read one. */
  hunt(id: string): Promise<Hunt | null>;
  /** Tell Afterglow you found a sticker (scanned at `at`, ms). Again is the same as once. `sticker-ended` when its end date had passed. */
  recordFind(code: string, at: number): Promise<void>;
  /** Make a sticker (added to the end of its hunt, if any). HQ, or an organizer's team for its own (`orgId`). */
  addSticker(input: StickerInput): Promise<Sticker>;
  stickers(max: number): Promise<Sticker[]>;
  /** Take a sticker's code down (its place in a hunt stays; scans from before still count). */
  deleteSticker(code: string): Promise<void>;
  addHunt(input: HuntInput): Promise<Hunt>;
  hunts(max: number): Promise<Hunt[]>;
  /** A hunt goes; its stickers stay as stickers on their own. */
  deleteHunt(id: string): Promise<void>;
  /** Stickers you've found, as Afterglow has them (from any phone): each code and when it was scanned (ms). */
  myFinds(max: number): Promise<{ code: string; at: number }[]>;
  /** How many people have found a sticker. */
  stickerFinds(code: string): Promise<number>;

  /** Event organizers' pages (features/organizers): anyone can read them, signed in or not. */
  orgs(): Promise<Org[]>;
  /** The organizer your signed-in email may run (its id), or null. */
  myOrg(): Promise<string | null>;
  /** Save an organizer's page: its own team (confirmed email), or HQ. Never changes its promotions. */
  saveOrg(org: Org): Promise<void>;
  /** Ask HQ for something: a promotion, a design, gifts. The organizer's team only. */
  sendOrgRequest(input: OrgRequestInput): Promise<OrgRequest>;
  /** An organizer's requests, newest first (its team or HQ); every organizer's with no id (HQ only). */
  orgRequests(orgId: string | null, max: number): Promise<OrgRequest[]>;
  /** HQ answers a request. */
  answerOrgRequest(id: string, status: OrgRequestStatus, reply?: string): Promise<void>;
  /** HQ promotes an event until that day ("YYYY-MM-DD"), or stops (null). */
  setPromotion(orgId: string, eventId: string, until: string | null): Promise<void>;
  /**
   * Link an account to an organizer (`on`), or unlink it: HQ for any account;
   * someone signed in with an organizer's (confirmed) email only for their own.
   */
  setOrgAccount(orgId: string, uid: string, on: boolean): Promise<void>;
  /**
   * Upload the organizer's logo (wide) or icon (square) from a picked image,
   * or take it away (null) to go back to the one shipped with the app. Its
   * team or HQ. Resolves with the new link.
   */
  setOrgImage(orgId: string, kind: 'logo' | 'icon', uri: string | null): Promise<string | undefined>;
  /** HQ: the @handle (and name) the organizer's accounts' profiles use, or none (null). */
  setOrgHandle(orgId: string, handle: string | null): Promise<void>;
  /** HQ: who may sign in to an organizer's studio (emails), and adding or taking one away (null). */
  orgMembers(orgId: string): Promise<string[]>;
  setOrgMember(email: string, orgId: string | null): Promise<void>;
  /** Count a view of an organizer's page, an event's page, a ticket tap or a promoted card (signed in only; one each time). */
  countOrgView(orgId: string, key: OrgCounter): Promise<void>;
  /** An organizer's numbers day by day since `since` ("YYYY-MM-DD"). Its team or HQ. */
  orgViews(orgId: string, since: string): Promise<OrgDay[]>;
  /** An organizer's stickers and gifts (its team or HQ), newest first. */
  orgStickers(orgId: string, max: number): Promise<Sticker[]>;
  orgHunts(orgId: string, max: number): Promise<Hunt[]>;
  /** How many people found each of an organizer's stickers and gifts (code -> count; counts only). Its team or HQ. */
  orgFinds(orgId: string): Promise<Record<string, number>>;
  /** Upload an event poster from the phone for an organizer (its team); its link, to put on the event. */
  uploadOrgPoster(orgId: string, uri: string): Promise<string>;
  /** Send an update to an organizer's followers (its team). */
  postOrgUpdate(orgId: string, input: OrgPostInput): Promise<OrgPost>;
  /** The newest updates from these organizers (at most 30), newest first. Anyone signed in. */
  orgPosts(orgIds: string[], max: number): Promise<OrgPost[]>;
  /** Take an update back (its team or HQ). */
  deleteOrgPost(id: string): Promise<void>;

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
  | 'not-invited'
  | 'sprout-taken'
  | 'kandi-taken'
  | 'sprout-gone'
  | 'throwback-limit'
  | 'sticker-ended'
  | 'already-sent'
  | 'not-found'
  | 'network'
  | 'unavailable'
  | 'account-exists'
  | 'cancelled'
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
  'email-in-use': t('There’s already an account with that email. Sign in instead.'),
  'invalid-email': t('That email doesn’t look right.'),
  'weak-password': t('Choose a longer password (at least 8 characters).'),
  'wrong-password': t('That email and password don’t match.'),
  'no-account': t('That email and password don’t match.'),
  'too-many-attempts': t('Too many tries. Wait a few minutes and try again.'),
  'handle-taken': t('Someone already has that handle.'),
  'not-signed-in': t('Sign in to do that.'),
  'no-profile': t('Create your profile first.'),
  'too-large': t('That video is too big to share. Try a shorter clip.'),
  'crew-full': t('That crew is full.'),
  'not-invited': t('Crews are invite only. Ask someone in the crew to invite you, or to send you a new invite link.'),
  'sprout-taken': t('Someone else already picked up this sprout.'),
  'kandi-taken': t('Someone else already picked up this kandi.'),
  'already-sent': t('You’ve already sent set times for this festival. We’ll look at them soon.'),
  'sprout-gone': t('This sprout can’t be picked up any more. Ask them for a new code.'),
  'throwback-limit': t('You’ve shared as many throwbacks as the free plan allows. It’s still saved in your Memories, with its badge.'),
  'sticker-ended': t('This sticker can’t be found any more.'),
  'not-found': t('That doesn’t exist any more.'),
  network: t('Couldn’t reach Afterglow. Check your connection and try again.'),
  unavailable: t('Profiles aren’t available in this version of Afterglow yet.'),
  'account-exists': t('There’s already an Afterglow account with that email. Sign in with your email and password.'),
  cancelled: t('Sign-in was cancelled.'),
  unknown: t('Something went wrong. Try again.'),
};

/** Shared videos are at most this big (the storage rules enforce it too). */
export const MAX_SHARE_BYTES = 150 * 1024 * 1024;
