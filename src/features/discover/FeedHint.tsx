import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { ChevronIcon } from '../../components/TabIcons';
import { color, radius, space, type } from '../../theme/tokens';
import { HINT_COPY, HINT_SPOKEN, type Hint } from './hints';
import { HeartIcon } from './icons';

/** A quiet first-time tip in the feed's header. Never over the video. */
export function FeedHint({ hint }: { hint: Hint }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      key={hint}
      entering={reduceMotion ? undefined : FadeIn.delay(900).duration(420)}
      exiting={reduceMotion ? undefined : FadeOut.duration(240)}
      style={styles.pill}
      accessibilityRole="text"
      accessibilityLabel={`Tip: ${HINT_SPOKEN[hint]}`}
      pointerEvents="none"
    >
      {hint === 'swipe' ? (
        <ChevronIcon color={color.glow} size={11} direction="up" />
      ) : (
        <HeartIcon color={color.glow} size={12} filled />
      )}
      <Text style={styles.text}>{HINT_COPY[hint]}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(18,16,38,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.35)',
  },
  text: { ...type.caption, color: color.moon },
});
