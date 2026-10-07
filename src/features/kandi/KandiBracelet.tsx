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
    case 'bolt':
      return (
        <G>
          <Path d="M2.6 -8.4 L-5 1 L-0.6 1 L-2.6 8.4 L5 -1.4 L0.6 -1.4Z" fill="#FFE14D" stroke="#E0A81E" strokeWidth={0.6} strokeLinejoin="round" />
          <Path d="M1.4 -5.6 L-2.6 -0.2" stroke="#FFFFFF" strokeWidth={0.9} strokeLinecap="round" opacity={0.75} />
        </G>
      );
    case 'butterfly':
      return (
        <G>
          <Path d="M-0.6 -1 C-3 -8 -9 -7.6 -8 -2.4 C-7.4 0.4 -4 0.6 -0.8 0 Z" fill="#8AB8FF" />
          <Path d="M0.6 -1 C3 -8 9 -7.6 8 -2.4 C7.4 0.4 4 0.6 0.8 0 Z" fill="#8AB8FF" />
          <Path d="M-0.8 0.6 C-3.6 1 -6.6 3 -5 5.6 C-3.6 7.4 -1.4 4.6 -0.6 1.6 Z" fill="#FF8AD8" />
          <Path d="M0.8 0.6 C3.6 1 6.6 3 5 5.6 C3.6 7.4 1.4 4.6 0.6 1.6 Z" fill="#FF8AD8" />
          <Circle cx={-4.6} cy={-3.6} r={1.2} fill="#FFFFFF" opacity={0.7} />
          <Circle cx={4.6} cy={-3.6} r={1.2} fill="#FFFFFF" opacity={0.7} />
          <Path d="M0 -3.6 L0 5" stroke="#2A1A3A" strokeWidth={1.4} strokeLinecap="round" />
          <Path d="M0 -3.4 Q-1.4 -6.6 -2.6 -7.6 M0 -3.4 Q1.4 -6.6 2.6 -7.6" stroke="#2A1A3A" strokeWidth={0.5} fill="none" strokeLinecap="round" />
        </G>
      );
    case 'crown':
      return (
        <G>
          <Path d="M-7.6 5 L-8 -4.4 L-3.8 -0.6 L0 -7 L3.8 -0.6 L8 -4.4 L7.6 5Z" fill="#FFD24A" stroke="#C9961E" strokeWidth={0.6} strokeLinejoin="round" />
          <Rect x={-7.6} y={3.2} width={15.2} height={2.6} rx={0.6} fill="#E8B42A" />
          <Circle cx={0} cy={0.6} r={1.5} fill="#FF4F8B" />
          <Circle cx={-4.6} cy={1.6} r={1} fill="#4FB6FF" />
          <Circle cx={4.6} cy={1.6} r={1} fill="#5BE37A" />
          <Circle cx={0} cy={-7} r={1} fill="#FFF4C8" />
          <Path d="M-6 -2 L-5.4 2" stroke="#FFFFFF" strokeWidth={0.8} strokeLinecap="round" opacity={0.7} />
        </G>
      );
    case 'flower':
      return (
        <G>
          {[0, 72, 144, 216, 288].map((a) => (
            <Ellipse key={a} cx={0} cy={-4.4} rx={3} ry={4.2} fill="#FF9AD5" stroke="#E86AB0" strokeWidth={0.4} transform={`rotate(${a})`} />
          ))}
          <Circle cx={0} cy={0} r={2.8} fill="#FFE14D" />
          <Circle cx={-0.8} cy={-0.8} r={0.9} fill="#FFFFFF" opacity={0.7} />
        </G>
      );
    case 'peace':
      return (
        <G>
          <Circle cx={0} cy={0} r={7.4} fill="#9AFFD8" />
          <Circle cx={0} cy={0} r={5.6} fill="none" stroke="#1E6A5A" strokeWidth={1.6} />
          <Path d="M0 -5.6 L0 5.6 M0 0.4 L-4 4 M0 0.4 L4 4" stroke="#1E6A5A" strokeWidth={1.6} strokeLinecap="round" />
          <Ellipse cx={-3.2} cy={-5} rx={2} ry={0.9} fill="#FFFFFF" opacity={0.6} transform="rotate(-30 -3.2 -5)" />
        </G>
      );
    case 'planet':
      return (
        <G>
          <Path d="M-8.4 2.6 C-9.4 4.6 -2 3.6 3 0.8 C7.6 -1.8 9.8 -4.4 8.4 -5" stroke="#FFD86B" strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.85} />
          <Circle cx={0} cy={0} r={5.6} fill="#B99CFF" />
          <Path d="M-5.4 -1.6 Q0 -0.4 5.4 -2" stroke="#8A6AE0" strokeWidth={1.1} fill="none" />
          <Path d="M-5 1.8 Q0 3 5 1.4" stroke="#8A6AE0" strokeWidth={0.9} fill="none" />
          <Circle cx={-2} cy={-2.8} r={1.2} fill="#FFFFFF" opacity={0.6} />
          <Path d="M-8.4 2.6 C-7 4.4 -1 3.4 3 1.8 C5.4 0.8 7.2 -0.2 8.2 -1.4" stroke="#FFD86B" strokeWidth={1.4} fill="none" strokeLinecap="round" />
        </G>
      );
    case 'portal':
      // A little swirling portal, green light spiralling in.
      return (
        <G>
          <Circle cx={0} cy={0} r={7.6} fill="#123A2A" stroke="#3A86E0" strokeWidth={1} />
          <Path d="M0 0 C0 -2.4 3 -2.6 3.6 0 C4.4 3.6 -0.6 5.6 -3.4 3.4 C-7 0.6 -4.6 -6 0.6 -6.2" stroke="#B6FF5A" strokeWidth={1.4} fill="none" strokeLinecap="round" />
          <Path d="M0.6 -6.2 C4.6 -6.4 7 -3.4 6.6 0.2" stroke="#CFE8FF" strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0.8} />
          <Circle cx={0} cy={0} r={1.2} fill="#E8FFD0" />
        </G>
      );
    case 'compass':
      // A brass compass, its needle pointing north.
      return (
        <G>
          <Circle cx={0} cy={0} r={7.6} fill="#E8B84A" stroke="#9A6A1E" strokeWidth={0.6} />
          <Circle cx={0} cy={0} r={5.8} fill="#FFF8E0" />
          <Path d="M0 -5 L1.6 0 L-1.6 0Z" fill="#FF4A4A" />
          <Path d="M0 5 L1.6 0 L-1.6 0Z" fill="#22305C" />
          <Circle cx={0} cy={0} r={0.9} fill="#9A6A1E" />
          <Ellipse cx={-3} cy={-5.2} rx={1.8} ry={0.8} fill="#FFFFFF" opacity={0.6} transform="rotate(-30 -3 -5.2)" />
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
