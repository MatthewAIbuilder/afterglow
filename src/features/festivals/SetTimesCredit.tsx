import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import type { Festival } from '../../data/types';
import { color, space, type } from '../../theme/tokens';
import { t } from '../../i18n';

/**
 * Credit beside set times taken from someone else's timetable (Clashfinder,
 * CC BY-NC 3.0): their name, a link to the timetable, and the licence, as
 * its terms ask. Nothing when the set times are the festival's own.
 */
export function SetTimesCredit({ festival, style }: { festival: Festival; style?: object }) {
  const credit = festival.setTimesCredit;
  if (!credit) return null;
  const line = credit.license ? t('Set times from {source} ({license}) ↗', { source: credit.name, license: credit.license }) : t('Set times from {source} ↗', { source: credit.name });
  return (
    <Pressable
      onPress={() => void Linking.openURL(credit.url).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel={t('Set times from {source}. Opens their timetable.', { source: credit.name })}
      hitSlop={6}
      style={({ pressed }) => [styles.credit, style, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.text}>{line}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  credit: { marginTop: space.lg, paddingVertical: space.sm, alignSelf: 'flex-start' },
  text: { ...type.caption, color: color.moonDim },
});
