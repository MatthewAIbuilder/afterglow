import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDecay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Artist, SoundTag, TasteProfile } from '../../data/types';
import { SOUND_LABEL } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { motion, type } from '../../theme/tokens';
import { ArtistBubble } from './ArtistBubble';
import { computeLayout, DETAIL_MIN, frameMap, regionAt, type RegionLabel } from './layout';
import { mixColor, SOUND_COLOR } from './colors';
import { artistColors } from '../../components/ArtistAvatar';
import { Constellation, HeartHalo, NebulaCloud, ReshapeRipple, SparkBurst, Starfield } from './MapSky';
import { chosenLinks, constellation, CONSTELLATION_OF, heartColors, nebulae } from './sky';
import { t } from '../../i18n';

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
  /** How alike two artists sound: joins the closest with constellation lines. */
  similarity?: (a: Artist, b: Artist) => number;
  /** Artists you love (or like): a small heart on their bubble. */
  loved?: ReadonlySet<string>;
  /** Told when you move the map away from its framing (true), and when it's back (false). */
  onMoved?: (moved: boolean) => void;
  /** Change it to glide back to the framing (the recentre button). */
  recenter?: number;
};

/** How far the drag trails (px per px/s of finger speed), and the most it trails. */
const LAG = 0.012;
const MAX_LAG = 16;
const lagSpring = { damping: 14, stiffness: 120, mass: 0.7 };
/** One loop of the map's clock: every bubble bobs and sways on it. */
const CLOCK_MS = 24000;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.4;

