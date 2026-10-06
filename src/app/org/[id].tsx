import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Missing } from '../../components/Missing';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { PageTitle } from '../../components/PageTitle';
import { WEB_URL } from '../../config/app';
import { isSupportAccount } from '../../features/admin/admin';
import { localDay } from '../../features/artists/shows';
import { pinLook } from '../../features/badges/badges';
import { EnamelPin } from '../../features/badges/EnamelPin';
import { OrgEventRows } from '../../features/organizers/OrgCards';
import { OrgLogo } from '../../features/organizers/OrgMark';
import { orgListings } from '../../features/organizers/organizers';
import { useCatalog } from '../../state/catalog';
import { useOrgView } from '../../features/organizers/useOrgView';
import { lookOf } from '../../features/finds/finds';
import { Collectible } from '../../features/sprouts/Collectible';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { useToday } from '../../lib/useToday';
import { useMyOrg, useOrg, useOrgs } from '../../state/orgs';
import { useSocial } from '../../state/social';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { t } from '../../i18n';

/**
 * An event organizer's page: their logo and words, their links, what's
 * coming up (each event opens like a festival), and what you can collect
 * from them: their badge (filming at one of their events) and their
 * creature (their stickers and gifts). Its team sees a way into the studio.
 */
export default function OrgScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const org = useOrg(id);
  const all = useOrgs();
  const insets = useSafeAreaInsets();
  const today = localDay(useToday());
  const social = useSocial();
  const mine = useMyOrg(social.user?.uid);
  useOrgView(org?.id, 'page');
  // Its own events and the imported ones (EDMTrain) it claimed, as Afterglow has them.
  const catalog = useCatalog();
  const events = useMemo(
    () => (org ? orgListings(org, { festival: catalog.festival, show: (sid) => catalog.shows.find((x) => x.id === sid) }, today) : { upcoming: [], past: [] }),
    [org, today, catalog],
  );
  const look = useMemo(() => (org ? pinLook({ id: org.id, name: org.name, location: '', organizer: org.id }) : undefined), [org]);

  if (!org || !look) {
    // Still reading organizers on a link opened fresh: a moment, rather than "not found".
    if (!all.length) return <View style={styles.root} />;
    return <Missing title={t('Organizer not found')} line={t('This page isn’t on Afterglow any more, or the link isn’t quite right.')} />;
  }
  const canEdit = mine === org.id || isSupportAccount(social.user);
  const open = (url: string) => {
    haptic.select();
    Linking.openURL(url).catch(() => {});
  };
  const link = `${WEB_URL}/org/${org.id}`;

  return (
    <View style={styles.root}>
      <PageTitle title={org.name} />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: insets.bottom + space.xxxl }}>
        <View style={styles.hero}>
          <OrgLogo org={org} width={270} />
          {org.tagline ? <Text style={styles.tagline}>{org.tagline}</Text> : null}
          {org.about ? <Text style={styles.about}>{org.about}</Text> : null}
          <View style={styles.links}>
            {org.website ? (
              <Pressable onPress={() => open(org.website!)} accessibilityRole="link" accessibilityLabel={t('{organizer} website', { organizer: org.name })} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                <Text style={styles.linkText}>{t('Website ↗')}</Text>
              </Pressable>
            ) : null}
            {org.instagram ? (
              <Pressable onPress={() => open(`https://www.instagram.com/${org.instagram}/`)} accessibilityRole="link" accessibilityLabel={t('{organizer} on Instagram', { organizer: org.name })} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                <Text style={styles.linkText}>{`Instagram ↗`}</Text>
              </Pressable>
            ) : null}
          </View>
          {canEdit ? (
            <Pressable
              onPress={() => {
                haptic.select();
                router.push({ pathname: '/studio', params: { org: org.id } });
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.studio, pressed && styles.pressed]}
            >
              <Text style={styles.studioText}>{t('Open the organizer studio')}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.section}>{t('Coming up')}</Text>
        <View style={styles.card}>{events.upcoming.length ? <OrgEventRows org={org} listings={events.upcoming} /> : <Text style={styles.empty}>{t('No events announced yet. Check back soon.')}</Text>}</View>

        <Text style={styles.section}>{t('Collect')}</Text>
        <View style={styles.collect}>
          <View style={styles.collectItem}>
            <EnamelPin look={look} size={132} />
            <Text style={styles.collectTitle}>{t('Their badge')}</Text>
            <Text style={styles.collectLine}>{t('Film at one of their events to collect it.')}</Text>
          </View>
          {org.mark === 'alchemy' ? (
            <View style={styles.collectItem}>
              <Collectible look={lookOf('flask')} size={120} still={false} />
              <Text style={styles.collectTitle}>{lookOf('flask').name}</Text>
              <Text style={styles.collectLine}>{t('Find their stickers at events, or get one as a gift.')}</Text>
            </View>
          ) : null}
        </View>

        {events.past.length ? (
          <>
            <Text style={styles.section}>{t('Past events')}</Text>
            <View style={styles.card}>
              <OrgEventRows org={org} listings={events.past.slice(0, 12)} />
            </View>
          </>
        ) : null}
      </ScrollView>
      <PageActions shareLabel={t('Share {organizer}', { organizer: org.name })} onShare={() => void shareMessage(t('{organizer} on Afterglow: {link}', { organizer: org.name, link }), org.name)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  hero: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, marginBottom: space.xl },
  tagline: { ...type.label, color: color.moonDim, textTransform: 'uppercase', letterSpacing: 2 },
  about: { ...type.body, color: color.moonDim, textAlign: 'center' },
  links: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  link: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  linkText: { ...type.label, color: color.moon },
  studio: { paddingHorizontal: space.lg, minHeight: 44, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: glowA(0.18), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.45) },
  studioText: { ...type.headline, color: color.moon },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: space.xl, marginBottom: space.sm, marginTop: space.md },
  card: { paddingHorizontal: space.lg, paddingVertical: space.sm, marginHorizontal: space.xl, marginBottom: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  empty: { ...type.body, color: color.moonDim, paddingVertical: space.md },
  collect: { flexDirection: 'row', gap: space.md, marginHorizontal: space.xl, marginBottom: space.lg },
  collectItem: { flex: 1, alignItems: 'center', gap: space.xs, padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  collectTitle: { ...type.headline, color: color.moon, textAlign: 'center' },
  collectLine: { ...type.caption, color: color.moonDim, textAlign: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
