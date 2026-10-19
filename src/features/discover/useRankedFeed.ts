import { useDeferredValue, useMemo, useState } from 'react';
import type { Clip, Festival } from '../../data/models';
import { useCatalog } from '../../state/catalog';
import { useFollowedArtists } from '../../state/followedArtists';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { useTaste } from '../../state/taste';
import { lineupClips } from '../festivals/links';
import { tonightClips, tonightOrder } from '../tonight/tonight';
import { FOLLOWING, inSound, likeOf, MIX, soundOf, TONIGHT } from './focus';
import { clipMedia } from './media';
import { soundcloudClips } from './soundcloud';
import { isUnplayable } from './unplayable';
import { type FeedItem, rankFeed } from '../recommend/feed';
import { rankStation, stationArtists } from '../recommend/station';

const NO_CLIPS: Clip[] = [];

/**
 * Discover's running order, from your live taste and viewing history. What's
 * on screen and the clip after it (already loading) stay put; everything
 * further down is re-ranked as you like, save, skip and watch, so what comes
 * next follows what you just did. Only artists on the focused festival's
 * lineup are in it (your mix has every clip; Following has only the videos
 * people you follow shared); a new focus starts a fresh
 * feed. Null until saved reactions and history have loaded and the focus is
 * known, so the first clip is chosen once, with everything known.
 */
export function useRankedFeed(
  activeIndex: number,
  /** A festival, the mix, Following, a sound ("sound:dubstep") from every lineup, or a station ("like:subtronics"). */
  focus: Festival | string | undefined,
  /** Clips people shared for this focus (community clips), ranked alongside the official ones. */
  community: Clip[] = NO_CLIPS,
  /** For Tonight's preview: the festival on now (as it is for you) and tonight's night. */
  tonight?: { festival: Festival; night?: string },
): FeedItem[] | null {
  // What you just did reaches the ranking a moment later (deferred), so a swipe never waits for a re-rank.
  const { reactions: reactionsNow, hydrated: reactionsReady } = useReactions();
  const { seen: seenNow, hydrated: seenReady, session } = useSeen();
  const reactions = useDeferredValue(reactionsNow);
  const seen = useDeferredValue(seenNow);
  const { taste, informed, similarity } = useTaste();
  const catalog = useCatalog();
  const { ratings } = useRatings();
  const ready = reactionsReady && seenReady && !!focus;
  // "Now" for recency: when this session started, or your latest view if that's later.
  const [sessionStart] = useState(() => Date.now());
  const { followed } = useFollowedArtists();
  // A station: the artist you started from and the artists who sound most like them, with how close each is.
  const seedId = typeof focus === 'string' ? likeOf(focus) : undefined;
  const station = useMemo(() => {
    const seed = seedId ? catalog.artist(seedId) : undefined;
    if (!seed) return undefined;
    const counts: Record<string, number> = {};
    for (const c of catalog.clips) counts[c.artistId] = (counts[c.artistId] ?? 0) + 1;
    const on = stationArtists(seed, catalog.artists, (id) => counts[id] ?? 0, similarity);
    return { seedId: seed.id, closeness: Object.fromEntries(on.map((s) => [s.artist.id, s.closeness])) as Record<string, number> };
  }, [seedId, catalog, similarity]);
  // SoundCloud cards of the artists that fit the focus (the feed decides which show, and where).
  const pages = useMemo(() => {
    if (!focus || focus === TONIGHT || !Object.keys(catalog.soundcloud).length) return NO_CLIPS;
    const tag = typeof focus === 'string' ? soundOf(focus) : undefined;
    const lineup = typeof focus === 'string' ? undefined : new Set(focus.lineup);
    const following = focus === FOLLOWING ? new Set(followed) : undefined;
    // Festival mode ("here:") is only what people filmed there.
    if (typeof focus === 'string' && focus !== MIX && focus !== FOLLOWING && !tag && !likeOf(focus)) return NO_CLIPS;
    return soundcloudClips(catalog, (id) => {
      if (lineup) return lineup.has(id);
      if (following) return following.has(id);
      // A sound's (and a station's) cards are picked with its clips, below.
      return true;
    });
  }, [focus, catalog, followed]);
  const clips = useMemo(() => {
    // Following is only videos from people you follow; the mix is every clip.
    // Tonight: the lineup's clips of artists playing tonight, crowd videos included.
    if (focus === TONIGHT) return tonight ? tonightClips(tonight.festival, [...catalog.clips, ...community], tonight.night) : [];
    const tag = typeof focus === 'string' ? soundOf(focus) : undefined;
    if (tag) return [...catalog.clips, ...community, ...pages].filter((c) => inSound(c, tag, catalog.artist));
    if (typeof focus === 'string' && likeOf(focus)) return station ? [...catalog.clips, ...community, ...pages].filter((c) => c.artistId in station.closeness) : [];
    const official =
      focus === MIX ? catalog.clips : focus === FOLLOWING || typeof focus === 'string' ? [] : focus ? lineupClips(focus, catalog.clips) : [];
    return community.length || pages.length ? [...official, ...community, ...pages] : official;
  }, [focus, catalog, community, tonight, pages, station]);

  // Re-rank when an input changes, during render (no extra pass through an effect). Moving
  // through the feed alone doesn't: where you are only decides what stays put at the next re-rank.
  const [state, setState] = useState<{ feed: FeedItem[] | null; inputs: readonly unknown[] }>({ feed: null, inputs: [] });
  // The focus by name: a festival is a new object each time the catalogue is rebuilt (the nightly file, an HQ update).
  const focusKey = typeof focus === 'string' || !focus ? focus : focus.id;
  const inputs = [ready, taste, informed, reactions, seen, clips, catalog.artists, similarity, ratings, focus, focusKey, station] as const;
  if (ready && inputs.some((v, i) => v !== state.inputs[i])) {
    const keep = state.feed && focusKey === state.inputs[10] ? state.feed.slice(0, activeIndex + 2).map((it) => it.clip.id) : [];
    const input = {
      // Only clips with something to watch: no drawn-stage placeholders, and none whose video failed this session.
      clips: clips.filter((c) => !!clipMedia(c) && !isUnplayable(c.id)),
      artists: catalog.artists,
      similarity,
      ratings,
      taste,
      informed,
      reactions,
      seen,
      now: Object.values(seen).reduce((a, b) => Math.max(a, b), sessionStart),
      // Each time the app opens, near-equal matches come in a different order (the very first time: your best matches, in order).
      seed: session > 1 ? session : undefined,
      // Same focus: keep what's on screen and next, even when community clips arrive later. New focus: start over.
      keep,
    };
    // A station has its own order: closeness to the artist you started from, blended with your match.
    const ranked = station ? rankStation({ ...input, ...station }) : rankFeed(input);
    // Tonight's preview: one set per artist, in set-time order once set times are out.
    const feed = focus === TONIGHT && tonight ? tonightOrder(ranked, tonight.festival, tonight.night, keep.length) : ranked;
    setState({ feed, inputs });
    return feed;
  }
  return state.feed;
}
