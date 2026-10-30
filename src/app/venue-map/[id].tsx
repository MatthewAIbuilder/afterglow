import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { PageFeedback } from '../../components/PageFeedback';
import { PageTitle } from '../../components/PageTitle';
import { distanceText } from '../../features/care/trail';
import { readTrails } from '../../features/care/trailStore';
import { formatTime } from '../../features/festivals/format';
import { unitsFor } from '../../features/festivals/near';
import { festivalNight } from '../../features/plan/live';
import { fitOf, metersOnMap, onMap, type Pin, PIN_KINDS, PIN_LABEL, type PinKind, stageNow, toPixel, walkMinutes } from '../../features/venueMap/venueMap';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useVenueMap } from '../../state/venueMaps';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';

const locale = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
};

const KIND_COLOR: Record<PinKind, string> = {
  stage: '#B48CFF',
  water: '#5FC8FF',
  medical: '#FF6B7A',
  toilets: '#9AA3B5',
  entrance: '#7CE3A2',
  food: '#FFB25F',
  lockers: '#C9C2A6',
  charging: '#FFE066',
  info: '#E6E1FF',
  camp: '#8FD48A',
};

/**
 * A festival's own map (`/venue-map/<festival id>`), when HQ has made one:
 * the official picture with its markers, your blue dot when you're there,
 * today's trail, and what's on at each stage. Pinch to zoom on iPhone. Kept
 * on the phone, so it opens with no signal.
 */
