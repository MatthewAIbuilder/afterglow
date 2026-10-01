import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
} from 'react-native-reanimated';
import type { Artist, SoundTag, TasteProfile } from '../../data/types';
import { SOUND_LABEL } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { color, motion, type } from '../../theme/tokens';
import { ArtistBubble } from './ArtistBubble';
import { computeLayout, fitScale as frameScale, regionAt } from './layout';

type Props = {
  artists: Artist[];
  taste: TasteProfile;
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBackgroundTap: () => void;
  /** A sound name around the map was tapped. */
  onRegionTap?: (tag: SoundTag) => void;
  /** While searching: who matches. Matches pop and the map glides to show them. */
  matchIds?: ReadonlySet<string>;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.4;

export function SoundMap({ artists, taste, width, height, selectedId, onSelect, onBackgroundTap, onRegionTap, matchIds }: Props) {
  const layout = useMemo(() => computeLayout(artists, taste), [artists, taste]);
  // Strongest matches bloom first.
  const bloomOrder = useMemo(
    () => [...layout.bubbles].sort((a, b) => b.affinity - a.affinity).map((b) => b.artist.id),
    [layout],
  );

  // Frame the heart of your universe (your strongest matches), keeping your top match dead centre.
  const fitScale = useMemo(() => frameScale(layout, width, height), [layout, width, height]);
  const cx = 0;
  const cy = 0;

  const scale = useSharedValue(fitScale);
  // Finger velocity, read by each bubble to lag behind and wobble into place.
  const velX = useSharedValue(0);
  const velY = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // Once you move the map yourself, it stays where you put it; until then it reframes as it reshapes
  // (your ratings load a moment after the first frame, and taste changes reshape it).
  const touched = useSharedValue(false);
  useEffect(() => {
    if (touched.get() || matchIds) return;
    scale.set(withSpring(fitScale, motion.gentle));
    tx.set(withSpring(0, motion.gentle));
    ty.set(withSpring(0, motion.gentle));
    // Only a new framing should move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitScale]);

  // How far you can wander before the map gently holds you back.
  const limitX = width * 0.9;
  const limitY = height * 0.9;

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      touched.set(true);
    })
    .onChange((e) => {
      tx.set(tx.get() + e.changeX);
      ty.set(ty.get() + e.changeY);
      velX.set(e.velocityX);
      velY.set(e.velocityY);
    })
    .onFinalize(() => {
      velX.set(0);
      velY.set(0);
    })
    .onEnd((e) => {
      tx.set(withDecay({ velocity: e.velocityX, clamp: [-limitX, limitX], rubberBandEffect: true }));
      ty.set(withDecay({ velocity: e.velocityY, clamp: [-limitY, limitY], rubberBandEffect: true }));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      touched.set(true);
    })
    .onChange((e) => {
      const next = Math.min(MAX_ZOOM * 1.15, Math.max(MIN_ZOOM * 0.85, scale.get() * e.scaleChange));
      const ratio = next / scale.get();
      // Keep the point under your fingers fixed while zooming.
      const fx = e.focalX - width / 2;
      const fy = e.focalY - height / 2;
      tx.set(fx - (fx - tx.get()) * ratio);
      ty.set(fy - (fy - ty.get()) * ratio);
      scale.set(next);
    })
    .onEnd(() => {
      if (scale.get() > MAX_ZOOM || scale.get() < MIN_ZOOM) {
        scale.set(withSpring(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale.get())), motion.snappy));
        runOnJS(haptic.settle)();
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_e, ok) => {
      if (!ok) return;
      touched.set(false);
      scale.set(withSpring(fitScale, motion.gentle));
      tx.set(withSpring(0, motion.gentle));
      ty.set(withSpring(0, motion.gentle));
      runOnJS(haptic.settle)();
    });

  // A search glides the map to its matches (or back to everyone when it ends).
  const matchKey = matchIds ? [...matchIds].sort().join('|') : '';
  const searchedOnce = useRef(false);
  useEffect(() => {
    if (!searchedOnce.current && !matchIds) return;
    searchedOnce.current = true;
    const hits = matchIds ? layout.bubbles.filter((b) => matchIds.has(b.artist.id)) : [];
    if (!hits.length) {
      scale.set(withSpring(fitScale, motion.gentle));
      tx.set(withSpring(0, motion.gentle));
      ty.set(withSpring(0, motion.gentle));
      return;
    }
    const minX = Math.min(...hits.map((b) => b.x - b.r));
    const maxX = Math.max(...hits.map((b) => b.x + b.r));
    const minY = Math.min(...hits.map((b) => b.y - b.r));
    const maxY = Math.max(...hits.map((b) => b.y + b.r + 36));
    const s = Math.min(MAX_ZOOM, Math.max(fitScale, Math.min((width - 48) / (maxX - minX), (height - 48) / (maxY - minY))));
    scale.set(withSpring(s, motion.gentle));
    tx.set(withSpring(-((minX + maxX) / 2) * s, motion.gentle));
    ty.set(withSpring(-((minY + maxY) / 2) * s, motion.gentle));
    // Only a new set of matches should move the camera (a reshape of your taste leaves it be).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey]);

  // World origin sits at the centre of the map area, offset so the cluster is centred.
  const ox = width / 2 - cx;
  const oy = height / 2 - cy;

  // One tap handler for the whole map: hit-test bubbles ourselves so a tap
  // can never both select an artist and dismiss the sheet.
  const handleTap = (px: number, py: number, t0: number, t1: number, s: number) => {
    const qx = width / 2 + (px - width / 2 - t0) / s;
    const qy = height / 2 + (py - height / 2 - t1) / s;
    const hit = layout.bubbles.find((b) => Math.hypot(qx - (ox + b.x), qy - (oy + b.y)) <= b.r + 6);
    if (!hit) {
      const region = onRegionTap ? regionAt(layout.regions, qx - ox, qy - oy) : undefined;
      if (region) {
        haptic.select();
        onRegionTap?.(region);
      } else onBackgroundTap();
      return;
    }
    haptic.tap();
    touched.set(true);
    onSelect(hit.artist.id);
    // Glide the chosen artist into the space above the sheet.
    const target = Math.max(s, fitScale * 1.15);
    const bx = ox + hit.x - width / 2;
    const by = oy + hit.y - height / 2;
    scale.set(withSpring(target, motion.gentle));
    tx.set(withSpring(-bx * target, motion.gentle));
    ty.set(withSpring(height * 0.3 - height / 2 - by * target, motion.gentle));
  };

  const singleTap = Gesture.Tap()
    .maxDistance(12)
    .requireExternalGestureToFail(doubleTap)
    .onEnd((e, ok) => {
      if (ok) runOnJS(handleTap)(e.x, e.y, tx.get(), ty.get(), scale.get());
    });

  const gesture = Gesture.Simultaneous(pan, pinch, Gesture.Exclusive(doubleTap, singleTap));

  const worldStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.viewport, { width, height }]}>
        <Animated.View style={[{ width, height }, worldStyle]}>
          {layout.regions.map((r) => (
            <Text
              key={r.tag}
              style={[styles.region, { left: ox + r.x - 60, top: oy + r.y - 8 }]}
              pointerEvents="none"
              accessible={!!onRegionTap}
              accessibilityRole={onRegionTap ? 'button' : undefined}
              accessibilityLabel={onRegionTap ? `${SOUND_LABEL[r.tag]}. Show these artists` : undefined}
              onAccessibilityTap={onRegionTap ? () => onRegionTap(r.tag) : undefined}
            >
              {SOUND_LABEL[r.tag]}
            </Text>
          ))}
          <View style={{ position: 'absolute', left: ox, top: oy }}>
            {layout.bubbles.map((b) => (
              <ArtistBubble
                key={b.artist.id}
                placed={b}
                index={bloomOrder.indexOf(b.artist.id)}
                selectedId={selectedId}
                onSelect={onSelect}
                searching={!!matchIds}
                matched={!!matchIds?.has(b.artist.id)}
                velX={velX}
                velY={velY}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // Not clipped: bubbles drift softly under the header's scrim instead of being cut off at an edge.
  viewport: { overflow: 'visible' },
  region: {
    position: 'absolute',
    width: 120,
    textAlign: 'center',
    ...type.caption,
    color: color.moonFaint,
    letterSpacing: 0.2,
  },
});
