import { type ReactNode, useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { MOVES_FROM } from './Collectible';
import { blinkOf, CLOCK_MS, paceOf, sine } from './motion';
import type { Driven } from './Sprout';
import type { Stage } from './sprouts';

/**
 * The raccoon, as it comes out of its trash can: a shiny little bin with two
 * eyes glinting under the lid, then two tiny paws gripping the rim, then a
 * masked face peeking over it, then the whole raccoon sitting by the tipped
 * can with a slice of pizza and a fluffy striped tail (who wanders the
 * garden: GardenScene does the hopping). The bin rattles, the paws wiggle,
 * the face bobs, the tail swishes and the eyes blink, all on the garden's
 * clock (or its own), still with reduced motion or `still`. Hidden from
 * screen readers (the label around it says what it is).
 */
type Colors = {
  can: string;
  canDeep: string;
  rim: string;
  lid: string;
  lidDeep: string;
  inside: string;
  fur: string;
  furDeep: string;
  cream: string;
  mask: string;
  paw: string;
  pawDeep: string;
  earIn: string;
  eye: string;
  glint: string;
  nose: string;
  cheek: string;
  crust: string;
  cheese: string;
  pepperoni: string;
};
const COLORS: Colors = {
  can: '#C9D6E4',
  canDeep: '#6E8299',
  rim: '#EAF1F8',
  lid: '#DCE6F0',
  lidDeep: '#7C90A6',
  inside: '#191624',
  fur: '#C3BDD2',
  furDeep: '#7B7392',
  cream: '#F6F3FB',
  mask: '#2F2A3D',
  paw: '#4B4460',
  pawDeep: '#2F2A3D',
  earIn: '#F3B8CB',
  eye: '#110F19',
  glint: '#FFE27A',
  nose: '#2A2436',
  cheek: '#FF97B5',
  crust: '#E8A54C',
  cheese: '#FFD45C',
  pepperoni: '#E8513F',
};
const GREYS: Colors = {
  can: '#8A88A0',
  canDeep: '#5A5870',
  rim: '#A8A6BC',
  lid: '#9694AC',
  lidDeep: '#5A5870',
  inside: '#2E2C40',
  fur: '#8A88A0',
  furDeep: '#5A5870',
  cream: '#A8A6BC',
  mask: '#4A4860',
  paw: '#5A5870',
  pawDeep: '#4A4860',
  earIn: '#7C7A92',
  eye: '#3A3850',
  glint: '#A8A6BC',
  nose: '#4A4860',
  cheek: '#8A88A0',
  crust: '#7C7A92',
  cheese: '#9694AC',
  pepperoni: '#6A687E',
};

export function RaccoonSprout({
  stage = 3,
  size = 80,
  still = size < MOVES_FROM,
  locked,
  scene,
  driven,
}: {
  stage?: Stage;
  size?: number;
  still?: boolean;
  locked?: boolean;
  scene?: boolean;
  driven?: Driven;
}) {
  const reduce = useReducedMotion();
  const moving = !reduce && !still;
  const ownClock = useSharedValue(0);
  const clock = driven?.clock ?? ownClock;
  const hasClock = !!driven;
  const running = moving && (driven ? driven.running : true);
  const pace = driven?.pace ?? paceOf('raccoon');
  const { phase, sway: swayC, bob: bobC, blink: blinkC } = pace;
  useEffect(() => {
    if (!moving || hasClock) return;
    ownClock.set(withRepeat(withTiming(1, { duration: CLOCK_MS, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(ownClock);
      ownClock.set(0);
    };
  }, [moving, hasClock, ownClock]);

  // The bin rattles now and then (a quick shiver, then still), as if something's inside.
  const rattleStyle = useAnimatedStyle(() => {
    if (!running) return { transform: [{ rotate: '0deg' }] };
    const u = (clock.get() * swayC + phase) % 1;
    const shake = u < 0.12 ? Math.sin(u * 120) * (1 - u / 0.12) : 0;
    return { transform: [{ rotate: `${shake * 3.2}deg` }] };
  });
  // Paws wiggle on the rim, and a face bobs up for a better look.
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (running ? sine(clock.get(), bobC, phase) : 0) * size * 0.018 }],
  }));
  // The grown raccoon sways a little, and its tail swishes.
  const swayStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(running ? sine(clock.get(), swayC, phase) : 0) * 3}deg` }],
  }));
  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(running ? sine(clock.get(), swayC * 2, phase + 0.25) : 0) * 9}deg` }],
  }));
  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: running ? blinkOf(clock.get(), blinkC, phase) : 1 }],
  }));

  const c = locked ? GREYS : COLORS;
  const id = `rc-${stage}-${locked ? 'g' : 'c'}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const grown = stage === 3 && !locked;

  const defs = (
    <Defs>
      <RadialGradient id={`aura-${id}`} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#B48CFF" stopOpacity={0.4} />
        <Stop offset="0.6" stopColor="#8FD6FF" stopOpacity={0.12} />
        <Stop offset="1" stopColor="#8FD6FF" stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id={`can-${id}`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={c.canDeep} />
        <Stop offset="0.3" stopColor={c.can} />
        <Stop offset="0.55" stopColor={c.can} />
        <Stop offset="1" stopColor={c.canDeep} />
      </LinearGradient>
      <LinearGradient id={`lying-${id}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={c.can} />
        <Stop offset="1" stopColor={c.canDeep} />
      </LinearGradient>
      <LinearGradient id={`lid-${id}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={c.lid} />
        <Stop offset="1" stopColor={c.lidDeep} />
      </LinearGradient>
      <LinearGradient id={`fur-${id}`} x1="0.3" y1="0" x2="0.7" y2="1">
        <Stop offset="0" stopColor={c.fur} />
        <Stop offset="1" stopColor={c.furDeep} />
      </LinearGradient>
    </Defs>
  );

  const back = (
    <G>
      {grown ? <Circle cx={50} cy={56} r={46} fill={`url(#aura-${id})`} /> : null}
      {scene ? null : <Ellipse cx={stage === 3 ? 50 : 50} cy={93} rx={stage === 3 ? 34 : 22} ry={3.2} fill="rgba(0,0,0,0.32)" />}
    </G>
  );

  // The standing bin: its dark inside, then the body in front with its ridges, rim and a shine.
  const inside = <Ellipse cx={50} cy={50} rx={19} ry={4.6} fill={c.inside} />;
  const canFront = (
    <G>
      <Path d="M30.5 50 Q50 55.5 69.5 50 L65.6 87.5 Q50 92.5 34.4 87.5 Z" fill={`url(#can-${id})`} />
      <Path d="M40.6 54.6 L42 88.6 M50 55.4 L50 89.8 M59.4 54.6 L58 88.6" stroke={c.canDeep} strokeWidth={1.3} opacity={0.45} fill="none" strokeLinecap="round" />
      <Path d="M33.4 80.5 Q50 85.5 66.6 80.5" stroke={c.canDeep} strokeWidth={1.4} opacity={0.5} fill="none" strokeLinecap="round" />
      {!locked ? <Path d="M35.2 56 L37.6 84" stroke="#FFFFFF" strokeWidth={2.4} opacity={0.42} fill="none" strokeLinecap="round" /> : null}
      <Ellipse cx={50} cy={50} rx={19.6} ry={4.9} fill="none" stroke={c.rim} strokeWidth={2.6} />
      <Path d="M30.6 50.6 Q50 56.2 69.4 50.6" stroke={c.canDeep} strokeWidth={0.9} opacity={0.5} fill="none" />
    </G>
  );
  // The lid: a little dome with a handle and a shine; `tilt` lifts it from its right edge.
  const lid = (tilt: number) => (
    <G transform={`rotate(${tilt} 70 49)`}>
      <Ellipse cx={50} cy={49.2} rx={21} ry={2.2} fill={c.lidDeep} />
      <Path d="M29.2 49 Q50 36.5 70.8 49 Q50 54 29.2 49 Z" fill={`url(#lid-${id})`} />
      <Path d="M45 41.8 Q50 36.4 55 41.8" stroke={c.lidDeep} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      {!locked ? <Path d="M36 45 Q42 41.2 48 40.4" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.5} fill="none" strokeLinecap="round" /> : null}
    </G>
  );
  // Two eyes glinting in the dark under the lid.
  const glints = (y: number) => (
    <G>
      <Ellipse cx={41} cy={y} rx={2.4} ry={1.7} fill={c.glint} />
      <Ellipse cx={50} cy={y} rx={2.4} ry={1.7} fill={c.glint} />
      <Ellipse cx={41.2} cy={y + 0.2} rx={0.8} ry={1.3} fill={c.inside} />
      <Ellipse cx={50.2} cy={y + 0.2} rx={0.8} ry={1.3} fill={c.inside} />
      {!locked ? <Circle cx={40.3} cy={y - 0.6} r={0.6} fill="#FFFFFF" /> : null}
      {!locked ? <Circle cx={49.3} cy={y - 0.6} r={0.6} fill="#FFFFFF" /> : null}
    </G>
  );
  // A little paw gripping the rim: the palm on top, four tiny fingers curled over the front.
  const paw = (x: number, y: number) => (
    <G key={`paw-${x}`}>
      <Ellipse cx={x} cy={y - 1} rx={4.6} ry={3} fill={c.paw} />
      {[-3, -1, 1, 3].map((dx) => (
        <Ellipse key={dx} cx={x + dx} cy={y + 1.6} rx={1.25} ry={1.7} fill={c.pawDeep} />
      ))}
      {!locked ? <Ellipse cx={x - 1.2} cy={y - 2.2} rx={1.6} ry={0.7} fill="#FFFFFF" opacity={0.25} /> : null}
    </G>
  );

  // A raccoon's head at (cx, cy), scaled by s: round ears, a white blaze, the black mask, a cream muzzle.
  const head = (cx: number, cy: number, s: number) => {
    const X = (v: number) => cx + v * s;
    const Y = (v: number) => cy + v * s;
    const ear = (side: -1 | 1) => (
      <G key={side}>
        <Ellipse cx={X(side * 11)} cy={Y(-9)} rx={5.2 * s} ry={5.6 * s} fill={`url(#fur-${id})`} transform={`rotate(${side * 18} ${X(side * 11)} ${Y(-9)})`} />
        <Ellipse cx={X(side * 11)} cy={Y(-8.4)} rx={2.8 * s} ry={3.2 * s} fill={c.earIn} transform={`rotate(${side * 18} ${X(side * 11)} ${Y(-8.4)})`} />
        <Path d={`M${X(side * 7.2)} ${Y(-12.6)} Q${X(side * 11)} ${Y(-15.6)} ${X(side * 14.6)} ${Y(-11.6)}`} stroke={c.cream} strokeWidth={1.2 * s} opacity={0.8} fill="none" strokeLinecap="round" />
      </G>
    );
    return (
      <G>
        {ear(-1)}
        {ear(1)}
        <Ellipse cx={cx} cy={cy} rx={14 * s} ry={12 * s} fill={`url(#fur-${id})`} />
        {/* Fluffy cheeks. */}
        <Path d={`M${X(-13.6)} ${Y(2)} Q${X(-17)} ${Y(5)} ${X(-12)} ${Y(7.2)} Q${X(-11)} ${Y(4)} ${X(-13.6)} ${Y(2)} Z`} fill={c.cream} />
        <Path d={`M${X(13.6)} ${Y(2)} Q${X(17)} ${Y(5)} ${X(12)} ${Y(7.2)} Q${X(11)} ${Y(4)} ${X(13.6)} ${Y(2)} Z`} fill={c.cream} />
        {/* The white blaze down the forehead. */}
        <Path d={`M${X(-2.4)} ${Y(-11.6)} Q${X(0)} ${Y(-12.6)} ${X(2.4)} ${Y(-11.6)} L${X(1.2)} ${Y(-3)} L${X(-1.2)} ${Y(-3)} Z`} fill={c.cream} opacity={0.85} />
        {/* Eyebrows. */}
        <Path d={`M${X(-10.5)} ${Y(-5.8)} Q${X(-7)} ${Y(-8)} ${X(-3.6)} ${Y(-6.2)} M${X(3.6)} ${Y(-6.2)} Q${X(7)} ${Y(-8)} ${X(10.5)} ${Y(-5.8)}`} stroke={c.cream} strokeWidth={1.6 * s} fill="none" strokeLinecap="round" />
        {/* The mask. */}
        <Path
          d={`M${X(-13)} ${Y(-0.6)} Q${X(-9)} ${Y(-6.6)} ${X(-3)} ${Y(-3.2)} Q${X(0)} ${Y(-1.8)} ${X(3)} ${Y(-3.2)} Q${X(9)} ${Y(-6.6)} ${X(13)} ${Y(-0.6)} Q${X(10.5)} ${Y(4.4)} ${X(5)} ${Y(2.4)} Q${X(0)} ${Y(1.2)} ${X(-5)} ${Y(2.4)} Q${X(-10.5)} ${Y(4.4)} ${X(-13)} ${Y(-0.6)} Z`}
          fill={c.mask}
        />
        {/* The muzzle, the nose, a little smile, rosy cheeks. */}
        <Ellipse cx={cx} cy={Y(5.4)} rx={7.2 * s} ry={4.8 * s} fill={c.cream} />
        <Ellipse cx={cx} cy={Y(3.4)} rx={2.2 * s} ry={1.6 * s} fill={c.nose} />
        {!locked ? <Ellipse cx={X(-0.6)} cy={Y(2.9)} rx={0.8 * s} ry={0.45 * s} fill="#FFFFFF" opacity={0.6} /> : null}
        <Path d={`M${X(0)} ${Y(5)} L${X(0)} ${Y(6.2)} M${X(-2.2)} ${Y(6.4)} Q${X(-1.1)} ${Y(7.8)} ${X(0)} ${Y(6.2)} Q${X(1.1)} ${Y(7.8)} ${X(2.2)} ${Y(6.4)}`} stroke={c.nose} strokeWidth={0.9 * s} fill="none" strokeLinecap="round" />
        {!locked ? <Ellipse cx={X(-9.2)} cy={Y(4.6)} rx={2.4 * s} ry={1.4 * s} fill={c.cheek} opacity={0.6} /> : null}
        {!locked ? <Ellipse cx={X(9.2)} cy={Y(4.6)} rx={2.4 * s} ry={1.4 * s} fill={c.cheek} opacity={0.6} /> : null}
      </G>
    );
  };
  // Big shiny eyes inside the mask (their own layer, so they blink).
  const eyesOf = (cx: number, cy: number, s: number) => (
    <G>
      {[-1, 1].map((side) => (
        <G key={side}>
          <Ellipse cx={cx + side * 6.6 * s} cy={cy - 1 * s} rx={2.7 * s} ry={3 * s} fill={c.eye} />
          {!locked ? <Circle cx={cx + side * 6.6 * s - 0.9 * s} cy={cy - 2 * s} r={1 * s} fill="#FFFFFF" /> : null}
          {!locked ? <Circle cx={cx + side * 6.6 * s + 0.9 * s} cy={cy - 0.1 * s} r={0.45 * s} fill="#FFFFFF" opacity={0.8} /> : null}
        </G>
      ))}
    </G>
  );

  const at = (v: number) => (v / 100) * size;
  const box = { width: size, height: size };
  const layer = (node: ReactNode) => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {defs}
      {node}
    </Svg>
  );
  const fill = { position: 'absolute' as const, width: size, height: size };
  const wrap = (children: ReactNode) => (
    <View style={box} accessible={false} importantForAccessibility="no-hide-descendants">
      {children}
    </View>
  );

  let picture: ReactNode;

  if (stage === 0) {
    // A closed bin with the lid just ajar, and two eyes glinting in the gap.
    const bin = (
      <G>
        {inside}
        {glints(47.6)}
        {canFront}
        {lid(9)}
        {/* A fish bone poking out from under the lid. */}
        <Path d="M66 45.6 L76 42.6" stroke={c.rim} strokeWidth={1.2} strokeLinecap="round" />
        <Path d="M69 44.7 L68.2 42.4 M69 44.7 L69.8 47 M72 43.8 L71.2 41.5 M72 43.8 L72.8 46.1" stroke={c.rim} strokeWidth={0.9} strokeLinecap="round" />
        <Path d="M76 42.6 L79 40.6 L78.4 44.2 Z" fill={c.rim} />
      </G>
    );
    picture = (
      <G>
        {back}
        {bin}
      </G>
    );
    if (moving)
      return wrap(
        <>
          <View style={fill}>{layer(back)}</View>
          <Animated.View style={[fill, { transformOrigin: [size / 2, at(90), 0] }, rattleStyle]}>{layer(bin)}</Animated.View>
        </>,
      );
  } else if (stage === 1) {
    // The lid lifted, two paws on the rim, the eyes peering out under it.
    const scenery = (
      <G>
        {inside}
        {canFront}
        {lid(30)}
      </G>
    );
    const hands = (
      <G>
        {glints(46.6)}
        {paw(38.4, 50.4)}
        {paw(61.6, 50.4)}
      </G>
    );
    picture = (
      <G>
        {back}
        {inside}
        {canFront}
        {lid(30)}
        {hands}
      </G>
    );
    if (moving)
      return wrap(
        <>
          <View style={fill}>{layer(back)}</View>
          <View style={fill}>{layer(scenery)}</View>
          <Animated.View style={[fill, bobStyle]}>
            <View style={fill}>{layer(paw(38.4, 50.4))}</View>
            <View style={fill}>{layer(paw(61.6, 50.4))}</View>
            <Animated.View style={[fill, { transformOrigin: [size / 2, at(46.6), 0] }, eyeStyle]}>{layer(glints(46.6))}</Animated.View>
          </Animated.View>
        </>,
      );
  } else if (stage === 2) {
    // The lid pushed up on its edge behind, a masked face peeking over the rim, paws holding on.
    const behind = (
      <G>
        {lid(72)}
        {inside}
      </G>
    );
    const face = head(50, 40, 0.95);
    const eyes = eyesOf(50, 40, 0.95);
    const front = (
      <G>
        {canFront}
        {paw(39, 50.4)}
        {paw(61, 50.4)}
      </G>
    );
    picture = (
      <G>
        {back}
        {behind}
        {face}
        {eyes}
        {front}
      </G>
    );
    if (moving)
      return wrap(
        <>
          <View style={fill}>{layer(back)}</View>
          <View style={fill}>{layer(behind)}</View>
          <Animated.View style={[fill, bobStyle]}>
            <View style={fill}>{layer(face)}</View>
            <Animated.View style={[fill, { transformOrigin: [size / 2, at(39), 0] }, eyeStyle]}>{layer(eyes)}</Animated.View>
          </Animated.View>
          <View style={fill}>{layer(front)}</View>
        </>,
      );
  } else {
    // Out at last: the bin tipped over behind, the lid on the ground, and the raccoon sitting with a slice of pizza.
    const scenery = (
      <G>
        {/* The tipped bin, its open end facing the raccoon. */}
        <Path d="M11 68.6 Q8.6 78 11 87.4 L40.6 88.8 L40.6 66.2 Z" fill={`url(#lying-${id})`} />
        <Path d="M14 72.6 L39 70.8 M13.6 78 L39 78 M14 83.4 L39 85.2" stroke={c.canDeep} strokeWidth={1.2} opacity={0.45} fill="none" strokeLinecap="round" />
        {!locked ? <Path d="M15 70.4 L36 68.8" stroke="#FFFFFF" strokeWidth={2} opacity={0.4} fill="none" strokeLinecap="round" /> : null}
        <Ellipse cx={40.6} cy={77.5} rx={4.4} ry={11.3} fill={c.inside} />
        <Ellipse cx={40.6} cy={77.5} rx={4.6} ry={11.5} fill="none" stroke={c.rim} strokeWidth={2.2} />
        {/* The lid on the ground. */}
        <Ellipse cx={20} cy={91.6} rx={10.5} ry={2.8} fill={c.lidDeep} />
        <Ellipse cx={20} cy={90.6} rx={10} ry={2.4} fill={`url(#lid-${id})`} />
        {/* An apple core that rolled out. */}
        <Path d="M44.6 87.6 Q43 84.6 45 82.6 Q46.4 84 47.8 82.6 Q49.8 84.6 48.2 87.6 Q46.4 89 44.6 87.6 Z" fill={locked ? c.lid : '#F6E7B8'} />
        <Path d="M46.4 82.8 L46.8 80.6" stroke={c.canDeep} strokeWidth={0.9} strokeLinecap="round" />
        <Ellipse cx={47.8} cy={80.8} rx={1.4} ry={0.7} fill={locked ? c.lidDeep : '#7FCB6A'} transform="rotate(-24 47.8 80.8)" />
      </G>
    );
    // A big fluffy striped tail, curling up behind.
    const tail = (
      <G>
        {(
          [
            [73, 84, 6.4, false],
            [79.6, 81, 6.4, true],
            [85, 75.4, 6, false],
            [88, 68.4, 5.6, true],
            [88.2, 61, 5.2, false],
            [86, 54.6, 4.6, true],
          ] as const
        ).map(([x, y, r, dark], i) => (
          <Circle key={i} cx={x} cy={y} r={r} fill={dark ? c.mask : `url(#fur-${id})`} />
        ))}
        {!locked ? <Path d="M84.2 72 Q87.4 66 86.4 59.6" stroke="#FFFFFF" strokeWidth={1.4} opacity={0.22} fill="none" strokeLinecap="round" /> : null}
      </G>
    );
    const body = (
      <G>
        {/* Feet. */}
        <Ellipse cx={52.4} cy={89.4} rx={5.2} ry={2.8} fill={c.paw} />
        <Ellipse cx={67.6} cy={89.4} rx={5.2} ry={2.8} fill={c.paw} />
        {/* A round little body and its cream tummy. */}
        <Path d="M47.6 88.4 Q43.4 73 49.6 63.6 Q60 57 70.4 63.6 Q76.6 73 72.4 88.4 Q60 92 47.6 88.4 Z" fill={`url(#fur-${id})`} />
        <Ellipse cx={60} cy={78} rx={8.4} ry={9.4} fill={c.cream} />
        {/* A slice of pizza, held in both paws. */}
        <Path d="M53.6 67.4 L66.4 67.4 L60 79.2 Z" fill={c.cheese} />
        <Path d="M53 66.2 Q60 64 67 66.2 L66.4 68.4 Q60 66.6 53.6 68.4 Z" fill={c.crust} />
        <Circle cx={58} cy={70.6} r={1.4} fill={c.pepperoni} />
        <Circle cx={62.2} cy={71.2} r={1.2} fill={c.pepperoni} />
        <Circle cx={60} cy={74.8} r={1} fill={c.pepperoni} />
        {/* Arms and paws around it. */}
        <Path d="M50.2 66 Q49 71 53.2 72.6" stroke={c.furDeep} strokeWidth={4.2} fill="none" strokeLinecap="round" />
        <Path d="M69.8 66 Q71 71 66.8 72.6" stroke={c.furDeep} strokeWidth={4.2} fill="none" strokeLinecap="round" />
        <Ellipse cx={54.2} cy={72.2} rx={2.8} ry={2.3} fill={c.paw} />
        <Ellipse cx={65.8} cy={72.2} rx={2.8} ry={2.3} fill={c.paw} />
      </G>
    );
    const face = head(60, 47, 1.05);
    const eyes = eyesOf(60, 47, 1.05);
    picture = (
      <G>
        {back}
        {scenery}
        {tail}
        {body}
        {face}
        {eyes}
      </G>
    );
    if (moving)
      return wrap(
        <>
          <View style={fill}>{layer(back)}</View>
          <View style={fill}>{layer(scenery)}</View>
          <Animated.View style={[fill, { transformOrigin: [at(70), at(86), 0] }, tailStyle]}>{layer(tail)}</Animated.View>
          <Animated.View style={[fill, { transformOrigin: [at(60), at(90), 0] }, swayStyle]}>
            <View style={fill}>{layer(body)}</View>
            <View style={fill}>{layer(face)}</View>
            <Animated.View style={[fill, { transformOrigin: [at(60), at(46), 0] }, eyeStyle]}>{layer(eyes)}</Animated.View>
          </Animated.View>
        </>,
      );
  }

  return wrap(
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {defs}
      {picture}
    </Svg>,
  );
}
