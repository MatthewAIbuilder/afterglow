import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { NIGHT_STYLE } from '../festival-map/mapStyle';
import { color, glowA, radius } from '../../theme/tokens';
import type { MapPerson } from './live';


/** Your crew as glowing dots on a dark map (faded when their spot is old), framed to fit everyone. Phones only. */
export function CrewMapView({ people, height }: { people: MapPerson[]; height: number }) {
  const map = useRef<MapView>(null);
  const coords = useMemo(() => people.map((p) => ({ latitude: p.lat, longitude: p.lon })), [people]);
  const key = coords.map((c) => `${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}`).join('|');
  useEffect(() => {
    if (coords.length > 1) map.current?.fitToCoordinates(coords, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });
    // key stands for `coords`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!people.length) return null;
  const first = people[0];
  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: first.lat, longitude: first.lon, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
        userInterfaceStyle="dark"
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        customMapStyle={NIGHT_STYLE}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsCompass={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {people.map((p) => (
          <Marker key={p.uid} coordinate={{ latitude: p.lat, longitude: p.lon }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={[styles.dot, p.me && styles.me, p.stale && styles.stale]}>
              <Text style={styles.initials}>{p.initials}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.glass },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: glowA(0.85), borderWidth: 2, borderColor: color.moon, shadowColor: color.glow, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  me: { backgroundColor: '#3E8BFF' },
  stale: { opacity: 0.45 },
  initials: { fontSize: 12, fontWeight: '700', color: color.night },
});
