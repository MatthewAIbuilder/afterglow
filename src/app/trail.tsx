import { router } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { unitsFor } from '../features/festivals/near';
import { askTrailPermission } from '../features/care/trailRecorder';
import { clearTrails, writePrefs } from '../features/care/trailStore';
import { TrailMap } from '../features/care/TrailMap';
import { daysOf, distanceText, durationText, trailStats, type TrailDay, type TrailPoint } from '../features/care/trail';
import { useTrail } from '../features/care/useTrail';
import { months, t, weekdays } from '../i18n';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { color, glowA, radius, space, type } from '../theme/tokens';

const MAP_HEIGHT = 340;

const locale = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
};

/** "Friday, Nov 6". */
function dayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${weekdays()[new Date(y, m - 1, d).getDay()]}, ${months(true)[m - 1]} ${d}`;
}

/** A gentle line for the time of day: something to do for yourself. */
function careLine(hour: number): string {
  if (hour < 5 || hour >= 22) return t('Late now. Water, a seat, and getting home safe with your crew.');
  if (hour < 12) return t('Morning. Water and something to eat before it gets going.');
  if (hour < 17) return t('Sun and steps add up. Water, shade and a snack.');
  return t('Long day on your feet. Sit for a few minutes and have some water.');
}

/**
 * Your festival trail: where you walked on the festival days you went to, drawn on a map, with how far you
 * walked, your steps and a gentle check-in. Recorded by the phone only on festival days, only if you turned
 * it on, and kept only on this phone (`features/care/trail.ts`, `docs/trail.md`).
 */
export default function TrailScreen() {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const trail = useTrail();
  const ids = Object.keys(trail.trails);
  // The festival being looked at: the one recording now, else the latest.
  const latest = useMemo(() => [...ids].sort((a, b) => (trail.trails[b].at(-1)?.[0] ?? 0) - (trail.trails[a].at(-1)?.[0] ?? 0))[0], [ids, trail.trails]);
  const [pickedFestival, setPickedFestival] = useState<string | undefined>();
  const festivalId = pickedFestival && trail.trails[pickedFestival] ? pickedFestival : latest;
  const days = useMemo<TrailDay[]>(() => (festivalId ? daysOf(trail.trails[festivalId] ?? []) : []), [festivalId, trail.trails]);
  const [day, setDay] = useState<string | 'all'>('all');
  const chosen = day !== 'all' && days.some((d) => d.day === day) ? day : 'all';
  const points = useMemo<TrailPoint[]>(() => days.filter((d) => chosen === 'all' || d.day === chosen).flatMap((d) => d.points), [days, chosen]);
  const stats = useMemo(() => {
    const per = days.filter((d) => chosen === 'all' || d.day === chosen).map((d) => trailStats(d.points));
    return { meters: per.reduce((n, s) => n + s.meters, 0), spanMs: per.reduce((n, s) => n + s.spanMs, 0), movingMs: per.reduce((n, s) => n + s.movingMs, 0) };
  }, [days, chosen]);
  const miles = unitsFor(locale()) === 'mi';
  const steps = useSteps(days.filter((d) => chosen === 'all' || d.day === chosen).map((d) => d.day));
  const festivalName = festivalId ? (catalog.festival(festivalId)?.name ?? '') : '';
  const on = trail.prefs.mode === 'on';

  const turn = (next: boolean) => {
    haptic.select();
    void writePrefs({ ...trail.prefs, mode: next ? 'on' : 'off' }).then(async () => {
      if (next) await askTrailPermission();
      await trail.refresh();
    });
  };
  const erase = () => {
    haptic.select();
    showAlert(t('Delete your festival trail?'), t('This removes where you walked from this phone. It can’t be undone.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: () => void clearTrails().then(() => trail.refresh()) },
    ]);
  };

  return (
    <View style={styles.root}>
      <PageTitle title={t('Your festival trail')} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('Your festival trail')}</Text>
        <Text style={styles.sub}>{t('Where you walked on festival days. Kept only on this phone.')}</Text>

        {ids.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {ids.map((id) => (
              <Chip
                key={id}
                label={catalog.festival(id)?.name ?? id}
                on={id === festivalId}
                onPress={() => {
                  setPickedFestival(id);
                  setDay('all');
                }}
              />
            ))}
          </ScrollView>
        ) : null}

        {points.length > 1 ? (
          <>
            {festivalName ? <Text style={styles.festival}>{festivalName}</Text> : null}
            <TrailMap days={days} chosen={chosen} height={MAP_HEIGHT} />
            {days.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label={t('All days')} on={chosen === 'all'} onPress={() => setDay('all')} />
                {days.map((d) => (
                  <Chip key={d.day} label={dayLabel(d.day)} on={chosen === d.day} onPress={() => setDay(d.day)} />
                ))}
              </ScrollView>
            ) : days[0] ? (
              <Text style={styles.dayOnly}>{dayLabel(days[0].day)}</Text>
            ) : null}

            <View style={styles.stats}>
              <Stat label={t('Walked')} value={distanceText(stats.meters, miles)} />
              <Stat label={t('Time out')} value={durationText(stats.spanMs)} />
              <Stat label={t('On the move')} value={durationText(stats.movingMs)} />
              {steps.value !== undefined ? <Stat label={t('Steps')} value={steps.value.toLocaleString('en-US')} /> : null}
            </View>
            {steps.value === undefined && steps.canAsk ? (
              <Pressable onPress={() => void steps.ask()} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.link}>{t('Count my steps')}</Text>
              </Pressable>
            ) : null}

            <View style={styles.care}>
              <Text style={styles.careTitle}>{t('Check in with yourself')}</Text>
              <Text style={styles.careLine}>{careLine(new Date().getHours())}</Text>
              <Pressable
                onPress={() => {
                  haptic.select();
                  router.push('/care');
                }}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={styles.link}>{t('Open Look after yourself')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{trail.loaded ? t('No trail yet') : ''}</Text>
            <Text style={styles.emptyText}>
              {on
                ? t('It starts by itself on festival days, and draws where you walk here. Open Afterglow when you arrive.')
                : t('Turn it on and Afterglow draws where you walk on festival days: your day on a map, how far you went and your steps.')}
            </Text>
          </View>
        )}

        {Platform.OS !== 'web' ? (
          <View style={styles.setting}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>{t('Keep a trail on festival days')}</Text>
                <Text style={styles.settingSub}>
                  {trail.recording ? t('Recording today. It stops by itself when the festival is over.') : t('Only on days a festival you’re going to is on. Never any other day.')}
                </Text>
              </View>
              <Switch value={on} onValueChange={turn} trackColor={{ true: color.glow }} accessibilityLabel={t('Keep a trail on festival days')} />
            </View>
            {on && trail.permission === 'denied' ? (
              <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.warn}>{t('Location is off for Afterglow. Open Settings to allow it.')}</Text>
              </Pressable>
            ) : null}
            {on && trail.permission === 'while-open' ? (
              <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.warn}>{t('To keep recording with your phone in your pocket, set Location to Always in Settings.')}</Text>
              </Pressable>
            ) : null}
            {on && trail.permission === 'undetermined' ? (
              <Pressable onPress={() => void askTrailPermission().then(() => trail.refresh())} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.warn}>{t('Allow location so it can record.')}</Text>
              </Pressable>
            ) : null}
            <Text style={styles.privacy}>{t('Your trail never leaves this phone, and it’s deleted when you delete the app or tap Delete below.')}</Text>
            {ids.length ? (
              <Pressable onPress={erase} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.delete}>{t('Delete my trail')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Steps on the festival days shown, from the phone's motion counter (iPhone keeps the last week). */
function useSteps(days: string[]) {
  const key = days.join();
  const [state, setState] = useState<{ key: string; value?: number; canAsk: boolean }>({ key: '', canAsk: false });
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios' || !key) return;
    let live = true;
    void (async () => {
      try {
        if (!(await Pedometer.isAvailableAsync())) return live && setState({ key, canAsk: false });
        const perm = await Pedometer.getPermissionsAsync();
        if (!perm.granted) return live && setState({ key, canAsk: perm.canAskAgain });
        let total = 0;
        for (const d of key.split(',')) {
          const [y, m, dd] = d.split('-').map(Number);
          const from = new Date(y, m - 1, dd, 7);
          const to = new Date(Math.min(new Date(y, m - 1, dd + 1, 7).getTime(), Date.now()));
          total += (await Pedometer.getStepCountAsync(from, to)).steps;
        }
        if (live) setState({ key, value: total, canAsk: false });
      } catch {
        if (live) setState({ key, canAsk: false });
      }
    })();
    return () => {
      live = false;
    };
  }, [key, asked]);
  const here = state.key === key ? state : { key, canAsk: false };
  return {
    value: here.value,
    canAsk: here.canAsk,
    ask: () =>
      Pedometer.requestPermissionsAsync()
        .catch(() => undefined)
        .then(() => setAsked((n) => n + 1)),
  };
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.chipText, on && { color: color.moon }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640, gap: space.md },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim },
  festival: { ...type.headline, color: color.moon, marginTop: space.sm },
  chips: { gap: space.sm, paddingVertical: space.xs },
  chip: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  chipOn: { backgroundColor: glowA(0.22), borderColor: glowA(0.55) },
  chipText: { ...type.label, color: color.moonDim },
  dayOnly: { ...type.label, color: color.moonDim },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: { flexGrow: 1, flexBasis: '45%', padding: space.lg, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  statValue: { ...type.title, color: color.moon, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption, color: color.moonDim, marginTop: 2 },
  link: { ...type.label, color: color.glow },
  care: { padding: space.lg, borderRadius: radius.md, backgroundColor: glowA(0.1), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4), gap: space.xs },
  careTitle: { ...type.headline, color: color.moon },
  careLine: { ...type.body, color: color.moonDim },
  empty: { padding: space.xl, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, gap: space.sm },
  emptyTitle: { ...type.headline, color: color.moon },
  emptyText: { ...type.body, color: color.moonDim },
  setting: { marginTop: space.lg, padding: space.lg, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, gap: space.md },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  settingTitle: { ...type.headline, fontSize: 16, color: color.moon },
  settingSub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  warn: { ...type.label, color: '#FFB86C' },
  privacy: { ...type.caption, color: color.moonFaint },
  delete: { ...type.label, color: '#FF7E8E' },
});
