import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { Festival } from '../../data/types';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCrewLive } from '../../state/crewLive';
import { useSocial } from '../../state/social';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { distanceText } from '../care/trail';
import { unitsFor } from '../festivals/near';
import { formatTime } from '../festivals/format';
import { mapsLink } from '../care/spots';
import type { Crew } from '../social/models';
import { CrewMapView } from './CrewMapView';
import { crewmatesNear, type MapPerson, shareUntil } from './live';
import { t, tn, weekdays } from '../../i18n';

const locale = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Crew on the map, on the crew's page while its festival is on: your own
 * switch to share where you are (only with this crew, only until the
 * morning after the festival, then it switches itself off), and everyone
 * sharing as dots on a map (phones) and a list with how far and which way.
 */
export function CrewMapCard({ crew, festival, nameOf }: { crew: Crew; festival: Festival; nameOf: (uid: string) => string }) {
  const now = useNow(30_000);
  const social = useSocial();
  const me = social.user?.uid;
  const { others, sharingUntil, start, stop } = useCrewLive(crew.id);
  const until = shareUntil(festival, now);
  const [here, setHere] = useState<{ lat: number; lon: number } | undefined>();
  const sharing = !!sharingUntil && sharingUntil > now.getTime();
  const miles = unitsFor(locale()) === 'mi';

  // Where you are, for distances, while this is open and you've allowed location.
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    let live = true;
    void (async () => {
      try {
        if (!(await Location.getForegroundPermissionsAsync()).granted || !live) return;
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 10 }, (p) => live && setHere({ lat: p.coords.latitude, lon: p.coords.longitude }));
        if (!live) sub.remove();
      } catch {
        // No location: the list still shows who's sharing.
      }
    })();
    return () => {
      live = false;
      sub?.remove();
    };
  }, [sharing]);

  const mates = useMemo(() => crewmatesNear(others, me, here, now.getTime()), [others, me, here, now]);
  const people = useMemo<MapPerson[]>(
    () => [...mates.map((m) => ({ uid: m.uid, initials: initials(nameOf(m.uid)), lat: m.lat, lon: m.lon, stale: m.stale })), ...(here && sharing && me ? [{ uid: me, initials: t('You').slice(0, 2), lat: here.lat, lon: here.lon, stale: false, me: true }] : [])],
    [mates, here, sharing, me, nameOf],
  );
  if (!until && !mates.length) return null;

  const endText = (() => {
    const end = new Date(sharingUntil ?? until ?? 0);
    return t('until {day} {time}', { day: weekdays()[end.getDay()], time: formatTime(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`) });
  })();

  const toggle = async (on: boolean) => {
    haptic.select();
    if (!on) return void stop();
    if (!until) return;
    const ok = await start(until);
    if (!ok)
      showAlert(t('Location is off for Afterglow'), t('Allow location to share where you are with your crew.'), [
        { text: t('Not now'), style: 'cancel' },
        ...(Platform.OS !== 'web' ? [{ text: t('Open Settings'), onPress: () => void Linking.openSettings() }] : []),
      ]);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('Crew on the map')}</Text>
      {until ? (
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{t('Share where I am with {crew}', { crew: crew.name })}</Text>
            <Text style={styles.sub}>{sharing ? t('On {until}. Only your crew sees it, and it switches itself off.', { until: endText }) : t('Only this crew, only while the festival is on. It switches itself off.')}</Text>
          </View>
          <Switch value={sharing} onValueChange={(v) => void toggle(v)} trackColor={{ true: color.glow }} accessibilityLabel={t('Share where I am with {crew}', { crew: crew.name })} />
        </View>
      ) : null}
      {people.length ? <CrewMapView people={people} height={240} /> : null}
      {mates.length ? (
        mates.map((m) => (
          <View key={m.uid} style={styles.row} accessible accessibilityLabel={`${nameOf(m.uid)}: ${m.meters !== undefined ? t('{distance} away, {direction}', { distance: distanceText(m.meters, miles), direction: m.direction ?? '' }) : t('sharing where they are')}. ${m.agoMin < 1 ? t('Just now') : tn(m.agoMin, '{n} min ago', '{n} min ago')}`}>
            <View style={[styles.face, m.stale && { opacity: 0.5 }]}>
              <Text style={styles.faceText}>{initials(nameOf(m.uid))}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{nameOf(m.uid)}</Text>
              <Text style={styles.where}>
                {m.meters !== undefined ? t('{distance} · {n} min walk, {direction}', { distance: distanceText(m.meters, miles), n: m.minutes ?? 1, direction: m.direction ?? '' }) : t('Sharing where they are')}
                {' · '}
                {m.agoMin < 1 ? t('Just now') : tn(m.agoMin, '{n} min ago', '{n} min ago')}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                haptic.select();
                void Linking.openURL(mapsLink(m, Platform.OS === 'ios')).catch(() => {});
              }}
              accessibilityRole="link"
              accessibilityLabel={t('Walking directions to {name} in Maps', { name: nameOf(m.uid) })}
              hitSlop={8}
            >
              <Text style={styles.link}>{t('Directions')}</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={styles.sub}>{t('Nobody in the crew is sharing where they are yet.')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.lg,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  title: { ...type.headline, color: color.moon },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  label: { ...type.label, color: color.moon },
  sub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  face: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: glowA(0.3) },
  faceText: { ...type.caption, color: color.moon, fontWeight: '700' },
  name: { ...type.label, color: color.moon },
  where: { ...type.caption, color: color.moonDim, marginTop: 1 },
  link: { ...type.label, color: color.glow },
});
