import { useEffect, useId } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import type { SoundTag } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { mixColor, SOUND_COLOR, withAlpha } from '../sound-map/colors';
import { type Favourite, orbitPlaces } from './identity';
import { ToeGlyph } from '../toes/Toe';
import { useToes } from '../toes/useToes';
import { color } from '../../theme/tokens';

/** One turn of the orbit, slow enough to feel alive, never busy. */
const TURN_MS = 90_000;

type Props = {
  width: number;
  height: number;
  /** Who drifts around you (best first). */
  artists: Favourite[];
  /** Your top sounds: the glow behind takes their colours. */
  sounds: SoundTag[];
  /** Your photo, in the middle. */
  children: React.ReactNode;
  onPress?: () => void;
  label: string;
};

/**
 * Your photo at the heart of a tiny version of My Sound: your favourite
 * artists drift slowly round you on a tilted ring, nearer ones a little
 * bigger and brighter, over a soft glow in your sounds' colours. Tap it for
 * My Sound. Still with reduced motion.
 */
export function SoundOrbit({ width, height, artists, sounds, children, onPress, label }: Props) {
  const reduce = useReducedMotion();
  const toes = useToes();
  const turn = useSharedValue(0);
  const bloom = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    bloom.set(withTiming(1, { duration: reduce ? 0 : 900, easing: Easing.out(Easing.cubic) }));
    if (reduce) return;
    turn.set(withRepeat(withTiming(1, { duration: TURN_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [reduce, turn, bloom]);

  const rx = Math.min(width / 2 - 34, 150);
  const ry = Math.min(height / 2 - 30, 82);
  const places = orbitPlaces(artists.length, rx, ry);
  const cx = width / 2;
  const cy = height / 2;

  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress?.();
      }}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={label}
      style={{ width, height }}
    >
      <Glow width={width} height={height} sounds={sounds} rx={rx} ry={ry} />
      {places.map((p, i) => {
        const a = artists[i];
        return <Moon key={a.artist.id} fav={a} place={p} turn={turn} bloom={bloom} cx={cx} cy={cy} rx={rx} ry={ry} index={i} count={places.length} />;
      })}
      {/* For one person only: a toe rides the ring with their artists. */}
      {toes ? <ToeMoon turn={turn} cx={cx} cy={cy} rx={rx} ry={ry} /> : null}
      <View style={styles.centre} pointerEvents="none">
        {children}
      </View>
    </Pressable>
  );
}

function Moon({
  fav,
  place,
  turn,
  bloom,
  cx,
  cy,
  rx,
  ry,
  index,
  count,
}: {
  fav: Favourite;
  place: { x: number; y: number; size: number; delay: number };
  turn: SharedValue<number>;
  bloom: SharedValue<number>;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  index: number;
  count: number;
}) {
  const reduce = useReducedMotion();
  const appear = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    appear.set(withDelay(reduce ? 0 : 200 + place.delay, withTiming(1, { duration: reduce ? 0 : 600, easing: Easing.out(Easing.back(1.6)) })));
  }, [appear, place.delay, reduce]);
  const base = -Math.PI / 3 + (index * 2 * Math.PI) / count;
  const depth = index % 2 ? 0.86 : 1;
  const half = place.size / 2;
  const style = useAnimatedStyle(() => {
    const angle = base + turn.get() * Math.PI * 2;
    const x = Math.cos(angle) * rx * depth * bloom.get();
    const y = Math.sin(angle) * ry * depth * bloom.get();
    // Lower on the ring is nearer: a little bigger and brighter.
    const near = (Math.sin(angle) + 1) / 2;
    return {
      opacity: appear.get() * (0.62 + 0.38 * near),
      transform: [{ translateX: cx + x - half }, { translateY: cy + y - half }, { scale: appear.get() * (0.86 + 0.2 * near) }],
    };
  });
  const ring = fav.artist.color ?? mixColor(fav.artist.sound);
  return (
    <Animated.View
      style={[styles.moon, { width: place.size, height: place.size, borderRadius: half, borderColor: withAlpha(ring, 0.9), shadowColor: ring }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <ArtistAvatar artist={fav.artist} size={place.size - 4} />
    </Animated.View>
  );
}

/** A small toe on the orbit, half a turn behind the first artist. */
function ToeMoon({ turn, cx, cy, rx, ry }: { turn: SharedValue<number>; cx: number; cy: number; rx: number; ry: number }) {
  const style = useAnimatedStyle(() => {
    const angle = Math.PI * 0.62 + turn.get() * Math.PI * 2;
    const near = (Math.sin(angle) + 1) / 2;
    return {
      opacity: 0.35 + 0.35 * near,
      transform: [{ translateX: cx + Math.cos(angle) * rx * 0.93 - 7 }, { translateY: cy + Math.sin(angle) * ry * 0.93 - 8 }, { rotate: `${angle * 57.3 + 90}deg` }],
    };
  });
  return (
    <Animated.View style={[styles.toe, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ToeGlyph size={14} color="#FFD9E8" />
    </Animated.View>
  );
}

/** The soft light behind: a cloud in each of your top sounds' colours, and the faint ring the artists ride on. */
function Glow({ width, height, sounds, rx, ry }: { width: number; height: number; sounds: SoundTag[]; rx: number; ry: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const colors = (sounds.length ? sounds : (['melodic-bass'] as SoundTag[])).slice(0, 3).map((s) => SOUND_COLOR[s]);
  // Each cloud stays inside the box, so its light fades out before any edge.
  const w = width / 2;
  const h = height / 2;
  const spots = [
    { x: w - w * 0.22, y: h - h * 0.08, rx: w * 0.78, ry: h * 0.92 },
    { x: w + w * 0.24, y: h + h * 0.06, rx: w * 0.76, ry: h * 0.94 },
    { x: w, y: h + h * 0.12, rx: w * 0.6, ry: h * 0.88 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Defs>
          {colors.map((c, i) => (
            <RadialGradient key={i} id={`g${id}${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c} stopOpacity={0.3} />
              <Stop offset="0.55" stopColor={c} stopOpacity={0.1} />
              <Stop offset="1" stopColor={c} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {colors.map((_, i) => (
          <Ellipse key={i} cx={spots[i].x} cy={spots[i].y} rx={spots[i].rx} ry={spots[i].ry} fill={`url(#g${id}${i})`} />
        ))}
        <Ellipse cx={width / 2} cy={height / 2} rx={rx} ry={ry} stroke="rgba(243,240,255,0.10)" strokeWidth={1} strokeDasharray="2 6" fill="none" />
        <Ellipse cx={width / 2} cy={height / 2} rx={rx * 0.86} ry={ry * 0.86} stroke="rgba(243,240,255,0.06)" strokeWidth={1} fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  toe: { position: 'absolute', left: 0, top: 0 },
  centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  moon: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.night,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
