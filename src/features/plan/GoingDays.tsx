import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/types';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { useGoing } from '../../state/going';
import { usePlan } from '../../state/plan';
import { accentEdge, color, glowA, radius, space, type } from '../../theme/tokens';

/**
 * "Which days are you going?" for a festival of more than one day: tap the
 * days you're going to and the plan, the route and the lineup lists only hold
 * those days. No day picked means all of them. Picking a day also marks the
 * festival as one you're going to.
 */
export function GoingDays({ festival }: { festival: Festival }) {
  const { editsAt, setDays } = usePlan();
  const { isGoing, toggle } = useGoing();
  if (festival.days.length < 2) return null;
  const chosen = editsAt(festival.id).days;
  const all = chosen.size === 0;

  const flip = (day: string) => {
    haptic.select();
    const next = new Set(chosen);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    // Every day picked is the same as none: all days.
    setDays(festival.id, next.size >= festival.days.length ? [] : festival.days.filter((d) => next.has(d)));
    if (!isGoing(festival.id)) toggle(festival.id);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('Which days are you going?')}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            haptic.select();
            setDays(festival.id, []);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: all }}
          accessibilityLabel={t('All days')}
          style={({ pressed }) => [styles.chip, all && styles.chipOn, pressed && { opacity: 0.8 }]}
        >
          <Text style={[styles.chipText, all && { color: color.moon }]}>{t('All days')}</Text>
        </Pressable>
        {festival.days.map((d) => {
          const on = chosen.has(d);
          return (
            <Pressable
              key={d}
              onPress={() => flip(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={on ? t("You're going on {day}. Tap to undo.", { day: t(d) }) : t("I'm going on {day}", { day: t(d) })}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, on && accentEdge, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.chipText, on && { color: color.moon }]}>{t(d)}</Text>
            </Pressable>
          );
        })}
      </View>
      {!all ? <Text style={styles.hint}>{t('Your plan only holds the days you picked.')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginTop: space.sm },
  title: { ...type.label, color: color.moonDim },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, backgroundColor: color.glass },
  chipOn: { backgroundColor: glowA(0.25), borderColor: glowA(0.6) },
  chipText: { ...type.label, color: color.moonDim },
  hint: { ...type.body, color: color.moonFaint },
});
