import type { VideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import type { VideoSize } from './videoFit';

/**
 * A video's real shape in the browser: its size read from the file (the
 * browser turns an iPhone's sideways-stored video upright), the size saved
 * with it until then.
 */
export function useVideoSize(_player: VideoPlayer, url: string | undefined, saved?: Partial<VideoSize>): Partial<VideoSize> | undefined {
  const [read, setRead] = useState<{ url: string; size: VideoSize }>();
  useEffect(() => {
    if (!url) return;
    let live = true;
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'metadata';
    const done = () => {
      if (live && v.videoWidth && v.videoHeight) setRead({ url, size: { width: v.videoWidth, height: v.videoHeight } });
      v.removeAttribute('src');
      v.load();
    };
    v.addEventListener('loadedmetadata', done, { once: true });
    v.src = url;
    v.load();
    return () => {
      live = false;
      v.removeEventListener('loadedmetadata', done);
      v.removeAttribute('src');
    };
  }, [url]);
  return read && read.url === url ? read.size : saved;
}
