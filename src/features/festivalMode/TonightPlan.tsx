import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistRow } from '../../components/ArtistRow';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { showAlert } from '../../lib/dialog';
import { directionsUrl } from '../../lib/directions';
import { haptic } from '../../lib/haptics';
import { useFestivalMode } from '../../state/festivalMode';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { lineupDays } from '../festivals/days';
import { picksByDay } from '../plan/byDay';
import { LiveNow } from '../plan/LiveNow';
import type { Pick } from '../plan/plan';
import { RouteList } from '../plan/RouteList';
import { useFestivalPlan } from '../plan/useFestivalPlan';
import { dayWord, t } from '../../i18n';
import type { ModeNow } from './mode';

/** Picks shown for a night before set times are out. */
const NIGHT_PICKS = 8;

/**
 * Festival mode's Lineup tab: your night, planned for you. Once set times are
 * out, where to be now and next and the whole night set to set; before, the
 * night's picks in order. Other nights are a tap away; the full lineup is on
 * the festival page. Everything here works with no signal.
 */
export function TonightPlan({ mode }: { mode: ModeNow }) {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { festival } = mode;
  const { picks, schedule, route } = useFestivalPlan(festival);
  const days = route?.length ? route.map((r) => r.day) : lineupDays(festival);
  const [chosen, setChosen] = useState<string | undefined>();
  const day = (chosen && days.includes(chosen) ? chosen : undefined) ?? (mode.night && days.includes(mode.night) ? mode.night : days[0]);
  // A test shows the first night as if it were tonight.
  const tonight = day === mode.night;
  const dayRoute = route?.find((r) => r.day === day);
  const byDay = picksByDay(festival, picks);
  const nightPicks: Pick[] = (
    days.length
      ? (() => {
          const d = byDay.days.find((x) => x.day === day);
          return d ? [...d.planned, ...d.explore] : [];
        })()
      : picks.filter((p) => p.tier !== 'explore')
  ).slice(0, NIGHT_PICKS);

  return (
    <View style={styles.root}>
      <PageTitle title={t('Tonight · {festival}', { festival: festival.name })} />
      <NightSky />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: tabSpace + space.xxxl }]}>
        <Text style={styles.kicker}>{mode.preview ? (tonight ? t('Test · tonight') : t('Test · festival mode')) : tonight ? t('Tonight') : festival.name}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {day ? t(day) : festival.name}
        </Text>
        <Text style={styles.sub}>{tonight ? t('At {festival}', { festival: festival.name }) : festival.name}</Text>

        {days.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsWrap}>
            {days.map((d) => {
              const on = d === day;
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    if (on) return;
                    haptic.select();
                    setChosen(d);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={d === mode.night ? t('{day}, tonight', { day: t(d) }) : t(d)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{d === mode.night ? t('{day} · tonight', { day: t(d) }) : t(d)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {schedule && dayRoute ? (
          <>
            {tonight ? (
              <View style={styles.live}>
                <LiveNow festival={festival} schedule={schedule} route={route} />
              </View>
            ) : null}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Set to set')}</Text>
              <RouteList festival={festival} route={dayRoute} />
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{days.length ? t('Your picks for {day}', { day: dayWord(day ?? '') }) : t('Your picks')}</Text>
            <Text style={styles.note}>{t('Set times aren’t out yet. When they are, this turns into your night, set to set.')}</Text>
            {nightPicks.length ? (
              nightPicks.map((p) => (
                <ArtistRow
                  key={p.artist.id}
                  artist={p.artist}
                  affinity={p.match}
                  festivalId={festival.id}
                  detail={p.pinned ? t('You starred this one') : p.tier === 'must-see' ? t('Must see') : p.tier === 'strong' ? t('Strong match') : t('Worth a look')}
                />
              ))
            ) : (
              <Text style={styles.quiet}>{days.length ? t('No picks for {day} yet. Rate the lineup and your night fills in.', { day: dayWord(day ?? '') }) : t('No picks yet. Rate the lineup and your night fills in.')}</Text>
            )}
          </View>
        )}

        <View style={styles.actions}>
          <Action
            label={days.length ? t('Rate the night') : t('Rate the lineup')}
            onPress={() => router.push({ pathname: '/tune/[id]', params: days.length && day ? { id: festival.id, day } : { id: festival.id } })}
          />
          <Action label={t('Full lineup')} onPress={() => router.push(`/festival/${festival.id}`)} />
        </View>
        {/* Getting there: the site on the phone's maps app. */}
        {festival.place || festival.location ? (
          <View style={styles.actions}>
            <Action
              label={t('Directions')}
              a11y={t('Directions to {place}. Opens your maps app.', { place: festival.location || festival.name })}
              onPress={() => void Linking.openURL(directionsUrl({ place: festival.place, name: [festival.name, festival.location].filter(Boolean).join(', ') }, Platform.OS)).catch(() => {})}
            />
          </View>
        ) : null}
        <Text style={styles.footnote}>{t('Your plan and the lineup work without signal.')}</Text>
        <LeaveLink mode={mode} />
      </ScrollView>
    </View>
  );
}

/** Back to the full app (or the end of a test), after asking. */
export function LeaveLink({ mode }: { mode: ModeNow }) {
  const { leave } = useFestivalMode();
  const askLeave = () =>
    showAlert(mode.preview ? t('End the test?') : t('Back to the full app?'), mode.preview ? undefined : t('Festival mode comes back if you switch it on from Tonight.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: mode.preview ? t('End test') : t('Full app'),
        onPress: () => {
          haptic.select();
          leave();
        },
      },
    ]);
  return (
    <Pressable onPress={askLeave} accessibilityRole="button" accessibilityLabel={mode.preview ? t('End the festival mode test') : t('Leave festival mode for the full app')} hitSlop={8}>
      <Text style={styles.leave}>{mode.preview ? t('End the test') : t('Back to the full app')}</Text>
    </Pressable>
  );
}

export function Action({ label, onPress, a11y }: { label: string; onPress: () => void; a11y?: string }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <Text style={styles.actionText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640 },
  kicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1.4 },
  title: { ...type.largeTitle, color: color.moon, marginTop: 2 },
  sub: { ...type.body, color: color.moonDim },
  chipsWrap: { marginTop: space.lg, marginHorizontal: -space.xl },
  chips: { gap: space.sm, paddingHorizontal: space.xl },
  chip: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  chipOn: { backgroundColor: glowA(0.22), borderColor: glowA(0.6) },
  chipText: { ...type.label, color: color.moonDim },
  chipTextOn: { color: color.moon },
  live: { marginTop: space.lg },
  section: { marginTop: space.xl, gap: space.sm },
  sectionTitle: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  note: { ...type.caption, color: color.moonDim },
  quiet: { ...type.body, color: color.moonDim },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.45),
  },
  actionText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  footnote: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.lg },
  leave: { ...type.label, color: color.moonFaint, textAlign: 'center', marginTop: space.lg, textDecorationLine: 'underline' },
});
