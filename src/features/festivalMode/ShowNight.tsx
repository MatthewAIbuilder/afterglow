import { router } from 'expo-router';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistRow } from '../../components/ArtistRow';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { directionsUrl } from '../../lib/directions';
import { color, space, type } from '../../theme/tokens';
import { datesLine } from '../festivals/format';
import { useFestivalPlan } from '../plan/useFestivalPlan';
import { t } from '../../i18n';
import type { ModeNow } from './mode';
import { eventPath } from './showEvent';
import { Action, LeaveLink } from './TonightPlan';

/**
 * Festival mode's Lineup tab at a one-night show: the night at a glance.
 * Where it is (directions, tickets), then the bill, best for you first (a
 * show has no set times, so there's no route). Everything here but the
 * links works with no signal: the bill was kept when you said you're going.
 */
export function ShowNight({ mode }: { mode: ModeNow }) {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { festival } = mode;
  const { picks } = useFestivalPlan(festival);
  const tickets = festival.links?.tickets;
  const where = festival.location || festival.name;

  return (
    <View style={styles.root}>
      <PageTitle title={t('Tonight · {festival}', { festival: festival.name })} />
      <NightSky />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: tabSpace + space.xxxl }]}>
        <Text style={styles.kicker}>{mode.preview ? t('Test · tonight') : t('Tonight')}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {festival.name}
        </Text>
        <Text style={styles.sub}>{[datesLine(festival), festival.location].filter(Boolean).join(' · ')}</Text>

        <View style={styles.actions}>
          <Action
            label={t('Directions')}
            a11y={t('Directions to {place}. Opens your maps app.', { place: where })}
            onPress={() => void Linking.openURL(directionsUrl({ place: festival.place, name: where }, Platform.OS)).catch(() => {})}
          />
          {tickets ? (
            <Action label={t('Tickets ↗')} a11y={t('Tickets for {show}. Opens their site.', { show: festival.name })} onPress={() => void Linking.openURL(tickets).catch(() => {})} />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('On the bill')}</Text>
          <Text style={styles.note}>{t('Best for you first. Artists on Afterglow only: the full lineup is on the show page.')}</Text>
          {picks.length ? (
            picks.map((p) => (
              <ArtistRow
                key={p.artist.id}
                artist={p.artist}
                affinity={p.match}
                detail={p.tier === 'must-see' ? t('Must see') : p.tier === 'strong' ? t('Strong match') : t('Worth a look')}
              />
            ))
          ) : (
            <Text style={styles.quiet}>{t('Nobody on the bill is on Afterglow yet.')}</Text>
          )}
        </View>

        <View style={styles.actions}>
          {picks.length ? <Action label={t('Rate the bill')} onPress={() => router.push({ pathname: '/tune/[id]', params: { id: festival.id } })} /> : null}
          <Action label={t('The show')} a11y={t('{show}: the show page', { show: festival.name })} onPress={() => router.push(eventPath(festival))} />
        </View>
        <Text style={styles.footnote}>{t('The bill works without signal.')}</Text>
        <LeaveLink mode={mode} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640 },
  kicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1.4 },
  title: { ...type.largeTitle, color: color.moon, marginTop: 2 },
  sub: { ...type.body, color: color.moonDim },
  section: { marginTop: space.xl, gap: space.sm },
  sectionTitle: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  note: { ...type.caption, color: color.moonDim },
  quiet: { ...type.body, color: color.moonDim },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  footnote: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.lg },
});
