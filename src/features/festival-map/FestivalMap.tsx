import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDecay,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { NEAR_KM } from '../festivals/near';
import type { Point } from '../festivals/near';
import { haptic } from '../../lib/haptics';
import { revealSecret } from '../../state/secrets';
import { color, motion, type } from '../../theme/tokens';
import {
  type Box,
  type Cluster,
  type MapPoint,
  type Marker,
  arcPath,
  boxAround,
  reachEllipse,
  clusterMarkers,
  dotsPath,
  fitView,
  grow,
  landDots,
  project,
} from './map';

/** Pixels between land dots on screen. */
const DOT_GAP = 6.5;
/** Each dot's radius, as a share of the gap. */
const DOT_R = 0.17;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 5;
/** Above this zoom, the dots are drawn again, sharp, for what's on screen. */
const DETAIL_AT = 1.35;
/** Lights closer than this many pixels share one. */
const CLUSTER_PX = 26;
/** Every festival's name shows from this zoom. */
const NAMES_AT = 2.4;

/** Light colour for each kind of festival. */
export const TONE_COLOR = {
  going: '#FF9AD5',
  love: color.glow,
  more: 'rgba(243,240,255,0.75)',
  over: 'rgba(243,240,255,0.32)',
} as const;

type Detail = { z: number; box: Box };

/**
 * The festival map: land as dots of light, festivals glowing where they
 * happen. Pinch and drag to move around, double-tap to zoom in, tap a light
 * to choose it. `area` is the part of the screen left clear of the header and
 * the cards, where the map frames its festivals.
 */
