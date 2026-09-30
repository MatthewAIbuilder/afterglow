import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  type SharedValue,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { color, motion, type } from '../../theme/tokens';
import { LABEL_OFFSET, MAX_R, type PlacedArtist } from './layout';

type Props = {
  placed: PlacedArtist;
  index: number;
  /** null when nothing is selected */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** A search is on: matches pop out, everyone else fades back. */
  searching?: boolean;
  matched?: boolean;
  /** Pan velocity of the map, px/s. */
  velX: SharedValue<number>;
  velY: SharedValue<number>;
};

// How far a bubble trails the finger, and the cap on that trail.
const LAG = 0.011;
const MAX_LAG = 14;
const LABEL_W = 150;
const D = MAX_R * 2; // bubbles render at full size and scale down, so size can animate
const GLOW = MAX_R * 2.5;

/** Only this many of the strongest matches get a full label; the rest a smaller, dimmer name and no percentage. */
const FULL_LABELS = 12;

/** Focus of a search match: bigger than selected (2), so it pops. */
const MATCH = 2.8;

// How the map reshapes when your taste changes: unhurried, one soft overshoot.
const reshape = { damping: 16, stiffness: 70, mass: 1.1 };

function ArtistBubbleBase({ placed, index, selectedId, onSelect, searching, matched, velX, velY }: Props) {
  const { artist, affinity, x, y, r } = placed;
  const reduceMotion = useReducedMotion();

  const bloom = useSharedValue(reduceMotion ? 1 : 0);
  const drift = useSharedValue(0.5);
  const focus = useSharedValue(1);
  const lagX = useSharedValue(0);
  const lagY = useSharedValue(0);

  // Position and size are animated, so a change in taste glides rather than jumps.
  const px = useSharedValue(x);
  const py = useSharedValue(y);
  const pr = useSharedValue(r);

  useEffect(() => {
    const cfg = reduceMotion ? { duration: 0 } : null;
    px.value = cfg ? x : withSpring(x, reshape);
    py.value = cfg ? y : withSpring(y, reshape);
    pr.value = cfg ? r : withSpring(r, reshape);
  }, [x, y, r, px, py, pr, reduceMotion]);

  // Bigger bubbles are heavier: they trail a little further and settle slower,
  // so the constellation moves like a loose group rather than a flat image.
  const weight = r / MAX_R;
  const lagSpring = { damping: 9 + weight * 3, stiffness: 150 - weight * 40, mass: 0.5 + weight * 0.6 };
  const reach = LAG * (0.6 + weight * 0.6);

  useAnimatedReaction(
    () => [velX.value, velY.value] as const,
    ([vx, vy]) => {
      if (reduceMotion) return;
      const clamp = (v: number) => Math.max(-MAX_LAG, Math.min(MAX_LAG, v));
      lagX.value = withSpring(clamp(-vx * reach), lagSpring);
      lagY.value = withSpring(clamp(-vy * reach), lagSpring);
    },
  );

  useEffect(() => {
    if (reduceMotion) return;
    // The one orchestrated moment: the universe blooms out from you, strongest matches first.
    bloom.value = withDelay(120 + index * 70, withSpring(1, motion.bloom));
    drift.value = withDelay(
      index * 180,
      withRepeat(withTiming(1, { duration: 3200 + (index % 4) * 450, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    // Only on first mount; later changes in rank should not replay the bloom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const isSelected = selectedId === artist.id;
    if (selectedId !== null) {
      focus.value = withSpring(isSelected ? 2 : 0, motion.snappy);
      return;
    }
    // A search match pops: a springy grow past the selected size, with its own glow.
    if (searching) focus.value = matched ? (reduceMotion ? MATCH : withSpring(MATCH, motion.bloom)) : withSpring(0, motion.snappy);
    else focus.value = withSpring(1, motion.snappy);
  }, [selectedId, artist.id, focus, searching, matched, reduceMotion]);

  const anchorStyle = useAnimatedStyle(() => {
    const p = bloom.value;
    const f = focus.value; // 0 dimmed, 1 normal, 2 selected
    return {
      opacity: Math.min(1, p) * (f < 1 ? 0.28 + 0.72 * f : 1),
      transform: [
        { translateX: px.value * p + lagX.value },
        { translateY: py.value * p + (drift.value - 0.5) * 6 + lagY.value },
      ],
    };
  });

  const bodyStyle = useAnimatedStyle(() => {
    const f = focus.value;
    const s = (pr.value / MAX_R) * bloom.value * (f > 1 ? 1 + 0.07 * (f - 1) : 1);
    return { transform: [{ scale: s }] };
  });

  // The extra glow of a search match.
  const matchGlowStyle = useAnimatedStyle(() => {
    const f = focus.value;
    return { opacity: f > 2 ? Math.min(1, (f - 2) / (MATCH - 2)) : 0 };
  });

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pr.value * bloom.value + LABEL_OFFSET }],
  }));

  const glowStrength = Math.pow(affinity, 3) * 0.75;
  const gid = `g-${artist.id}`;
  const pct = Math.round(affinity * 100);
  // index is the bloom order: strongest match first.
  const prominent = index < FULL_LABELS;

  return (
    <Animated.View
      style={[styles.anchor, anchorStyle]}
      accessibilityRole="button"
      accessibilityLabel={`${artist.name}, ${pct} percent match`}
      onAccessibilityTap={() => onSelect(artist.id)}
    >
      <Animated.View style={[styles.glow, bodyStyle]} pointerEvents="none">
        <Svg width={GLOW} height={GLOW}>
          <Defs>
            <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
              <Stop offset="0.3" stopColor={color.glow} stopOpacity={glowStrength} />
              <Stop offset="1" stopColor={color.glowDeep} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill={`url(#${gid})`} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.glow, bodyStyle, matchGlowStyle]} pointerEvents="none">
        <Svg width={GLOW} height={GLOW}>
          <Defs>
            <RadialGradient id={`${gid}-m`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.3" stopColor={color.glow} stopOpacity={0.7} />
              <Stop offset="1" stopColor={color.glowDeep} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill={`url(#${gid}-m)`} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.body, bodyStyle]}>
        <ArtistAvatar artist={artist} size={D} />
      </Animated.View>

      <Animated.View style={[styles.label, labelStyle]} pointerEvents="none">
        {/* Quieter labels for smaller bubbles, so the strongest matches lead; the match is still read out, and shown once selected. */}
        <Text style={[styles.name, !prominent && styles.nameSmall]} numberOfLines={1}>
          {artist.name}
        </Text>
        {prominent || selectedId === artist.id || matched ? <Text style={styles.pct}>{pct}%</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

export const ArtistBubble = memo(ArtistBubbleBase);

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  glow: { position: 'absolute', left: -GLOW / 2, top: -GLOW / 2, width: GLOW, height: GLOW },
  body: { position: 'absolute', left: -D / 2, top: -D / 2, width: D, height: D },
  label: { position: 'absolute', left: -LABEL_W / 2, top: 0, width: LABEL_W, alignItems: 'center' },
  name: { ...type.label, color: color.moon, textAlign: 'center' },
  nameSmall: { fontSize: 11, lineHeight: 14, color: color.moonDim, fontWeight: '500' },
  pct: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'], marginTop: 1 },
});
