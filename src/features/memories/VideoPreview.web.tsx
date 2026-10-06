import { createElement, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { t } from '../../i18n';
import { loopPosition, type ClipWindow } from './trim';

/**
 * The video you're tagging, on the website: the browser's own player, inline
 * (an iPhone would otherwise go full screen or show nothing), with its
 * controls so you can hear it and scrub. A trimmed video plays only its part.
 */
export function VideoPreview({ uri, clip, style }: { uri: string; clip?: ClipWindow; style: StyleProp<ViewStyle> }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const start = clip?.start;
  const end = clip?.end;
  // Only the first start goes in the link: moving the part later seeks, it doesn't reload the video.
  const [firstStart] = useState(start ?? 0);
  useEffect(() => {
    const v = ref.current;
    if (!v || start === undefined || end === undefined) return;
    const part = { start, end };
    const jump = () => {
      if (v.currentTime < start || v.currentTime > end) v.currentTime = start;
    };
    const tick = () => {
      const back = loopPosition(v.currentTime, part);
      if (back !== undefined) v.currentTime = back;
    };
    if (v.readyState >= 1) v.currentTime = start;
    v.addEventListener('loadedmetadata', jump);
    v.addEventListener('timeupdate', tick);
    return () => {
      v.removeEventListener('loadedmetadata', jump);
      v.removeEventListener('timeupdate', tick);
    };
  }, [start, end]);
  return (
    <View style={[style, styles.frame]}>
      {createElement('video', {
        ref,
        // A start time in the link makes Safari draw a frame before anything plays (otherwise it's black).
        src: `${uri}#t=${firstStart + 0.1}`,
        controls: true,
        playsInline: true,
        loop: !clip,
        preload: 'auto',
        'aria-label': t('Your video'),
        style: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000', display: 'block' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({ frame: { overflow: 'hidden' } });
