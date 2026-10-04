import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { type ArtistLook, type Face, type LeafShape } from './artistLook';
import { ARTIST_FACES, ArtistBack, ArtistFace, ArtistTop, ArtistWear } from './ArtistParts';
import { kindOf, type SproutKind, type Stage } from './sprouts';

/**
 * How each kind looks: its body (light, mid, deep), its leaves (light,
 * deep), its face, the shape of its leaves and what it wears once in bloom.
 * Every kind is a green sprout at heart; the tints, faces and little
 * accessories are what make them collectible.
 */
type Look = { body: [string, string, string]; leaf: [string, string]; face: Face; leafShape: LeafShape };

const LOOKS: Record<SproutKind, Look> = {
  seedling: { body: ['#B6F7CF', '#5BD48E', '#1F8C50'], leaf: ['#8FF0B4', '#239255'], face: 'smile', leafShape: 'round' },
  plur: { body: ['#C8F7D4', '#66D69A', '#2A9A63'], leaf: ['#A6F2C2', '#2E9E64'], face: 'joy', leafShape: 'heart' },
  wanderer: { body: ['#D4F5B0', '#86CF62', '#3F8F37'], leaf: ['#B9EE8E', '#4C9A3C'], face: 'wink', leafShape: 'pointed' },
  bass: { body: ['#A9F0E4', '#3FC7B0', '#137A78'], leaf: ['#7FE8D2', '#177E73'], face: 'cool', leafShape: 'jagged' },
  melody: { body: ['#C9F3D9', '#7CD9A6', '#3B9B78'], leaf: ['#B2EFCB', '#3E9C72'], face: 'bliss', leafShape: 'petal' },
  groove: { body: ['#A8F2DD', '#45CFA6', '#14876C'], leaf: ['#86EBCB', '#178A6A'], face: 'shades', leafShape: 'wide' },
  spotlight: { body: ['#E3F7B4', '#A9DB5E', '#5C9A2C'], leaf: ['#CFF29A', '#5E9C30'], face: 'sparkle', leafShape: 'round' },
  sunrise: { body: ['#F2F2B0', '#C3D96A', '#7A9C34'], leaf: ['#E2EE9C', '#7E9E36'], face: 'sleepy', leafShape: 'pointed' },
};
const GREY: Look = { body: ['#7C7A92', '#5A5870', '#3A3850'], leaf: ['#7A7890', '#4A4860'], face: 'smile', leafShape: 'round' };
const INK = '#0E2A1A';

/**
 * A little sprout friend. A seed peeking out of the soil, then a shoot,
 * then leafy, then in bloom: each kind with its own face, leaves, colours
 * and what it wears (PLUR a heart and kandi, Bass headphones, Melody a
 * flower crown, Groove sunglasses, Spotlight a halo of light, Sunrise a
 * rising sun, Wanderer a star and a bandana, Groove a record and a chain). Bloomed sprouts glow softly and sparkle.
 * Sways gently unless motion is reduced or `still`. Hidden from screen
 * readers (the label around it says what it is).
 *
 * An artist's sprout passes `artist` (their look, from `artistLook`): its
 * colours, face, leaves, what sits on top and what it wears, with a ring in
 * bronze, silver or gold for its `tier` (how many of their sets you filmed).
 */
export const TIER_COLOR = ['', '#D08A4E', '#D6DDEA', '#FFD24A'] as const;

