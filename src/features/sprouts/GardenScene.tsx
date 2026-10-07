import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, runOnJS, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useNow } from '../../lib/useNow';
import { skyAt } from './sky';
import { t, tn } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { useGardenLayout } from '../../state/gardenLayout';
import { color, motion, space, type } from '../../theme/tokens';
import { type ArtistLook, hashOf, mix } from './artistLook';
import type { Tier } from './artistSprouts';
import { HORIZON, type Meadow, meadow, moveTo, nearestSpot, placeResidents, samePlacement, type Spot } from './gardenLayout';
import { SPROUT_DEEP, SPROUT_GLOW, SPROUT_GREEN } from './look';
import { CLOCK_MS, type Pace, paceOf, sine, WANDER_X, WANDER_Y, wander } from './motion';
import { Sprout } from './Sprout';
import type { DecorId } from './decor';
import { DecorBehind, DecorFront } from './DecorSky';
import type { SproutKind, Stage } from './sprouts';

/**
 * The living garden: a night meadow where every sprout and artist
 * collectible stands at its own spot, bobbing, swaying and blinking on one
 * shared clock (motion.ts), little feet swinging. Hold one to pick it up and
 * carry it to another spot (it swaps with whoever stood there); a tap opens
 * its sheet. Where everything stands is kept per account on this phone
 * (state/gardenLayout.ts). With reduced motion everything rests, and moving
 * still works (no bounce). It stops moving when the screen isn't showing.
 */
export type SceneResident = {
  id: string;
  /** Its name, under it. */
  name: string;
  /** For screen readers: name, who from, how grown. */
  label: string;
  /** How big it stands (pt), before the back rows shrink a little. */
  size: number;
  /** A small bar under it: how far to the next stage or level, in a colour. */
  bar?: { at: number; color: string };
  /** Its first appearance: it glows. */
  fresh?: boolean;
  look: { kind: SproutKind; stage: Stage } | { artist: ArtistLook; tier: Tier; shiny?: boolean };
};

type Props = {
  residents: SceneResident[];
  /** Whose garden ('guest' when signed out): layouts are kept per account. */
  account: string;
  /** The width it has (the page's content width). */
  width: number;
  /** The screen is showing: the garden moves. */
  focused: boolean;
  /** The residents are loaded, so where they stand can be kept. */
  ready: boolean;
  onOpen: (id: string) => void;
  /** Something is being carried (the page shouldn't scroll under it). */
  onCarrying?: (on: boolean) => void;
  /** Visiting someone else's garden: nothing can be moved, and a tap makes a resident dance. */
  visiting?: boolean;
  /** Decorations in its sky (decor.ts). */
  decor?: readonly DecorId[];
};

/** Hold this long to pick something up (a shorter touch is a tap, or a scroll). */
export const LIFT_MS = 260;
/** Arrivals since this long ago glow. */
const lagSpring = { damping: 16, stiffness: 150, mass: 0.6 };

