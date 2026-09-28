import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect as SvgRect, Stop } from 'react-native-svg';
import { artistColors } from '../../components/ArtistAvatar';
import type { Rect } from './videoLayout';

type Props = {
  artistId: string;
  bpm: number;
  /** The player's frame. The glow spreads out around it and sits behind it, never on top. */
  frame: Rect;
  clock: SharedValue<number>;
  reduceMotion: boolean;
};

const SPREAD = 90;

/** Stage light spilling out from behind the video, breathing on the beat, so the whole screen feels part of the set. */
function PlayerGlowBase({ artistId, bpm, frame, clock, reduceMotion }: Props) {
  const [, bright] = artistColors(artistId);
  const beat = 60000 / bpm;
  const w = frame.w + SPREAD * 2;
  const h = frame.h + SPREAD * 2;

  const pulse = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0.75 };
    const hit = Math.exp(((-(clock.value % beat) / beat) * 5));
    return { opacity: 0.55 + 0.45 * hit, transform: [{ scale: 1 + 0.04 * hit }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.glow, { left: frame.x - SPREAD, top: frame.y - SPREAD, width: w, height: h }, pulse]}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={`player-glow-${artistId}`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={bright} stopOpacity="0.7" />
            <Stop offset="0.55" stopColor={bright} stopOpacity="0.22" />
            <Stop offset="1" stopColor={bright} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <SvgRect width="100%" height="100%" fill={`url(#player-glow-${artistId})`} />
      </Svg>
    </Animated.View>
  );
}

export const PlayerGlow = memo(PlayerGlowBase);

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
});
