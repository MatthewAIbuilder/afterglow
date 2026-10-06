import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { t } from '../../i18n';
import type { ClipWindow } from './trim';
import { useClipLoop } from './useClipLoop';
import { seekTo } from './seek';

/**
 * The video you're tagging, playing on a loop with the phone's own controls
 * (so you can hear it and scrub). A trimmed video plays only its part, and
 * jumps to the part's start whenever the part moves. The website's version
 * is VideoPreview.web.tsx.
 */
export function VideoPreview({ uri, clip, style }: { uri: string; clip?: ClipWindow; style: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  useClipLoop(player, clip);
  const start = clip?.start;
  useEffect(() => {
    if (start !== undefined) seekTo(player, start);
  }, [player, start]);
  return <VideoView player={player} style={style} contentFit="contain" nativeControls playsInline allowsPictureInPicture={false} accessibilityLabel={t('Your video')} />;
}