export function GardenScene({ residents, account, width, focused, ready, onOpen, onCarrying, visiting = false, decor = [] }: Props) {
  const reduce = useReducedMotion();
  const running = focused && !reduce;
  // The sky follows the hour (checked every ten minutes).
  const now = useNow(600_000);
  // One clock for the whole garden.
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!running) return;
    clock.set(withRepeat(withTiming(1, { duration: CLOCK_MS, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(clock);
      clock.set(0);
    };
  }, [running, clock]);

  const m = meadow(residents.length, width);
  const { layout, ready: layoutReady, save } = useGardenLayout(account);
  const placement = placeResidents(
    residents.map((r) => r.id),
    layout,
    m,
  );
  // Keep where everyone stands (new arrivals placed, the departed freed), once the garden is known.
  useEffect(() => {
    if (visiting || !ready || !layoutReady || !residents.length || samePlacement(layout, placement)) return;
    save(placement);
  }, [visiting, ready, layoutReady, residents.length, layout, placement, save]);
  const placementRef = useRef(placement);
  useEffect(() => {
    placementRef.current = placement;
  });

  const [carrying, setCarrying] = useState<string>();
  const carryingRef = useRef(false);
  const pick = useCallback(
    (id: string) => {
      haptic.tap();
      carryingRef.current = true;
      setCarrying(id);
      onCarrying?.(true);
    },
    [onCarrying],
  );
  const release = useCallback(() => {
    carryingRef.current = false;
    setCarrying(undefined);
    onCarrying?.(false);
  }, [onCarrying]);
  const drop = useCallback(
    (id: string, spot: number) => {
      haptic.settle();
      save(moveTo(placementRef.current, id, spot));
    },
    [save],
  );
  // On the website, a touch that's carrying something must not scroll the page under it.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const block = (e: TouchEvent) => {
      if (carryingRef.current) e.preventDefault();
    };
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, []);

  // Who's at which spot, for the glow pools and for glancing at a neighbour.
  const spotOf = (id: string): Spot => m.spots[placement[id]] ?? m.spots[0];
  const sprouts = residents.filter((r) => 'kind' in r.look).length;
  const artists = residents.length - sprouts;
  const sproutsLine = tn(sprouts, '{n} sprout', '{n} sprouts');
  const label = visiting
    ? t('A night meadow with {sprouts} and {collectibles}. Tap one to make it dance.', { sprouts: sproutsLine, collectibles: tn(artists, '{n} artist collectible', '{n} artist collectibles') })
    : artists
      ? t('A night meadow with {sprouts} and {collectibles}. Hold and drag one to move it.', { sprouts: sproutsLine, collectibles: tn(artists, '{n} artist collectible', '{n} artist collectibles') })
      : t('A night meadow with {sprouts}. Hold and drag one to move it.', { sprouts: sproutsLine });

  return (
    <View style={{ width, height: m.height }} accessible={false}>
      <Ground hour={now.getHours()} decor={decor} width={width} m={m} pools={residents.map((r) => ({ ...spotOf(r.id), gold: 'artist' in r.look }))} clock={clock} running={running} label={label} />
      {residents.map((r) => {
        const spot = spotOf(r.id);
        // The nearest neighbour in its row, to glance at now and then.
        const near = residents.filter((o) => o.id !== r.id && spotOf(o.id).row === spot.row).sort((a, b) => Math.abs(spotOf(a.id).x - spot.x) - Math.abs(spotOf(b.id).x - spot.x))[0];
        const glance = near ? Math.sign(spotOf(near.id).x - spot.x) : 0;
        return (
          <Creature
            key={r.id}
            r={r}
            spot={spot}
            spots={m.spots}
            colWidth={m.colWidth}
            scale={m.scale}
            names={m.names}
            width={width}
            clock={clock}
            running={running}
            reduce={reduce}
            carrying={carrying === r.id}
            glance={glance}
            onOpen={onOpen}
            onPick={pick}
            onDrop={drop}
            onRelease={release}
            visiting={visiting}
          />
        );
      })}
    </View>
  );
}

type CreatureProps = {
  r: SceneResident;
  spot: Spot;
  spots: Spot[];
  colWidth: number;
  /** The meadow's crowding: how big everyone stands, and whether names show. */
  scale: number;
  names: boolean;
  /** The meadow's width, so nobody wanders off the edge. */
  width: number;
  clock: SharedValue<number>;
  running: boolean;
  reduce: boolean;
  carrying: boolean;
  glance: number;
  onOpen: (id: string) => void;
  onPick: (id: string) => void;
  onDrop: (id: string, spot: number) => void;
  onRelease: () => void;
  visiting: boolean;
};