export function Sprout({
  kind = 'seedling',
  stage = 3,
  size = 80,
  still,
  locked,
  artist,
  tier = 0,
}: {
  kind?: SproutKind;
  stage?: Stage;
  size?: number;
  still?: boolean;
  locked?: boolean;
  artist?: ArtistLook;
  tier?: 0 | 1 | 2 | 3;
}) {
  const k = kindOf(kind);
  const reduce = useReducedMotion();
  const moving = !reduce && !still;
  const sway = useSharedValue(0);
  const twinkle = useSharedValue(0.6);
  const bloom = stage === 3 && !locked;
  // Each sprout's own pace, so a garden never moves in step.
  const pace = artist ? artist.accent.charCodeAt(2) + artist.face.length : kind.length;
  useEffect(() => {
    if (!moving) return;
    // Each sprout sways at its own pace so a garden never moves in step.
    const ms = 1700 + ((pace * 137 + stage * 211) % 900);
    sway.set(withRepeat(withSequence(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: ms, easing: Easing.inOut(Easing.sin) })), -1, true));
    if (bloom) {
      twinkle.set(
        withDelay(
          (pace * 97) % 700,
          withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(0.15, { duration: 1100, easing: Easing.inOut(Easing.quad) })), -1, false),
        ),
      );
    }
    return () => {
      cancelAnimation(sway);
      cancelAnimation(twinkle);
    };
  }, [moving, bloom, kind, pace, stage, sway, twinkle]);
  const top = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.get() * 5}deg` }] }));
  const body = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 + sway.get() * 0.018 }, { scaleX: 1 - sway.get() * 0.008 }] }));
  const sparkle = useAnimatedStyle(() => ({ opacity: twinkle.get() }));

  const own: Look = artist ?? LOOKS[kind] ?? LOOKS.seedling;
  // Locked: a grey silhouette of what it will be (its leaves and what it wears), so there's something to collect.
  const look = locked ? { ...GREY, leafShape: own.leafShape } : own;
  const accent = locked ? '#8A88A0' : artist ? artist.accent : k.accent;
  const id = `${artist ? `a${artist.accent.slice(1)}${artist.top}${artist.wear}${artist.face}` : kind}-${stage}-${locked ? 'g' : 'c'}`;
  const seed = stage === 0;
  // The body: a seed sits low and small in its mound; later stages stand up.
  const bx = 50;
  const by = seed ? 81 : 71;
  const brx = seed ? 15 : 21;
  const bry = seed ? 14 : 20;
  // The stem's top, in the drawing's 100 × 100 box.
  const stemBase = by - bry * 0.82;
  const stemTop = [stemBase - 8, 37, 31, 29][stage];
  const leafScale = [0.45, 0.8, 1, 1.08][stage];
  const dressed = stage === 3 && (!!artist || kind !== 'seedling');
  const artistFace = !!artist && ARTIST_FACES.includes(look.face);

  return (
    <View style={{ width: size, height: size }} accessible={false} importantForAccessibility="no-hide-descendants">
      {/* Behind: a soft glow in the kind's colour once it blooms, and the shadow on the ground. */}
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id={`aura-${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={accent} stopOpacity={0.45} />
            <Stop offset="0.6" stopColor={accent} stopOpacity={0.12} />
            <Stop offset="1" stopColor={accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {bloom ? <Circle cx={50} cy={kind === 'seedling' && !artist ? 56 : 50} r={46} fill={`url(#aura-${id})`} /> : null}
        {tier > 0 && !locked ? (
          <G>
            <Circle cx={50} cy={52} r={45} fill="none" stroke={TIER_COLOR[tier]} strokeWidth={5} opacity={0.18} />
            <Circle cx={50} cy={52} r={45} fill="none" stroke={TIER_COLOR[tier]} strokeWidth={1.8} opacity={0.9} />
          </G>
        ) : null}
        {artist && dressed ? <ArtistBack back={locked ? 'none' : artist.back} x={bx} y={by} accent={accent} /> : null}
        {kind === 'spotlight' && bloom ? <Path d="M50 4 L30 70 L70 70 Z" fill={accent} opacity={0.12} /> : null}
        <Ellipse cx={50} cy={93} rx={seed ? 24 : 20} ry={3.6} fill="rgba(0,0,0,0.35)" />
      </Svg>

      {/* Stem, leaves and bloom, swaying from the top of the body. */}
      <Animated.View style={[{ position: 'absolute', width: size, height: size, transformOrigin: [size / 2, size * (stemBase / 100), 0] }, top]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={`leaf-${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={look.leaf[0]} />
              <Stop offset="1" stopColor={look.leaf[1]} />
            </LinearGradient>
          </Defs>
          <Path d={`M${bx} ${stemBase + 2} Q${bx - 2} ${(stemBase + stemTop) / 2} ${bx} ${stemTop}`} stroke={look.leaf[1]} strokeWidth={seed ? 2.4 : 3.2} strokeLinecap="round" fill="none" />
          {seed ? (
            <Path d={leafPath('round', bx, stemTop + 1, 1, leafScale)} fill={`url(#leaf-${id})`} />
          ) : (
            <G>
              <Path d={leafPath(look.leafShape, bx, stemTop + 2, -1, leafScale)} fill={`url(#leaf-${id})`} stroke={look.leaf[1]} strokeWidth={0.6} strokeOpacity={0.5} />
              <Path d={leafPath(look.leafShape, bx, stemTop + 2, 1, leafScale)} fill={`url(#leaf-${id})`} stroke={look.leaf[1]} strokeWidth={0.6} strokeOpacity={0.5} />
              <Path d={veinPath(bx, stemTop + 2, -1, leafScale)} stroke={look.leaf[1]} strokeWidth={0.9} opacity={0.55} fill="none" strokeLinecap="round" />
              <Path d={veinPath(bx, stemTop + 2, 1, leafScale)} stroke={look.leaf[1]} strokeWidth={0.9} opacity={0.55} fill="none" strokeLinecap="round" />
              {/* A shine along each leaf. */}
              <Path d={shinePath(bx, stemTop + 2, -1, leafScale)} stroke="#FFFFFF" strokeWidth={1.1} opacity={0.35} fill="none" strokeLinecap="round" />
              <Path d={shinePath(bx, stemTop + 2, 1, leafScale)} stroke="#FFFFFF" strokeWidth={1.1} opacity={0.35} fill="none" strokeLinecap="round" />
            </G>
          )}
          {stage >= 2 ? <Path d={leafPath(look.leafShape, bx - 1, stemTop + 12, -1, leafScale * 0.55)} fill={`url(#leaf-${id})`} /> : null}
          {dressed ? artist ? <ArtistTop top={artist.top} x={bx} y={stemTop - 4} accent={accent} /> : <Bloom kind={kind} x={bx} y={stemTop - 4} color={accent} grey={locked} /> : null}
        </Svg>
      </Animated.View>

      {/* The body with its face (and, in bloom, what it wears). */}
      <Animated.View style={[{ position: 'absolute', width: size, height: size, transformOrigin: [size / 2, size * 0.9, 0] }, body]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`body-${id}`} cx="38%" cy="30%" r="80%">
              <Stop offset="0" stopColor={look.body[0]} />
              <Stop offset="0.55" stopColor={look.body[1]} />
              <Stop offset="1" stopColor={look.body[2]} />
            </RadialGradient>
            <LinearGradient id={`soil-${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#6B4A35" />
              <Stop offset="1" stopColor="#3A271C" />
            </LinearGradient>
          </Defs>
          <Path d={beanPath(bx, by, brx, bry)} fill={`url(#body-${id})`} stroke={look.body[2]} strokeWidth={1.2} strokeOpacity={0.7} />
          {/* Gloss on top, a rim of light below. */}
          <Ellipse cx={bx - brx * 0.32} cy={by - bry * 0.52} rx={brx * 0.32} ry={bry * 0.18} fill="#FFFFFF" opacity={0.42} />
          <Circle cx={bx - brx * 0.62} cy={by - bry * 0.22} r={1.4} fill="#FFFFFF" opacity={0.5} />
          <Path d={`M${bx - brx * 0.7} ${by + bry * 0.42} Q${bx} ${by + bry * 0.78} ${bx + brx * 0.7} ${by + bry * 0.42}`} stroke="#FFFFFF" strokeWidth={1} opacity={0.18} fill="none" strokeLinecap="round" />
          {artist && dressed ? <ArtistWear wear={artist.wear} x={bx} y={by} rx={brx} ry={bry} accent={accent} layer="under" /> : null}
          {artistFace ? (
            <ArtistFace face={look.face} x={bx} y={by + 1} s={1} accent={locked ? '#8A88A0' : accent} />
          ) : (
            <FaceOf face={dressed || stage >= 1 ? look.face : 'smile'} x={bx} y={by + (seed ? -5 : 1)} s={seed ? 0.75 : 1} blush={!locked} />
          )}
          {artist && dressed ? <ArtistWear wear={artist.wear} x={bx} y={by} rx={brx} ry={bry} accent={accent} layer="over" /> : null}
          {!artist && dressed ? <Wear kind={kind} x={bx} y={by} rx={brx} ry={bry} color={accent} grey={locked} /> : null}
          {/* A seed sits in a little mound of soil. */}
          {seed ? (
            <G>
              <Path d="M20 94 Q24 84 36 85 Q50 82 64 85 Q76 84 80 94 Z" fill={`url(#soil-${id})`} />
              <Path d="M30 86.5 Q50 83 70 86.5" stroke="#8A6A52" strokeWidth={0.8} opacity={0.6} fill="none" strokeLinecap="round" />
              <Circle cx={33} cy={89} r={1.2} fill="#8A6A52" />
              <Circle cx={62} cy={88.5} r={1} fill="#8A6A52" />
              <Circle cx={70} cy={91} r={1.3} fill="#2C1E15" />
            </G>
          ) : null}
        </Svg>
      </Animated.View>

      {/* Sparkles around a bloomed sprout. */}
      {bloom ? (
        <Animated.View style={[{ position: 'absolute', width: size, height: size }, sparkle]} pointerEvents="none">
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Path d={sparklePath(16, 30, 4.5)} fill="#FFFFFF" opacity={0.9} />
            <Path d={sparklePath(85, 42, 3.5)} fill={accent} />
            <Path d={sparklePath(22, 64, 2.6)} fill={accent} opacity={0.85} />
            <Path d={sparklePath(80, 18, 2.4)} fill="#FFFFFF" opacity={0.75} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A rounded bean, a little flatter at the bottom. */
function beanPath(cx: number, cy: number, rx: number, ry: number) {
  return `M${cx - rx} ${cy} C${cx - rx} ${cy - ry * 1.2} ${cx + rx} ${cy - ry * 1.2} ${cx + rx} ${cy} C${cx + rx} ${cy + ry * 0.9} ${cx - rx} ${cy + ry * 0.9} ${cx - rx} ${cy} Z`;
}

/** A leaf from the stem (x, y) out to one side (`dir` -1 left, 1 right), in the kind's shape. */
function leafPath(shape: LeafShape, x: number, y: number, dir: number, s: number) {
  const tx = x + dir * 22 * s;
  const ty = y - 9 * s;
  switch (shape) {
    case 'heart': {
      // Two lobes at the tip, like a little heart on its side.
      const mx = x + dir * 13 * s;
      return `M${x} ${y} C${x + dir * 4 * s} ${y - 14 * s} ${mx} ${y - 18 * s} ${tx} ${ty - 5 * s} C${tx + dir * 2 * s} ${ty - 1 * s} ${tx + dir * 1 * s} ${ty + 3 * s} ${tx - dir * 1 * s} ${ty + 4 * s} C${mx} ${y + 6 * s} ${x + dir * 5 * s} ${y + 5 * s} ${x} ${y} Z`;
    }
    case 'pointed':
      return `M${x} ${y} C${x + dir * 7 * s} ${y - 12 * s} ${tx - dir * 6 * s} ${ty - 4 * s} ${tx + dir * 3 * s} ${ty - 4 * s} C${tx - dir * 6 * s} ${ty + 6 * s} ${x + dir * 8 * s} ${y + 5 * s} ${x} ${y} Z`;
    case 'jagged':
      // A leaf with a zigzag edge, like a sound wave.
      return `M${x} ${y} L${x + dir * 5 * s} ${y - 9 * s} L${x + dir * 9 * s} ${y - 7 * s} L${x + dir * 13 * s} ${y - 14 * s} L${x + dir * 16 * s} ${y - 10 * s} L${tx} ${ty - 3 * s} C${tx - dir * 5 * s} ${ty + 8 * s} ${x + dir * 8 * s} ${y + 5 * s} ${x} ${y} Z`;
    case 'petal':
      return `M${x} ${y} C${x + dir * 3 * s} ${y - 16 * s} ${tx + dir * 3 * s} ${ty - 10 * s} ${tx} ${ty} C${tx - dir * 2 * s} ${ty + 7 * s} ${x + dir * 6 * s} ${y + 6 * s} ${x} ${y} Z`;
    case 'wide':
      return `M${x} ${y} C${x + dir * 4 * s} ${y - 15 * s} ${tx + dir * 4 * s} ${ty - 9 * s} ${tx + dir * 2 * s} ${ty + 1 * s} C${tx - dir * 3 * s} ${ty + 10 * s} ${x + dir * 9 * s} ${y + 7 * s} ${x} ${y} Z`;
    default:
      return `M${x} ${y} C${x + dir * 6 * s} ${y - 13 * s} ${tx - dir * 2 * s} ${ty - 6 * s} ${tx} ${ty} C${tx - dir * 5 * s} ${ty + 8 * s} ${x + dir * 8 * s} ${y + 5 * s} ${x} ${y} Z`;
  }
}
function veinPath(x: number, y: number, dir: number, s: number) {
  return `M${x + dir * 2 * s} ${y - 1 * s} Q${x + dir * 11 * s} ${y - 6 * s} ${x + dir * 18 * s} ${y - 8.5 * s}`;
}
function shinePath(x: number, y: number, dir: number, s: number) {
  return `M${x + dir * 6 * s} ${y - 7 * s} Q${x + dir * 10 * s} ${y - 10 * s} ${x + dir * 14 * s} ${y - 11 * s}`;
}

/** A four-pointed sparkle. */
function sparklePath(cx: number, cy: number, r: number) {
  const q = r * 0.28;
  return `M${cx} ${cy - r} Q${cx + q} ${cy - q} ${cx + r} ${cy} Q${cx + q} ${cy + q} ${cx} ${cy + r} Q${cx - q} ${cy + q} ${cx - r} ${cy} Q${cx - q} ${cy - q} ${cx} ${cy - r} Z`;
}

/** The face: eyes, mouth and blush, drawn around (x, y), the middle of the eyes. */
function FaceOf({ face, x, y, s, blush }: { face: Face; x: number; y: number; s: number; blush: boolean }) {
  const ex = 6.5 * s;
  const mouthY = y + 5.5 * s;
  const eyes = (() => {
    switch (face) {
      case 'joy':
        return (
          <G>
            <Path d={`M${x - ex - 2.6 * s} ${y + 0.8 * s} Q${x - ex} ${y - 2.6 * s} ${x - ex + 2.6 * s} ${y + 0.8 * s}`} stroke={INK} strokeWidth={1.7 * s} fill="none" strokeLinecap="round" />
            <Path d={`M${x + ex - 2.6 * s} ${y + 0.8 * s} Q${x + ex} ${y - 2.6 * s} ${x + ex + 2.6 * s} ${y + 0.8 * s}`} stroke={INK} strokeWidth={1.7 * s} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'bliss':
      case 'sleepy':
        return (
          <G>
            <Path d={`M${x - ex - 2.4 * s} ${y - 0.6 * s} Q${x - ex} ${y + 2.2 * s} ${x - ex + 2.4 * s} ${y - 0.6 * s}`} stroke={INK} strokeWidth={1.6 * s} fill="none" strokeLinecap="round" />
            <Path d={`M${x + ex - 2.4 * s} ${y - 0.6 * s} Q${x + ex} ${y + 2.2 * s} ${x + ex + 2.4 * s} ${y - 0.6 * s}`} stroke={INK} strokeWidth={1.6 * s} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'wink':
        return (
          <G>
            <Circle cx={x - ex} cy={y} r={2.5 * s} fill={INK} />
            <Circle cx={x - ex + 0.8 * s} cy={y - 0.9 * s} r={0.9 * s} fill="#FFFFFF" />
            <Path d={`M${x + ex - 2.6 * s} ${y + 0.4 * s} Q${x + ex} ${y - 1.8 * s} ${x + ex + 2.6 * s} ${y + 0.4 * s}`} stroke={INK} strokeWidth={1.7 * s} fill="none" strokeLinecap="round" />
          </G>
        );
      case 'shades':
        // Groove's sunglasses sit where the eyes are.
        return (
          <G>
            <Rect x={x - ex - 4.6 * s} y={y - 3 * s} width={9.2 * s} height={6 * s} rx={2.6 * s} fill="#141024" />
            <Rect x={x + ex - 4.6 * s} y={y - 3 * s} width={9.2 * s} height={6 * s} rx={2.6 * s} fill="#141024" />
            <Path d={`M${x - ex + 4.6 * s} ${y - 1 * s} L${x + ex - 4.6 * s} ${y - 1 * s}`} stroke="#141024" strokeWidth={1.6 * s} />
            <Path d={`M${x - ex - 2.6 * s} ${y - 1.4 * s} L${x - ex - 0.6 * s} ${y - 1.4 * s}`} stroke="#5BE3B5" strokeWidth={1.1 * s} strokeLinecap="round" />
            <Path d={`M${x + ex - 2.6 * s} ${y - 1.4 * s} L${x + ex - 0.6 * s} ${y - 1.4 * s}`} stroke="#5BE3B5" strokeWidth={1.1 * s} strokeLinecap="round" />
          </G>
        );
      case 'sparkle':
        return (
          <G>
            <Circle cx={x - ex} cy={y} r={2.9 * s} fill={INK} />
            <Circle cx={x + ex} cy={y} r={2.9 * s} fill={INK} />
            <Path d={sparklePath(x - ex + 0.9 * s, y - 0.9 * s, 1.6 * s)} fill="#FFFFFF" />
            <Path d={sparklePath(x + ex + 0.9 * s, y - 0.9 * s, 1.6 * s)} fill="#FFFFFF" />
            <Circle cx={x - ex - 1 * s} cy={y + 1.2 * s} r={0.55 * s} fill="#FFFFFF" />
            <Circle cx={x + ex - 1 * s} cy={y + 1.2 * s} r={0.55 * s} fill="#FFFFFF" />
          </G>
        );
      default:
        return (
          <G>
            <Circle cx={x - ex} cy={y} r={2.5 * s} fill={INK} />
            <Circle cx={x + ex} cy={y} r={2.5 * s} fill={INK} />
            <Circle cx={x - ex + 0.8 * s} cy={y - 0.9 * s} r={0.9 * s} fill="#FFFFFF" />
            <Circle cx={x + ex + 0.8 * s} cy={y - 0.9 * s} r={0.9 * s} fill="#FFFFFF" />
          </G>
        );
    }
  })();
  const mouth = (() => {
    switch (face) {
      case 'joy':
        return <Path d={`M${x - 3.6 * s} ${mouthY - 0.6 * s} Q${x} ${mouthY + 4.6 * s} ${x + 3.6 * s} ${mouthY - 0.6 * s} Z`} fill={INK} />;
      case 'bliss':
        return <Ellipse cx={x} cy={mouthY + 0.6 * s} rx={1.6 * s} ry={2 * s} fill={INK} />;
      case 'sleepy':
        return <Ellipse cx={x} cy={mouthY + 0.8 * s} rx={1.3 * s} ry={1.1 * s} fill={INK} />;
      case 'shades':
      case 'cool':
        return <Path d={`M${x - 3.6 * s} ${mouthY - 0.4 * s} Q${x + 0.6 * s} ${mouthY + 3 * s} ${x + 4 * s} ${mouthY - 1.4 * s}`} stroke={INK} strokeWidth={1.6 * s} strokeLinecap="round" fill="none" />;
      default:
        return <Path d={`M${x - 3.2 * s} ${mouthY - 0.4 * s} Q${x} ${mouthY + 2.8 * s} ${x + 3.2 * s} ${mouthY - 0.4 * s}`} stroke={INK} strokeWidth={1.6 * s} strokeLinecap="round" fill="none" />;
    }
  })();
  return (
    <G>
      {eyes}
      {mouth}
      {blush ? (
        <G>
          <Ellipse cx={x - ex - 4 * s} cy={y + 4 * s} rx={3 * s} ry={1.8 * s} fill="#FF7EB6" opacity={0.45} />
          <Ellipse cx={x + ex + 4 * s} cy={y + 4 * s} rx={3 * s} ry={1.8 * s} fill="#FF7EB6" opacity={0.45} />
        </G>
      ) : null}
    </G>
  );
}

/** Colours for what a sprout wears: as drawn, or greys for a locked silhouette (darks stay darker). */
const DARKS = new Set(['#22305C', '#141024', '#2A2638', '#3A3458']);
const toner = (grey?: boolean) => (c: string) => (!grey ? c : DARKS.has(c) ? '#46445C' : c === '#FFFFFF' ? '#9A98B0' : '#7C7A92');

/** What a bloomed sprout wears on its body. */
function Wear({ kind, x, y, rx, ry, color, grey }: { kind: SproutKind; x: number; y: number; rx: number; ry: number; color: string; grey?: boolean }) {
  const t = toner(grey);
  switch (kind) {
    case 'bass':
      // Headphones: a band over the top and a cup on each side.
      return (
        <G>
          <Path d={`M${x - rx - 1} ${y - 2} C${x - rx - 1} ${y - ry * 1.55} ${x + rx + 1} ${y - ry * 1.55} ${x + rx + 1} ${y - 2}`} stroke={t('#22305C')} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Rect x={x - rx - 5} y={y - 6} width={8} height={12} rx={3.5} fill={color} stroke={t('#22305C')} strokeWidth={1.4} />
          <Rect x={x + rx - 3} y={y - 6} width={8} height={12} rx={3.5} fill={color} stroke={t('#22305C')} strokeWidth={1.4} />
          <Path d={`M${x - rx - 2.5} ${y - 2} L${x - rx - 2.5} ${y + 2}`} stroke={t('#FFFFFF')} strokeWidth={1} opacity={0.6} strokeLinecap="round" />
        </G>
      );
    case 'plur':
      // A kandi bracelet of colourful beads around its middle.
      return (
        <G>
          {['#FF7EB6', '#FFD58A', '#6EE7A0', '#6FC3FF', '#A97CFF', '#FF7EB6', '#FFD58A'].map((c) => t(c)).map((c, i) => {
            const at = (i - 3) / 3.4;
            return <Circle key={i} cx={x + at * rx * 0.86} cy={y + ry * 0.55 + Math.abs(at) * -2.2} r={2.1} fill={c} stroke={t('#FFFFFF')} strokeWidth={0.5} strokeOpacity={0.6} />;
          })}
        </G>
      );
    case 'wanderer':
      // A little bandana knotted at the side.
      return (
        <G>
          <Path d={`M${x - rx * 0.92} ${y - ry * 0.55} Q${x} ${y - ry * 0.9} ${x + rx * 0.92} ${y - ry * 0.55} L${x + rx * 0.8} ${y - ry * 0.33} Q${x} ${y - ry * 0.66} ${x - rx * 0.8} ${y - ry * 0.33} Z`} fill={color} />
          <Path d={`M${x + rx * 0.86} ${y - ry * 0.45} l5 -3 l-1 5 Z M${x + rx * 0.86} ${y - ry * 0.45} l6 2 l-4 3 Z`} fill={color} />
          <Circle cx={x - rx * 0.3} cy={y - ry * 0.62} r={0.9} fill={t('#FFFFFF')} opacity={0.8} />
          <Circle cx={x + rx * 0.3} cy={y - ry * 0.6} r={0.9} fill={t('#FFFFFF')} opacity={0.8} />
        </G>
      );
    case 'melody':
      // Notes drifting from its singing mouth.
      return (
        <G>
          <Path d={`M${x + rx + 2} ${y - 4} l0 -8 l5 -1.5 l0 7`} stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          <Circle cx={x + rx + 0.8} cy={y - 3.6} r={1.9} fill={color} />
          <Circle cx={x + rx + 5.8} cy={y - 5} r={1.9} fill={color} />
        </G>
      );
    case 'groove':
      // A gold chain.
      return <Path d={`M${x - rx * 0.6} ${y + ry * 0.32} Q${x} ${y + ry * 0.75} ${x + rx * 0.6} ${y + ry * 0.32}`} stroke={t('#FFD58A')} strokeWidth={1.6} strokeDasharray="1.6 1.2" fill="none" strokeLinecap="round" />;
    default:
      return null;
  }
}

/** What a bloomed sprout wears on top. */
function Bloom({ kind, x, y, color, grey }: { kind: SproutKind; x: number; y: number; color: string; grey?: boolean }) {
  const t = toner(grey);
  const cy = y - 4;
  switch (kind) {
    case 'plur':
      return (
        <G>
          <Path d={`M${x} ${cy + 9} C${x - 15} ${cy - 1} ${x - 9} ${cy - 15} ${x} ${cy - 7} C${x + 9} ${cy - 15} ${x + 15} ${cy - 1} ${x} ${cy + 9} Z`} fill={color} stroke={t('#FFFFFF')} strokeOpacity={0.5} strokeWidth={0.8} />
          <Ellipse cx={x - 4.5} cy={cy - 5} rx={2.6} ry={1.6} fill={t('#FFFFFF')} opacity={0.55} />
        </G>
      );
    case 'wanderer':
      return (
        <G>
          <Path d={starPath(x, cy, 11, 4.8)} fill={color} stroke={t('#FFFFFF')} strokeOpacity={0.55} strokeWidth={0.8} strokeLinejoin="round" />
          <Circle cx={x - 2.4} cy={cy - 2.6} r={1.6} fill={t('#FFFFFF')} opacity={0.6} />
        </G>
      );
    case 'melody':
      // A crown of five petals.
      return (
        <G>
          {[0, 72, 144, 216, 288].map((a) => (
            <Ellipse
              key={a}
              cx={x + Math.sin((a * Math.PI) / 180) * 7}
              cy={cy - Math.cos((a * Math.PI) / 180) * 7}
              rx={4.4}
              ry={5.6}
              fill={color}
              transform={`rotate(${a} ${x + Math.sin((a * Math.PI) / 180) * 7} ${cy - Math.cos((a * Math.PI) / 180) * 7})`}
              opacity={0.95}
            />
          ))}
          <Circle cx={x} cy={cy} r={4} fill={t('#FFE9A8')} />
          <Circle cx={x - 1.2} cy={cy - 1.2} r={1.2} fill={t('#FFFFFF')} opacity={0.7} />
        </G>
      );
    case 'bass':
      // A speaker cone with sound rings.
      return (
        <G>
          <Circle cx={x} cy={cy} r={8} fill={t('#22305C')} />
          <Circle cx={x} cy={cy} r={6} fill={color} />
          <Circle cx={x} cy={cy} r={2.4} fill={t('#22305C')} />
          <Path d={`M${x - 12} ${cy - 6} q-3.5 6 0 12 M${x + 12} ${cy - 6} q3.5 6 0 12`} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.85} />
          <Path d={`M${x - 15.5} ${cy - 8} q-4.5 8 0 16 M${x + 15.5} ${cy - 8} q4.5 8 0 16`} stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.5} />
        </G>
      );
    case 'groove':
      // A spinning record.
      return (
        <G>
          <Circle cx={x} cy={cy} r={9} fill={t('#141024')} />
          <Circle cx={x} cy={cy} r={7} fill="none" stroke={t('#3A3458')} strokeWidth={0.6} />
          <Circle cx={x} cy={cy} r={5} fill="none" stroke={t('#3A3458')} strokeWidth={0.6} />
          <Circle cx={x} cy={cy} r={3.2} fill={color} />
          <Circle cx={x} cy={cy} r={0.9} fill={t('#141024')} />
          <Path d={`M${x - 6} ${cy - 5} A8 8 0 0 1 ${x + 2} ${cy - 8}`} stroke={t('#FFFFFF')} strokeWidth={0.9} opacity={0.45} fill="none" strokeLinecap="round" />
        </G>
      );
    case 'spotlight':
      return (
        <G>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <Path
              key={a}
              d={`M${x + Math.sin((a * Math.PI) / 180) * 9} ${cy - Math.cos((a * Math.PI) / 180) * 9} L${x + Math.sin((a * Math.PI) / 180) * 13} ${cy - Math.cos((a * Math.PI) / 180) * 13}`}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
          <Circle cx={x} cy={cy} r={6.5} fill={color} />
          <Circle cx={x} cy={cy} r={3.5} fill={t('#FFFFFF')} opacity={0.8} />
        </G>
      );
    case 'sunrise':
      return (
        <G>
          <Path d={`M${x - 10} ${cy + 4} A10 10 0 0 1 ${x + 10} ${cy + 4} Z`} fill={color} />
          <Path d={`M${x - 6} ${cy + 4} A6 6 0 0 1 ${x + 6} ${cy + 4} Z`} fill={t('#FFD58A')} />
          {[-70, -35, 0, 35, 70].map((a) => (
            <Path
              key={a}
              d={`M${x + Math.sin((a * Math.PI) / 180) * 12.5} ${cy + 4 - Math.cos((a * Math.PI) / 180) * 12.5} L${x + Math.sin((a * Math.PI) / 180) * 16} ${cy + 4 - Math.cos((a * Math.PI) / 180) * 16}`}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
          <Path d={`M${x - 13} ${cy + 4.4} L${x + 13} ${cy + 4.4}`} stroke={t('#FFD58A')} strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
        </G>
      );
    default:
      return null;
  }
}

function starPath(cx: number, cy: number, r: number, inner: number) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? inner : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)} `;
  }
  return `${d}Z`;
}
