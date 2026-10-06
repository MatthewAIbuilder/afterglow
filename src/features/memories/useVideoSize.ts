import type { VideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import type { VideoSize } from './videoFit';

/**
 * A video's real shape, from the video itself once it loads (the size saved
 * with it until then, which older videos don't have).
 */
export function useVideoSize(player: VideoPlayer, _url: string | undefined, saved?: Partial<VideoSize>): Partial<VideoSize> | undefined {
  const [size, setSize] = useState<VideoSize>();
  useEffect(() => {
    const sub = player.addListener('sourceLoad', (e) => {
      const s = e.availableVideoTracks?.[0]?.size;
      if (s?.width && s.height) setSize({ width: s.width, height: s.height });
    });
    return () => sub.remove();
  }, [player]);
  return size ?? saved;
}
