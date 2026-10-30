import { APP_NAME, SUPPORT_EMAIL } from '../../config/app';
import { GUIDELINES } from '../social/copy';
import { CHAT_RULES } from '../crews/chat';

/**
 * The Privacy Policy, Terms of Use and Community Guidelines, as plain data so
 * the app and the website show exactly the same words. Written from what the
 * app really does (see docs/legal.md for where each claim comes from); they
 * should be reviewed before a public launch. Pure.
 */
export type LegalDoc = 'privacy' | 'terms' | 'guidelines';
export type LegalSection = { heading?: string; paragraphs: string[] };
export type LegalDocument = { id: LegalDoc; title: string; updated: string; intro: string; sections: LegalSection[] };

/** When these words last changed (shown as "Last updated"). */
export const LEGAL_UPDATED = 'October 30, 2026';

/** Who runs Afterglow, named on the Privacy Policy and the Terms. */
export const OPERATOR = 'Matthew Smith, in Florida, United States';

export const LEGAL_DOCS: LegalDoc[] = ['privacy', 'terms', 'guidelines'];

export const isLegalDoc = (v: unknown): v is LegalDoc => typeof v === 'string' && (LEGAL_DOCS as string[]).includes(v);

/** How to reach the team: the support email when there is one, otherwise the app's own report tools. */
export function contactParagraph(email: string = SUPPORT_EMAIL): string {
  return email
    ? `Questions about this, or a request about your data: ${email}.`
    : `Questions about this, or a request about your data: use Report on the profile or video concerned, or delete your account from Edit profile. A contact email will be listed here soon.`;
}

/** What the Terms say once the app has partner (affiliate) links, and only then. */
export const PARTNER_TERMS =
  'Some links to tickets, places to stay or things to pack are partner links: if you buy through them, Afterglow may earn a commission from the seller. It doesn’t change your price. What you buy is between you and the seller, under their terms.';

/** What the Privacy Policy says about partner links, once there are any. */
export const PARTNER_PRIVACY =
  'Partner links (tickets, places to stay, things to pack) open the seller’s own site, which may note that you came from Afterglow so we can be paid a commission. We don’t send them anything about you, and we don’t see what you buy.';

/**
 * `partners`: the app has partner links (see features/partners), so the Terms
 * and Privacy Policy say so. False until a real one is added.
 */
