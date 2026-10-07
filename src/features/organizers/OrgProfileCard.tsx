import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { t } from '../../i18n';
import { localDay } from '../artists/shows';
import { datesLine } from '../festivals/format';
import { OrgLogo } from './OrgMark';
import { datesText, type Org, splitEvents } from './organizers';

/**
 * On the profile of an account that runs an organizer: the organizer's logo
 * and line, its next event, and the way in (its studio on your own profile,
 * its page on someone else's).
 */
export function OrgProfileCard({ org, own }: { org: Org; own: boolean }) {
  const today = localDay(useToday());
  const next = splitEvents(org, today).upcoming[0];
  const go = (to: () => void) => () => {
    haptic.select();
    to();
  };
  const openPage = go(() => router.push({ pathname: '/org/[id]', params: { id: org.id } }));
  const when = next ? datesLine({ dates: datesText(next), startDate: next.date, endDate: next.endDate ?? next.date }) : undefined;
  return (
    <View style={styles.card}>
      <Pressable onPress={openPage} accessibilityRole="button" accessibilityLabel={t('{organizer}. Open their page', { organizer: org.name })} style={({ pressed }) => [styles.top, pressed && styles.pressed]}>
        <Text style={styles.kicker}>{own ? t('You run') : t('Runs')}</Text>
        <OrgLogo org={org} width={210} />
        {org.tagline ? <Text style={styles.tagline}>{org.tagline}</Text> : null}
        <Text style={styles.next} numberOfLines={1}>
          {next ? t('Next: {event} · {when}', { event: next.name, when: when! }) : t('No events announced yet')}
        </Text>
      </Pressable>
      {/* Its website and Instagram, as on its page. */}
      {org.website || org.instagram ? (
        <View style={styles.links}>
          {org.website ? (
            <Pressable onPress={go(() => Linking.openURL(org.website!).catch(() => {}))} accessibilityRole="link" accessibilityLabel={t('{organizer} website', { organizer: org.name })} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>{t('Website ↗')}</Text>
            </Pressable>
          ) : null}
          {org.instagram ? (
            <Pressable onPress={go(() => Linking.openURL(`https://www.instagram.com/${org.instagram}/`).catch(() => {}))} accessibilityRole="link" accessibilityLabel={t('{organizer} on Instagram', { organizer: org.name })} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>{`Instagram ↗`}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.row}>
        {own ? (
          <Pressable onPress={go(() => router.push('/studio'))} accessibilityRole="button" accessibilityLabel={t('Open the organizer studio')} style={({ pressed }) => [styles.button, styles.glow, pressed && styles.pressed]}>
            <Text style={styles.glowText}>{t('Organizer studio')}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={openPage} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>{own ? t('Your organizer page') : t('See their events')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg, marginTop: space.md, marginBottom: space.md, padding: space.lg, gap: space.md, borderRadius: radius.lg, backgroundColor: 'rgba(10,10,14,0.72)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  top: { alignItems: 'center', gap: space.sm },
  kicker: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1.4 },
  tagline: { ...type.label, color: color.moonDim, textTransform: 'uppercase', letterSpacing: 2 },
  next: { ...type.caption, color: color.moonDim },
  row: { flexDirection: 'row', gap: space.sm },
  links: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  link: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  button: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  buttonText: { ...type.label, color: color.moon },
  glow: { backgroundColor: glowA(0.2), borderColor: glowA(0.5) },
  glowText: { ...type.label, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
