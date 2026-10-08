import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { LANGUAGE, LOCALE, t, tn } from '../../i18n';
import { PARTNER_NOTE, stayDates, stayLinkOf, stayMapUrl, type StayExtra, type StayTrip } from './partners';
import { StayMap } from './StayMap';

/** The map's height: Stay22 asks for at least 450 so its list and filters fit. */
const MAP_HEIGHT = 460;

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * "Where to stay" for a festival or a show: the nights (in the day it starts,
 * out the day after it ends, or a night either side), and Stay22's live list
 * or map of places near the venue with prices, right on the page. Choosing a
 * place opens the booking site. Says Afterglow may earn a commission.
 * Nothing when there's nowhere to point at.
 */
export function StayCard({ trip, name }: { trip: StayTrip & { links?: { stay?: string } }; name: string }) {
  const [extra, setExtra] = useState<StayExtra>({});
  const [view, setView] = useState<'listview' | 'map'>('listview');
  const map = stayMapUrl(trip, { extra, view, accent: color.glow, language: LANGUAGE });
  const all = stayLinkOf(trip, undefined, extra);
  if (!map || !all) return null;
  const d = stayDates(trip, extra);
  const place = trip.location?.split(',')[0]?.trim() || name;
  const toggle = (key: keyof StayExtra) => {
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
      <Text style={styles.kicker}>{t('Where to stay')}</Text>
      <Text style={styles.title}>{d ? tn(d.nights, 'One night near {place}', '{n} nights near {place}', { place }) : t('Places near {place}', { place })}</Text>
      {d ? <Text style={styles.dates}>{t('Check in {in}, check out {out}', { in: day(d.checkin), out: day(d.checkout) })}</Text> : null}
      <View style={styles.chips}>
        {chip(t('List'), view === 'listview', () => (haptic.select(), setView('listview')), t('Show places to stay as a list'))}
        {chip(t('Map'), view === 'map', () => (haptic.select(), setView('map')), t('Show places to stay on a map'))}
        {d ? chip(t('Arrive a day early'), !!extra.early, () => toggle('early'), t('Arrive a day early')) : null}
        {d ? chip(t('Stay a night longer'), !!extra.late, () => toggle('late'), t('Stay a night longer')) : null}
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
  kicker: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { ...type.headline, color: color.moon },
  dates: { ...type.label, color: color.moonDim },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.xs },
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
  note: { ...type.caption, color: color.moonFaint },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
