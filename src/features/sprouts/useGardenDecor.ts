import { useMemo } from 'react';
import { useKandi } from '../../state/kandi';
import { useSprouts } from '../../state/sprouts';
import { decorFor, type DecorId } from './decor';

/** The decorations you've earned for your garden (decor.ts). */
export function useGardenDecor(): DecorId[] {
  const { gifts, collected, artists } = useSprouts();
  const { received } = useKandi();
  return useMemo(() => decorFor({ given: gifts.filter((g) => g.claimedBy).length, kinds: collected, artists, kandi: received.length }), [gifts, collected, artists, received.length]);
}
