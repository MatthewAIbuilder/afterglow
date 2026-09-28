import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { CloseIcon } from '../../components/TabIcons';
import { festivalById } from '../../data/festivals';
import { color, motion, space } from '../../theme/tokens';

/** Full-screen lineup poster. Pinch to zoom, drag to read, double-tap to zoom in or out. */
export default function PosterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const festival = festivalById(id);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const clampPan = () => {
    'worklet';
    const maxX = (width * (scale.value - 1)) / 2;
    const maxY = (height * (scale.value - 1)) / 2;
    tx.value = withSpring(Math.max(-maxX, Math.min(maxX, tx.value)), motion.snappy);
    ty.value = withSpring(Math.max(-maxY, Math.min(maxY, ty.value)), motion.snappy);
  };

  const pinch = Gesture.Pinch()
    .onChange((e) => {
      const next = Math.max(0.8, Math.min(6, scale.value * e.scaleChange));
      const ratio = next / scale.value;
      const fx = e.focalX - width / 2;
      const fy = e.focalY - height / 2;
      tx.value = fx - (fx - tx.value) * ratio;
      ty.value = fy - (fy - ty.value) * ratio;
      scale.value = next;
    })
    .onEnd(() => {
      if (scale.value < 1) scale.value = withSpring(1, motion.snappy);
      clampPan();
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onChange((e) => {
      tx.value += e.changeX;
      ty.value += e.changeY;
    })
    .onEnd(() => clampPan());

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1.2) {
        scale.value = withSpring(1, motion.gentle);
        tx.value = withSpring(0, motion.gentle);
        ty.value = withSpring(0, motion.gentle);
      } else {
        const s = 2.5;
        scale.value = withSpring(s, motion.gentle);
        tx.value = withSpring(-(e.x - width / 2) * (s - 1), motion.gentle);
        ty.value = withSpring(-(e.y - height / 2) * (s - 1), motion.gentle);
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <View style={styles.root}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
        <Animated.View style={[{ width, height }, style]}>
          {festival?.posterImageUrl ? (
            <Image source={{ uri: festival.posterImageUrl }} style={{ width, height }} contentFit="contain" />
          ) : null}
        </Animated.View>
      </GestureDetector>
      <View style={[styles.close, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Close poster" onPress={() => router.back()}>
          <CloseIcon color={color.moon} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  close: { position: 'absolute', right: space.lg },
});
