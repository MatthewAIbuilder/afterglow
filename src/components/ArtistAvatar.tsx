import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import type { Artist, ArtistMember } from '../data/types';
import { paletteFrom } from '../theme/artistColor';
import { color, nightA } from '../theme/tokens';

// Stable per-artist gradient so monograms are distinguishable but on-palette.
const PAIRS: [string, string][] = [
  ['#3B2A7A', '#A97CFF'],
  ['#1C2A6B', '#7C8CFF'],
  ['#4A1E5E', '#D07CFF'],
  ['#23184F', '#8E6BFF'],
  ['#2A1F55', '#FF7AC6'],
];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * The artist's colour pair: [deep, bright]. From their own colour (taken from
 * their photo) when they have one, otherwise a stable on-palette pair for
 * their id. Shared by avatars, bubbles, artist pages and the stage scene.
 */
export const artistColors = (id: string, own?: string): [string, string] => (own ? paletteFrom(own) : PAIRS[hash(id) % PAIRS.length]);

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2);

// A touch of night at the bottom, so bright photos sit in the dark theme.
const nightShade = <LinearGradient colors={[nightA(0), nightA(0.32)]} start={{ x: 0.5, y: 0.45 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />;

export function ArtistAvatar({ artist, size }: { artist: Artist; size: number }) {
  const ring = { width: size, height: size, borderRadius: size / 2 };
  const [from, to] = artistColors(artist.id, artist.color);
  // The monogram is always there, so a photo that's loading, offline or broken never leaves an empty circle.
  const monogram = (
    <LinearGradient colors={[to, from]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[ring, styles.center, StyleSheet.absoluteFill]}>
      <Text style={[styles.initials, { fontSize: size * 0.3 }]}>{initialsOf(artist.name)}</Text>
    </LinearGradient>
  );
  if (!artist.imageUrl && artist.members && artist.members.length > 1) return <SplitAvatar artist={artist} members={artist.members} size={size} />;
  if (!artist.imageUrl) return <View style={[ring, styles.frame]}>{monogram}</View>;
  return (
    <View style={[ring, styles.frame]}>
      {monogram}
      <Image testID="avatar-photo" source={{ uri: artist.imageUrl }} style={[ring, StyleSheet.absoluteFill]} contentFit="cover" transition={250} />
      {nightShade}
    </View>
  );
}

/**
 * A b2b: one circle cut into a slice per artist, each face centred in its
 * slice, with a thin line of night between. Someone without a photo gets
 * their own monogram in their slice.
 */
function SplitAvatar({ artist, members, size }: { artist: Artist; members: ArtistMember[]; size: number }) {
  const ring = { width: size, height: size, borderRadius: size / 2 };
  const slice = size / members.length;
  const line = Math.max(1, size / 60);
  return (
    <View style={[ring, styles.frame]}>
      {members.map((m, i) => {
        const [from, to] = artistColors(m.id ?? `${artist.id}:${i}`, m.color);
        // The face sits in the middle of its slice: the square photo is centred on the slice.
        const offset = (slice - size) / 2;
        return (
          <View key={`${m.name}-${i}`} style={[styles.slice, { left: i * slice, width: slice, height: size }]}>
            <LinearGradient colors={[to, from]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[styles.center, { position: 'absolute', left: 0, top: 0, width: slice, height: size }]}>
              <Text style={[styles.initials, { fontSize: size * (members.length > 2 ? 0.16 : 0.2) }]}>{initialsOf(m.name)}</Text>
            </LinearGradient>
            {m.imageUrl ? <Image testID="avatar-photo" source={{ uri: m.imageUrl }} style={{ position: 'absolute', top: 0, left: offset, width: size, height: size }} contentFit="cover" transition={250} /> : null}
          </View>
        );
      })}
      {members.slice(1).map((m, i) => (
        <View key={`line-${m.name}-${i}`} style={[styles.line, { left: (i + 1) * slice - line / 2, width: line, height: size }]} />
      ))}
      {nightShade}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.16)' },
  center: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: color.moon, fontWeight: '700', letterSpacing: -0.5, opacity: 0.92 },
  slice: { position: 'absolute', top: 0, overflow: 'hidden' },
  line: { position: 'absolute', top: 0, backgroundColor: nightA(0.85) },
});
