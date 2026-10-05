import { useDeferredValue, useMemo, useState } from 'react';
import type { Clip, Festival } from '../../data/models';
import { useCatalog } from '../../state/catalog';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { useTaste } from '../../state/taste';
import { lineupClips } from '../festivals/links';
import { tonightClips, tonightOrder } from '../tonight/tonight';
import { FOLLOWING, inSound, MIX, soundOf, TONIGHT } from './focus';
import { type FeedItem, rankFeed } from '../recommend/feed';

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
  /** A festival, the mix, Following, or a sound ("sound:dubstep") from every lineup. */
  focus: Festival | string | undefined,
  /** Clips people shared for this focus (community clips), ranked alongside the official ones. */
  community: Clip[] = NO_CLIPS,
  /** For Tonight's preview: the festival on now (as it is for you) and tonight's night. */
  tonight?: { festival: Festival; night?: string },
): FeedItem[] | null {
  // What you just did reaches the ranking a moment later (deferred), so a swipe never waits for a re-rank.
  const { reactions: reactionsNow, hydrated: reactionsReady } = useReactions();
  const { seen: seenNow, hydrated: seenReady } = useSeen();
  const reactions = useDeferredValue(reactionsNow);
  const seen = useDeferredValue(seenNow);
  const { taste, informed, similarity } = useTaste();
  const catalog = useCatalog();
  const { ratings } = useRatings();
  const ready = reactionsReady && seenReady && !!focus;
  // "Now" for recency: when this session started, or your latest view if that's later.
  const [sessionStart] = useState(() => Date.now());
  const clips = useMemo(() => {
    // Following is only videos from people you follow; the mix is every clip.
    // Tonight: the lineup's clips of artists playing tonight, crowd videos included.
    if (focus === TONIGHT) return tonight ? tonightClips(tonight.festival, [...catalog.clips, ...community], tonight.night) : [];
    const tag = typeof focus === 'string' ? soundOf(focus) : undefined;
    if (tag) return [...catalog.clips, ...community].filter((c) => inSound(c, tag, catalog.artist));
    const official =
      focus === MIX ? catalog.clips : focus === FOLLOWING || typeof focus === 'string' ? [] : focus ? lineupClips(focus, catalog.clips) : [];
    return community.length ? [...official, ...community] : official;
  }, [focus, catalog, community, tonight]);

  // Re-rank when an input changes, during render (no extra pass through an effect). Moving
  // through the feed alone doesn't: where you are only decides what stays put at the next re-rank.
  const [state, setState] = useState<{ feed: FeedItem[] | null; inputs: readonly unknown[] }>({ feed: null, inputs: [] });
  // The focus by name: a festival is a new object each time the catalogue is rebuilt (the nightly file, an HQ update).
  const focusKey = typeof focus === 'string' || !focus ? focus : focus.id;
  const inputs = [ready, taste, informed, reactions, seen, clips, catalog.artists, similarity, ratings, focus, focusKey] as const;
  if (ready && inputs.some((v, i) => v !== state.inputs[i])) {
    const keep = state.feed && focusKey === state.inputs[10] ? state.feed.slice(0, activeIndex + 2).map((it) => it.clip.id) : [];
    const ranked = rankFeed({
      clips,
      artists: catalog.artists,
      similarity,
      ratings,
      taste,
      informed,
      reactions,
      seen,
      now: Object.values(seen).reduce((a, b) => Math.max(a, b), sessionStart),
      // Same focus: keep what's on screen and next, even when community clips arrive later. New focus: start over.
      keep,
    });
    // Tonight's preview: one set per artist, in set-time order once set times are out.
    const feed = focus === TONIGHT && tonight ? tonightOrder(ranked, tonight.festival, tonight.night, keep.length) : ranked;
    setState({ feed, inputs });
    return feed;
  }
  return state.feed;
}
