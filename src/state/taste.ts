import { useMemo } from 'react';
import { ARTISTS } from '../data/artists';
import { CLIPS } from '../data/clips';
import { MOCK_TASTE } from '../data/tasteProfile';
import { computeTaste } from '../features/taste/engine';
import { useReactions } from './reactions';

/** Live taste profile: the starting profile, reshaped by everything you have reacted to. */
export function useTaste() {
  const { reactions } = useReactions();
  return useMemo(() => computeTaste(MOCK_TASTE, ARTISTS, CLIPS, reactions), [reactions]);
}
