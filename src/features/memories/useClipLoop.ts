import type { VideoPlayer } from 'expo-video';
import { useEffect } from 'react';
import { loopPosition, type ClipWindow } from './trim';
import { reportEvery, seekTo } from './seek';

/**
 * A trimmed video plays only its part: the player starts at the part's
 * start and loops back there at its end. Nothing happens for an untrimmed one.
 */
export function useClipLoop(player: VideoPlayer, clip: ClipWindow | undefined) {
  const start = clip?.start;
  const end = clip?.end;
  useEffect(() => {
    if (start === undefined || end === undefined) return;
    const part = { start, end };
    reportEvery(player, 0.25);
    seekTo(player, start);
    const subs = [
      player.addListener('timeUpdate', ({ currentTime }) => {
        const back = loopPosition(currentTime, part);
        if (back !== undefined) seekTo(player, back);
      }),
      player.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay' && player.currentTime < start) seekTo(player, start);
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player, start, end]);
}