export function FestivalMap({
  markers,
  selected,
  onSelect,
  here,
  width,
  height,
  area,
  journey,
  frameKey,
  toHere,
  testID,
}: {
  markers: readonly Marker[];
  selected?: string;
  onSelect: (festivalId: string) => void;
  here?: Point;
  width: number;
  height: number;
  area: { top: number; bottom: number };
  /** Your festivals in date order: a glowing line draws in between them. */
  journey?: readonly MapPoint[];
  /** The map frames its festivals again only when this changes. */
  frameKey: string;
  /** Bump to glide to where you are. */
  toHere?: number;
  testID?: string;
}) {
  const reduced = useReducedMotion();
  const areaH = Math.max(80, height - area.top - area.bottom);
  const areaCx = width / 2;
  const areaCy = area.top + areaH / 2;

  // Frame every festival (and you) the first time; the drawable world reaches well beyond it.
  const points = useMemo(() => [...markers.map((m) => m.at), ...(here ? [project(here)] : [])], [markers, here]);
  // Framed once per `frameKey` (a filter, a tour): data arriving later (a place looked up) never yanks the map back.
  // Framed from nothing (places still being looked up)? Frame again once there's something to show.
  const [framing, setFraming] = useState(() => ({ key: frameKey, frame: boxAround(points), from: points.length }));
  if (framing.key !== frameKey || (framing.from === 0 && points.length > 0)) setFraming({ key: frameKey, frame: boxAround(points), from: points.length });
  const frame = framing.frame;
  const view = useMemo(() => fitView(frame, width * 0.9, areaH * 0.9), [frame, width, areaH]);
  const S = view.scale;
  // Room to roam: well past the festivals, and always more than a screen in every direction.
  const world = useMemo(() => {
    const g = grow(frame, 1.6);
    const hw = (width / S) * 1.6;
    const hh = (height / S) * 1.6;
    return { x0: Math.min(g.x0, view.cx - hw), y0: Math.min(g.y0, view.cy - hh), x1: Math.max(g.x1, view.cx + hw), y1: Math.max(g.y1, view.cy + hh) };
  }, [frame, view, S, width, height]);
  const layerW = (world.x1 - world.x0) * S;
  const layerH = (world.y1 - world.y0) * S;
  const toLayer = useCallback((m: MapPoint) => ({ x: (m.x - world.x0) * S, y: (m.y - world.y0) * S }), [world, S]);

  // Where the layer's top-left corner is on screen, and the zoom.
  const start = toLayer({ x: view.cx, y: view.cy });
  const ax = useSharedValue(areaCx - start.x);
  const ay = useSharedValue(areaCy - start.y);
  const z = useSharedValue(reduced ? 1 : 0.86);
  const shown = useSharedValue(reduced ? 1 : 0);
  // The base dots hide under the sharp ones, and come back while you zoom.
  const baseOn = useSharedValue(1);

  // The sharp layer for what's on screen when zoomed in, and the zoom the lights cluster at.
  const [detail, setDetail] = useState<Detail | undefined>();
  const [zoomStep, setZoomStep] = useState(1);

  // Reframe when the festivals change (a filter).
  const framed = useRef('');
  useEffect(() => {
    const key = `${frame.x0},${frame.y0},${frame.x1},${frame.y1},${width},${areaH}`;
    if (framed.current === key) return;
    const first = !framed.current;
    framed.current = key;
    const s = toLayer({ x: view.cx, y: view.cy });
    if (first) {
      ax.set(areaCx - s.x);
      ay.set(areaCy - s.y);
      z.set(reduced ? 1 : withSpring(1, motion.gentle));
      shown.set(withTiming(1, { duration: reduced ? 0 : 520 }));
    } else {
      const go = reduced ? (v: number) => v : (v: number) => withSpring(v, motion.gentle);
      ax.set(go(areaCx - s.x));
      ay.set(go(areaCy - s.y));
      z.set(go(1));
    }
    // Back at the first zoom: the base dots show again.
    baseOn.set(withTiming(1, { duration: 240 }));
    setDetail(undefined);
    setZoomStep(1);
  }, [frame, width, areaH, view, toLayer, areaCx, areaCy, reduced, ax, ay, z, shown, baseOn]);

  const lastZoom = useSharedValue(1);
  const settle = useCallback(
    (zoom: number, x: number, y: number) => {
      setZoomStep(Math.round(zoom * 4) / 4);
      // A secret: as close as the map goes (once each time you get there, not every move once you're there).
      if (zoom >= MAX_ZOOM * 0.98 && lastZoom.get() < MAX_ZOOM * 0.98) revealSecret('edge');
      lastZoom.set(zoom);
      // The base dots step aside for the sharp ones when zoomed in, and come back when not.
      baseOn.set(withTiming(zoom < DETAIL_AT ? 1 : 0, { duration: 240 }));
      if (zoom < DETAIL_AT) {
        setDetail(undefined);
        return;
      }
      // What's on screen, in map units, plus half again on every side.
      const toMap = (px: number, py: number) => ({ x: world.x0 + (px - x) / zoom / S, y: world.y0 + (py - y) / zoom / S });
      const a = toMap(0, 0);
      const b = toMap(width, height);
      setDetail((d) => (d && Math.abs(d.z - zoom) / zoom < 0.12 && within(d.box, a, b) ? d : { z: zoom, box: grow({ x0: a.x, y0: a.y, x1: b.x, y1: b.y }, 0.5) }));
    },
    [world, S, width, height, baseOn, lastZoom],
  );

  // Keep the middle of the screen over the drawable world.
  const clampA = (v: number, zoom: number, size: number, mid: number) => {
    'worklet';
    return Math.min(mid, Math.max(mid - size * zoom, v));
  };

  const pan0 = useSharedValue({ x: 0, y: 0 });
  const gliding = useSharedValue(0);
  const pinch0 = useSharedValue({ z: 1, x: 0, y: 0, fx: 0, fy: 0 });
  const report = () => {
    'worklet';
    runOnJS(settle)(z.get(), ax.get(), ay.get());
  };
  const pan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      pan0.set({ x: ax.get(), y: ay.get() });
      // Bring the base dots back while moving, in case you drag past the sharp ones.
      baseOn.set(1);
    })
    .onUpdate((e) => {
      const p = pan0.get();
      ax.set(p.x + e.translationX);
      ay.set(p.y + e.translationY);
    })
    .onEnd((e) => {
      const zoom = z.get();
      const lo = (mid: number, size: number) => [mid - size * zoom, mid] as [number, number];
      const fling = (v: number) => Math.max(-2400, Math.min(2400, v));
      // Measure once both directions have come to rest.
      gliding.set(2);
      const rest = (done?: boolean) => {
        'worklet';
        if (!done) return;
        gliding.set(gliding.get() - 1);
        if (gliding.get() === 0) report();
      };
      ax.set(withDecay({ velocity: fling(e.velocityX), deceleration: 0.993, clamp: lo(width / 2, layerW) }, rest));
      ay.set(withDecay({ velocity: fling(e.velocityY), deceleration: 0.993, clamp: lo(height / 2, layerH) }, rest));
    });
  const pinch = Gesture.Pinch()
    .onStart((e) => {
      pinch0.set({ z: z.get(), x: ax.get(), y: ay.get(), fx: e.focalX, fy: e.focalY });
      baseOn.set(1);
    })
    .onUpdate((e) => {
      const p = pinch0.get();
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, p.z * e.scale));
      // The spot under your fingers stays under them.
      const lx = (p.fx - p.x) / p.z;
      const ly = (p.fy - p.y) / p.z;
      ax.set(e.focalX - lx * next);
      ay.set(e.focalY - ly * next);
      z.set(next);
    })
    .onEnd(() => {
      const zoom = Math.max(1, z.get());
      if (zoom !== z.get()) {
        // Zoomed out past the frame: ease back to it around the middle.
        const lx = (width / 2 - ax.get()) / z.get();
        const ly = (height / 2 - ay.get()) / z.get();
        ax.set(withSpring(width / 2 - lx * zoom, motion.gentle));
        ay.set(withSpring(height / 2 - ly * zoom, motion.gentle));
        z.set(withSpring(zoom, motion.gentle, (done) => done && report()));
      } else {
        const tx = clampA(ax.get(), zoom, layerW, width / 2);
        const ty = clampA(ay.get(), zoom, layerH, height / 2);
        ax.set(withSpring(tx, motion.gentle));
        ay.set(withSpring(ty, motion.gentle));
        // Where it's springing to, not where it is now.
        runOnJS(settle)(zoom, tx, ty);
      }
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      const from = z.get();
      const next = from >= MAX_ZOOM * 0.7 ? 1 : Math.min(MAX_ZOOM, from * 2);
      const lx = (e.x - ax.get()) / from;
      const ly = (e.y - ay.get()) / from;
      // Zoom in on the spot you tapped, bringing it towards the middle.
      ax.set(withSpring(clampA(areaCx - lx * next, next, layerW, width / 2), motion.gentle));
      ay.set(withSpring(clampA(areaCy - ly * next, next, layerH, height / 2), motion.gentle));
      z.set(withSpring(next, motion.gentle, (done) => done && report()));
      runOnJS(haptic.soft)();
    });
  const gesture = Gesture.Simultaneous(pan, pinch, doubleTap);

  // Glide to the chosen festival, keeping the zoom.
  const glideTo = useCallback(
    (m: MapPoint, zoomTo?: number) => {
      const zoom = zoomTo ?? Math.max(1, z.get());
      const p = toLayer(m);
      const go = reduced ? (v: number) => v : (v: number) => withSpring(v, motion.gentle);
      ax.set(go(areaCx - p.x * zoom));
      ay.set(go(areaCy - p.y * zoom));
      if (zoomTo) z.set(go(zoomTo));
      setTimeout(() => settle(zoom, areaCx - p.x * zoom, areaCy - p.y * zoom), reduced ? 0 : 420);
    },
    [toLayer, areaCx, areaCy, reduced, ax, ay, z, settle],
  );
  const lastGlide = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!selected || selected === lastGlide.current) return;
    lastGlide.current = selected;
    const m = markers.find((k) => k.festival.id === selected);
    if (m) glideTo(m.at);
  }, [selected, markers, glideTo]);

  // The journey, in layer pixels.
  const trail = useMemo(() => (journey && journey.length > 1 ? arcPath(journey.map(toLayer)) : undefined), [journey, toLayer]);

  // "Show me": glide to where you are.
  const answered = useRef(0);
  useEffect(() => {
    // Only when asked (a new `toHere`), once you're known: never again on a filter change or a refreshed location.
    if (!toHere || !here || answered.current === toHere) return;
    answered.current = toHere;
    glideTo(project(here));
  }, [toHere, here, glideTo]);

  const clusters = useMemo(() => clusterMarkers(markers, S * zoomStep, CLUSTER_PX), [markers, S, zoomStep]);

  // The base dots: the whole drawable world at the first zoom.
  const base = useMemo(() => {
    const dots = landDots(world, DOT_GAP / S);
    return dotsPath(dots, world, S, DOT_GAP * DOT_R);
  }, [world, S]);
  const sharp = useMemo(() => {
    if (!detail) return undefined;
    const scale = S * detail.z;
    const dots = landDots(detail.box, DOT_GAP / scale);
    // Land dots get a touch bigger as you get closer, like lights at night.
    return { path: dotsPath(dots, detail.box, scale, DOT_GAP * DOT_R * Math.min(1.6, 1 + (detail.z - 1) * 0.15)), ...detail };
  }, [detail, S]);

  const baseStyle = useAnimatedStyle(() => {
    const k = z.get();
    return {
      opacity: shown.get() * baseOn.get(),
      transform: [{ translateX: ax.get() + (layerW / 2) * (k - 1) }, { translateY: ay.get() + (layerH / 2) * (k - 1) }, { scale: k }],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <View style={[StyleSheet.absoluteFill, styles.root]} testID={testID} collapsable={false}>
        <Animated.View style={[styles.layer, { width: layerW, height: layerH }, baseStyle]} pointerEvents="none">
          <Svg width={layerW} height={layerH}>
            <Defs>
              {(['going', 'love', 'more'] as const).map((t) => (
                <RadialGradient key={t} id={`pool-${t}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={t === 'going' ? '#FF7AC6' : t === 'love' ? color.glow : color.moon} stopOpacity={t === 'more' ? 0.12 : 0.34} />
                  <Stop offset="1" stopColor={t === 'going' ? '#FF7AC6' : t === 'love' ? color.glow : color.moon} stopOpacity="0" />
                </RadialGradient>
              ))}
            </Defs>
            {/* City light: a soft pool where each festival happens, under the dots. */}
            {markers
              .filter((m) => m.tone !== 'over')
              .map((m) => {
                const p = toLayer(m.at);
                const r = m.tone === 'going' ? 46 : m.tone === 'love' ? 34 + Math.min(18, m.loved * 3) : 20;
                return <Circle key={m.festival.id} cx={p.x} cy={p.y} r={r} fill={`url(#pool-${m.tone})`} />;
              })}
            <Path d={base} fill={color.moon} fillOpacity={0.2} />
            {/* How far Near you reaches, around you. */}
            {here ? (
              <Ellipse
                cx={toLayer(project(here)).x}
                cy={toLayer(project(here)).y}
                rx={reachEllipse(here, NEAR_KM).rx * S}
                ry={reachEllipse(here, NEAR_KM).ry * S}
                stroke="#6FC3FF"
                strokeOpacity={0.45}
                strokeWidth={1.2}
                strokeDasharray="4 5"
                fill="#6FC3FF"
                fillOpacity={0.04}
              />
            ) : null}
            {trail ? <Journey key={trail.d} d={trail.d} length={trail.length} reduced={reduced} /> : null}
          </Svg>
        </Animated.View>
        {sharp ? <SharpLayer sharp={sharp} world={world} S={S} ax={ax} ay={ay} z={z} /> : null}
        {here ? <HereDot at={toLayer(project(here))} ax={ax} ay={ay} z={z} reduced={reduced} /> : null}
        {clusters.map((c, i) => (
          <Light
            key={c.lead.festival.id}
            cluster={c}
            at={toLayer(c.at)}
            ax={ax}
            ay={ay}
            z={z}
            index={i}
            chosen={c.members.some((m) => m.festival.id === selected)}
            named={zoomStep >= NAMES_AT || c.lead.tone === 'going'}
            reduced={reduced}
            onPress={() => {
              haptic.select();
              lastGlide.current = c.lead.festival.id;
              onSelect(c.lead.festival.id);
              // A cluster opens up: zoom in until it splits.
              if (c.members.length > 1) glideTo(c.at, Math.min(MAX_ZOOM, Math.max(zoomStep * 2.2, 2)));
              else glideTo(c.at);
            }}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The journey line: it draws itself in, from your first festival to your last. */
function Journey({ d, length, reduced }: { d: string; length: number; reduced: boolean }) {
  const drawn = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) drawn.set(withDelay(500, withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) })));
  }, [drawn, reduced]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.get()) }));
  return (
    <>
      <Defs>
        <LinearGradient id="journey" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FF9AD5" />
          <Stop offset="1" stopColor={color.glow} />
        </LinearGradient>
      </Defs>
      <AnimatedPath d={d} stroke="url(#journey)" strokeOpacity={0.35} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${length} ${length}`} animatedProps={props} />
      <AnimatedPath d={d} stroke="url(#journey)" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeDasharray={`${length} ${length}`} animatedProps={props} />
    </>
  );
}

const within = (b: Box, a: MapPoint, c: MapPoint) => a.x >= b.x0 && a.y >= b.y0 && c.x <= b.x1 && c.y <= b.y1;

/** The dots drawn again, sharp, for what was on screen when you stopped zooming. */
function SharpLayer({
  sharp,
  world,
  S,
  ax,
  ay,
  z,
}: {
  sharp: { path: string; z: number; box: Box };
  world: Box;
  S: number;
  ax: SharedValue<number>;
  ay: SharedValue<number>;
  z: SharedValue<number>;
}) {
  const w = (sharp.box.x1 - sharp.box.x0) * S * sharp.z;
  const h = (sharp.box.y1 - sharp.box.y0) * S * sharp.z;
  const ox = (sharp.box.x0 - world.x0) * S;
  const oy = (sharp.box.y0 - world.y0) * S;
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.set(0);
    fade.set(withTiming(1, { duration: 220 }));
  }, [sharp, fade]);
  const style = useAnimatedStyle(() => {
    const k = z.get() / sharp.z;
    const left = ax.get() + ox * z.get();
    const top = ay.get() + oy * z.get();
    return {
      opacity: fade.get(),
      transform: [{ translateX: left + (w / 2) * (k - 1) }, { translateY: top + (h / 2) * (k - 1) }, { scale: k }],
    };
  });
  return (
    <Animated.View style={[styles.layer, { width: w, height: h }, style]} pointerEvents="none">
      <Svg width={w} height={h}>
        <Path d={sharp.path} fill={color.moon} fillOpacity={0.22} />
      </Svg>
    </Animated.View>
  );
}

/** Keeps something at a layer point, at its own size whatever the zoom. */
function useAt(at: MapPoint, size: number, ax: SharedValue<number>, ay: SharedValue<number>, z: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    transform: [{ translateX: ax.get() + at.x * z.get() - size / 2 }, { translateY: ay.get() + at.y * z.get() - size / 2 }],
  }));
}

const LIGHT = 44;

/** A festival's light: its core, a halo, a ring when chosen, a slow pulse when you're going. */
function Light({
  cluster,
  at,
  ax,
  ay,
  z,
  index,
  chosen,
  named,
  reduced,
  onPress,
}: {
  cluster: Cluster;
  at: MapPoint;
  ax: SharedValue<number>;
  ay: SharedValue<number>;
  z: SharedValue<number>;
  index: number;
  chosen: boolean;
  named: boolean;
  reduced: boolean;
  onPress: () => void;
}) {
  const { lead, members } = cluster;
  const tone = lead.tone;
  const tint = TONE_COLOR[tone];
  const core = tone === 'going' ? 12 : tone === 'love' ? 10 + Math.min(4, lead.loved) : tone === 'more' ? 7 : 6;
  const place = useAt(at, LIGHT, ax, ay, z);
  // Lights land one after another the first time, like a city switching on.
  const on = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) on.set(withDelay(260 + Math.min(index, 30) * 28, withSpring(1, motion.bloom)));
  }, [on, index, reduced]);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced || tone !== 'going') return;
    pulse.set(withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false));
  }, [pulse, tone, reduced]);
  const pick = useSharedValue(chosen ? 1 : 0);
  useEffect(() => {
    pick.set(reduced ? (chosen ? 1 : 0) : chosen ? withSequence(withSpring(1.25, motion.snappy), withSpring(1, motion.bloom)) : withTiming(0, { duration: 180 }));
  }, [chosen, pick, reduced]);
  const coreStyle = useAnimatedStyle(() => ({ opacity: on.get(), transform: [{ scale: on.get() * (1 + pick.get() * 0.35) }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pick.get()), transform: [{ scale: 0.6 + pick.get() * 0.4 }] }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: (1 - pulse.get()) * 0.7 * on.get(), transform: [{ scale: 0.6 + pulse.get() * 1.4 }] }));

  const what = tone === 'going' ? 'You’re going.' : tone === 'over' ? 'It’s over.' : lead.loved ? `${lead.loved} you’d love.` : '';
  const label = members.length > 1 ? `${lead.festival.name} and ${members.length - 1} more here. ${what}` : `${lead.festival.name}, ${lead.festival.dates}, ${lead.festival.location}. ${what}`;
  return (
    <Animated.View style={[styles.light, place]} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label.trim()}
        accessibilityState={{ selected: chosen }}
        hitSlop={6}
        style={styles.lightHit}
        testID={`map-light-${lead.festival.id}`}
      >
        {tone === 'going' ? <Animated.View style={[styles.pulse, { borderColor: tint }, pulseStyle]} /> : null}
        <Animated.View style={[styles.ring, { borderColor: tint }, ringStyle]} />
        <Animated.View style={[styles.core, coreStyle, { width: core, height: core, borderRadius: core / 2, backgroundColor: tint, shadowColor: tint }]} />
        {members.length > 1 ? (
          <View style={[styles.count, { borderColor: tint }]}>
            <Text style={styles.countText}>{members.length}</Text>
          </View>
        ) : null}
      </Pressable>
      {named || chosen ? (
        <View style={styles.nameBox} pointerEvents="none">
          <Text numberOfLines={2} style={[styles.name, chosen && styles.nameChosen]}>
            {lead.festival.name}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Where you are, when Near you is on: a cool blue dot with a slow ripple. */
function HereDot({ at, ax, ay, z, reduced }: { at: MapPoint; ax: SharedValue<number>; ay: SharedValue<number>; z: SharedValue<number>; reduced: boolean }) {
  const place = useAt(at, LIGHT, ax, ay, z);
  const ripple = useSharedValue(0);
  useEffect(() => {
    if (!reduced) ripple.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false));
  }, [ripple, reduced]);
  const rippleStyle = useAnimatedStyle(() => ({ opacity: (1 - ripple.get()) * 0.6, transform: [{ scale: 0.5 + ripple.get() * 1.6 }] }));
  return (
    <Animated.View style={[styles.light, place]} pointerEvents="none" accessible accessibilityLabel="You are here, roughly">
      <View style={styles.lightHit}>
        <Animated.View style={[styles.pulse, { borderColor: HERE }, rippleStyle]} />
        <View style={styles.here} />
      </View>
    </Animated.View>
  );
}

const HERE = '#6FC3FF';

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  layer: { position: 'absolute', left: 0, top: 0 },
  light: { position: 'absolute', left: 0, top: 0, width: LIGHT, alignItems: 'center' },
  lightHit: { width: LIGHT, height: LIGHT, alignItems: 'center', justifyContent: 'center' },
  core: { shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  ring: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 1.5 },
  pulse: { position: 'absolute', width: 26, height: 26, borderRadius: 13, borderWidth: 1.5 },
  count: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: color.night,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { ...type.caption, fontSize: 10, lineHeight: 12, color: color.moon },
  nameBox: { position: 'absolute', top: LIGHT - 8, left: (LIGHT - 140) / 2, width: 140, alignItems: 'center' },
  name: {
    ...type.caption,
    textAlign: 'center',
    color: color.moonDim,
    textShadowColor: color.night,
    textShadowRadius: 6,
  },
  nameChosen: { color: color.moon, fontWeight: '700' },
  here: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: HERE,
    borderWidth: 2,
    borderColor: color.moon,
    shadowColor: HERE,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