export function SoundMap({ artists, taste, width, height, selectedId, onSelect, onBackgroundTap, onRegionTap, matchIds, similarity, loved, onMoved, recenter }: Props) {
  const layout = useMemo(() => computeLayout(artists, taste), [artists, taste]);
  // The sky around the bubbles: each sound's nebula, and lines between artists who sound alike.
  const skies = useMemo(() => nebulae(layout), [layout]);
  // Your constellation: lines between your strongest matches who sound alike. A chosen artist adds lines to those most like them.
  const ambient = useMemo(
    () => (similarity ? constellation([...layout.bubbles].sort((a, b) => b.affinity - a.affinity).slice(0, CONSTELLATION_OF), similarity) : []),
    [layout, similarity],
  );
  const fadeKey = ambient.map((l) => `${l.a}-${l.b}-${Math.round(l.x1)}-${Math.round(l.y1)}`).join('|');
  const links = useMemo(() => {
    if (!similarity || !selectedId) return ambient;
    const extra = chosenLinks(layout.bubbles, selectedId, similarity).filter((l) => !ambient.some((m) => [m.a, m.b].sort().join() === [l.a, l.b].sort().join()));
    return [...ambient, ...extra];
  }, [ambient, layout, selectedId, similarity]);
  const byId = useMemo(() => new Map(layout.bubbles.map((b) => [b.artist.id, b.artist])), [layout]);
  const artistOf = useCallback((id: string) => byId.get(id), [byId]);
  // Lines wait for the first bloom to finish; after a reshape, for the bubbles to glide into place.
  const [linkDelay] = useState(() => 600 + Math.min(artists.length, 40) * 70);
  // Sparks where you last tapped a bubble.
  const [spark, setSpark] = useState<{ key: number; x: number; y: number; r: number; color: string } | undefined>();
  // Strongest matches bloom first.
  const bloomOrder = useMemo(
    () => [...layout.bubbles].sort((a, b) => b.affinity - a.affinity).map((b) => b.artist.id),
    [layout],
  );

  // Open on the whole universe: every sound's group in view, as big as fits.
  const framing = useMemo(() => frameMap(layout, width, height), [layout, width, height]);
  const fitScale = framing.scale;
  const homeX = framing.x;
  const homeY = framing.y;
  // Every name shows from here in (zoomed out, only each sound's strongest and your top few).
  const detailAt = Math.max(DETAIL_MIN, fitScale * 1.4);
  // You can zoom out a little past the framing, never further.
  const minZoom = Math.min(MIN_ZOOM, fitScale * 0.85);
  const leaders = useMemo(() => new Set(layout.leaders), [layout]);
  const cx = 0;
  const cy = 0;

  const scale = useSharedValue(fitScale);
  // How far the whole universe trails your finger; each bubble trails by its weight.
  const lagX = useSharedValue(0);
  const lagY = useSharedValue(0);
  // One clock for every bubble's float (much lighter than a loop per bubble).
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    clock.set(withRepeat(withTiming(1, { duration: CLOCK_MS, easing: Easing.linear }), -1, false));
  }, [clock, reduceMotion]);
  const moved = useCallback((on: boolean) => onMoved?.(on), [onMoved]);
  const tx = useSharedValue(homeX);
  const ty = useSharedValue(homeY);
  // Once you move the map yourself, it stays where you put it; until then it reframes as it reshapes
  // (your ratings load a moment after the first frame, and taste changes reshape it).
  const touched = useSharedValue(false);
  const touch = () => {
    'worklet';
    if (!touched.get()) {
      touched.set(true);
      runOnJS(moved)(true);
    }
  };
  // Back to the framing (the recentre button).
  const firstRecenter = useRef(recenter);
  useEffect(() => {
    if (recenter === firstRecenter.current) return;
    touched.set(false);
    scale.set(withSpring(fitScale, motion.gentle));
    tx.set(withSpring(homeX, motion.gentle));
    ty.set(withSpring(homeY, motion.gentle));
    moved(false);
    // Only a new press of the button should move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenter]);
  useEffect(() => {
    if (touched.get() || matchIds) return;
    scale.set(withSpring(fitScale, motion.gentle));
    tx.set(withSpring(homeX, motion.gentle));
    ty.set(withSpring(homeY, motion.gentle));
    // Only a new framing should move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitScale, homeX, homeY]);

  // How far you can wander: until the farthest artist reaches the middle of the screen, never off into empty sky.
  const reachX = useMemo(() => Math.max(0, ...layout.bubbles.map((b) => Math.abs(b.x) + b.r)), [layout]);
  const reachY = useMemo(() => Math.max(0, ...layout.bubbles.map((b) => Math.abs(b.y) + b.r)), [layout]);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      touch();
    })
    .onChange((e) => {
      tx.set(tx.get() + e.changeX);
      ty.set(ty.get() + e.changeY);
      const clamp = (v: number) => Math.max(-MAX_LAG, Math.min(MAX_LAG, v));
      lagX.set(withSpring(clamp(-e.velocityX * LAG), lagSpring));
      lagY.set(withSpring(clamp(-e.velocityY * LAG), lagSpring));
    })
    .onFinalize(() => {
      lagX.set(withSpring(0, lagSpring));
      lagY.set(withSpring(0, lagSpring));
    })
    .onEnd((e) => {
      const limitX = Math.max(width * 0.25, reachX * scale.get());
      const limitY = Math.max(height * 0.25, reachY * scale.get());
      const fling = (v: number) => Math.max(-2600, Math.min(2600, v));
      tx.set(withDecay({ velocity: fling(e.velocityX), deceleration: 0.996, clamp: [-limitX, limitX], rubberBandEffect: true, rubberBandFactor: 0.7 }));
      ty.set(withDecay({ velocity: fling(e.velocityY), deceleration: 0.996, clamp: [-limitY, limitY], rubberBandEffect: true, rubberBandFactor: 0.7 }));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      touch();
    })
    .onChange((e) => {
      const next = Math.min(MAX_ZOOM * 1.15, Math.max(minZoom * 0.85, scale.get() * e.scaleChange));
      const ratio = next / scale.get();
      // Keep the point under your fingers fixed while zooming.
      const fx = e.focalX - width / 2;
      const fy = e.focalY - height / 2;
      tx.set(fx - (fx - tx.get()) * ratio);
      ty.set(fy - (fy - ty.get()) * ratio);
      scale.set(next);
    })
    .onEnd(() => {
      if (scale.get() > MAX_ZOOM || scale.get() < minZoom) {
        scale.set(withSpring(Math.min(MAX_ZOOM, Math.max(minZoom, scale.get())), motion.snappy));
        runOnJS(haptic.settle)();
      }
    });

  // Double-tap: zoomed out, zoom in on that spot (every name shows); zoomed in, back to the whole map.
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e, ok) => {
      if (!ok) return;
      const s0 = scale.get();
      if (s0 < detailAt * 0.95) {
        const next = Math.min(MAX_ZOOM, detailAt * 1.1);
        const ratio = next / s0;
        const fx = e.x - width / 2;
        const fy = e.y - height / 2;
        if (!touched.get()) {
          touched.set(true);
          runOnJS(moved)(true);
        }
        tx.set(withSpring(fx - (fx - tx.get()) * ratio, motion.gentle));
        ty.set(withSpring(fy - (fy - ty.get()) * ratio, motion.gentle));
        scale.set(withSpring(next, motion.gentle));
        runOnJS(haptic.select)();
        return;
      }
      touched.set(false);
      scale.set(withSpring(fitScale, motion.gentle));
      tx.set(withSpring(homeX, motion.gentle));
      ty.set(withSpring(homeY, motion.gentle));
      runOnJS(haptic.settle)();
      runOnJS(moved)(false);
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
      tx.set(withSpring(homeX, motion.gentle));
      ty.set(withSpring(homeY, motion.gentle));
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
    if (!touched.get()) {
      touched.set(true);
      moved(true);
    }
    onSelect(hit.artist.id);
    setSpark((last) => ({ key: (last?.key ?? 0) + 1, x: hit.x, y: hit.y, r: hit.r, color: hit.artist.color ? artistColors(hit.artist.id, hit.artist.color)[1] : mixColor(hit.artist.sound) }));
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
        <Starfield width={width} height={height} tx={tx} ty={ty} scale={scale} />
        <Animated.View style={[{ width, height }, worldStyle]}>
          {skies.map((n, i) => (
            <NebulaCloud key={n.tag} nebula={n} index={i} ox={ox} oy={oy} />
          ))}
          <ReshapeRipple pulse={layout} color={heartColors(skies)[0]} ox={ox} oy={oy} />
          <Constellation links={links} artist={artistOf} selectedId={selectedId} dimmed={!!matchIds} ox={ox} oy={oy} delay={linkDelay} fadeKey={fadeKey} />
          {layout.bubbles[0] ? <HeartHalo skies={skies} r={layout.bubbles[0].r} ox={ox} oy={oy} /> : null}
          {layout.regions.map((r) => (
            <RegionName key={r.tag} region={r} ox={ox} oy={oy} scale={scale} tappable={!!onRegionTap} onTap={onRegionTap} />
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
                lagX={lagX}
                lagY={lagY}
                clock={clock}
                scale={scale}
                detailAt={detailAt}
                loved={!!loved?.has(b.artist.id)}
                lead={leaders.has(b.artist.id)}
              />
            ))}
          </View>
          {spark ? <SparkBurst key={spark.key} x={ox + spark.x} y={oy + spark.y} r={spark.r} color={spark.color} /> : null}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** Zoomed out, a sound's name grows back against the zoom (up to this much) so it reads like a place name on a map. */
const REGION_MAX_GROW = 2.2;

/** A sound's name beside its group, in its own colour; it stays readable however far out you zoom. */
function RegionName({ region: r, ox, oy, scale, tappable, onTap }: { region: RegionLabel; ox: number; oy: number; scale: SharedValue<number>; tappable: boolean; onTap?: (tag: SoundTag) => void }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: Math.min(REGION_MAX_GROW, Math.max(1, 0.85 / scale.get())) }] }));
  return (
    <Animated.Text
      style={[styles.region, { left: ox + r.x - 60, top: oy + r.y - 9, color: SOUND_COLOR[r.tag], textShadowColor: SOUND_COLOR[r.tag] }, style]}
      pointerEvents="none"
      accessible={tappable}
      accessibilityRole={tappable ? 'button' : undefined}
      accessibilityLabel={tappable ? t('{sound}. Show these artists', { sound: SOUND_LABEL[r.tag] }) : undefined}
      onAccessibilityTap={onTap ? () => onTap(r.tag) : undefined}
    >
      {SOUND_LABEL[r.tag]}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  // Not clipped: bubbles drift softly under the header's scrim instead of being cut off at an edge.
  viewport: { overflow: 'visible' },
  // Each sound's name in its own colour, softly lit, matching its nebula.
  region: {
    position: 'absolute',
    width: 120,
    textAlign: 'center',
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    opacity: 0.95,
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
});
