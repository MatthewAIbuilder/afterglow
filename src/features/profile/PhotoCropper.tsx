import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { CROP_SHAPES, type CropShape, cropRect, frameFor, MAX_ZOOM, type Size } from './crop';
import { t } from '../../i18n';

export type CropSource = { uri: string; width: number; height: number };

type Props = {
  /** The picked photo, or undefined when closed. */
  source: CropSource | undefined;
  shape: CropShape;
  /** The framed photo, saved as a JPEG on the phone. */
  onDone: (uri: string) => void;
  onCancel: () => void;
};

/**
 * Move and scale a photo before it's used: pinch to zoom, drag to move,
 * double-tap to start again, or the zoom buttons (they also serve screen
 * readers and a mouse). The frame is a circle for your photo and a wide
 * strip for your cover; the photo always fills it.
 */
export function PhotoCropper({ source, shape, onDone, onCancel }: Props) {
  return (
    <Modal visible={!!source} animationType="fade" presentationStyle="fullScreen" onRequestClose={onCancel} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>{source ? <Cropper key={source.uri} source={source} shape={shape} onDone={onDone} onCancel={onCancel} /> : null}</GestureHandlerRootView>
    </Modal>
  );
}

function Cropper({ source, shape, onDone, onCancel }: Required<Props> & { source: CropSource }) {
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const top = insets.top + 64;
  const bottom = insets.bottom + 132;
  const space_ = { width: screen.width, height: Math.max(200, screen.height - top - bottom) };
  const frame = frameFor(shape, space_);
  const image: Size = { width: source.width, height: source.height };
  const fill = Math.max(frame.width / Math.max(1, image.width), frame.height / Math.max(1, image.height));
  const [busy, setBusy] = useState(false);

  const zoom = useSharedValue(1);
  const startZoom = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // How far the photo may move at a zoom (the same rule as crop.ts, on the UI thread).
  const limit = (z: number, w: number, f: number) => {
    'worklet';
    return Math.max(0, (w * fill * z - f) / 2);
  };
  const settle = (z: number) => {
    'worklet';
    const lx = limit(z, image.width, frame.width);
    const ly = limit(z, image.height, frame.height);
    x.set(withSpring(Math.min(lx, Math.max(-lx, x.get())), { damping: 20, stiffness: 200 }));
    y.set(withSpring(Math.min(ly, Math.max(-ly, y.get())), { damping: 20, stiffness: 200 }));
  };

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
    })
    .onUpdate((e) => {
      const z = zoom.get();
      const lx = limit(z, image.width, frame.width);
      const ly = limit(z, image.height, frame.height);
      // A little give past the edge, then it springs back.
      const rubber = (v: number, l: number) => (v > l ? l + (v - l) * 0.3 : v < -l ? -l + (v + l) * 0.3 : v);
      x.set(rubber(startX.get() + e.translationX, lx));
      y.set(rubber(startY.get() + e.translationY, ly));
    })
    .onEnd(() => settle(zoom.get()));
  const pinch = Gesture.Pinch()
    .onStart(() => startZoom.set(zoom.get()))
    .onUpdate((e) => zoom.set(Math.min(MAX_ZOOM * 1.15, Math.max(0.85, startZoom.get() * e.scale))))
    .onEnd(() => {
      const z = Math.min(MAX_ZOOM, Math.max(1, zoom.get()));
      zoom.set(withSpring(z, { damping: 20, stiffness: 200 }));
      settle(z);
    });
  const reset = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      zoom.set(withTiming(1, { duration: 220 }));
      x.set(withTiming(0, { duration: 220 }));
      y.set(withTiming(0, { duration: 220 }));
    });
  const gesture = Gesture.Simultaneous(pan, pinch, reset);

  const photo = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: zoom.get() }],
  }));

  const step = (by: number) => {
    haptic.select();
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom.get() * by));
    zoom.set(withTiming(z, { duration: 200 }));
    const lx = Math.max(0, (image.width * fill * z - frame.width) / 2);
    const ly = Math.max(0, (image.height * fill * z - frame.height) / 2);
    x.set(withTiming(Math.min(lx, Math.max(-lx, x.get())), { duration: 200 }));
    y.set(withTiming(Math.min(ly, Math.max(-ly, y.get())), { duration: 200 }));
  };

  const choose = async () => {
    if (busy) return;
    setBusy(true);
    haptic.tap();
    try {
      const rect = cropRect(image, frame, zoom.get(), { x: x.get(), y: y.get() });
      const out = CROP_SHAPES[shape].outWidth;
      const ctx = ImageManipulator.manipulate(source.uri).crop(rect);
      if (rect.width > out) ctx.resize({ width: out });
      const ref = await ctx.renderAsync();
      const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
      onDone(saved.uri);
    } catch {
      // Couldn't frame it on this phone: use the photo as picked rather than nothing.
      onDone(source.uri);
    }
  };

  const round = CROP_SHAPES[shape].round;
  const fx = (screen.width - frame.width) / 2;
  const fy = top + (space_.height - frame.height) / 2;
  const hole = round
    ? `M ${fx} ${fy + frame.height / 2} a ${frame.width / 2} ${frame.height / 2} 0 1 0 ${frame.width} 0 a ${frame.width / 2} ${frame.height / 2} 0 1 0 ${-frame.width} 0 Z`
    : roundedRect(fx, fy, frame.width, frame.height, radius.md);
  const title = shape === 'avatar' ? t('Move and scale your photo') : t('Move and scale your cover');

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} accessible={false}>
          <View style={[styles.photoBox, { left: fx, top: fy, width: frame.width, height: frame.height }]}>
            <Animated.View style={[{ width: image.width * fill, height: image.height * fill }, photo]}>
              <Image source={{ uri: source.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
            </Animated.View>
          </View>
          {/* The night outside the frame, with the frame cut out of it. */}
          <Svg style={StyleSheet.absoluteFill} width={screen.width} height={screen.height} pointerEvents="none">
            <Path d={`M0 0 H${screen.width} V${screen.height} H0 Z ${hole}`} fill="rgba(6,5,16,0.72)" fillRule="evenodd" />
            <Path d={hole} fill="none" stroke="rgba(243,240,255,0.7)" strokeWidth={1.5} />
          </Svg>
        </View>
      </GestureDetector>

      <View style={[styles.head, { paddingTop: insets.top + space.md }]} pointerEvents="none">
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.hint}>{t('Pinch to zoom, drag to move. Double-tap to start again.')}</Text>
      </View>

      <View style={[styles.foot, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.zoomRow}>
          <ZoomButton label={t('Zoom out')} glyph="−" onPress={() => step(1 / 1.25)} />
          <ZoomButton label={t('Zoom in')} glyph="+" onPress={() => step(1.25)} />
        </View>
        <View style={styles.actions}>
          <Pressable onPress={onCancel} accessibilityRole="button" style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
            <Text style={styles.cancelText}>{t('Cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void choose()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={shape === 'avatar' ? t('Use this photo') : t('Use this cover')}
            accessibilityState={{ busy }}
            style={({ pressed }) => [styles.use, pressed && styles.pressed]}
          >
            {busy ? <ActivityIndicator color={color.night} /> : <Text style={styles.useText}>{shape === 'avatar' ? t('Use photo') : t('Use cover')}</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ZoomButton({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.zoom, pressed && styles.pressed]}>
      <Text style={styles.zoomText}>{glyph}</Text>
    </Pressable>
  );
}

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  photoBox: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  head: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.xl },
  title: { ...type.headline, color: color.moon },
  hint: { ...type.caption, color: color.moonDim, marginTop: space.xs, textAlign: 'center' },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, gap: space.lg },
  zoomRow: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  zoom: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  zoomText: { fontSize: 22, lineHeight: 26, color: color.moon },
  actions: { flexDirection: 'row', gap: space.md },
  cancel: { flex: 1, minHeight: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  cancelText: { ...type.headline, color: color.moon },
  use: { flex: 1, minHeight: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glow },
  useText: { ...type.headline, color: color.night },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
