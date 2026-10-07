import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { PersonAvatar } from '../../components/PersonAvatar';
import type { Standing } from '../social/models';
import { color, space, type } from '../../theme/tokens';
import { captionsOf, GLOW, RING, ringOf } from './standing';
import { useStanding } from './useStanding';

type Props = {
  name?: string;
  url?: string;
  size: number;
  /** Whose standing to show (read and cached), or pass `standing` directly. */
  uid?: string;
  standing?: Standing;
};

/**
 * A profile photo with its standing: founders get a slowly turning gold
 * ring with a warm glow, artists a holographic one, the team and partners
 * their own colours. Everyone else gets the plain photo. Still with reduced
 * motion.
 */
export function StandingAvatar({ name, url, size, uid, standing: given }: Props) {
  const read = useStanding(given ? undefined : uid);
  const standing = given ?? read;
  const ring = ringOf(standing);
  const reduce = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!ring || reduce) return;
    turn.set(withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [ring, reduce, turn]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 360}deg` }] }));

  if (!ring) return <PersonAvatar name={name} url={url} size={size} uid={uid} />;
  const thick = Math.max(2.5, Math.round(size * 0.045));
  const gap = Math.max(2, Math.round(size * 0.03));
  const outer = size + (thick + gap) * 2;
  const glow = GLOW[ring];
  return (
    <View style={{ width: outer, height: outer }}>
      {/* The glow: a soft halo behind the ring. */}
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: `${glow}33`, shadowColor: glow, shadowRadius: size * 0.18 },
        ]}
      />
      <View style={[styles.ring, { width: outer, height: outer, borderRadius: outer / 2 }]}>
        <Animated.View style={[{ position: 'absolute', width: outer * 1.5, height: outer * 1.5, left: -outer * 0.25, top: -outer * 0.25 }, spin]}>
          <LinearGradient colors={RING[ring] as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={[styles.gap, { width: size + gap * 2, height: size + gap * 2, borderRadius: (size + gap * 2) / 2 }]}>
          <PersonAvatar name={name} url={url} size={size} uid={uid} />
        </View>
      </View>
    </View>
  );
}

/**
 * The captions under a name: a flair ("Artist") and, for founders, "One of
 * the first 100 on Afterglow · #23" in gold. Nothing for everyone else.
 */
export function StandingCaption({ uid, standing: given, align = 'left' }: { uid?: string; standing?: Standing; align?: 'left' | 'center' }) {
  const read = useStanding(given ? undefined : uid);
  const lines = captionsOf(given ?? read);
  if (!lines.length) return null;
  return (
    <View style={[styles.captions, align === 'center' && { alignItems: 'center' }]}>
      {lines.map((c) => (
        <View key={c.kind} style={[styles.caption, { borderColor: `${GLOW[c.kind]}66`, backgroundColor: `${GLOW[c.kind]}1A` }]}>
          <View style={[styles.dot, { backgroundColor: GLOW[c.kind], shadowColor: GLOW[c.kind] }]} />
          <Text style={[styles.captionText, { color: c.kind === 'founder' ? '#FFE38A' : color.moon }]} numberOfLines={1}>
            {c.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: 'absolute', shadowOpacity: 0.9, shadowOffset: { width: 0, height: 0 } },
  ring: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  gap: { backgroundColor: color.night, alignItems: 'center', justifyContent: 'center' },
  captions: { gap: space.xs, marginTop: space.xs, alignItems: 'flex-start' },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.sm + 2, paddingVertical: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  captionText: { ...type.caption, fontWeight: '600' },
});
