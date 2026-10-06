import { SOUNDCLOUD_PREFIX, soundcloudCardId } from '../../data/catalog';
import type { Artist, Clip, Festival, SoundCloudProfile } from '../../data/models';
import { t } from '../../i18n';

/**
 * SoundCloud cards in Discover: one card per artist with a SoundCloud page
 * (matched each night, or set in the catalogue), playing their uploads in
 * SoundCloud's official embedded player. They're clips like any other to the
 * feed and the taste engine (likes, saves and skips count for the artist),
 * with the id "soundcloud:<artist id>". Pure.
 */

/** The words on the card and in lists. */
export const SOUNDCLOUD_TITLE = t('On SoundCloud');
/** A card has no fixed length; this only keeps the clip shape whole. */
const CARD_SEC = 60;

export const isSoundCloudClip = (clip: Clip) => clip.source?.provider === 'soundcloud';
export const isSoundCloudCardId = (id: string) => id.startsWith(SOUNDCLOUD_PREFIX) && id.length > SOUNDCLOUD_PREFIX.length;
/** The artist a SoundCloud card is for. */
export const artistOfCard = (id: string) => (isSoundCloudCardId(id) ? id.slice(SOUNDCLOUD_PREFIX.length) : undefined);

/** One artist's SoundCloud card, filed under a festival they play (their first in the catalogue; "" when none). */
export function soundcloudClip(artistId: string, profile: SoundCloudProfile, festivalId = ''): Clip {
  return {
    id: soundcloudCardId(artistId),
    artistId,
    festivalId,
    title: SOUNDCLOUD_TITLE,
    durationSec: CARD_SEC,
    bpm: 0,
    source: { provider: 'soundcloud', ...profile },
  };
}

type Pages = {
  artists: readonly Artist[];
  soundcloud: Record<string, SoundCloudProfile>;
  festivalsOf: (artistId: string) => Festival[];
};

/** Every artist's SoundCloud card, in catalogue order of artists. */
export function soundcloudClips({ artists, soundcloud, festivalsOf }: Pages, only?: (artistId: string) => boolean): Clip[] {
  const out: Clip[] = [];
  for (const a of artists) {
    const p = soundcloud[a.id];
    if (!p || (only && !only(a.id))) continue;
    out.push(soundcloudClip(a.id, p, festivalsOf(a.id)[0]?.id));
  }
  return out;
}

/**
 * SoundCloud cards you reacted to, so your likes, saves and skips keep
 * counting for the artist (and Your clips can list them), even when the card
 * is out of the feed. Only ids of artists on Afterglow.
 */
export function reactedCards(reactionIds: Iterable<string>, pages: Pages, hasArtist: (id: string) => boolean, loaded: ReadonlySet<string>): Clip[] {
  const out: Clip[] = [];
  for (const id of reactionIds) {
    const artistId = artistOfCard(id);
    if (!artistId || loaded.has(id) || !hasArtist(artistId)) continue;
    const p = pages.soundcloud[artistId];
    out.push(p ? soundcloudClip(artistId, p, pages.festivalsOf(artistId)[0]?.id) : { id, artistId, festivalId: '', title: SOUNDCLOUD_TITLE, durationSec: CARD_SEC, bpm: 0 });
  }
  return out;
}

/**
 * SoundCloud's official embedded player for a page: their uploads, in the
 * page's big-picture look, without comments or related tracks, in the accent
 * colour (a hex like "#A97CFF").
 */
export function embedUrl(pageUrl: string, { autoPlay, accent }: { autoPlay: boolean; accent: string }) {
  const hex = /^#?([0-9a-fA-F]{6})$/.exec(accent)?.[1] ?? 'A97CFF';
  return (
    `https://w.soundcloud.com/player/?url=${encodeURIComponent(pageUrl)}` +
    `&color=${hex.toLowerCase()}&auto_play=${autoPlay}&visual=true&show_comments=false&hide_related=true&show_reposts=false&show_teaser=false`
  );
}

export type SoundCloudMessage =
  | { type: 'ready' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'progress'; share: number }
  | { type: 'error' };

/** A message from the player page, or undefined if it isn't one. */
export function parseSoundCloudMessage(raw: unknown): SoundCloudMessage | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const m = JSON.parse(raw) as { type?: unknown; share?: unknown };
    if (m?.type === 'ready' || m?.type === 'play' || m?.type === 'pause' || m?.type === 'error') return { type: m.type };
    if (m?.type === 'progress' && typeof m.share === 'number' && Number.isFinite(m.share)) return { type: 'progress', share: Math.min(1, Math.max(0, m.share)) };
  } catch {}
  return undefined;
}

/**
 * A minimal page around SoundCloud's embedded player and its Widget API, so
 * the app can play and pause it (the feed pauses it when you swipe away,
 * leave Discover or pause). The player keeps its own controls and branding;
 * nothing is drawn over it. Messages go to `window.ReactNativeWebView` (the
 * phone's web view; the browser frame provides the same). If the Widget API
 * doesn't load, the player still works with its own buttons.
 */
export function soundcloudPlayerHtml(pageUrl: string, { autoPlay, accent }: { autoPlay: boolean; accent: string }) {
  const src = JSON.stringify(embedUrl(pageUrl, { autoPlay, accent }));
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}</style>
</head><body>
<iframe id="sc" allow="autoplay; encrypted-media" scrolling="no" frameborder="no"></iframe>
<script>
var frame = document.getElementById('sc');
frame.src = ${src};
var widget, sentReady = false;
function send(m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
function ready() { if (!sentReady) { sentReady = true; send({ type: 'ready' }); } }
// Without the Widget API the player still shows; say it's ready once it has loaded.
frame.addEventListener('load', function () { setTimeout(ready, 1500); });
function hook() {
  if (!window.SC || !SC.Widget) return;
  widget = SC.Widget(frame);
  var E = SC.Widget.Events;
  widget.bind(E.READY, ready);
  widget.bind(E.PLAY, function () { send({ type: 'play' }); });
  widget.bind(E.PAUSE, function () { send({ type: 'pause' }); });
  widget.bind(E.FINISH, function () { send({ type: 'pause' }); });
  widget.bind(E.ERROR, function () { send({ type: 'error' }); });
  widget.bind(E.PLAY_PROGRESS, function (e) { if (e && typeof e.relativePosition === 'number') send({ type: 'progress', share: e.relativePosition }); });
}
window.afterglow = {
  play: function () { if (widget) widget.play(); },
  pause: function () { if (widget) widget.pause(); }
};
</script>
<script src="https://w.soundcloud.com/player/api.js" onload="hook()"></script>
</body></html>`;
}
