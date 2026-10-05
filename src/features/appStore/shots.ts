import type { Clip, Festival } from '../../data/models';
import type { Rating } from '../taste/ratings';
import { lineupClips } from '../festivals/links';
import { bySoonest, isOver } from '../festivals/shelves';

/**
 * App Store screenshots of the website build (`scripts/app-store-shots.ts`).
 * Pure: which festival and artists to show, the saved state that makes the
 * screens look lived in, the list of shots and the branded frame around each.
 * Everything shown comes from the real catalogue: a real festival and real
 * artists on its lineup. Nothing here invents lineups, set times or people.
 */

/** The iPhone sizes App Store Connect asks for, portrait, in pixels. */
export const DEVICES = [
  { key: '6.9', name: '6.9-inch', width: 1320, height: 2868 },
  { key: '6.5', name: '6.5-inch', width: 1284, height: 2778 },
] as const;
export type Device = (typeof DEVICES)[number];

/** Rendered at the phone's own size in points, three pixels to a point, like a real iPhone. */
export const SCALE = 3;
export const cssSize = (d: Device) => ({ width: d.width / SCALE, height: d.height / SCALE });

/** The app's screen inside the frame, as a share of the frame's width. */
export const SCREEN_SHARE = 0.76;

/** A festival worth showing needs a lineup with this many acts. */
export const LINEUP_MIN = 20;
/** How many artists the seeded person loves, and likes. */
export const LOVES = 6;
export const LIKES = 4;
/** How many of the loved artists are starred as must-sees. */
export const STARS = 3;

/**
 * The festival the screenshots are about: the one asked for, else the
 * soonest real (not demo) festival that hasn't started yet and has a proper
 * lineup, else the soonest real one not over.
 */
