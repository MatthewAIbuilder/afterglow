import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { color, motion, space, type, nightA } from '../../theme/tokens';
import { HeartIcon, SaveIcon, SkipIcon } from './icons';
import { t } from '../../i18n';

type Props = {
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  /** Without it there's no Save button (community clips can't be kept in Your clips). */
  onSave?: () => void;
  onSkip: () => void;
  /** Row sits under a video instead of floating beside the stage. */
  horizontal?: boolean;
};

export function ActionRail({ liked, saved, onLike, onSave, onSkip, horizontal }: Props) {
  return (
    <View style={[styles.rail, horizontal && styles.row]}>
      <RailButton label={liked ? t('Liked') : t('Like')} active={liked} onPress={onLike}>
        <HeartIcon color={liked ? color.glow : color.moon} filled={liked} />
      </RailButton>
      {onSave ? (
        <RailButton label={saved ? t('Saved') : t('Save')} active={saved} onPress={onSave}>
          <SaveIcon color={saved ? color.glow : color.moon} filled={saved} />
        </RailButton>
      ) : null}
      <RailButton label={t('Skip')} active={false} onPress={onSkip} nudge>
        <SkipIcon color={color.moon} />
      </RailButton>
    </View>
  );
}

function RailButton({
  label,
  active,
  onPress,
  nudge,
  children,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Skip: the icon darts forward when tapped. */
  nudge?: boolean;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const x = useSharedValue(0);
  // Each time the button turns on (not when it shows up already on): a pop, a ring and sparks.
  const [burst, setBurst] = useState(0);
  const [prev, setPrev] = useState(active);
  if (active !== prev) {
    setPrev(active);
    if (active && !reduced) setBurst((b) => b + 1);
  }
  const was = useRef(active);
  useEffect(() => {
    if (active && !was.current) s.set(withSequence(withTiming(1.25, { duration: 110 }), withSpring(1, motion.snappy)));
    was.current = active;
  }, [active, s]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { scale: s.get() }] }));

  return (
    <Pressable
      onPress={() => {
        if (nudge && !reduced) x.set(withSequence(withTiming(9, { duration: 90 }), withSpring(0, motion.snappy)));
        onPress();
      }}
      onPressIn={() => s.set(withSpring(0.86, motion.snappy))}
      onPressOut={() => s.set(withSpring(1, motion.snappy))}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      style={styles.button}
    >
      <View>
        {burst ? <Burst key={burst} /> : null}
        <Animated.View style={[styles.icon, style]}>{children}</Animated.View>
      </View>
      <Text style={[styles.label, active && { color: color.glow }]}>{label}</Text>
    </Pressable>
  );
}

const SPARKS = 8;

/** A ring of light and a handful of sparks flying out from a button that just turned on. */
function Burst() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [t]);
  const ring = useAnimatedStyle(() => ({ opacity: 1 - t.get(), transform: [{ scale: 0.6 + t.get() * 0.9 }] }));
  return (
    <View style={styles.burst} pointerEvents="none">
      <Animated.View style={[styles.ring, ring]} />
      {Array.from({ length: SPARKS }, (_, i) => (
        <Spark key={i} i={i} t={t} />
      ))}
    </View>
  );
}

function Spark({ i, t }: { i: number; t: SharedValue<number> }) {
  const a = (i / SPARKS) * Math.PI * 2 - Math.PI / 2;
  const style = useAnimatedStyle(() => ({
    opacity: t.get() < 0.15 ? 0 : 1 - t.get(),
    transform: [{ translateX: Math.cos(a) * 36 * t.get() }, { translateY: Math.sin(a) * 36 * t.get() }, { scale: 1 - t.get() * 0.5 }],
  }));
  return <Animated.View style={[styles.spark, { backgroundColor: i % 2 ? color.glow : '#FF7EB6' }, style]} />;
}

const styles = StyleSheet.create({
  burst: { position: 'absolute', left: 0, top: 0, width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: color.glow },
  spark: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },
  rail: { alignItems: 'center', gap: space.xl },
  row: { flexDirection: 'row', justifyContent: 'center', gap: space.xxxl },
  button: { alignItems: 'center' },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: nightA(0.35),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  label: { ...type.caption, color: color.moon, marginTop: 5, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
});
