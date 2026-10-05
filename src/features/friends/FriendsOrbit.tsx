import { router } from 'expo-router';
import { useEffect, useId } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { PersonAvatar } from '../../components/PersonAvatar';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, space, type, glowA } from '../../theme/tokens';
import type { Profile } from '../social/models';
import { ringPlaces, splitOrbit } from './orbit';

/** One slow turn of the whole orbit (both rings together, so faces never cross). */
const TURN_MS = 140_000;
const HEIGHT = 300;
const ME = 66;
const INNER = 56;
const OUTER = 36;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

type Props = {
  me: Profile;
  /** People you follow (read for the tab). */
  friends: readonly Profile[];
  /** Your close friends, in the order you starred them. */
  close: readonly string[];
  /** New messages from someone (a close friend's 1-to-1 chat). */
  unreadFrom: (uid: string) => number;
  /** The soonest festival someone's going to, to say under their name. */
  nextFestival: (p: Profile) => Festival | undefined;
  /** A friend was tapped: open their quick options. */
  onPick: (p: Profile) => void;
};

/**
 * Your people as a little universe, like the orbit on your profile: you in
 * the middle, your close friends circling close (named, a dot when they've
 * written), and everyone else you follow on a wider, fainter ring. Tap anyone
 * for quick options (message, profile, close friend); hold a close friend for
 * their profile. Your profile background glows behind it (`backdrop`). The
 * whole orbit turns very slowly as one; still with reduced motion.
 */
