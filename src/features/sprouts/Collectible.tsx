import { type ReactNode, useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { type ArtistLook, hashOf, mix, type Palette } from './artistLook';
import { DRAW, type Fills, star } from './creatures';

/** Bronze, silver and gold, for the ring round a collectible's tile. */
export const TIER_COLOR = ['', '#D08A4E', '#D6DDEA', '#FFD24A'] as const;

const NIGHT = '#07060F';
/** Sprouts and collectibles this big or bigger move by themselves; smaller ones are still unless `still={false}`. */
export const MOVES_FROM = 100;

/** A locked one: the same creature as a grey figure, still. */
const LOCKED: Palette = { light: '#A3A1B6', mid: '#76748C', deep: '#4A4860', alt: '#8E8CA4', altDeep: '#57556C', accent: '#B4B2C6', glow: '#6E6C84' };

/**
 * An artist's collectible: their creature (creatures.tsx), glowing on a dark
 * round tile with a ring in bronze, silver or gold for its `tier`. It floats,
 * blinks, and its flames, wings or tentacles move, unless motion is reduced,
 * it's `still`, or `locked` (a grey figure of what you could earn). Small
 * ones (under `MOVES_FROM`) are still unless told otherwise, so a grid or a
 * list of them scrolls smoothly; a still one is drawn as a single picture.
 * Hidden from screen readers (the label around it says what it is).
 */
export function Collectible({ look, size = 80, tier = 0, still = size < MOVES_FROM, locked }: { look: ArtistLook; size?: number; tier?: 0 | 1 | 2 | 3; still?: boolean; locked?: boolean }) {
  // Ends with `_`, so a fill's name ends `_vs`, `_vh` … (creatures.tsx's `mirror` reads them).
  const uid = `c${useId().replace(/[^a-zA-Z0-9]/g, '')}_`;
  const p = locked ? LOCKED : look.palette;
  const reduce = useReducedMotion();
  const moving = !reduce && !still && !locked;
  const s = size / 100;

  const fills: Fills = {
    body: `url(#${uid}b)`,
    round: `url(#${uid}r)`,
    alt: `url(#${uid}a)`,
    white: `url(#${uid}w)`,
    iris: `url(#${uid}i)`,
    holo: `url(#${uid}h)`,
    shade: `url(#${uid}vs)`,
    hi: `url(#${uid}vh)`,
    rim: `url(#${uid}vr)`,
    spec: `url(#${uid}sp)`,
    ball: `url(#${uid}ey)`,
    ao: `url(#${uid}ao)`,
  };
  const art = DRAW[look.creature](p, fills, look.extra);

  const bob = useSharedValue(0);
  const sway = useSharedValue(0);
  const flick = useSharedValue(1);
  const blink = useSharedValue(1);
  // Each collectible keeps its own time, so a shelf of them never moves in step
  // (from its creature and colours, not its name, so the timing is the same in every language).
  const pace = hashOf(`${look.creature}${p.mid}${p.accent}`) % 1000;

  useEffect(() => {
    if (!moving) return;
    const sine = Easing.inOut(Easing.sin);
    const bobMs = 2200 + (pace % 600);
    bob.set(withRepeat(withSequence(withTiming(1, { duration: bobMs, easing: sine }), withTiming(-1, { duration: bobMs, easing: sine })), -1, true));
    const swayMs = 1500 + ((pace * 7) % 700);
    sway.set(withRepeat(withSequence(withTiming(1, { duration: swayMs, easing: sine }), withTiming(-1, { duration: swayMs, easing: sine })), -1, true));
    flick.set(
      withRepeat(
        withSequence(
          withTiming(0.72, { duration: 260, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 340, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.84, { duration: 180 }),
          withTiming(1, { duration: 420 + (pace % 300) }),
        ),
        -1,
        false,
      ),
    );
    blink.set(withRepeat(withSequence(withDelay(2600 + ((pace * 13) % 2200), withTiming(0.08, { duration: 90 })), withTiming(1, { duration: 130 })), -1, false));
    return () => {
      cancelAnimation(bob);
      cancelAnimation(sway);
      cancelAnimation(flick);
      cancelAnimation(blink);
      // Back to rest, so a stopped one never freezes mid-blink or off-centre.
      bob.set(0);
      sway.set(0);
      flick.set(1);
      blink.set(1);
    };
  }, [moving, pace, bob, sway, flick, blink]);

  const flap = !!art.flap;
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.get() * size * 0.018 }] }));
  const swayStyle = useAnimatedStyle(() => ({ transform: flap ? [{ scaleX: 1 - (sway.get() + 1) * 0.07 }] : [{ rotate: `${sway.get() * 3.5}deg` }] }));
  const flickStyle = useAnimatedStyle(() => ({ opacity: flick.get(), transform: [{ scale: 0.985 + flick.get() * 0.015 }] }));
  const blinkStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.get() }] }));

  const defs = (
    <Defs>
      <LinearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={p.light} />
        <Stop offset="0.55" stopColor={p.mid} />
        <Stop offset="1" stopColor={p.deep} />
      </LinearGradient>
      <RadialGradient id={`${uid}r`} cx="40%" cy="32%" r="75%">
        <Stop offset="0" stopColor={p.light} />
        <Stop offset="0.6" stopColor={p.mid} />
        <Stop offset="1" stopColor={p.deep} />
      </RadialGradient>
      <LinearGradient id={`${uid}a`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={p.alt} />
        <Stop offset="1" stopColor={p.altDeep} />
      </LinearGradient>
      <RadialGradient id={`${uid}w`} cx="42%" cy="38%" r="65%">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="0.7" stopColor={p.light} />
        <Stop offset="1" stopColor={p.mid} />
      </RadialGradient>
      <RadialGradient id={`${uid}i`} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={p.accent} />
        <Stop offset="0.55" stopColor={p.alt} />
        <Stop offset="1" stopColor={p.altDeep} />
      </RadialGradient>
      <LinearGradient id={`${uid}h`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={p.alt} />
        <Stop offset="0.5" stopColor={p.mid} />
        <Stop offset="1" stopColor={p.altDeep} />
      </LinearGradient>
      <RadialGradient id={`${uid}t`} cx="50%" cy="42%" r="58%">
        <Stop offset="0" stopColor={mix(p.deep, NIGHT, locked ? 0.75 : 0.55)} />
        <Stop offset="1" stopColor={NIGHT} />
      </RadialGradient>
      {/* Vinyl: the same soft light on every part. A key light from the top left, shade towards the bottom right, light bouncing back off the tile, a glossy highlight. */}
      <LinearGradient id={`${uid}vs`} x1="0.15" y1="0" x2="0.75" y2="1">
        <Stop offset="0" stopColor="#000000" stopOpacity={0} />
        <Stop offset="0.5" stopColor="#000000" stopOpacity={0.04} />
        <Stop offset="1" stopColor="#120820" stopOpacity={0.5} />
      </LinearGradient>
      <RadialGradient id={`${uid}vh`} cx="30%" cy="22%" r="62%">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.62} />
        <Stop offset="0.38" stopColor="#FFFFFF" stopOpacity={0.16} />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id={`${uid}vr`} x1="0" y1="0" x2="0.3" y2="1">
        <Stop offset="0.74" stopColor={p.glow} stopOpacity={0} />
        <Stop offset="1" stopColor={p.glow} stopOpacity={locked ? 0.15 : 0.6} />
      </LinearGradient>
      {/* The same light, mirrored: for a part drawn mirrored (creatures.tsx `mirror`), so it's still lit from the top left. */}
      <LinearGradient id={`${uid}vsm`} x1="0.85" y1="0" x2="0.25" y2="1">
        <Stop offset="0" stopColor="#000000" stopOpacity={0} />
        <Stop offset="0.5" stopColor="#000000" stopOpacity={0.04} />
        <Stop offset="1" stopColor="#120820" stopOpacity={0.5} />
      </LinearGradient>
      <RadialGradient id={`${uid}vhm`} cx="70%" cy="22%" r="62%">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.62} />
        <Stop offset="0.38" stopColor="#FFFFFF" stopOpacity={0.16} />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id={`${uid}vrm`} x1="1" y1="0" x2="0.7" y2="1">
        <Stop offset="0.74" stopColor={p.glow} stopOpacity={0} />
        <Stop offset="1" stopColor={p.glow} stopOpacity={locked ? 0.15 : 0.6} />
      </LinearGradient>
      <RadialGradient id={`${uid}sp`} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
        <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.55} />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id={`${uid}ey`} cx="45%" cy="62%" r="62%">
        <Stop offset="0" stopColor="#4A3D6E" />
        <Stop offset="0.55" stopColor="#1A1230" />
        <Stop offset="1" stopColor="#06040C" />
      </RadialGradient>
      <RadialGradient id={`${uid}ao`} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#000000" stopOpacity={0.6} />
        <Stop offset="0.6" stopColor="#000000" stopOpacity={0.22} />
        <Stop offset="1" stopColor="#000000" stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id={`${uid}g`} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={p.glow} stopOpacity={locked ? 0.15 : 0.55} />
        <Stop offset="0.6" stopColor={p.glow} stopOpacity={locked ? 0.05 : 0.16} />
        <Stop offset="1" stopColor={p.glow} stopOpacity={0} />
      </RadialGradient>
    </Defs>
  );
  /** One layer of the drawing, the full box. */
  const layer = (node: ReactNode) => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {defs}
      {node}
    </Svg>
  );
  /** A layer that moves around a point: drawn twice as big, centred on it, so it turns or squashes about that point. */
  const around = (node: ReactNode, [px, py]: [number, number], style: object, key: string) => (
    <Animated.View key={key} style={[{ position: 'absolute', left: (px - 100) * s, top: (py - 100) * s, width: size * 2, height: size * 2 }, style]}>
      <Svg width={size * 2} height={size * 2} viewBox={`${px - 100} ${py - 100} 200 200`}>
        {defs}
        {node}
      </Svg>
    </Animated.View>
  );
  const fill = { position: 'absolute' as const, left: 0, top: 0, width: size, height: size };
  const flicker = art.flicker ? (
    <Animated.View key="flicker" style={[fill, flickStyle]}>
      {layer(art.flicker)}
    </Animated.View>
  ) : null;
  const eyes = art.eyes;
  const ring = tier ? TIER_COLOR[tier] : locked ? '#4A4860' : p.glow;

  /* The tile: night, the creature's glow, a few far stars and its ring. */
  const tile = (
    <>
      <Circle cx={50} cy={50} r={48} fill={`url(#${uid}t)`} />
      <Circle cx={50} cy={50} r={44} fill={`url(#${uid}g)`} />
      {/* The floor it stands on: a soft shadow under it. */}
      {art.ground === null ? null : <Ellipse cx={(art.ground ?? [50, 88, 24])[0]} cy={(art.ground ?? [50, 88, 24])[1]} rx={(art.ground ?? [50, 88, 24])[2]} ry={(art.ground ?? [50, 88, 24])[2] * 0.2} fill={`url(#${uid}ao)`} />}
      {locked ? null : (
        <>
          <Path d={star(18 + (pace % 9), 24, 1.3)} fill="#FFFFFF" opacity={0.5} />
          <Path d={star(82 - (pace % 7), 76, 1.1)} fill="#FFFFFF" opacity={0.4} />
          <Circle cx={74} cy={14 + (pace % 6)} r={0.7} fill="#FFFFFF" opacity={0.5} />
        </>
      )}
      <Circle cx={50} cy={50} r={47.5} fill="none" stroke={ring} strokeWidth={tier ? 2.6 : 1} opacity={tier ? 0.95 : 0.45} />
      {tier === 3 && !locked ? <Circle cx={50} cy={50} r={45.4} fill="none" stroke="#FFF3B0" strokeWidth={0.6} opacity={0.6} /> : null}
    </>
  );
  const box = { width: size, height: size, overflow: 'hidden' as const };

  // Still: every part in one picture, much lighter to draw than the moving layers.
  if (!moving) {
    return (
      <View style={box} accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none">
        {layer(
          <>
            {tile}
            {art.back}
            {art.sway}
            {art.flickerOver ? null : art.flicker}
            {art.body}
            {eyes?.el}
            {art.flickerOver ? art.flicker : null}
            {art.front}
          </>,
        )}
      </View>
    );
  }

  return (
    <View style={box} accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <View style={fill}>{layer(tile)}</View>
      <Animated.View style={[fill, floatStyle]}>
        {art.back ? <View style={fill}>{layer(art.back)}</View> : null}
        {art.sway ? around(art.sway, art.pivot ?? [50, 50], swayStyle, 'sway') : null}
        {art.flickerOver ? null : flicker}
        <View style={fill}>{layer(art.body)}</View>
        {eyes ? around(eyes.el, [eyes.box[0] + eyes.box[2] / 2, eyes.box[1] + eyes.box[3] / 2], blinkStyle, 'eyes') : null}
        {art.flickerOver ? flicker : null}
        {art.front ? <View style={fill}>{layer(art.front)}</View> : null}
      </Animated.View>
    </View>
  );
}