export default function VenueMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const catalog = useCatalog();
  const festival = catalog.festival(id);
  const map = useVenueMap(id);
  const fit = useMemo(() => (map ? fitOf(map.anchors) : undefined), [map]);
  const now = useNow(30_000);
  const night = festival ? festivalNight(festival, now) : undefined;
  const miles = unitsFor(locale()) === 'mi';
  const [hidden, setHidden] = useState<Set<PinKind>>(() => new Set());
  const [picked, setPicked] = useState<Pin | undefined>();
  const [here, setHere] = useState<{ lat: number; lon: number } | undefined>();
  const [trail, setTrail] = useState<{ lat: number; lon: number }[]>([]);

  // Where you are, if you've allowed location.
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    let live = true;
    void (async () => {
      try {
        if (!(await Location.getForegroundPermissionsAsync()).granted || !live) return;
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 }, (p) => live && setHere({ lat: p.coords.latitude, lon: p.coords.longitude }));
        if (!live) sub.remove();
      } catch {
        // No location: the map still shows.
      }
    })();
    return () => {
      live = false;
      sub?.remove();
    };
  }, []);

  // Today's trail at this festival, when you keep one.
  useEffect(() => {
    let live = true;
    void readTrails().then((all) => {
      const today = new Date().toDateString();
      const points = (all[id] ?? []).filter((p) => new Date(p[0]).toDateString() === today).map((p) => ({ lat: p[1], lon: p[2] }));
      if (live) setTrail(points);
    });
    return () => {
      live = false;
    };
  }, [id]);

  const shownW = Math.min(width - space.lg * 2, 900);
  const scale = map ? shownW / map.width : 1;
  const shownH = map ? map.height * scale : 0;
  const you = fit && here ? toPixel(fit, here.lat, here.lon) : undefined;
  const youOn = !!(map && you && onMap(map, you));
  const trailPx = fit ? trail.map((p) => toPixel(fit, p.lat, p.lon)) : [];
  const kinds = map ? PIN_KINDS.filter((k) => map.pins.some((p) => p.kind === k)) : [];
  const toggle = (k: PinKind) => {
    haptic.select();
    setHidden((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  if (!festival) return null;
  return (
    <View style={styles.root}>
      <PageTitle title={t('Map · {festival}', { festival: festival.name })} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('Festival map')}</Text>
        <Text style={styles.sub}>{festival.name}</Text>
        {map === undefined ? null : !map ? (
          <Text style={styles.sub}>{t('There’s no map for this festival on Afterglow yet.')}</Text>
        ) : (
          <>
            {kinds.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {kinds.map((k) => (
                  <Pressable key={k} onPress={() => toggle(k)} accessibilityRole="button" accessibilityState={{ selected: !hidden.has(k) }} style={[styles.chip, !hidden.has(k) && { borderColor: KIND_COLOR[k] }]}>
                    <View style={[styles.chipDot, { backgroundColor: KIND_COLOR[k] }, hidden.has(k) && { opacity: 0.3 }]} />
                    <Text style={[styles.chipText, !hidden.has(k) && { color: color.moon }]}>{PIN_LABEL[k]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <ScrollView style={{ width: shownW, height: shownH }} maximumZoomScale={4} minimumZoomScale={1} bouncesZoom centerContent showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
              <View style={{ width: shownW, height: shownH }}>
                <Image source={{ uri: map.image }} style={StyleSheet.absoluteFill} contentFit="fill" accessibilityLabel={t('The {festival} map', { festival: festival.name })} cachePolicy="disk" />
                {trailPx.length > 1 ? (
                  <Svg style={StyleSheet.absoluteFill} width={shownW} height={shownH} pointerEvents="none">
                    <Polyline points={trailPx.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')} fill="none" stroke={color.glow} strokeWidth={3} strokeOpacity={0.85} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                ) : null}
                {map.pins
                  .filter((p) => !hidden.has(p.kind))
                  .map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        haptic.select();
                        setPicked(p);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.label || PIN_LABEL[p.kind]}, ${PIN_LABEL[p.kind]}`}
                      hitSlop={10}
                      style={[styles.pin, { left: p.x * scale - 9, top: p.y * scale - 9, backgroundColor: KIND_COLOR[p.kind] }, picked?.id === p.id && styles.pinOn]}
                    />
                  ))}
                {youOn && you ? <View style={[styles.you, { left: you.x * scale - 8, top: you.y * scale - 8 }]} accessibilityLabel={t('You are here')} /> : null}
              </View>
            </ScrollView>
            {here && !youOn ? <Text style={styles.note}>{t('You’re not on the festival grounds right now.')}</Text> : null}
            {picked ? <PinCard pin={picked} festivalId={festival.id} miles={miles} walkFromYou={fit && youOn && you ? walkMinutes(metersOnMap(fit, you, picked)) : undefined} meters={fit && youOn && you ? metersOnMap(fit, you, picked) : undefined} night={night} /> : <Text style={styles.note}>{t('Tap a marker for what it is, and what’s on at a stage.')}</Text>}
          </>
        )}
        <PageFeedback />
      </ScrollView>
    </View>
  );
}

function PinCard({ pin, festivalId, walkFromYou, meters, miles, night }: { pin: Pin; festivalId: string; walkFromYou?: number; meters?: number; miles: boolean; night?: { day: string; minute: number } }) {
  const catalog = useCatalog();
  const festival = catalog.festival(festivalId);
  const at = pin.kind === 'stage' && pin.stageId && festival ? stageNow(festival, pin.stageId, night) : {};
  const name = (aid: string) => catalog.artist(aid)?.name ?? aid;
  return (
    <View style={styles.card} accessible accessibilityLiveRegion="polite">
      <Text style={styles.cardKind}>{PIN_LABEL[pin.kind]}</Text>
      <Text style={styles.cardTitle}>{pin.label || PIN_LABEL[pin.kind]}</Text>
      {meters !== undefined && walkFromYou !== undefined ? <Text style={styles.cardLine}>{t('{distance} · {n} min walk', { distance: distanceText(meters, miles), n: walkFromYou })}</Text> : null}
      {at.now ? <Text style={styles.cardLine}>{t('On now: {artist}, until {time}', { artist: name(at.now.artistId), time: formatTime(at.now.end) })}</Text> : null}
      {at.next ? <Text style={styles.cardQuiet}>{t('Next: {artist} at {time}', { artist: name(at.next.artistId), time: formatTime(at.next.start) })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.lg, alignItems: 'center', gap: space.md },
  title: { ...type.largeTitle, color: color.moon, alignSelf: 'stretch' },
  sub: { ...type.body, color: color.moonDim, alignSelf: 'stretch' },
  chips: { gap: space.sm, paddingVertical: space.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.glass },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { ...type.caption, color: color.moonDim },
  pin: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#0B0A14' },
  pinOn: { transform: [{ scale: 1.4 }], borderColor: '#FFFFFF' },
  you: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#3E8BFF', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#3E8BFF', shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  note: { ...type.caption, color: color.moonDim, alignSelf: 'stretch' },
  card: { alignSelf: 'stretch', padding: space.lg, gap: 4, borderRadius: radius.md, backgroundColor: glowA(0.1), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4) },
  cardKind: { ...type.caption, color: color.glow },
  cardTitle: { ...type.headline, color: color.moon },
  cardLine: { ...type.body, color: color.moon },
  cardQuiet: { ...type.caption, color: color.moonDim },
});
