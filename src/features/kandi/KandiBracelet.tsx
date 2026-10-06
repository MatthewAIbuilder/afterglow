import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { patternOf, type PatternId } from './kandi';

/**
 * A kandi bracelet, drawn: a ring of glossy pony beads seen a little from
 * above (the back of the ring smaller and in shadow), with white letter
 * cubes spelling its word across the front. Square, `size` wide.
 */
export function KandiBracelet({ word, beads, size = 120, label }: { word: string; beads: PatternId; size?: number; label?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const colors = patternOf(beads).colors;
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
    return (
      <G key={b.i} opacity={0.55 + b.depth * 0.45}>
        <Circle cx={b.x} cy={b.y} r={r} fill={colors[b.i % colors.length]} />
        <Circle cx={b.x} cy={b.y} r={r} fill={`url(#${uid}shade)`} />
        <Ellipse cx={b.x - r * 0.35} cy={b.y - r * 0.4} rx={r * 0.38} ry={r * 0.26} fill="#FFFFFF" opacity={0.75} />
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
    </Svg>
  );
}
