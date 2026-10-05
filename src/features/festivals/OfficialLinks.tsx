import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * A festival's official links, from the catalogue: "Get tickets" (until the
 * festival is over) and "Official site". They open the festival's own pages;
 * Afterglow sells nothing. Nothing shows when there are no links.
 */
export function OfficialLinks({ festival, over }: { festival: Festival; over: boolean }) {
  const tickets = over ? undefined : festival.links?.tickets;
  const website = festival.links?.website;
  if (!tickets && !website) return null;
  const open = (url: string) => {
    haptic.select();
    Linking.openURL(url).catch(() => {});
  };
  return (
    <View style={styles.row}>
      {tickets ? (
        <Pressable
          onPress={() => open(tickets)}
          accessibilityRole="link"
          accessibilityLabel={`Get tickets for ${festival.name} on the official site`}
          style={({ pressed }) => [styles.link, styles.tickets, pressed && styles.pressed]}
        >
          <Text style={styles.ticketsText}>Get tickets ↗</Text>
        </Pressable>
      ) : null}
      {website ? (
        <Pressable
          onPress={() => open(website)}
          accessibilityRole="link"
          accessibilityLabel={`${festival.name} official site`}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Text style={styles.text}>Official site ↗</Text>
        </Pressable>
      ) : null}
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
  tickets: { backgroundColor: 'rgba(169,124,255,0.18)', borderColor: 'rgba(169,124,255,0.4)' },
  ticketsText: { ...type.label, color: color.moon },
  text: { ...type.label, color: color.moonDim },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