export function legalDocument(id: LegalDoc, email: string = SUPPORT_EMAIL, opts: { partners?: boolean } = {}): LegalDocument {
  const contact = contactParagraph(email);
  const partners = !!opts.partners;
  switch (id) {
    case 'privacy':
      return {
        id,
        title: 'Privacy Policy',
        updated: LEGAL_UPDATED,
        intro: `${APP_NAME} is run by ${OPERATOR} (“we” and “us” here). It’s built so that most of what it knows about you stays on your phone. This explains what stays there, what leaves it when you choose to share, and what you can do about it.`,
        sections: [
          {
            heading: 'What stays on your device',
            paragraphs: [
              'Your taste: the clips you like, save, skip and watch, the artists you rate, the festivals you’re going to, the sets you star, your recent searches and what you’ve seen in Discover. These are kept on your phone (or in your browser on the website) and aren’t sent to us, except what you can choose to share below: your favourite artists (shown on your profile unless you switch it off), the festivals you’re going to (if you show them on your profile) and the sets you star at a festival whose crew you’ve joined.',
              'Your memories (videos you add) stay on your phone until you choose to share one. When you add a video, Afterglow may read when and where it was filmed to guess the festival and set. Only the city and region are kept, on your phone; exact coordinates are not stored.',
              'If you turn on festivals near you, Afterglow asks for your location, rounds it to about a kilometre and keeps it on your phone (or in your browser) to show how far festivals are. Your phone’s maps service may be asked which town that is, and where a festival’s venue is. It isn’t sent to us, and you can turn it off on the Festivals tab.',
              'Festival trail (only if you turn it on): on the days a festival you’re going to is on, Afterglow records where you walk, including while the app is closed (it needs “Always” location for that), and stops by itself when the festival is over. It draws your day on a map, with how far you walked. It is kept only on your phone, never sent to us or shown to anyone, and removed when you delete it in the app or delete the app.',
              'Find my way back: if you save where you parked, camped or any spot, Afterglow keeps that place on your phone (or in your browser) to point you back to it. It is never sent to us, and Forget removes it.',
              'Fit checks (photos of your outfit) and the sets you’ve seen and rated stay on your phone. A fit check goes to your crew only if you tap Send, as a crew photo.',
              'Festival weather: for a festival coming up soon, Afterglow asks Open-Meteo (a free weather service) for the forecast at the festival’s location, not yours. Nothing about you is sent with it.',
              'If you connect Spotify or Apple Music, your sign-in is kept in your phone’s secure storage and a summary of your library (which artists, not song titles or playlists) is kept on your phone to shape your recommendations. None of it is sent to us. Disconnecting removes it.',
              'Reminders are scheduled on your phone. If you allow notifications and are signed in, your phone’s notification address is stored with your account: in each crew and 1-to-1 chat you’re in (so the people there can notify you of their messages, check-ins and meeting spot), and on its own for friends who follow you back (crew invites) and Afterglow support (replies to your messages). Turning notifications off in your phone’s settings stops them, and signing out removes this phone’s address.',
              'Messages you write in a crew’s chat are seen only by the people in that crew, with when you wrote them and when they arrived; leaving the crew removes yours and ending it removes them all. 1-to-1 messages are seen only by the two of you, and deleting your account removes yours. Afterglow support can read crew chats and 1-to-1 messages, and does so only when handling a report or a safety issue; it can remove messages that break the rules. Joining a crew also records that you agreed to its chat rules and how you were invited.',
              'Photos you send to a crew go only to the people in that crew, stored with the crew\u2019s updates; they never appear on Discover or your profile, and leaving the crew removes the ones you sent.',
              'Crew on the map (only if you turn it on, for one crew at a time): while a festival you’re going to is on, your phone sends where you are to that crew while the app is open, rounded to about a metre, and only its members can see it. It switches itself off the morning after the festival, when you turn it off, or when you leave the crew, and it’s removed then.',
              'When you’re signed in: the days and times you open the app, which kind of phone or the website, and the app version. This tells us how many people use Afterglow and keeps old versions in view; it never includes what you watch or do, and only you and Afterglow support can read it. It’s removed with your account.',
              'Switching accounts: if you save accounts for quick switching, their emails and names are kept on your phone, and their passwords only in your phone’s keychain (on the website, nothing is kept and you type the password each time). They never leave your phone.',
              'Support messages: when you contact support in the app, we keep your message and our replies with your name, @handle and sign-in email so we can reply; only you and Afterglow support can read them, and they’re deleted with your account.',
              'Founders and badges: if you were one of the first 100 people to make a profile, your founder number is public and shows on your profile. Your festival badges are worked out from the videos you share, so anyone who can see those videos can see your badges. Your glow level from daily quests (a single number) shows on your profile too, unless you switch it off in Edit profile; switching it off removes it.',
              'Look after yourself (stopwatches, including what you chose to time them for, water, food, check-ins and pulse checks) is kept only on your phone. Steps are read from your phone’s own motion counter, only after you ask, and are not stored. None of it is sent to us, shown on your profile or in recaps; it can be locked with Face ID, and Clear everything removes it. Only if you tap “I’m OK” or “Ask my crew for help” does your crew get that one check-in (not how you felt or anything else on the page), like any other crew update.',
            ],
          },
          {
            heading: 'What you share with an account',
            paragraphs: [
              'Creating a profile is optional. If you do, we store your email address and password sign-in (through Google Firebase Authentication), and your profile: name, @handle, bio, photo and any Instagram, Snapchat or TikTok usernames you add (shown as links to those accounts). Anyone signed in to Afterglow can see your profile.',
              'Only if you switch them on: the festivals you’re going to and your top three sounds are shown on your profile. Your favourite artists (up to six, worked out from the artists you love, like or follow) and the animated background you pick are shown unless you switch them off.',
              'Videos you choose to share to your profile, with the festival, night and artist you tagged (for a festival from before Afterglow, the name, year and town you gave it; we also count how many of those you’ve shared, since the free plan shares up to three). Anyone signed in can watch them. Afterglow doesn’t add where you filmed, but a video file can carry its own details from your phone. If you add the song Shazam heard, its title and artist show with the video.',
              'Who you follow, the shared videos you like, festival crews you join and the sets you star at that crew’s festival (seen only by the crew), people you block (seen only by you) and reports you send (seen only by us).',
              'Sprouts you give: who gave it, its kind (or, for an artist’s collectible, the artist) and any note, the festival it was given at, and once someone picks it up, who and when. Anyone with its code can see who it’s from. Sprouts you pick up are kept the same way. Your garden’s growth is worked out on your phone.',
              'Stickers you find: which sticker and when you scanned it, so it stays in your collection on every phone and so Afterglow can count how many people found each one. For a sticker or gift from an event organizer, the organizer sees how many people found it, never who.',
              'Event organizers on Afterglow see counts only: how many times signed-in people opened their page and their events’ pages, tapped their tickets link, saw their promoted event or found their stickers each day, and how many people show their events on their profile or shared videos there (as anyone can see). They never see who.',
              'Set times you send for a festival: the text and any screenshot, seen only by us. We check them before publishing the set times for everyone (never your screenshot, which is deleted once they’re checked), and keep that they went live so we can thank you.',
            ],
          },
          {
            heading: 'Who else is involved',
            paragraphs: [
              'Accounts, shared videos and the website are run on Google Firebase (Authentication, Cloud Firestore, Cloud Storage and Hosting), with data stored in the United States. Google processes it for us under its own terms.',
              'Notifications go through Expo’s push service (650 Industries) and Apple’s or Google’s, which carry a notification’s words (for a chat message, its first lines) to your phone.',
              'On iPhone, while you tag a video Afterglow can ask Apple’s Shazam which song is playing: your phone sends Apple a short fingerprint of the sound (not the video or its sound itself), and nothing is kept unless you add the song.',
              'Clips in Discover play in YouTube’s own player, so YouTube (Google) receives what any embedded YouTube video receives and applies its own privacy policy. Spotify and Apple Music sign-ins happen on their own pages.',
              ...(partners ? [PARTNER_PRIVACY] : []),
              'We don’t sell your data, show ads, or use advertising or third-party analytics trackers.',
            ],
          },
          {
            heading: 'Your choices',
            paragraphs: [
              'Delete your account any time from Profile → Edit profile → Delete account. Your profile, handle, shared videos, follows, likes, crew memberships, 1-to-1 messages and support messages are removed. What’s on your phone stays there until you delete the app or use Start over on My Sound.',
              'Remove a shared video from your profile at any time; its file is deleted. Switch off showing your festivals, sound or favourite artists in Edit profile. Block anyone, and they can no longer follow you, like your videos or join a crew you started.',
            ],
          },
          {
            heading: 'Age',
            paragraphs: ['Afterglow is for adults: accounts are only for people 18 or older, and it isn’t meant for anyone under 18. If you believe someone under 18 has an account, let us know and we’ll remove it.'],
          },
          { heading: 'Changes and contact', paragraphs: ['If this policy changes, the date above changes with it, and we’ll mention big changes in the app.', contact] },
        ],
      };
    case 'terms':
      return {
        id,
        title: 'Terms of Use',
        updated: LEGAL_UPDATED,
        intro: `These terms apply when you use ${APP_NAME}, in the app or on the website. ${APP_NAME} is run by ${OPERATOR} (“we” and “us” here). By using it, or by creating a profile, you agree to them.`,
        sections: [
          {
            heading: 'Using Afterglow',
            paragraphs: [
              'You must be at least 18 to create a profile. Keep your sign-in to yourself; you’re responsible for what’s done with your account.',
              'Festival information (lineups, days, set times) comes from official sources but can change or be wrong. Check with the festival before you rely on it. Plans and routes are suggestions.',
              'Clips in Discover are official videos played in YouTube’s player and belong to their owners.',
              ...(partners ? [PARTNER_TERMS] : []),
            ],
          },
          {
            heading: 'What you share',
            paragraphs: [
              'You keep ownership of the videos, photos and words you share. By sharing them you let Afterglow store them and show them to other people on Afterglow, for as long as they’re shared.',
              'Only share what you filmed yourself or have the right to share, and follow the Community Guidelines. We may remove content or accounts that break them, and we act on reports.',
            ],
          },
          {
            heading: 'Please don’t',
            paragraphs: [
              'Harass, threaten or impersonate anyone; share anything illegal, hateful or sexually explicit; spam; or try to break, overload, scrape or get around the app’s security or limits.',
            ],
          },
          {
            heading: 'The service',
            paragraphs: [
              'Features may change, pause or stop, and we can’t promise it will always be available or free of mistakes. It’s provided as it is, and to the extent the law allows we aren’t responsible for losses from using it or from relying on festival information.',
              'You can stop using Afterglow and delete your account at any time. We may suspend or close accounts that break these terms.',
            ],
          },
          {
            heading: 'The App Store',
            paragraphs: [
              'If you got Afterglow from Apple’s App Store, Apple’s standard licence for apps also applies. These terms are between you and us, not Apple: Apple isn’t responsible for Afterglow, its content or its support, and has no duty to maintain it.',
            ],
          },
          {
            heading: 'Which law applies',
            paragraphs: [
              'These terms follow the laws of the State of Florida, United States, without regard to its rules on conflicts of law. Any dispute about them or about Afterglow is handled in the state or federal courts located in Florida, unless the law where you live gives you the right to bring it there.',
            ],
          },
          { heading: 'Changes and contact', paragraphs: ['If these terms change, the date above changes with it, and we’ll mention big changes in the app.', contact] },
        ],
      };
    case 'guidelines':
      return {
        id,
        title: 'Community Guidelines',
        updated: LEGAL_UPDATED,
        intro: 'Afterglow is for sharing the best moments of the festivals you love. Everyone agrees to these when they create a profile.',
        sections: [
          { paragraphs: GUIDELINES },
          {
            heading: 'Crew chats',
            paragraphs: [
              'Crews are invite only: you join one from an invite in the app or an invite link from someone in it. Starting or joining a crew means agreeing to these rules for its chat, as well as everything above.',
              ...CHAT_RULES,
              'Only the people in a crew can read its chat (and Afterglow support, only when handling a report or a safety issue). The person who started the crew can remove messages and people. Report a message by holding it; reported messages are reviewed and can be removed.',
            ],
          },
          {
            heading: 'Reports and blocks',
            paragraphs: [
              'Use ••• on a profile or video to report it or block the person. A reported video is hidden for you straight away. Reports are reviewed, and content or accounts that break these guidelines are removed.',
              contact,
            ],
          },
        ],
      };
  }
}

/** The address of each page (in the app and on the website). */
export const legalPath = (id: LegalDoc) => `/legal/${id}`;
