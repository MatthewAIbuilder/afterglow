import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import type { Artist, SoundTag } from '../../data/models';
import { artistColors } from '../../components/ArtistAvatar';
import { NO_SOUND_COLOR, SOUND_COLOR } from './colors';

/**
 * How a bubble on My Sound looks: a glowing orb, not a dot on a chart.
 * `OrbGlass` gives any face (a photo or a planet) an atmosphere in the colour
 * of their sound, a soft ring of light just outside the edge, so sounds tell
 * apart at a glance. No gloss or glint over the photo (the user preferred
 * them matte, 2026-10-05). `PlanetFace` is an artist without a photo: a small planet
 * banded in the colours of their sound mix, their initials faint on it.
 */

const hashOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const safe = (id: string) => id.replace(/[^A-Za-z0-9]/g, '');

/** Their sounds, strongest first (up to three), as colours. */
function soundBands(sound: Artist['sound']): string[] {
  const tags = (Object.entries(sound ?? {}) as [SoundTag, number][]).filter(([t, w]) => w > 0 && SOUND_COLOR[t]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return tags.length ? tags.map(([t]) => SOUND_COLOR[t]) : [NO_SOUND_COLOR];
}

/**
 * The orb's atmosphere: a soft ring in its sound's colour just outside the
 * edge (in place of a hard ring). It starts at the edge, so it never covers
 * the face.
 */
export function OrbGlass({ size, tone, id }: { size: number; tone: string; id: string }) {
  const g = `og-${safe(id)}`;
  const outer = size * 1.22;
  const pad = (outer - size) / 2;
  const edge = size / outer;
  return (
    <Svg width={outer} height={outer} style={{ position: 'absolute', left: -pad, top: -pad }} pointerEvents="none">
      <Defs>
        {/* The atmosphere: a soft ring in their sound's colour just outside the edge. */}
        <RadialGradient id={`${g}h`} cx="50%" cy="50%" r="50%">
          <Stop offset={String(edge)} stopColor={tone} stopOpacity={0} />
          <Stop offset={String(edge + 0.012)} stopColor={tone} stopOpacity={0.75} />
          <Stop offset={String(edge + 0.045)} stopColor={tone} stopOpacity={0.35} />
          <Stop offset="1" stopColor={tone} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={outer / 2} cy={outer / 2} r={outer / 2} fill={`url(#${g}h)`} />
    </Svg>
  );
}

export function PlanetFace({ artist, size }: { artist: Pick<Artist, 'id' | 'name' | 'sound' | 'color'>; size: number }) {
  const g = `pf-${safe(artist.id)}`;
  const [deep, bright] = artistColors(artist.id, artist.color);
  const bands = soundBands(artist.sound);
  const h = hashOf(artist.id);
  const tilt = -18 + (h % 36);
  const c = size / 2;
  const initials = artist.name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  // Bands across the planet: its main sound widest, the others thinner, each at its own height.
  const rows = [-0.42, -0.2, 0.05, 0.28, 0.5].map((y, i) => ({ y, color: bands[i % bands.length], w: [0.16, 0.1, 0.2, 0.08, 0.14][(i + h) % 5], o: [0.42, 0.26, 0.38, 0.22, 0.34][(i + (h >> 3)) % 5] }));
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={`${g}b`} cx="40%" cy="34%" r="75%">
          <Stop offset="0" stopColor={bright} />
          <Stop offset="0.7" stopColor={deep} />
          <Stop offset="1" stopColor="#0A0918" />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={c} fill={`url(#${g}b)`} />
      <G transform={`rotate(${tilt} ${c} ${c})`} opacity={0.9}>
        {rows.map((r, i) => (
          <Ellipse key={i} cx={c} cy={c + r.y * size} rx={size * 0.62} ry={size * r.w * 0.5} fill={r.color} opacity={r.o} />
        ))}
      </G>
      <SvgText x={c} y={c + size * 0.11} fontSize={size * 0.3} fontWeight="700" fill="#FFFFFF" fillOpacity={0.7} textAnchor="middle">
        {initials}
      </SvgText>
    </Svg>
  );
}
