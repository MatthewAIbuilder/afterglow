import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, type LatLng, Marker, Polyline } from 'react-native-maps';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { NEAR_KM } from '../festivals/near';
import type { Point } from '../festivals/near';
import { haptic } from '../../lib/haptics';
import { revealSecret } from '../../state/secrets';
import { color, radius, space, type, raisedA } from '../../theme/tokens';
import {
  type Cluster,
  type MapPoint,
  type Marker as FestivalMarker,
  type Region,
  DEFAULT_BOX,
  NAMES_DELTA,
  SINGLE_DELTA,
  STREET_DELTA,
  boxAround,
  clusterMarkers,
  project,
  pxPerUnit,
  regionOf,
  unproject,
} from './map';
import { SPREAD_ZOOM, sameSpot, spreadMarkers } from './explore';
import { NIGHT_STYLE } from './mapStyle';
import { HERE_COLOR, SHOW_COLOR, TONE_COLOR } from './tones';
import { type ShowPin, showPinLabel } from './tour';
import { t } from '../../i18n';
import { datesLine } from '../festivals/format';

/** Lights closer than this many pixels share one. */
const CLUSTER_PX = 30;
/** How long a glide takes. */
const GLIDE_MS = 480;

const toLatLng = (m: MapPoint): LatLng => {
  const p = unproject(m);
  return { latitude: p.lat, longitude: p.lon };
};
const pointLatLng = (p: Point): LatLng => ({ latitude: p.lat, longitude: p.lon });

/**
 * The festival map on phones: Apple Maps (iPhone) or Google Maps (Android)
 * in a dark, quiet night style, with every festival glowing where it
 * happens. The map moves and zooms natively, down to the streets around a
 * venue. Lights that sit close together share one with a count, and split
 * as you zoom in. The website draws its own map of dots (FestivalMap.web.tsx).
 * `area` is the part of the screen left clear of the header and the cards.
 */
