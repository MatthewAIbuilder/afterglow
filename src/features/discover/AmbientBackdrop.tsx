import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { color } from '../../theme/tokens';

type Props = {
  /** The video's own still: its colours become the light around the player. */
  uri: string;
  /** Breathes slowly while the clip plays; still otherwise, and always with reduced motion. */
  playing: boolean;
  reduceMotion: boolean;
};

/**
 * The glow behind a video that doesn't fill the screen: the clip's still,
 * blown up and heavily blurred, so the colours of the set spill out to the
 * edges and the page still feels full-screen (like an ambient mode). Darkened
 * enough for the text above and below the player to stay readable.
 */
export function AmbientBackdrop({ uri, playing, reduceMotion }: Props) {
  const breath = useSharedValue(0);
  useEffect(() => {
    if (playing && !reduceMotion) {
      breath.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      cancelAnimation(breath);
    }
    return () => cancelAnimation(breath);
  }, [playing, reduceMotion, breath]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1.35 + 0.08 * breath.value }],
    opacity: 0.85 + 0.15 * breath.value,
  }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} transition={400} />
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <LinearGradient
        colors={['rgba(10,9,24,0.85)', 'rgba(10,9,24,0)', 'rgba(10,9,24,0)', 'rgba(10,9,24,0.9)']}
        locations={[0, 0.3, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: color.night },
  dim: { backgroundColor: 'rgba(6,5,16,0.38)' },
});