function Creature({ r, spot, spots, colWidth, scale, names, width, clock, running, reduce, carrying, glance, onOpen, onPick, onDrop, onRelease, visiting }: CreatureProps) {
  const size = Math.round(r.size * scale * (0.9 + 0.1 * spot.depth));
  const pace: Pace = paceOf(r.id);
  const bobC = pace.bob;
  const phase = pace.phase;
  const legs = pace.wanders;
  // How far it strolls from its spot (it always comes back), staying inside the meadow.
  const reachX = colWidth * WANDER_X;
  const reachY = size * WANDER_Y * 2;
  const edge = Math.min(colWidth / 2, size / 2 + 4);
  const px = useSharedValue(spot.x);
  const py = useSharedValue(spot.y);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lift = useSharedValue(0);
  const squash = useSharedValue(0);
  const tilt = useSharedValue(0);
  const sx = spot.x;
  const sy = spot.y;
  // Glides to its spot when that changes (moved, or swapped with the one dropped on it).
  useEffect(() => {
    if (reduce) {
      px.set(sx);
      py.set(sy);
    } else {
      px.set(withSpring(sx, motion.gentle));
      py.set(withSpring(sy, motion.gentle));
    }
  }, [sx, sy, reduce, px, py]);
  // A tap while visiting: a hop and a spin.
  const dance = useSharedValue(0);
  const pan = Gesture.Pan()
    .enabled(!visiting)
    .activateAfterLongPress(LIFT_MS)
    .withTestId(`garden-move-${r.id}`)
    .onStart(() => {
      if (reduce) lift.set(1);
      else lift.set(withSpring(1, motion.bloom));
      runOnJS(onPick)(r.id);
    })
    .onUpdate((e) => {
      dx.set(e.translationX);
      dy.set(e.translationY);
      if (!reduce) tilt.set(withSpring(Math.max(-12, Math.min(12, e.velocityX * 0.012)), lagSpring));
    })
    .onEnd(() => {
      const x = px.get() + dx.get();
      const y = py.get() + dy.get();
      const to = nearestSpot(spots, x, y);
      px.set(x);
      py.set(y);
      dx.set(0);
      dy.set(0);
      if (reduce) {
        px.set(spots[to].x);
        py.set(spots[to].y);
      } else {
        px.set(withSpring(spots[to].x, motion.snappy));
        py.set(withSpring(spots[to].y, motion.snappy));
        // A little squash as it lands.
        squash.set(withDelay(200, withSequence(withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }), withSpring(0, motion.bloom))));
      }
      runOnJS(onDrop)(r.id, to);
    })
    .onFinalize(() => {
      if (reduce) {
        lift.set(0);
        tilt.set(0);
      } else {
        lift.set(withSpring(0, motion.snappy));
        tilt.set(withSpring(0, lagSpring));
      }
      runOnJS(onRelease)();
    });

  // Wandering about its spot on the garden's clock, set down while it's carried.
  const placeStyle = useAnimatedStyle(() => {
    const away = 1 - Math.min(1, lift.get());
    const w = running ? wander(clock.get(), legs, phase) : { x: 0, y: 0, walking: 0 };
    const x = Math.max(edge, Math.min(width - edge, px.get() + w.x * reachX * away));
    return { transform: [{ translateX: x + dx.get() }, { translateY: py.get() + dy.get() + w.y * reachY * away }] };
  });
  const bodyStyle = useAnimatedStyle(() => {
    const up = lift.get();
    const sq = squash.get();
    const t = clock.get();
    const bob = running ? sine(t, bobC, phase) : 0;
    // Walking: little hops in step, leaning the way it's going.
    const w = running ? wander(t, legs, phase) : { x: 0, y: 0, walking: 0 };
    const ahead = running ? wander((t + 0.002) % 1, legs, phase).x - w.x : 0;
    const step = running ? Math.abs(sine(t, 60, phase)) * w.walking * (1 - up) : 0;
    const lean = Math.sign(ahead) * w.walking * 6 * (1 - up);
    const d = dance.get();
    // Up and back down twice while turning all the way round.
    const hop = Math.abs(Math.sin(d * Math.PI * 2));
    return {
      transform: [
        { translateY: -bob * size * 0.03 - step * size * 0.05 - up * size * 0.14 - hop * size * 0.22 },
        { rotate: `${tilt.get() + lean}deg` },
        { rotateY: `${d * 360}deg` },
        { scale: 1 + up * 0.15 },
        { scaleX: 1 + sq * 0.09 },
        { scaleY: 1 - sq * 0.11 },
      ],
    };
  });
  // Its shadow on the ground: smaller and fainter the higher it floats.
  const shadowStyle = useAnimatedStyle(() => {
    const up = lift.get();
    const bob = running ? sine(clock.get(), bobC, phase) : 0;
    const k = 1 - 0.1 * bob - 0.45 * up;
    return { opacity: 0.6 - 0.12 * bob - 0.45 * up, transform: [{ scaleX: k }, { scaleY: k }] };
  });
  const glowStyle = useAnimatedStyle(() => ({ opacity: running ? 0.55 + 0.45 * sine(clock.get(), 12, phase) : 0.8 }));

  const open = () => {
    if (visiting) {
      haptic.tap();
      if (reduce) dance.set(0);
      else dance.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) })));
      onOpen(r.id);
      return;
    }
    haptic.select();
    onOpen(r.id);
  };
  const look = r.look;
  const driven = { clock, pace, running, lift, glance };
  const glowId = `fresh${hashOf(r.id)}`;
  return (
    <GestureDetector gesture={pan} touchAction="pan-y" userSelect="none">
      <Animated.View style={[styles.creature, { width: colWidth, marginLeft: -colWidth / 2, marginTop: -size, zIndex: carrying ? 100 : spot.row + 1 }, placeStyle]}>
        <Animated.View style={[styles.shadow, { width: size * 0.5, height: size * 0.1, top: size - size * 0.075, marginLeft: -size * 0.25 }, shadowStyle]} pointerEvents="none">
          <View style={styles.shadowCore} />
        </Animated.View>
        <Animated.View style={[{ width: size, height: size }, bodyStyle]}>
          {r.fresh ? (
            <Animated.View style={[styles.glow, { width: size * 1.5, height: size * 1.5, left: -size * 0.25, top: -size * 0.2 }, glowStyle]} pointerEvents="none">
              <Svg width={size * 1.5} height={size * 1.5} viewBox="0 0 100 100">
                <Defs>
                  <RadialGradient id={glowId} cx="50%" cy="55%" r="50%">
                    <Stop offset="0" stopColor={SPROUT_GLOW[0]} stopOpacity={0.5} />
                    <Stop offset="0.5" stopColor={SPROUT_GLOW[1]} stopOpacity={0.18} />
                    <Stop offset="1" stopColor={SPROUT_GLOW[1]} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={50} cy={55} r={50} fill={`url(#${glowId})`} />
              </Svg>
            </Animated.View>
          ) : null}
          {/* A short press opens it; a hold as long as a pick-up never counts as a press (so letting go of a carried one never opens it, on the website too). */}
          <Pressable
            onPress={open}
            onLongPress={() => {}}
            delayLongPress={LIFT_MS}
            accessibilityRole="button"
            accessibilityLabel={r.label}
            accessibilityHint={visiting ? t('Tap to make it dance') : t('Hold and drag to move')}
            style={({ pressed }) => [{ width: size, height: size }, pressed && !carrying && styles.pressed]}
          >
            {'kind' in look ? <Sprout kind={look.kind} stage={look.stage} size={size} still={reduce} scene driven={driven} /> : <Sprout artist={look.artist} tier={look.tier} shiny={look.shiny} size={size} still={reduce} scene driven={driven} />}
          </Pressable>
        </Animated.View>
        {names ? (
          <Text style={styles.name} numberOfLines={1}>
            {r.name}
          </Text>
        ) : null}
        {names && r.bar ? (
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.round(Math.max(0, Math.min(1, r.bar.at)) * 100)}%`, backgroundColor: r.bar.color }]} />
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

/** The meadow: a rolling horizon, far stars, a soft glow where each resident stands, grass, and fireflies drifting about. */
function Ground({ hour, decor, width, m, pools, clock, running, label }: { hour: number; decor: readonly DecorId[]; width: number; m: Meadow; pools: { x: number; y: number; gold: boolean }[]; clock: SharedValue<number>; running: boolean; label: string }) {
  const h = m.height;
  const sky = skyAt(hour, SPROUT_GLOW[1]);
  const hz = HORIZON;
  const far = mix(color.night, '#3AA86A', 0.16);
  const near = mix(color.night, SPROUT_DEEP, 0.22);
  const deep = mix(color.night, '#0B2A1C', 0.45);
  const grass = mix(near, SPROUT_GREEN, 0.28);
  const at = (i: number, salt: string) => (hashOf(`${salt}${i}`) % 1000) / 1000;
  const farHill = `M0 ${hz + 12} C${width * 0.16} ${hz - 6} ${width * 0.34} ${hz - 8} ${width * 0.5} ${hz + 2} S${width * 0.8} ${hz - 12} ${width} ${hz + 6} L${width} ${hz + 80} L0 ${hz + 80} Z`;
  const nearTop = `M0 ${hz + 28} C${width * 0.18} ${hz + 14} ${width * 0.4} ${hz + 36} ${width * 0.58} ${hz + 24} S${width * 0.84} ${hz + 8} ${width} ${hz + 26}`;
  const nearHill = `${nearTop} L${width} ${h} L0 ${h} Z`;
  const stars = Array.from({ length: 11 }, (_, i) => ({ x: at(i, 'sx') * width, y: 4 + at(i, 'sy') * (hz - 10), r: 0.7 + at(i, 'sr') * 0.8, o: 0.25 + at(i, 'so') * 0.45 }));
  const tufts = Array.from({ length: Math.round(width / 28) * m.rows }, (_, i) => ({ x: at(i, 'tx') * width, y: hz + 46 + at(i, 'ty') * (h - hz - 60), s: 0.7 + at(i, 'ts') * 0.6 }));
  const flies = Array.from({ length: 7 }, (_, i) => ({ x: 20 + at(i, 'fx') * (width - 40), y: hz + 10 + at(i, 'fy') * Math.max(40, h * 0.55 - hz) }));
  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={width} height={h} pointerEvents="none">
        <Defs>
          <LinearGradient id="garden-far" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={far} />
            <Stop offset="1" stopColor={near} />
          </LinearGradient>
          <LinearGradient id="garden-near" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={near} />
            <Stop offset="0.45" stopColor={deep} />
            <Stop offset="0.92" stopColor={deep} stopOpacity={0.5} />
            <Stop offset="1" stopColor={deep} stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id="garden-dawn" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={sky.glow} stopOpacity={sky.glowOpacity} />
            <Stop offset="1" stopColor={sky.glow} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="garden-wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky.wash ?? sky.glow} stopOpacity={sky.washOpacity} />
            <Stop offset="1" stopColor={sky.wash ?? sky.glow} stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id="garden-pool" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={SPROUT_GREEN} stopOpacity={0.2} />
            <Stop offset="1" stopColor={SPROUT_GREEN} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="garden-pool-gold" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFD58A" stopOpacity={0.16} />
            <Stop offset="1" stopColor="#FFD58A" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {sky.washOpacity ? <Rect x={0} y={0} width={width} height={hz + 30} fill="url(#garden-wash)" /> : null}
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F3F0FF" opacity={s.o * sky.stars} />
        ))}
        <DecorBehind decor={decor} width={width} hz={hz} />
        {/* A glow low on the horizon, like the last of the light behind the hills. */}
        <Ellipse cx={width * 0.5} cy={hz + 20} rx={width * (sky.phase === 'night' ? 0.55 : 0.7)} ry={sky.phase === 'night' ? 46 : 64} fill="url(#garden-dawn)" />
        <Path d={farHill} fill="url(#garden-far)" />
        <Path d={nearHill} fill="url(#garden-near)" />
        <Path d={nearTop} stroke={SPROUT_GLOW[1]} strokeWidth={9} opacity={0.07} fill="none" />
        <Path d={nearTop} stroke={SPROUT_GLOW[0]} strokeWidth={1.2} opacity={0.28} fill="none" />
        <DecorFront decor={decor} width={width} hz={hz} />
        {pools.map((p, i) => (
          <Ellipse key={i} cx={p.x} cy={p.y + 2} rx={m.colWidth * 0.46} ry={16} fill={p.gold ? 'url(#garden-pool-gold)' : 'url(#garden-pool)'} />
        ))}
        {tufts.map((t, i) => (
          <Path key={i} d={`M${t.x} ${t.y} q${-1.6 * t.s} ${-5 * t.s} ${-2.6 * t.s} ${-8 * t.s} M${t.x} ${t.y} q0 ${-6 * t.s} ${0.6 * t.s} ${-9.5 * t.s} M${t.x} ${t.y} q${1.6 * t.s} ${-5 * t.s} ${3 * t.s} ${-7 * t.s}`} stroke={grass} strokeWidth={1.1} strokeLinecap="round" fill="none" opacity={0.55} />
        ))}
      </Svg>
      {flies.map((f, i) => (
        <Firefly key={i} i={i} x={f.x} y={f.y} clock={clock} running={running} />
      ))}
    </View>
  );
}

function Firefly({ i, x, y, clock, running }: { i: number; x: number; y: number; clock: SharedValue<number>; running: boolean }) {
  const pace = paceOf(`firefly${i}`);
  const glow = pace.blink;
  const phase = pace.phase;
  const style = useAnimatedStyle(() => {
    if (!running) return { opacity: 0.4, transform: [{ translateX: 0 }, { translateY: 0 }] };
    const t = clock.get();
    const a = 0.5 + 0.5 * sine(t, glow, phase);
    return { opacity: 0.08 + 0.85 * a * a * a, transform: [{ translateX: 7 * sine(t, 3, phase) }, { translateY: 5 * sine(t, 4, phase + 0.3) }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.firefly, { left: x - 5, top: y - 5 }, style]}>
      <View style={styles.fireflyCore} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  creature: { position: 'absolute', left: 0, top: 0, alignItems: 'center' },
  shadow: { position: 'absolute', left: '50%', borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center' },
  shadowCore: { width: '62%', height: '70%', borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.4)' },
  glow: { position: 'absolute' },
  pressed: { opacity: 0.85 },
  name: { ...type.caption, color: color.moon, opacity: 0.9, marginTop: 2, textAlign: 'center', paddingHorizontal: space.xs },
  bar: { width: 40, height: 3, borderRadius: 2, marginTop: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  firefly: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(214,255,160,0.2)', alignItems: 'center', justifyContent: 'center' },
  fireflyCore: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#E8FFB8' },
});
