import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { LANGUAGE, LOCALE, t, tn } from '../../i18n';
import { PARTNER_NOTE, stayDates, stayLinkOf, stayMapUrl, thingsToDoLink, townOf, type StayExtra, type StayKind, type StayTrip } from './partners';
import { StayMap } from './StayMap';

/** The map's height: Stay22 asks for at least 450; a little more shows more of the map. */
const MAP_HEIGHT = 520;

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * "Where to stay" for a festival or a show: the nights (in the day it starts,
 * out the day after it ends, or a night either side), and Stay22's live map
 * (or list) of places near the venue with prices (all, or only hotels or homes), right
 * on the page. Choosing a place opens the booking site. With a crew going, it searches for the whole
 * crew at first (bigger places), or just you. A trip of more than one night
 * also links to things to do in town. Says Afterglow may earn a commission.
 * Nothing when there's nowhere to point at.
 */
export function StayCard({ trip, name, crew }: { trip: StayTrip & { links?: { stay?: string } }; name: string; crew?: { size: number } }) {
  const [nights, setExtra] = useState<StayExtra>({});
  const [kind, setKind] = useState<StayKind>('all');
  const [view, setView] = useState<'map' | 'listview'>('map');
  const hasCrew = !!crew && crew.size > 1;
  const [forCrew, setForCrew] = useState(true);
  const extra: StayExtra = { ...nights, ...(hasCrew && forCrew ? { adults: crew.size } : {}) };
  const map = stayMapUrl(trip, { extra, kind, view, accent: color.glow, language: LANGUAGE });
  const all = stayLinkOf(trip, undefined, extra);
  const todo = thingsToDoLink(trip);
  if (!map || !all) return null;
  const d = stayDates(trip, extra);
  const place = trip.location?.split(',')[0]?.trim() || name;
  const toggle = (key: 'early' | 'late') => {
    haptic.select();
    setExtra((e) => ({ ...e, [key]: !e[key] }));
  };
  const chip = (label: string, on: boolean, onPress: () => void, a11y: string) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, on && { color: color.moon }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.kicker}>{t('Where to stay')}</Text>
        <View style={styles.views} accessibilityRole="tablist">
          {(['map', 'listview'] as const).map((v) => {
            const on = view === v;
            return (
              <Pressable
                key={v}
                onPress={() => {
                  if (on) return;
                  haptic.select();
                  setView(v);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={v === 'map' ? t('Show places to stay on a map') : t('Show places to stay as a list')}
                hitSlop={6}
                style={[styles.viewBtn, on && styles.viewOn]}
              >
                <Text style={[styles.viewText, on && { color: color.moon }]}>{v === 'map' ? t('Map') : t('List')}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text style={styles.title}>{d ? tn(d.nights, 'One night near {place}', '{n} nights near {place}', { place }) : t('Places near {place}', { place })}</Text>
      {d ? <Text style={styles.dates}>{t('Check in {in}, check out {out}', { in: day(d.checkin), out: day(d.checkout) })}</Text> : null}
      <View style={styles.chips}>
        {chip(t('All places'), kind === 'all', () => (haptic.select(), setKind('all')), t('Show all places to stay'))}
        {chip(t('Hotels'), kind === 'hotels', () => (haptic.select(), setKind('hotels')), t('Show only hotels'))}
        {chip(t('Homes'), kind === 'homes', () => (haptic.select(), setKind('homes')), t('Show only homes and rentals'))}
      </View>
      <View style={styles.chips}>
        {d ? chip(t('Arrive a day early'), !!extra.early, () => toggle('early'), t('Arrive a day early')) : null}
        {d ? chip(t('Stay a night longer'), !!extra.late, () => toggle('late'), t('Stay a night longer')) : null}
        {hasCrew ? chip(t('Your crew of {n}', { n: crew.size }), forCrew, () => (haptic.select(), setForCrew(true)), t('Places for your crew of {n}', { n: crew.size })) : null}
        {hasCrew ? chip(t('Just me'), !forCrew, () => (haptic.select(), setForCrew(false)), t('Places for just you')) : null}
      </View>
      <StayMap key={map} url={map} height={MAP_HEIGHT} label={t('Places to stay near {festival}, with prices', { festival: name })} />
      <Pressable
        onPress={() => {
          haptic.select();
          Linking.openURL(all).catch(() => {});
        }}
        accessibilityRole="link"
        accessibilityLabel={t('See all places to stay near {festival}. Opens in your browser.', { festival: name })}
        style={({ pressed }) => [styles.all, pressed && styles.pressed]}
      >
        <Text style={styles.allText}>{t('See all places to stay ↗')}</Text>
      </Pressable>
      {todo ? (
        <Pressable
          onPress={() => {
            haptic.select();
            Linking.openURL(todo).catch(() => {});
          }}
          accessibilityRole="link"
          accessibilityLabel={t('Things to do in {town} while you’re there. Opens in your browser.', { town: townOf(trip.location) })}
          style={({ pressed }) => [styles.todo, pressed && styles.pressed]}
        >
          <Text style={styles.todoTitle}>{t('Things to do in {town} ↗', { town: townOf(trip.location).split(',')[0] })}</Text>
          <Text style={styles.todoLine}>{t('Tours and day trips around your nights')}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.note}>{PARTNER_NOTE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    gap: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  views: { flexDirection: 'row', padding: 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  viewBtn: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill },
  viewOn: { backgroundColor: glowA(0.18) },
  viewText: { ...type.caption, color: color.moonDim },
  title: { ...type.headline, color: color.moon },
  dates: { ...type.label, color: color.moonDim },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipOn: { backgroundColor: glowA(0.18), borderColor: glowA(0.4) },
  chipText: { ...type.label, color: color.moonDim },
  all: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  allText: { ...type.label, color: color.moon },
  todo: { marginTop: space.sm, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, gap: 2 },
  todoTitle: { ...type.label, color: color.moon },
  todoLine: { ...type.caption, color: color.moonDim },
  note: { ...type.caption, color: color.moonFaint },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
