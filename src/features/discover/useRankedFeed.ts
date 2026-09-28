import { useState } from 'react';
import { ARTISTS } from '../../data/artists';
import { CLIPS } from '../../data/clips';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { useTaste } from '../../state/taste';
import { type FeedItem, rankFeed } from '../recommend/feed';

/**
 * Discover's running order, from your live taste and viewing history. What's
 * on screen and the clip after it (already loading) stay put; everything
 * further down is re-ranked as you like, save, skip and watch, so what comes
 * next follows what you just did. Null until saved reactions and history
 * have loaded, so the first clip is chosen once, with everything known.
 */
export function useRankedFeed(activeIndex: number): FeedItem[] | null {
  const { reactions, hydrated: reactionsReady } = useReactions();
  const { seen, hydrated: seenReady } = useSeen();
  const { taste, informed } = useTaste();
  const ready = reactionsReady && seenReady;
  // "Now" for recency: when this session started, or your latest view if that's later.
  const [sessionStart] = useState(() => Date.now());

  // Re-rank when an input changes, during render (no extra pass through an effect).
  const [state, setState] = useState<{ feed: FeedItem[] | null; inputs: readonly unknown[] }>({ feed: null, inputs: [] });
  const inputs = [ready, taste, informed, reactions, seen, activeIndex] as const;
  if (ready && inputs.some((v, i) => v !== state.inputs[i])) {
    const feed = rankFeed({
      clips: CLIPS,
      artists: ARTISTS,
      taste,
      informed,
      reactions,
      seen,
      now: Object.values(seen).reduce((a, b) => Math.max(a, b), sessionStart),
      keep: state.feed ? state.feed.slice(0, activeIndex + 2).map((it) => it.clip.id) : [],
    });
    setState({ feed, inputs });
    return feed;
  }
  return state.feed;
}
