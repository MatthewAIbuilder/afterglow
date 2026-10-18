import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { NIGHT_STYLE } from '../festival-map/mapStyle';
import { color, radius } from '../../theme/tokens';
import { boxOf, type TrailPoint } from './trail';

/** The part of the map the lines get framed in. */
const EDGE = { top: 40, right: 40, bottom: 40, left: 40 };

/**
 * Where you walked, as glowing lines on a dark map: one line per festival day, the chosen day
 * brightest, a dot where it began and a pin where it ended (or where you are now). Phones only
 * (the website shows a note instead: `TrailMap.web.tsx`).
 */
export function TrailMap({ days, chosen, height }: { days: { day: string; points: readonly TrailPoint[] }[]; chosen: string | 'all'; height: number }) {
  const map = useRef<MapView>(null);
  const shown = useMemo(() => days.filter((d) => chosen === 'all' || d.day === chosen), [days, chosen]);
  const all = useMemo(() => shown.flatMap((d) => d.points), [shown]);
  const box = useMemo(() => (all.length ? boxOf(all) : undefined), [all]);
  useEffect(() => {
    if (all.length > 1) map.current?.fitToCoordinates(all.map((p) => ({ latitude: p[1], longitude: p[2] })), { edgePadding: EDGE, animated: true });
  }, [all]);
  if (!box) return null;
  const first = all[0];
  const last = all[all.length - 1];
  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={box}
        userInterfaceStyle="dark"
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        customMapStyle={NIGHT_STYLE}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsTraffic={false}
        showsCompass={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {shown.map((d) => (
          <Polyline
            key={d.day}
            coordinates={d.points.map((p) => ({ latitude: p[1], longitude: p[2] }))}
            strokeColor={color.glow}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        ))}
        <Marker coordinate={{ latitude: first[1], longitude: first[2] }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.start} />
        </Marker>
        {all.length > 1 ? (
          <Marker coordinate={{ latitude: last[1], longitude: last[2] }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.end} />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.nightRaised },
  start: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#7CE0B0', borderWidth: 2, borderColor: color.night },
  end: { width: 18, height: 18, borderRadius: 9, backgroundColor: color.glow, borderWidth: 3, borderColor: color.moon },
});
