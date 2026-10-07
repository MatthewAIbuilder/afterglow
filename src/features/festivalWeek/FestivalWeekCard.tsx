import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { useFestivalWeek } from './useFestivalWeek';
import { t } from '../../i18n';

const GOLD = '#FFD58A';

/**
 * Festival week, as a card: seven little doors, lit up as they open, and
 * what's ready today. Only in the week before a festival you're going to.
 * Pass the festival as it is for you (after `forYou`).
 */
export function FestivalWeekCard({ festival, showName = false }: { festival: Festival; showName?: boolean }) {
  const week = useFestivalWeek(festival);
  if (!week) return null;
  const label = showName
    ? t('Festival week for {festival}. {line}. Opens the calendar.', { festival: festival.name, line: week.line })
    : t('Festival week. {line}. Opens the calendar.', { line: week.line });
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/festival-week/[id]', params: { id: festival.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, week.ready > 0 && styles.cardReady, pressed && { opacity: 0.85 }]}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.kicker}>{showName ? t('FESTIVAL WEEK · {festival}', { festival: festival.name.toUpperCase() }) : t('FESTIVAL WEEK')}</Text>
        <View style={styles.doors}>
          {week.doors.map((d) => (
            <View key={d.day} style={[styles.door, d.opened && styles.doorOpen, d.unlocked && !d.opened && styles.doorReady]}>
              <Text style={[styles.doorText, d.unlocked && !d.opened && { color: GOLD }]}>{d.opened ? d.emoji : d.day}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.line, week.ready > 0 && { color: GOLD }]}>{week.line}</Text>
      </View>
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  cardReady: { borderColor: 'rgba(255,213,138,0.55)', backgroundColor: 'rgba(255,213,138,0.07)' },
  kicker: { ...type.caption, fontSize: 11, color: GOLD, letterSpacing: 1.5, fontWeight: '700' },
  doors: { flexDirection: 'row', gap: 6 },
  door: { flex: 1, maxWidth: 34, aspectRatio: 0.8, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  doorReady: { borderWidth: 1, borderColor: GOLD, backgroundColor: 'rgba(255,213,138,0.12)' },
  doorOpen: { backgroundColor: glowA(0.18), borderColor: glowA(0.45) },
  doorText: { ...type.label, color: color.moonDim, fontVariant: ['tabular-nums'] },
  line: { ...type.label, color: color.moonDim },
});