export function chooseFestival(
  festivals: readonly Festival[],
  demoIds: ReadonlySet<string>,
  today: Date,
  wanted?: string,
): Festival | undefined {
  if (wanted) return festivals.find((f) => f.id === wanted);
  const real = festivals.filter((f) => !demoIds.has(f.id) && !isOver(f, today) && f.lineup.length >= LINEUP_MIN);
  const todayKey = dayKey(today);
  const ahead = real.filter((f) => !!f.startDate && f.startDate > todayKey);
  return bySoonest(ahead, today)[0] ?? bySoonest(real, today)[0];
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Artists from the festival's lineup for the seeded person: ones with clips
 * first (so Discover has something to play), then the ones who play the most
 * festivals in the catalogue (the best known), then billing order. Lineup
 * entries that aren't one artist ("… takeover", "… presents", b2b sets) are
 * left out.
 */
export function chooseArtists(
  festival: Festival,
  clips: readonly Clip[],
  festivals: readonly Festival[],
  count = LOVES + LIKES,
): string[] {
  const withClips = new Set(lineupClips(festival, [...clips]).map((c) => c.artistId));
  const plays = (id: string) => festivals.filter((f) => f.lineup.includes(id)).length;
  return festival.lineup
    .filter((id) => !/takeover|presents|experience|-b2b-/.test(id))
    .map((id, i) => ({ id, i, clips: withClips.has(id) ? 1 : 0, plays: plays(id) }))
    .sort((a, b) => b.clips - a.clips || b.plays - a.plays || a.i - b.i)
    .slice(0, count)
    .map((x) => x.id);
}

export type Seed = {
  festival: Festival;
  artists: readonly string[];
  clips: readonly Clip[];
  /** The What's new key the app is on, so it doesn't open over a screenshot. */
  whatsNewKey: string;
  now: number;
};

/**
 * What goes into the browser's storage before the app starts (the keys the
 * app's own stores use): going to the festival, a handful of loved and liked
 * artists, a few stars, two liked clips and a little Look after yourself
 * (water and a check-in, nothing else), with every first-time tip and
 * pop-up already seen.
 */
export function seedStorage({ festival, artists, clips, whatsNewKey, now }: Seed): Record<string, string> {
  const loves = artists.slice(0, LOVES);
  const likes = artists.slice(LOVES, LOVES + LIKES);
  const ratings: Record<string, Rating> = {};
  for (const id of loves) ratings[id] = 'love';
  for (const id of likes) ratings[id] = 'like';
  const shown = lineupClips(festival, [...clips]).filter((c) => loves.includes(c.artistId));
  const liked = shown.slice(0, 2);
  const reactions = Object.fromEntries(liked.map((c) => [c.id, { liked: true, saved: false, skipped: false }]));
  const seen = Object.fromEntries(shown.slice(0, 4).map((c, i) => [c.id, now - (i + 1) * 60_000]));
  const minute = 60_000;
  const care = {
    timers: [],
    log: [
      { kind: 'water', at: now - 95 * minute },
      { kind: 'checkin', at: now - 70 * minute, mood: 'great' },
      { kind: 'water', at: now - 40 * minute },
      { kind: 'water', at: now - 10 * minute },
    ],
    lock: false,
  };
  return {
    'welcomed.v1': 'true',
    'whatsNew.v1': whatsNewKey,
    'hints.v1': JSON.stringify(['swipe', 'like', 'hold']),
    'questTip.v1': '1',
    'careTip.v1': '1',
    'going.v1': JSON.stringify([festival.id]),
    'discoverFocus.v1': festival.id,
    'artistRatings.v1': JSON.stringify(ratings),
    'mustSees.v2': JSON.stringify({ [festival.id]: loves.slice(0, STARS) }),
    'reactions.v1': JSON.stringify(reactions),
    'seen.v1': JSON.stringify(seen),
    'care.v1': JSON.stringify(care),
  };
}

export type Shot = {
  id: string;
  headline: string;
  sub: string;
  /** Where the app opens for it. */
  path: string;
  /** Text to scroll into view before the capture. */
  scrollTo?: string;
};

/**
 * The screenshots, in App Store order. The timetable and route only once
 * the festival's set times are out (they're never made up).
 */
export function shotList(festival: Festival): Shot[] {
  const page = `/festival/${festival.id}`;
  const shots: Shot[] = [
    { id: 'discover', headline: 'Live sets from your lineups', sub: 'Swipe through clips of the artists you’re going to see.', path: '/' },
    { id: 'for-you', headline: 'A plan built from your sound', sub: `${festival.name}, ranked by what you love.`, path: page },
    { id: 'my-sound', headline: 'See your sound', sub: 'Every artist you love, as a living map.', path: '/sound?view=map' },
  ];
  if (festival.sets?.length) {
    shots.push({ id: 'timetable', headline: 'Your route, set to set', sub: 'The day planned around the sets you want.', path: page, scrollTo: 'Full day route' });
  }
  shots.push(
    { id: 'festivals', headline: 'Every festival, counted down', sub: 'Lineups, dates and who you’ll love at each.', path: '/festivals' },
    { id: 'festival-map', headline: 'Find festivals near you', sub: 'Every festival on one map.', path: '/festival-map' },
    { id: 'crew', headline: 'Go with your crew', sub: 'Start a crew, share picks and find each other.', path: '/together' },
    { id: 'care', headline: 'Look after yourself', sub: 'Water, how you feel and help close by. Private to you.', path: '/care' },
  );
  return shots;
}

/** File name for one shot at one size: "6.9-01-discover.png". */
export const shotFile = (device: Device, index: number, shot: Shot) => `${device.key}-${String(index + 1).padStart(2, '0')}-${shot.id}.png`;

/** A PNG's size from its header, or undefined when it isn't a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((b, i) => bytes[i] !== b)) return undefined;
  const word = (at: number) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
  return { width: word(16), height: word(20) };
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The branded frame: the night sky with the app's purple glow, the headline
 * and a short line above, and the app's screen below with rounded corners.
 * Laid out in points for `cssSize(device)`.
 */
export function frameHtml({ headline, sub, image, width, height }: { headline: string; sub: string; image: string; width: number; height: number }): string {
  const screenW = Math.round(width * SCREEN_SHARE);
  const screenH = Math.round((screenW * height) / width);
  const radius = Math.round(screenW * 0.11);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#0A0918}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#F3F0FF;position:relative;-webkit-font-smoothing:antialiased}
.sky{position:absolute;inset:0;background:
radial-gradient(70% 38% at 50% 30%,rgba(107,63,224,.55),rgba(58,35,128,.18) 55%,transparent 75%),
radial-gradient(60% 30% at 85% 0%,rgba(169,124,255,.28),transparent 70%),
radial-gradient(60% 30% at 0% 100%,rgba(28,42,107,.55),transparent 70%),
linear-gradient(180deg,#0E0C24 0%,#0A0918 60%,#0A0918 100%)}
.text{position:absolute;left:0;right:0;top:${Math.round(height * 0.055)}px;padding:0 ${Math.round(width * 0.08)}px;text-align:center}
h1{margin:0;font-size:${Math.round(width * 0.085)}px;line-height:1.1;font-weight:700;letter-spacing:-0.03em}
p{margin:${Math.round(width * 0.025)}px 0 0;font-size:${Math.round(width * 0.04)}px;line-height:1.35;color:rgba(243,240,255,.68);font-weight:500}
.screen{position:absolute;left:${Math.round((width - screenW) / 2)}px;top:${Math.round(height * 0.2)}px;width:${screenW}px;height:${screenH}px;border-radius:${radius}px;overflow:hidden;
box-shadow:0 0 0 1px rgba(255,255,255,.14),0 0 ${Math.round(width * 0.12)}px rgba(169,124,255,.35),0 ${Math.round(width * 0.04)}px ${Math.round(width * 0.1)}px rgba(0,0,0,.6)}
.screen img{display:block;width:100%;height:100%}
</style></head><body><div class="sky"></div><div class="text"><h1>${escapeHtml(headline)}</h1><p>${escapeHtml(sub)}</p></div>
<div class="screen"><img src="${image}" alt=""></div></body></html>`;
}
