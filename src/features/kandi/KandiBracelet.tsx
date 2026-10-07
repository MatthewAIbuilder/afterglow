import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { type CharmId, patternOf, type PatternId } from './kandi';

/** A charm, drawn about 14 wide round (0, 0). */
function Charm({ id }: { id: CharmId }) {
  switch (id) {
    case 'heart':
      return (
        <G>
          <Path d="M0 6 C-10 -1 -7.5 -10 0 -5 C7.5 -10 10 -1 0 6Z" fill="#FF4F8B" />
          <Path d="M-4.2 -5.6 C-6 -5 -6.4 -3 -5.6 -1.6" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.8} />
        </G>
      );
    case 'star':
      return (
        <G>
          <Path d="M0 -8 L2.4 -2.6 L8 -2.4 L3.6 1.2 L5.2 7 L0 3.8 L-5.2 7 L-3.6 1.2 L-8 -2.4 L-2.4 -2.6Z" fill="#FFD24A" stroke="#C9961E" strokeWidth={0.6} strokeLinejoin="round" />
          <Circle cx={-1.6} cy={-2.8} r={1.1} fill="#FFFFFF" opacity={0.8} />
        </G>
      );
    case 'alien':
      return (
        <G>
          <Path d="M0 -8 C6 -8 7.5 -3 6 1 C4.6 4.8 2 7.4 0 7.4 C-2 7.4 -4.6 4.8 -6 1 C-7.5 -3 -6 -8 0 -8Z" fill="#7CFF8A" />
          <Path d="M-5.2 -1.6 C-4.4 -4 -1.6 -3.6 -1.2 -1 C-1.6 0.8 -4.2 0.6 -5.2 -1.6Z" fill="#0E0816" />
          <Path d="M5.2 -1.6 C4.4 -4 1.6 -3.6 1.2 -1 C1.6 0.8 4.2 0.6 5.2 -1.6Z" fill="#0E0816" />
          <Ellipse cx={-2.4} cy={-6} rx={1.8} ry={0.9} fill="#FFFFFF" opacity={0.6} />
        </G>
      );
    case 'mushroom':
      return (
        <G>
          <Rect x={-2.6} y={0} width={5.2} height={7} rx={2} fill="#FFF1DC" />
          <Path d="M-8 1.4 C-8 -6 -3.6 -8.4 0 -8.4 C3.6 -8.4 8 -6 8 1.4Z" fill="#FF4A4A" />
          <Circle cx={-3.6} cy={-3.4} r={1.4} fill="#FFFFFF" />
          <Circle cx={2.4} cy={-5} r={1.2} fill="#FFFFFF" />
          <Circle cx={4.4} cy={-1} r={1} fill="#FFFFFF" />
        </G>
      );
    case 'smiley':
      return (
        <G>
          <Circle cx={0} cy={0} r={7.4} fill="#FFE14D" stroke="#E0B21E" strokeWidth={0.6} />
          <Ellipse cx={-2.6} cy={-1.8} rx={1} ry={1.6} fill="#2A1A0A" />
          <Ellipse cx={2.6} cy={-1.8} rx={1} ry={1.6} fill="#2A1A0A" />
          <Path d="M-4 1.8 Q0 6 4 1.8" stroke="#2A1A0A" strokeWidth={1.2} fill="none" strokeLinecap="round" />
        </G>
      );
    case 'moon':
      return (
        <G>
          <Path d="M2.4 -7.6 C-3.8 -7.4 -7.6 -2.4 -6.6 2.8 C-5.6 7.6 0.2 9.4 4.6 6.4 C-0.6 6 -3.6 1.6 -2.6 -2.8 C-2 -5.2 -0.2 -7 2.4 -7.6Z" fill="#FFF0B0" stroke="#D8C070" strokeWidth={0.5} />
          <Circle cx={-3.6} cy={1} r={0.9} fill="#E0CC80" />
        </G>
      );
  }
}

/** A charm on its own (for choosing one), `size` wide. */
export function CharmIcon({ id, size = 32 }: { id: CharmId; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="-10 -10 20 20">
      <Charm id={id} />
    </Svg>
  );
}

/**
 * A kandi bracelet, drawn: a ring of glossy pony beads seen a little from
 * above (the back of the ring smaller and in shadow), with white letter
 * cubes spelling its word across the front and maybe a charm hanging below.
 * Glow-in-the-dark beads glow, galaxy beads sparkle, gold shines like
 * metal. Square, `size` wide.
 */
