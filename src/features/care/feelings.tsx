import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { t } from '../../i18n';
import { HELP_MOODS, type Mood, MOOD_LABEL, MOOD_LEVEL, MOODS } from './care';

/** A colour per graph level: 5 bright mint down to 1 soft coral. */
export const LEVEL_COLOR: Record<number, string> = { 5: '#5BE3B5', 4: '#9ADF8F', 3: '#C9C3E6', 2: '#FFB86B', 1: '#FF8A8A' };
export const moodColor = (m: Mood) => LEVEL_COLOR[MOOD_LEVEL[m]];

/** Each feeling as a whole line for screen readers. */
export const FEELING_LINE: Record<Mood, string> = {
  great: t("I'm feeling great"),
  good: t("I'm feeling good"),
  okay: t("I'm feeling okay"),
  tired: t("I'm feeling tired"),
  anxious: t("I'm feeling anxious"),
  hot: t("I'm feeling too hot"),
  overwhelmed: t("I'm feeling overwhelmed"),
  sick: t("I'm feeling sick"),
  rough: t("I'm feeling not great"),
};

/**
 * The feelings to pick from, each with its colour dot. `compact` is the
 * smaller row used on a stopwatch.
 */
export function FeelingChips({ onPick, compact, current }: { onPick: (m: Mood) => void; compact?: boolean; current?: Mood }) {
  return (
    <View style={[styles.grid, compact && styles.gridCompact]}>
      {MOODS.map((m) => {
        const on = current === m;
        const careful = HELP_MOODS.includes(m);
        return (
          <Pressable
            key={m}
            onPress={() => {
              haptic.select();
              onPick(m);
            }}
            accessibilityRole="button"
            accessibilityLabel={FEELING_LINE[m]}
            style={({ pressed }) => [styles.chip, compact && styles.chipCompact, careful && styles.chipCareful, on && styles.chipOn, pressed && styles.pressed]}
          >
            <View style={[styles.dot, { backgroundColor: moodColor(m) }]} />
            <Text style={[styles.text, compact && styles.textCompact]} numberOfLines={1}>
              {MOOD_LABEL[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  gridCompact: { gap: 6 },
  // Dot above the word, so even "Overwhelmed" fits three across on a small phone.
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 56,
    paddingHorizontal: 4,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipCompact: { flexDirection: 'row', gap: space.sm, flexBasis: 'auto', flexGrow: 0, minHeight: 36, paddingVertical: 0, paddingHorizontal: space.sm + 2, borderRadius: radius.pill },
  chipCareful: { borderColor: 'rgba(255,140,140,0.35)' },
  chipOn: { backgroundColor: glowA(0.22), borderColor: glowA(0.6) },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { ...type.label, fontSize: 13, letterSpacing: -0.2, color: color.moon, textAlign: 'center' },
  textCompact: { ...type.caption, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
