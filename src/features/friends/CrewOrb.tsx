import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { PersonAvatar } from '../../components/PersonAvatar';
import { color, glowA, glowDeepA } from '../../theme/tokens';
import { crewOrbPlaces } from './orbit';

type Face = { name?: string; url?: string };

/**
 * A crew's picture: its people's faces round a small ring of light, like a
 * tiny version of the orbit on your profile. Up to four faces; with more
 * people a small count sits on the ring. Before anyone's face has loaded,
 * the crew's first letter in the night glow.
 */
export function CrewOrb({ name, people, total, size }: { name: string; people: readonly Face[]; total?: number; size: number }) {
  const shown = people.slice(0, 4);
  const places = crewOrbPlaces(shown.length, size);
  const extra = Math.max(0, (total ?? people.length) - shown.length);
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* The glow and the faint ring the faces sit on. */}
      <LinearGradient colors={[glowDeepA(0.55), 'rgba(58,35,128,0.25)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} stroke={glowA(0.45)} strokeWidth={1} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={size * 0.3} stroke="rgba(243,240,255,0.10)" strokeWidth={1} strokeDasharray="2 4" fill="none" />
      </Svg>
      {shown.length ? (
        places.map((p, i) => (
          <View key={i} style={[styles.face, { left: p.x, top: p.y, width: p.size, height: p.size, borderRadius: p.size / 2, zIndex: shown.length - i }]}>
            <PersonAvatar name={shown[i].name} url={shown[i].url} size={p.size - 3} />
          </View>
        ))
      ) : (
        <View style={styles.centre}>
          <Text style={[styles.letter, { fontSize: size * 0.4 }]}>{name.trim().charAt(0).toUpperCase() || '·'}</Text>
        </View>
      )}
      {extra > 0 ? (
        <View style={[styles.count, { minWidth: Math.min(30, size * 0.42), height: Math.min(22, size * 0.34), borderRadius: 11 }]}>
          <Text style={[styles.countText, { fontSize: Math.min(12, Math.max(9, size * 0.19)) }]}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: color.night, borderWidth: 1.5, borderColor: color.night },
  centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  letter: { color: color.moon, fontWeight: '700' },
  count: { position: 'absolute', right: -2, bottom: -2, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glowDeep, borderWidth: 1.5, borderColor: color.night, zIndex: 9 },
  countText: { color: color.moon, fontWeight: '700' },
});
