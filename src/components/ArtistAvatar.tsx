import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import type { Artist } from '../data/types';
import { color } from '../theme/tokens';

// Stable per-artist gradient so monograms are distinguishable but on-palette.
const PAIRS: [string, string][] = [
  ['#3B2A7A', '#A97CFF'],
  ['#1C2A6B', '#7C8CFF'],
  ['#4A1E5E', '#D07CFF'],
  ['#23184F', '#8E6BFF'],
  ['#2A1F55', '#FF7AC6'],
];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** The artist's colour pair: [deep, bright]. Shared by avatars and the stage scene. */
export const artistColors = (id: string) => PAIRS[hash(id) % PAIRS.length];

export function ArtistAvatar({ artist, size }: { artist: Artist; size: number }) {
  const ring = { width: size, height: size, borderRadius: size / 2 };
  const [from, to] = artistColors(artist.id);
  const initials = artist.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2);
  // The monogram is always there, so a photo that's loading, offline or broken never leaves an empty circle.
  const monogram = (
    <LinearGradient colors={[to, from]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[ring, styles.center, StyleSheet.absoluteFill]}>
      <Text style={[styles.initials, { fontSize: size * 0.3 }]}>{initials}</Text>
    </LinearGradient>
  );
  if (!artist.imageUrl) return <View style={[ring, styles.frame]}>{monogram}</View>;
  return (
    <View style={[ring, styles.frame]}>
      {monogram}
      <Image source={{ uri: artist.imageUrl }} style={[ring, StyleSheet.absoluteFill]} contentFit="cover" transition={250} />
      {/* A touch of night at the bottom, so bright photos sit in the dark theme. */}
      <LinearGradient colors={['rgba(10,9,24,0)', 'rgba(10,9,24,0.32)']} start={{ x: 0.5, y: 0.45 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.16)' },
  center: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: color.moon, fontWeight: '700', letterSpacing: -0.5, opacity: 0.92 },
});
