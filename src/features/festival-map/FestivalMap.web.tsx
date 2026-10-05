import './leaflet.css';
import L from 'leaflet';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { NEAR_KM, type Point } from '../festivals/near';
import { haptic } from '../../lib/haptics';
import { revealSecret } from '../../state/secrets';
import { color, radius, space, type } from '../../theme/tokens';
import { SPREAD_ZOOM, sameSpot, spreadMarkers } from './explore';
import {
  type Cluster,
  type MapPoint,
  type Marker as FestivalMarker,
  type Region,
  NAMES_DELTA,
  SINGLE_DELTA,
  STREET_DELTA,
  clusterMarkers,
  pxPerUnit,
  unproject,
} from './map';
import { HERE_COLOR, TONE_COLOR } from './tones';

export { TONE_COLOR };

/** Lights closer than this many pixels share one. */
const CLUSTER_PX = 30;
/** A dark street map with every road and town, free to use with credit (CARTO, from OpenStreetMap). */
const TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const latLngOf = (m: MapPoint): L.LatLngTuple => {
  const p = unproject(m);
  return [p.lat, p.lon];
};
const pointLatLng = (p: Point): L.LatLngTuple => [p.lat, p.lon];
/** The zoom level that shows this many degrees across `width` pixels. */
const zoomFor = (degrees: number, width: number) => Math.log2((width * 360) / (256 * degrees));

/**
 * The festival map on the website: a real dark street map (Leaflet, tiles
 * from CARTO and OpenStreetMap) that drags, wheels and pinches down to the
 * streets, with every festival glowing where it happens. Same props and
 * behaviour as the phone map (FestivalMap.tsx): lights cluster with a count
 * and split as you zoom, festivals sharing a spot fan out, the cards follow
 * what's in view.
 */
