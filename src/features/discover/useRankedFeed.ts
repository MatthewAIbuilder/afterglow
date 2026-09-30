import { useMemo, useState } from 'react';
import type { Clip, Festival } from '../../data/models';
import { useCatalog } from '../../state/catalog';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { useTaste } from '../../state/taste';
import { lineupClips } from '../festivals/links';
import { MIX } from './focus';
import { type FeedItem, rankFeed } from '../recommend/feed';

const NO_CLIPS: Clip[] = [];

/**
 * Discover's running order, from your live taste and viewing history. What's
 * on screen and the clip after it (already loading) stay put; everything
 * further down is re-ranked as you like, save, skip and watch, so what comes
 * next follows what you just did. Only artists on the focused festival's
 * lineup are in it (your mix has every clip); a new focus starts a fresh
 * feed. Null until saved reactions and history have loaded and the focus is
 * known, so the first clip is chosen once, with everything known.
 */
export function useRankedFeed(
  activeIndex: number,
  focus: Festival | typeof MIX | undefined,
  /** Clips people shared for this focus (community clips), ranked alongside the official ones. */
  community: Clip[] = NO_CLIPS,
): FeedItem[] | null {
  const { reactions, hydrated: reactionsReady } = useReactions();
  const { seen, hydrated: seenReady } = useSeen();
  const { taste, informed, similarity } = useTaste();
  const catalog = useCatalog();
  const { ratings } = useRatings();
  const ready = reactionsReady && seenReady && !!focus;
  // "Now" for recency: when this session started, or your latest view if that's later.
  const [sessionStart] = useState(() => Date.now());
  const clips = useMemo(() => {
    const official = focus === MIX ? catalog.clips : focus ? lineupClips(focus, catalog.clips) : [];
    return community.length ? [...official, ...community] : official;
  }, [focus, catalog, community]);

  // Re-rank when an input changes, during render (no extra pass through an effect).
  const [state, setState] = useState<{ feed: FeedItem[] | null; inputs: readonly unknown[] }>({ feed: null, inputs: [] });
  const inputs = [ready, taste, informed, reactions, seen, activeIndex, clips, catalog.artists, similarity, ratings, focus] as const;
  if (ready && inputs.some((v, i) => v !== state.inputs[i])) {
    const feed = rankFeed({
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
      keep: state.feed && focus === state.inputs[10] ? state.feed.slice(0, activeIndex + 2).map((it) => it.clip.id) : [],
    });
    setState({ feed, inputs });
    return feed;
  }
  return state.feed;
}