export function FestivalMap({
  markers,
  shows,
  selected,
  onSelect,
  here,
  width,
  area,
  journey,
  frameKey,
  toHere,
  onView,
  testID,
}: {
  markers: readonly FestivalMarker[];
  /** An artist's club shows on their tour: smaller lights, under the festivals'. */
  shows?: readonly ShowPin[];
  /** The chosen festival's or show's id. */
  selected?: string;
  onSelect: (id: string) => void;
  here?: Point;
  width: number;
  height: number;
  area: { top: number; bottom: number };
  /** Your festivals in date order: a glowing line between them. */
  journey?: readonly MapPoint[];
  /** The map frames its festivals again only when this changes. */
  frameKey: string;
  /** Bump to glide to where you are. */
  toHere?: number;
  /** The part of the map in view after you move it by hand; undefined when it frames everything again. */
  onView?: (region: Region | undefined) => void;
  testID?: string;
}) {
  const reduced = useReducedMotion();
  // Festivals and shows on the map.
  const lit = markers.length + (shows?.length ?? 0);
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const points = useMemo(() => [...markers.map((m) => m.at), ...(shows ?? []).map((p) => p.at), ...(here ? [project(here)] : [])], [markers, shows, here]);
  const [first] = useState(() => regionOf(boxAround(points)));
  const [region, setRegion] = useState<Region>(first);
  // Moved by hand since it was last framed: offer to show everything again.
  const [moved, setMoved] = useState(false);
  const duration = reduced ? 0 : GLIDE_MS;
  // Touched since the last move settled: the move was yours, so the cards follow what's in view.
  // The map's own moves (framing, gliding to a festival or to you) clear it.
  const touched = useRef(false);

  const frameAll = useCallback(
    (animated: boolean) => {
      const m = map.current;
      if (!m) return;
      touched.current = false;
      if (points.length > 1) {
        m.fitToCoordinates(points.map(toLatLng), { edgePadding: { top: 36, right: 56, bottom: 36, left: 56 }, animated });
      } else {
        const r = points.length ? { ...toLatLng(points[0]), latitudeDelta: SINGLE_DELTA, longitudeDelta: SINGLE_DELTA } : regionOf(DEFAULT_BOX);
        m.animateToRegion(r, animated ? duration : 0);
      }
      setMoved(false);
      onView?.(undefined);
    },
    [points, duration, onView],
  );

  // Framed once per `frameKey` (a filter, a tour): a place looked up later never yanks the map back,
  // but a map framed from nothing frames again once there's something to show.
  const framed = useRef<{ key?: string; from: number }>({ from: 0 });
  useEffect(() => {
    if (!ready) return;
    const f = framed.current;
    if (f.key === frameKey && !(f.from === 0 && points.length > 0)) return;
    const firstTime = f.key === undefined;
    framed.current = { key: frameKey, from: points.length };
    frameAll(!firstTime);
  }, [ready, frameKey, points, frameAll]);

  // Glide to the chosen festival, keeping the zoom.
  const lastGlide = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!ready || !selected || selected === lastGlide.current) return;
    lastGlide.current = selected;
    const at = markers.find((k) => k.festival.id === selected)?.at ?? shows?.find((p) => p.show.id === selected)?.at;
    if (!at) return;
    touched.current = false;
    map.current?.animateCamera({ center: toLatLng(at) }, { duration });
  }, [ready, selected, markers, shows, duration]);

  // "Show me": glide to where you are, only when asked.
  const answered = useRef(0);
  useEffect(() => {
    if (!ready || !toHere || !here || answered.current === toHere) return;
    answered.current = toHere;
    touched.current = false;
    const span = Math.min(region.longitudeDelta, 10);
    map.current?.animateToRegion({ ...pointLatLng(here), latitudeDelta: span * 0.8, longitudeDelta: span }, duration);
  }, [ready, toHere, here, region.longitudeDelta, duration]);

  const street = useRef(false);
  const onRegion = useCallback((r: Region) => {
    if (touched.current) {
      touched.current = false;
      onView?.(r);
    }
    // A secret: all the way down to the streets (once each time you get there).
    const atStreet = r.longitudeDelta < STREET_DELTA;
    if (atStreet && !street.current) revealSecret('edge');
    street.current = atStreet;
    setRegion(r);
  }, [onView]);

  // Lights cluster by zoom, in steps, so small moves don't shuffle them.
  const scale = pxPerUnit(region, width);
  const step = 2 ** (Math.round(Math.log2(scale) * 2) / 2);
  // Festivals sharing a spot fan out once you're zoomed in to a city, each its own light.
  const spread = useMemo(() => spreadMarkers(markers, region, step), [markers, region, step]);
  const clusters = useMemo(() => clusterMarkers(spread, step, CLUSTER_PX), [spread, step]);
  const fanned = useMemo(() => spread.filter((m, i) => m.at !== markers[i]?.at), [spread, markers]);
  const allNamed = region.longitudeDelta < NAMES_DELTA;
  const trail = useMemo(() => (journey && journey.length > 1 ? journey.map(toLatLng) : undefined), [journey]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View
        style={StyleSheet.absoluteFill}
        testID={testID}
        onTouchStart={() => {
          touched.current = true;
          if (!moved) setMoved(true);
        }}
      >
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={first}
          userInterfaceStyle="dark"
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          customMapStyle={NIGHT_STYLE}
          mapPadding={{ top: area.top, right: 0, bottom: area.bottom, left: 0 }}
          showsPointsOfInterests={false}
          showsBuildings={false}
          showsTraffic={false}
          showsIndoors={false}
          showsCompass={false}
          toolbarEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          moveOnMarkerPress={false}
          onMapReady={() => setReady(true)}
          onRegionChangeComplete={onRegion}
        >
          {/* How far Near you reaches, around you. */}
          {here ? (
            <Circle center={pointLatLng(here)} radius={NEAR_KM * 1000} strokeColor="rgba(111,195,255,0.5)" strokeWidth={1.2} fillColor="rgba(111,195,255,0.05)" lineDashPattern={[6, 6]} />
          ) : null}
          {trail ? (
            <>
              <Polyline coordinates={trail} geodesic strokeColor="rgba(255,154,213,0.28)" strokeWidth={8} lineCap="round" />
              <Polyline coordinates={trail} geodesic strokeColor="#FF9AD5" strokeWidth={2} lineCap="round" />
            </>
          ) : null}
          {/* A fanned-out light keeps a thread back to the real spot. */}
          {fanned.map((m) => (
            <Polyline key={`thread-${m.festival.id}`} coordinates={[pointLatLng(m.point), toLatLng(m.at)]} strokeColor="rgba(243,240,255,0.22)" strokeWidth={1} />
          ))}
          {here ? (
            <Marker coordinate={pointLatLng(here)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={1}>
              <HereDot reduced={reduced} />
            </Marker>
          ) : null}
          {/* An artist's club shows: small lights, under the festivals'. */}
          {(shows ?? []).map((p) => (
            <ShowLight
              key={p.show.id}
              pin={p}
              chosen={p.show.id === selected}
              onPress={() => {
                haptic.select();
                lastGlide.current = p.show.id;
                onSelect(p.show.id);
                map.current?.animateCamera({ center: toLatLng(p.at) }, { duration });
              }}
            />
          ))}
          {clusters.map((c) => (
            <Light
              key={c.lead.festival.id}
              cluster={c}
              chosen={c.members.some((m) => m.festival.id === selected)}
              named={allNamed || c.lead.tone === 'going'}
              reduced={reduced}
              onPress={() => {
                haptic.select();
                lastGlide.current = c.lead.festival.id;
                onSelect(c.lead.festival.id);
                const at = toLatLng(c.at);
                // A cluster opens up: festivals at one spot fan out; others are framed until they split.
                if (c.members.length > 1 && sameSpot(c.members)) {
                  const spot = pointLatLng(c.members[0].point);
                  map.current?.animateToRegion({ ...spot, latitudeDelta: SPREAD_ZOOM * 0.8, longitudeDelta: SPREAD_ZOOM }, duration);
                } else if (c.members.length > 1) {
                  map.current?.fitToCoordinates(
                    c.members.map((m) => pointLatLng(m.point)),
                    { edgePadding: { top: 80, right: 80, bottom: 80, left: 80 }, animated: !reduced },
                  );
                } else map.current?.animateCamera({ center: at }, { duration });
              }}
            />
          ))}
        </MapView>
      </View>
      {moved && lit ? (
        <View style={[styles.again, { top: area.top + space.sm }]} pointerEvents="box-none">
          <Pressable
            onPress={() => {
              haptic.soft();
              frameAll(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={lit > 1 ? t('Show all these festivals again') : t('Back to the festival')}
            style={({ pressed }) => [styles.againPill, pressed && { opacity: 0.8 }]}
          >
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.againText}>{lit > 1 ? t('Show all') : t('Back to it')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Size of the area a light is drawn in: the light on top, its name under it. */
const LIGHT = 44;
const BOX_W = 150;
const BOX_H = LIGHT + 34;

/**
 * Redraws a marker's picture for a moment after it changes, then stops
 * (Google Maps draws markers as pictures; keeping them live costs frames).
 */
function useTracking(key: string) {
  const [seen, setSeen] = useState(key);
  const [track, setTrack] = useState(true);
  if (seen !== key) {
    setSeen(key);
    setTrack(true);
  }
  useEffect(() => {
    if (!track) return;
    const t = setTimeout(() => setTrack(false), 700);
    return () => clearTimeout(t);
  }, [track, key]);
  return track;
}

/** A festival's light: a glowing core in its colour, a halo, a ring when chosen, a slow pulse when you're going. */
function Light({ cluster, chosen, named, reduced, onPress }: { cluster: Cluster; chosen: boolean; named: boolean; reduced: boolean; onPress: () => void }) {
  const { lead, members } = cluster;
  const tone = lead.tone;
  const tint = TONE_COLOR[tone];
  const core = tone === 'going' ? 13 : tone === 'love' ? 10 + Math.min(4, lead.loved) : tone === 'more' ? 8 : 6;
  const showName = named || chosen;
  const track = useTracking(`${chosen}|${showName}|${members.length}`);
  // The pulse lives on iPhone, where markers are real views (Google Maps draws them as still pictures).
  const pulses = tone === 'going' && !reduced && Platform.OS === 'ios';
  const what = tone === 'going' ? t('You’re going.') : tone === 'over' ? t('It’s over.') : lead.loved ? t('{n} you’d love.', { n: lead.loved }) : '';
  const label = `${members.length > 1 ? t('{festival} and {n} more here.', { festival: lead.festival.name, n: members.length - 1 }) : t('{festival}, {dates}, {place}.', { festival: lead.festival.name, dates: datesLine(lead.festival), place: lead.festival.location })} ${what}`;
  return (
    <Marker
      coordinate={toLatLng(cluster.at)}
      anchor={{ x: 0.5, y: LIGHT / 2 / (showName ? BOX_H : LIGHT) }}
      onPress={onPress}
      tracksViewChanges={track}
      zIndex={chosen ? 100 : tone === 'going' ? 30 : tone === 'love' ? 20 : 10}
    >
      <View
        style={showName ? styles.box : styles.lightHit}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label.trim()}
        accessibilityState={{ selected: chosen }}
        testID={`map-light-${lead.festival.id}`}
        collapsable={false}
      >
        <View style={styles.lightHit}>
          {tone !== 'over' ? <View style={[styles.halo, { backgroundColor: tint, width: core * 3, height: core * 3, borderRadius: core * 1.5 }]} /> : null}
          {pulses ? <Pulse tint={tint} /> : tone === 'going' ? <View style={[styles.pulse, { borderColor: tint, opacity: 0.45 }]} /> : null}
          {chosen ? <View style={[styles.ring, { borderColor: tint }]} /> : null}
          <View style={[styles.core, { width: core, height: core, borderRadius: core / 2, backgroundColor: tint, shadowColor: tint }]} />
          {members.length > 1 ? (
            <View style={[styles.count, { borderColor: tint }]}>
              <Text style={styles.countText}>{members.length}</Text>
            </View>
          ) : null}
        </View>
        {showName ? (
          <Text numberOfLines={2} style={[styles.name, chosen && styles.nameChosen]}>
            {lead.festival.name}
          </Text>
        ) : null}
      </View>
    </Marker>
  );
}

/** A club show on an artist's tour: a small hollow light, quieter than a festival's, a ring when chosen. */
function ShowLight({ pin, chosen, onPress }: { pin: ShowPin; chosen: boolean; onPress: () => void }) {
  const track = useTracking(String(chosen));
  return (
    <Marker coordinate={toLatLng(pin.at)} anchor={{ x: 0.5, y: 0.5 }} onPress={onPress} tracksViewChanges={track} zIndex={chosen ? 100 : 5}>
      <View
        style={styles.lightHit}
        accessible
        accessibilityRole="button"
        accessibilityLabel={showPinLabel(pin.show)}
        accessibilityState={{ selected: chosen }}
        testID={`map-show-${pin.show.id}`}
        collapsable={false}
      >
        {chosen ? <View style={[styles.showRing, { borderColor: SHOW_COLOR }]} /> : null}
        <View style={[styles.showDot, { borderColor: SHOW_COLOR, shadowColor: SHOW_COLOR }]} />
      </View>
    </Marker>
  );
}

function Pulse({ tint }: { tint: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false));
  }, [p]);
  const style = useAnimatedStyle(() => ({ opacity: (1 - p.get()) * 0.7, transform: [{ scale: 0.6 + p.get() * 1.3 }] }));
  return <Animated.View style={[styles.pulse, { borderColor: tint }, style]} />;
}

/** Where you are, when Near you is on: a cool blue dot. */
function HereDot({ reduced }: { reduced: boolean }) {
  return (
    <View style={styles.lightHit} accessible accessibilityLabel={t('You are here, roughly')} collapsable={false}>
      {reduced || Platform.OS !== 'ios' ? <View style={[styles.pulse, { borderColor: HERE_COLOR, opacity: 0.4 }]} /> : <Pulse tint={HERE_COLOR} />}
      <View style={styles.here} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: BOX_W, height: BOX_H, alignItems: 'center' },
  lightHit: { width: LIGHT, height: LIGHT, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', opacity: 0.22 },
  core: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)', shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  ring: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  showDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, backgroundColor: color.night, shadowOpacity: 0.8, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  showRing: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  pulse: { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 1.5 },
  count: {
    position: 'absolute',
    top: 3,
    right: 1,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: color.night,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { ...type.caption, fontSize: 10, lineHeight: 12, color: color.moon, fontWeight: '700' },
  name: {
    ...type.caption,
    marginTop: -6,
    textAlign: 'center',
    color: color.moon,
    textShadowColor: color.night,
    textShadowRadius: 5,
  },
  nameChosen: { fontWeight: '700' },
  here: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: HERE_COLOR,
    borderWidth: 2,
    borderColor: color.moon,
    shadowColor: HERE_COLOR,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  again: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  againPill: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: raisedA(0.5),
  },
  againText: { ...type.label, color: color.moon },
});
