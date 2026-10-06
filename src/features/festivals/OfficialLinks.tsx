import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { earnsFrom, PARTNER_NOTE } from '../partners/partners';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { t } from '../../i18n';

/**
 * A festival's links, from the catalogue: "Get tickets" (until the festival is
 * over), "Official site" and "Places to stay" (a partner link, until it's
 * over). Afterglow sells nothing itself; when a link earns a commission a
 * short notice says so under the row. Nothing shows when there are no links.
 */
export function OfficialLinks({ festival, over }: { festival: Festival; over: boolean }) {
  const tickets = over ? undefined : festival.links?.tickets;
  const website = festival.links?.website;
  const stay = over ? undefined : festival.links?.stay;
  if (!tickets && !website && !stay) return null;
  const open = (url: string) => {
    haptic.select();
    Linking.openURL(url).catch(() => {});
  };
  return (
    <View>
      <View style={styles.row}>
        {tickets ? (
          <Pressable
            onPress={() => open(tickets)}
            accessibilityRole="link"
            accessibilityLabel={t('Get tickets for {festival} on the official site', { festival: festival.name })}
            style={({ pressed }) => [styles.link, styles.tickets, pressed && styles.pressed]}
          >
            <Text style={styles.ticketsText}>{t('Get tickets ↗')}</Text>
          </Pressable>
        ) : null}
        {website ? (
          <Pressable
            onPress={() => open(website)}
            accessibilityRole="link"
            accessibilityLabel={t('{festival} official site', { festival: festival.name })}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Text style={styles.text}>{t('Official site ↗')}</Text>
          </Pressable>
        ) : null}
        {stay ? (
          <Pressable
            onPress={() => open(stay)}
            accessibilityRole="link"
            accessibilityLabel={t('Places to stay near {festival}. Opens in your browser.', { festival: festival.name })}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Text style={styles.text}>{t('Places to stay ↗')}</Text>
          </Pressable>
        ) : null}
      </View>
      {earnsFrom(festival, over) ? <Text style={styles.note}>{PARTNER_NOTE}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm, marginBottom: space.md },
  link: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  tickets: { backgroundColor: glowA(0.18), borderColor: glowA(0.4) },
  ticketsText: { ...type.label, color: color.moon },
  text: { ...type.label, color: color.moonDim },
  note: { ...type.caption, color: color.moonFaint, marginTop: space.sm },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