export function FriendsOrbit({ me, friends, close, unreadFrom, nextFestival, onPick, backdrop }: Props & { backdrop?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen - space.xl * 2, 560);
  const turn = useSharedValue(0);
  const bloom = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    bloom.set(withTiming(1, { duration: reduce ? 0 : 900, easing: Easing.out(Easing.cubic) }));
    if (reduce) return;
    turn.set(withRepeat(withTiming(1, { duration: TURN_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [reduce, turn, bloom]);

  const { inner, outer } = splitOrbit(friends, close);
  const cx = width / 2;
  const cy = HEIGHT / 2;
  // The inner ring leaves room under each face for its name, inside the outer ring.
  const innerR = { x: Math.min(width * 0.28, 120), y: 66 };
  const outerR = { x: width / 2 - OUTER / 2 - 2, y: HEIGHT / 2 - OUTER / 2 - 6 };
  // Inner ring starts at the top; the outer one half a step round so the rings never line up.
  const innerPlaces = ringPlaces(inner.length, INNER, -Math.PI / 2);
  const outerPlaces = ringPlaces(outer.length, OUTER, -Math.PI / 2 + Math.PI / Math.max(1, outer.length));

  return (
    <View style={{ width, height: HEIGHT, alignSelf: 'center' }}>
      {backdrop}
      <Glow width={width} height={HEIGHT} cx={cx} cy={cy} inner={innerR} outer={outerR} />
      {outer.map((p, i) => (
        <Moon key={p.uid} place={outerPlaces[i]} r={outerR} cx={cx} cy={cy} turn={turn} bloom={bloom} dir={1} delay={300 + i * 60}>
          <Pressable
            onPress={() => {
              haptic.select();
              onPick(p);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${firstName(p.displayName)}. Quick options`}
            hitSlop={6}
            style={({ pressed }) => [styles.outer, pressed && styles.pressed]}
          >
            <PersonAvatar name={p.displayName} url={p.avatarUrl} size={OUTER - 3} />
          </Pressable>
        </Moon>
      ))}
      {inner.map((p, i) => {
        const unread = unreadFrom(p.uid);
        const next = nextFestival(p);
        return (
          <Moon key={p.uid} place={innerPlaces[i]} r={innerR} cx={cx} cy={cy} turn={turn} bloom={bloom} dir={1} delay={150 + i * 90} label>
            <Pressable
              onPress={() => {
                haptic.select();
                onPick(p);
              }}
              onLongPress={() => router.push({ pathname: '/u/[handle]', params: { handle: p.handle } })}
              accessibilityRole="button"
              accessibilityLabel={`${p.displayName}, close friend${unread ? `, ${unread} new` : ''}${next ? `. Going to ${next.name}` : ''}. Quick options`}
              accessibilityHint="Hold for their profile"
              style={({ pressed }) => [styles.innerWrap, pressed && styles.pressed]}
            >
              <View style={[styles.inner, unread ? styles.innerUnread : null]}>
                <PersonAvatar name={p.displayName} url={p.avatarUrl} size={INNER - 6} />
              </View>
              {unread ? <View style={styles.dot} /> : null}
              <Text style={styles.name} numberOfLines={1}>
                {firstName(p.displayName)}
              </Text>
            </Pressable>
          </Moon>
        );
      })}
      {/* You, in the middle. */}
      <View style={[styles.me, { left: cx - ME / 2, top: cy - ME / 2 }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <PersonAvatar name={me.displayName} url={me.avatarUrl} size={ME - 8} />
      </View>
    </View>
  );
}

function Moon({
  place,
  r,
  cx,
  cy,
  turn,
  bloom,
  dir,
  delay,
  label,
  children,
}: {
  place: { angle: number; size: number };
  r: { x: number; y: number };
  cx: number;
  cy: number;
  turn: SharedValue<number>;
  bloom: SharedValue<number>;
  /** Turns per turn of the orbit. */
  dir: number;
  delay: number;
  /** Leave room under the face for a name. */
  label?: boolean;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const appear = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    appear.set(withDelay(reduce ? 0 : delay, withTiming(1, { duration: reduce ? 0 : 600, easing: Easing.out(Easing.back(1.5)) })));
  }, [appear, delay, reduce]);
  const half = place.size / 2;
  const boxW = label ? 84 : place.size;
  const style = useAnimatedStyle(() => {
    const angle = place.angle + turn.get() * Math.PI * 2 * dir;
    const x = Math.cos(angle) * r.x * bloom.get();
    const y = Math.sin(angle) * r.y * bloom.get();
    // Lower on the ring is nearer: a touch bigger and brighter.
    const near = (Math.sin(angle) + 1) / 2;
    return {
      opacity: appear.get() * (label ? 0.82 + 0.18 * near : 0.5 + 0.35 * near),
      transform: [{ translateX: cx + x - boxW / 2 }, { translateY: cy + y - half }, { scale: appear.get() * (0.9 + 0.14 * near) }],
      zIndex: Math.round(near * 10) + (label ? 20 : 0),
    };
  });
  return <Animated.View style={[styles.moon, { width: boxW }, style]}>{children}</Animated.View>;
}

/** The soft light behind and the two faint rings. */
function Glow({ width, height, cx, cy, inner, outer }: { width: number; height: number; cx: number; cy: number; inner: { x: number; y: number }; outer: { x: number; y: number } }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={`a${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color.glowDeep} stopOpacity={0.42} />
            <Stop offset="0.5" stopColor={color.haze} stopOpacity={0.16} />
            <Stop offset="1" stopColor={color.haze} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`b${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color.stage} stopOpacity={0.12} />
            <Stop offset="1" stopColor={color.stage} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={cx} cy={cy} rx={width / 2} ry={height / 2} fill={`url(#a${id})`} />
        <Ellipse cx={cx + width * 0.12} cy={cy + height * 0.1} rx={width * 0.32} ry={height * 0.3} fill={`url(#b${id})`} />
        <Ellipse cx={cx} cy={cy} rx={outer.x} ry={outer.y} stroke="rgba(243,240,255,0.07)" strokeWidth={1} strokeDasharray="2 6" fill="none" />
        <Ellipse cx={cx} cy={cy} rx={inner.x} ry={inner.y} stroke={glowA(0.22)} strokeWidth={1} fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  moon: { position: 'absolute', left: 0, top: 0, alignItems: 'center' },
  outer: { width: OUTER, height: OUTER, borderRadius: OUTER / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: color.night, borderWidth: 1.5, borderColor: 'rgba(243,240,255,0.18)' },
  innerWrap: { alignItems: 'center' },
  inner: {
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.night,
    borderWidth: 2,
    borderColor: color.glow,
    shadowColor: color.glow,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  innerUnread: { borderColor: color.moon },
  dot: { position: 'absolute', top: 0, right: 14, width: 14, height: 14, borderRadius: 7, backgroundColor: color.glow, borderWidth: 2, borderColor: color.night },
  name: { ...type.caption, color: color.moon, marginTop: 4, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  me: {
    position: 'absolute',
    width: ME,
    height: ME,
    borderRadius: ME / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.night,
    borderWidth: 2,
    borderColor: 'rgba(243,240,255,0.85)',
    shadowColor: color.glow,
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  pressed: { opacity: 0.7 },
});