export function FestivalMap({
  markers,
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
  selected?: string;
  onSelect: (festivalId: string) => void;
  here?: Point;
  width: number;
  height: number;
  area: { top: number; bottom: number };
  journey?: readonly MapPoint[];
  frameKey: string;
  toHere?: number;
  onView?: (region: Region | undefined) => void;
  testID?: string;
}) {
  const reduced = useReducedMotion();
  const host = useRef<View>(null);
  const map = useRef<L.Map | null>(null);
  const [region, setRegion] = useState<Region | undefined>();
  // Bumped on every move so the lights follow the map.
  const [, setTick] = useState(0);
  const [moved, setMoved] = useState(false);
  const touched = useRef(false);
  const onViewRef = useRef(onView);
  useEffect(() => {
    onViewRef.current = onView;
  }, [onView]);

  // The map itself, made once.
  useEffect(() => {
    const el = host.current as unknown as HTMLDivElement | null;
    if (!el) return;
    // No zoom animation: the lights are drawn over the map and would lag behind a scaling map, then jump.
    const m = L.map(el, { zoomControl: false, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 18, zoomSnap: 0.25, wheelPxPerZoomLevel: 90, zoomAnimation: false });
    L.tileLayer(TILES, { attribution: CREDIT, subdomains: 'abcd', maxZoom: 19, detectRetina: true }).addTo(m);
    m.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    m.setView([30, -95], 4);
    const read = () => {
      const b = m.getBounds();
      const c = b.getCenter();
      const r = { latitude: c.lat, longitude: c.lng, latitudeDelta: b.getNorth() - b.getSouth(), longitudeDelta: b.getEast() - b.getWest() };
      setRegion(r);
      return r;
    };
    m.on('move zoom', () => setTick((n) => n + 1));
    m.on('moveend', () => {
      const r = read();
      // A secret: all the way down to the streets.
      if (r.longitudeDelta < STREET_DELTA) revealSecret('edge');
      if (touched.current) {
        touched.current = false;
        onViewRef.current?.(r);
      }
    });
    const mine = () => {
      touched.current = true;
      setMoved(true);
    };
    el.addEventListener('pointerdown', mine);
    el.addEventListener('wheel', mine, { passive: true });
    map.current = m;
    read();
    return () => {
      el.removeEventListener('pointerdown', mine);
      el.removeEventListener('wheel', mine);
      m.remove();
      map.current = null;
    };
  }, []);

  // Keep the map filling its box, with its credit line above the cards.
  useEffect(() => {
    map.current?.invalidateSize();
  }, [width]);
  useEffect(() => {
    const corner = map.current?.getContainer().querySelector<HTMLElement>('.leaflet-bottom.leaflet-right');
    if (corner) corner.style.bottom = `${area.bottom}px`;
  }, [area.bottom]);

  const points = useMemo(() => [...markers.map((m) => m.point), ...(here ? [here] : [])], [markers, here]);
  const frameAll = useCallback(
    (animated: boolean) => {
      const m = map.current;
      if (!m) return;
      const pad = { paddingTopLeft: [56, area.top + 24] as L.PointTuple, paddingBottomRight: [56, area.bottom + 24] as L.PointTuple, animate: animated && !reduced };
      if (points.length > 1) m.fitBounds(L.latLngBounds(points.map(pointLatLng)), { ...pad, maxZoom: 9 });
      else if (points.length === 1) m.setView(pointLatLng(points[0]), zoomFor(SINGLE_DELTA, width), { animate: animated && !reduced });
      setMoved(false);
      onViewRef.current?.(undefined);
    },
    [points, area.top, area.bottom, reduced, width],
  );

  // Framed once per `frameKey`; a map framed from nothing frames again once there's something to show.
  const framed = useRef<{ key?: string; from: number }>({ from: 0 });
  useEffect(() => {
    const f = framed.current;
    if (f.key === frameKey && !(f.from === 0 && points.length > 0)) return;
    const firstTime = f.key === undefined;
    framed.current = { key: frameKey, from: points.length };
    frameAll(!firstTime);
  }, [frameKey, points, frameAll]);

  // Glide to the chosen festival, keeping the zoom.
  const lastGlide = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!selected || selected === lastGlide.current) return;
    lastGlide.current = selected;
    const k = markers.find((m) => m.festival.id === selected);
    if (k) map.current?.panTo(pointLatLng(k.point), { animate: !reduced });
  }, [selected, markers, reduced]);

  // "Show me": glide to where you are.
  const answered = useRef(0);
  useEffect(() => {
    if (!toHere || !here || answered.current === toHere) return;
    answered.current = toHere;
    const m = map.current;
    if (m) m.setView(pointLatLng(here), Math.max(m.getZoom(), 7), { animate: !reduced });
  }, [toHere, here, reduced]);

  // Lines on the map: Near you's reach, your journey, and threads from fanned-out lights to their real spot.
  const scale = region ? pxPerUnit(region, width) : 1;
  const step = 2 ** (Math.round(Math.log2(scale) * 2) / 2);
  const spread = useMemo(() => (region ? spreadMarkers(markers, region, step) : [...markers]), [markers, region, step]);
  const fanned = useMemo(() => spread.filter((m, i) => m.at !== markers[i]?.at), [spread, markers]);
  const clusters = useMemo(() => clusterMarkers(spread, step, CLUSTER_PX), [spread, step]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const layers: L.Layer[] = [];
    if (here) layers.push(L.circle(pointLatLng(here), { radius: NEAR_KM * 1000, color: 'rgba(111,195,255,0.5)', weight: 1.2, dashArray: '6 6', fillColor: 'rgba(111,195,255,0.05)', fillOpacity: 1, interactive: false }));
    if (journey && journey.length > 1) {
      const line = journey.map(latLngOf);
      layers.push(L.polyline(line, { color: 'rgba(255,154,213,0.28)', weight: 8, lineCap: 'round', interactive: false }));
      layers.push(L.polyline(line, { color: '#FF9AD5', weight: 2, lineCap: 'round', interactive: false }));
    }
    for (const f of fanned) layers.push(L.polyline([pointLatLng(f.point), latLngOf(f.at)], { color: 'rgba(243,240,255,0.25)', weight: 1, interactive: false }));
    for (const l of layers) l.addTo(m);
    return () => {
      for (const l of layers) l.remove();
    };
  }, [here, journey, fanned]);

  const m = map.current;
  const allNamed = !!region && region.longitudeDelta < NAMES_DELTA;
  const at = (ll: L.LatLngTuple) => (m ? m.latLngToContainerPoint(ll) : undefined);
  const hereAt = here ? at(pointLatLng(here)) : undefined;

  return (
    <View style={StyleSheet.absoluteFill} testID={testID}>
      <View ref={host} style={[StyleSheet.absoluteFill, styles.host]} />
      {/* The lights, drawn over the map and moved with it. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {hereAt ? (
          <View style={[styles.lightBox, { left: hereAt.x - LIGHT / 2, top: hereAt.y - LIGHT / 2 }]} pointerEvents="none" accessible accessibilityLabel="You are here, roughly">
            <View style={[styles.pulse, { borderColor: HERE_COLOR, opacity: 0.4 }]} />
            <View style={styles.here} />
          </View>
        ) : null}
        {m
          ? clusters.map((c) => {
              const p = at(latLngOf(c.at));
              if (!p || p.x < -80 || p.y < -80 || p.x > width + 80) return null;
              return (
                <Light
                  key={c.lead.festival.id}
                  cluster={c}
                  x={Math.round(p.x)}
                  y={Math.round(p.y)}
                  chosen={c.members.some((k) => k.festival.id === selected)}
                  named={allNamed || c.lead.tone === 'going'}
                  onPress={() => {
                    haptic.select();
                    lastGlide.current = c.lead.festival.id;
                    onSelect(c.lead.festival.id);
                    touched.current = true;
                    setMoved(true);
                    // A cluster opens up: festivals at one spot fan out; others are framed until they split.
                    if (c.members.length > 1 && sameSpot(c.members)) m.setView(pointLatLng(c.members[0].point), zoomFor(SPREAD_ZOOM, width), { animate: !reduced });
                    else if (c.members.length > 1)
                      m.fitBounds(L.latLngBounds(c.members.map((k) => pointLatLng(k.point))), {
                        paddingTopLeft: [80, area.top + 40],
                        paddingBottomRight: [80, area.bottom + 40],
                        animate: !reduced,
                      });
                    else m.panTo(latLngOf(c.at), { animate: !reduced });
                  }}
                />
              );
            })
          : null}
      </View>
      {moved && markers.length ? (
        <View style={[styles.again, { top: area.top + space.sm }]} pointerEvents="box-none">
          <Pressable
            onPress={() => {
              haptic.soft();
              frameAll(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={markers.length > 1 ? 'Show all these festivals again' : 'Back to the festival'}
            style={({ pressed }) => [styles.againPill, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.againText}>{markers.length > 1 ? 'Show all' : 'Back to it'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const LIGHT = 44;
const BOX_W = 160;

/**
 * A festival's light: a glowing core in its colour, a halo, a ring when chosen; a count for several; its name under it.
 * Drawn again only when it moves or changes (dragging the map redraws the lights on every frame).
 */
const Light = memo(LightView, (a, b) =>
  a.x === b.x && a.y === b.y && a.chosen === b.chosen && a.named === b.named && a.cluster.lead === b.cluster.lead && a.cluster.members.length === b.cluster.members.length,
);

function LightView({ cluster, x, y, chosen, named, onPress }: { cluster: Cluster; x: number; y: number; chosen: boolean; named: boolean; onPress: () => void }) {
  const { lead, members } = cluster;
  const tone = lead.tone;
  const tint = TONE_COLOR[tone];
  const core = tone === 'going' ? 13 : tone === 'love' ? 10 + Math.min(4, lead.loved) : tone === 'more' ? 8 : 6;
  const showName = named || chosen;
  const what = tone === 'going' ? 'You’re going.' : tone === 'over' ? 'It’s over.' : lead.loved ? `${lead.loved} you’d love.` : '';
  const label = members.length > 1 ? `${lead.festival.name} and ${members.length - 1} more here. ${what}` : `${lead.festival.name}, ${lead.festival.dates}, ${lead.festival.location}. ${what}`;
  return (
    <View style={[styles.lightBox, { left: x - LIGHT / 2, top: y - LIGHT / 2, zIndex: chosen ? 100 : tone === 'going' ? 30 : tone === 'love' ? 20 : 10 }]} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label.trim()}
        accessibilityState={{ selected: chosen }}
        testID={`map-light-${lead.festival.id}`}
        style={styles.lightHit}
      >
        {tone !== 'over' ? <View style={[styles.halo, { backgroundColor: tint, width: core * 3, height: core * 3, borderRadius: core * 1.5 }]} /> : null}
        {tone === 'going' ? <View style={[styles.pulse, { borderColor: tint, opacity: 0.5 }]} /> : null}
        {chosen ? <View style={[styles.ring, { borderColor: tint }]} /> : null}
        <View style={[styles.core, { width: core, height: core, borderRadius: core / 2, backgroundColor: tint, shadowColor: tint }]} />
        {members.length > 1 ? (
          <View style={[styles.count, { borderColor: tint }]}>
            <Text style={styles.countText}>{members.length}</Text>
          </View>
        ) : null}
      </Pressable>
      {showName ? (
        <View style={styles.nameBox} pointerEvents="none">
          <Text numberOfLines={2} style={[styles.name, chosen && styles.nameChosen]}>
            {lead.festival.name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { backgroundColor: color.night },
  lightBox: { position: 'absolute', width: LIGHT, alignItems: 'center' },
  lightHit: { width: LIGHT, height: LIGHT, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as never,
  halo: { position: 'absolute', opacity: 0.22 },
  core: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)', shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  ring: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
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
  nameBox: { position: 'absolute', top: LIGHT - 6, left: (LIGHT - BOX_W) / 2, width: BOX_W, alignItems: 'center' },
  name: {
    ...type.caption,
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
  },
  again: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  againPill: {
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: 'rgba(18,16,38,0.78)',
  },
  againText: { ...type.label, color: color.moon },
});
