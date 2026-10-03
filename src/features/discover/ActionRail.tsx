import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { color, motion, space, type } from '../../theme/tokens';
import { HeartIcon, SaveIcon, SkipIcon } from './icons';

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
      <RailButton label={liked ? 'Liked' : 'Like'} active={liked} onPress={onLike}>
        <HeartIcon color={liked ? color.glow : color.moon} filled={liked} />
      </RailButton>
      {onSave ? (
        <RailButton label={saved ? 'Saved' : 'Save'} active={saved} onPress={onSave}>
          <SaveIcon color={saved ? color.glow : color.moon} filled={saved} />
        </RailButton>
      ) : null}
      <RailButton label="Skip" active={false} onPress={onSkip}>
        <SkipIcon color={color.moon} />
      </RailButton>
    </View>
  );
}

function RailButton({
  label,
  active,
  onPress,
  children,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const s = useSharedValue(1);

  // A small pop whenever the button turns on.
  useEffect(() => {
    if (active) s.set(withSequence(withTiming(1.25, { duration: 110 }), withSpring(1, motion.snappy)));
  }, [active, s]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => s.set(withSpring(0.86, motion.snappy))}
      onPressOut={() => s.set(withSpring(1, motion.snappy))}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      style={styles.button}
    >
      <Animated.View style={[styles.icon, style]}>{children}</Animated.View>
      <Text style={[styles.label, active && { color: color.glow }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { alignItems: 'center', gap: space.xl },
  row: { flexDirection: 'row', justifyContent: 'center', gap: space.xxxl },
  button: { alignItems: 'center' },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,9,24,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  label: { ...type.caption, color: color.moon, marginTop: 5, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
});