export function KandiBracelet({ word, beads, charm, size = 120, label }: { word: string; beads: PatternId; charm?: CharmId; size?: number; label?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const pattern = patternOf(beads);
  const colors = pattern.colors;
  const letters = [...word];
  const cx = 50;
  const cy = 52;
  const rx = 38;
  const ry = 22;
  const total = 30;
  // The letter cubes take the front of the ring, centred at the bottom (each cube about one bead and a bit).
  const step = (2 * Math.PI) / total;
  const span = letters.length * step * 1.15;
  const front = Math.PI / 2;
  type Bead = { a: number; x: number; y: number; depth: number; i: number };
  const ring: Bead[] = Array.from({ length: total }, (_, i) => {
    const a = front + Math.PI + i * step;
    return { a, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), depth: (Math.sin(a) + 1) / 2, i };
  });
  const inLetters = (a: number) => {
    const d = Math.atan2(Math.sin(a - front), Math.cos(a - front));
    return Math.abs(d) < span / 2 + step * 0.2;
  };
  const back = ring.filter((b) => b.depth < 0.5);
  const fore = ring.filter((b) => b.depth >= 0.5 && !(letters.length && inLetters(b.a)));
  const cubes = letters.map((ch, i) => {
    // Left to right as you read it: angles grow towards the left across the front.
    const a = front + span / 2 - (i + 0.5) * (span / letters.length);
    return { ch, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), turn: (Math.cos(a) * -18).toFixed(1) };
  });
  const bead = (b: Bead) => {
    const r = 4.3 + b.depth * 1.6;
    const c = colors[b.i % colors.length];
    return (
      <G key={b.i} opacity={0.55 + b.depth * 0.45}>
        {pattern.glow ? <Circle cx={b.x} cy={b.y} r={r * 1.9} fill={c} opacity={0.22} /> : null}
        <Circle cx={b.x} cy={b.y} r={r} fill={c} />
        <Circle cx={b.x} cy={b.y} r={r} fill={`url(#${uid}shade)`} />
        {pattern.metal ? <Circle cx={b.x} cy={b.y} r={r - 0.3} fill="none" stroke="#8A6410" strokeWidth={0.6} opacity={0.6} /> : null}
        <Ellipse cx={b.x - r * 0.35} cy={b.y - r * 0.4} rx={r * (pattern.metal ? 0.5 : 0.38)} ry={r * 0.26} fill="#FFFFFF" opacity={pattern.metal ? 0.95 : 0.75} />
        {pattern.sparkle && b.i % 3 === 0 ? <Path d={`M${(b.x + r * 0.3).toFixed(1)} ${(b.y - 1.6).toFixed(1)} l0.5 1.1 1.1 0.5 -1.1 0.5 -0.5 1.1 -0.5 -1.1 -1.1 -0.5 1.1 -0.5Z`} fill="#FFFFFF" /> : null}
      </G>
    );
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={label} accessible={!!label}>
      <Defs>
        <RadialGradient id={`${uid}shade`} cx="35%" cy="30%" r="75%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.18} />
          <Stop offset="0.6" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.45} />
        </RadialGradient>
      </Defs>
      {pattern.glow ? <Ellipse cx={cx} cy={cy} rx={rx + 8} ry={ry + 8} fill={colors[0]} opacity={0.1} /> : null}
      {/* The elastic, then the back of the ring, then the front. */}
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={0.8} />
      {back.map(bead)}
      {fore.map(bead)}
      {cubes.map((c, i) => (
        <G key={`l${i}`} transform={`rotate(${c.turn} ${c.x.toFixed(1)} ${c.y.toFixed(1)})`}>
          {c.ch === ' ' ? (
            <Circle cx={c.x} cy={c.y} r={3.4} fill={colors[i % colors.length]} />
          ) : (
            <G>
              <Rect x={c.x - 5.4} y={c.y - 5.4} width={10.8} height={10.8} rx={2.2} fill="#FBFAFF" stroke="#D8D2EA" strokeWidth={0.5} />
              <SvgText x={c.x} y={c.y + 3.2} fontSize={8.6} fontWeight="800" fill="#1A1430" textAnchor="middle">
                {c.ch}
              </SvgText>
            </G>
          )}
        </G>
      ))}
      {charm ? (
        <G>
          {/* A jump ring from the bottom of the bracelet, and the charm hanging from it. */}
          <Circle cx={cx} cy={cy + ry + (letters.length ? 6.6 : 3.4)} r={1.8} fill="none" stroke="#D8DCE6" strokeWidth={0.9} />
          <G transform={`translate(${cx} ${cy + ry + (letters.length ? 15.4 : 12.2)})`}>
            <Charm id={charm} />
          </G>
        </G>
      ) : null}
    </Svg>
  );
}
