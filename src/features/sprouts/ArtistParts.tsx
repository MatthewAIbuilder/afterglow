import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { Back, Face, Top, Wear } from './artistLook';

/**
 * The drawn parts of artist sprouts, in the sprout's 100 × 100 box (body
 * centred at x, y with radii rx, ry; tops sit at the stem's tip). Only
 * Sprout.tsx uses these.
 */
const INK = '#0E2A1A';
const DARK = '#1A1626';
const GOLD = '#FFD24A';
const GOLD_DEEP = '#C9971E';

const rad = (deg: number) => (deg * Math.PI) / 180;

function starPath(cx: number, cy: number, r: number, inner: number) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? inner : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)} `;
  }
  return `${d}Z`;
}
const heartPath = (x: number, y: number, s: number) =>
  `M${x} ${y + 7 * s} C${x - 11 * s} ${y - 1 * s} ${x - 7 * s} ${y - 11 * s} ${x} ${y - 5 * s} C${x + 7 * s} ${y - 11 * s} ${x + 11 * s} ${y - 1 * s} ${x} ${y + 7 * s} Z`;

/** Behind the body. */
export function ArtistBack({ back, x, y, accent }: { back: Back; x: number; y: number; accent: string }) {
  if (back === 'mane') {
    return (
      <G>
        {Array.from({ length: 14 }, (_, i) => {
          const a = rad((360 / 14) * i);
          const px = x + Math.sin(a) * 25;
          const py = y - 2 - Math.cos(a) * 24;
          return <Ellipse key={i} cx={px} cy={py} rx={7} ry={9.5} fill={i % 2 ? accent : '#C97A1E'} transform={`rotate(${(360 / 14) * i} ${px} ${py})`} />;
        })}
        <Circle cx={x} cy={y - 2} r={22} fill="#B8711C" opacity={0.6} />
      </G>
    );
  }
  if (back === 'glow-ring') {
    return (
      <G>
        <Circle cx={x} cy={y - 6} r={30} fill="none" stroke="#9FF0FF" strokeWidth={2.4} opacity={0.6} />
        <Circle cx={x} cy={y - 6} r={30} fill="none" stroke="#FF9EDB" strokeWidth={1.2} strokeDasharray="6 5" opacity={0.8} />
      </G>
    );
  }
  return null;
}

/** On top of the stem. */
export function ArtistTop({ top, x, y, accent }: { top: Top; x: number; y: number; accent: string }) {
  const cy = y - 4;
  switch (top) {
    case 'phoenix':
      // A crest of flame feathers fanning up.
      return (
        <G>
          {[-40, -20, 0, 20, 40].map((a, i) => {
            const len = i === 2 ? 17 : i === 1 || i === 3 ? 14 : 10;
            const tx = x + Math.sin(rad(a)) * len;
            const ty = cy + 6 - Math.cos(rad(a)) * len;
            const c = i === 2 ? '#FFE08A' : i % 2 ? '#FFB347' : accent;
            return <Path key={a} d={`M${x - 3} ${cy + 6} Q${(x + tx) / 2 - 4} ${(cy + 6 + ty) / 2} ${tx} ${ty} Q${(x + tx) / 2 + 4} ${(cy + 6 + ty) / 2} ${x + 3} ${cy + 6} Z`} fill={c} />;
          })}
          <Circle cx={x} cy={cy + 5} r={3.4} fill="#FFE08A" />
        </G>
      );
    case 'pumpkin':
      return (
        <G>
          <Path d={`M${x} ${cy - 7} q1 -4 4 -5`} stroke="#3E7D2A" strokeWidth={2} fill="none" strokeLinecap="round" />
          <Ellipse cx={x} cy={cy + 1} rx={11} ry={8.5} fill={accent} />
          <Ellipse cx={x} cy={cy + 1} rx={5} ry={8.5} fill="none" stroke="#C25E0E" strokeWidth={1} />
          <Ellipse cx={x} cy={cy + 1} rx={9} ry={8.5} fill="none" stroke="#C25E0E" strokeWidth={0.8} opacity={0.7} />
          <Path d={`M${x - 6} ${cy - 1} l2.6 -3 l2.6 3 Z M${x + 1} ${cy - 1} l2.6 -3 l2.6 3 Z`} fill="#3A1A08" />
          <Path d={`M${x - 6} ${cy + 3} l2 2 l2 -2 l2 2 l2 -2 l2 2 l2 -2 l-1 3 q-5 3 -10 0 Z`} fill="#3A1A08" />
        </G>
      );
    case 'halo':
      return (
        <G>
          <Ellipse cx={x} cy={cy - 4} rx={12} ry={3.6} fill="none" stroke={GOLD} strokeWidth={4} opacity={0.3} />
          <Ellipse cx={x} cy={cy - 4} rx={12} ry={3.6} fill="none" stroke={accent} strokeWidth={2.2} />
        </G>
      );
    case 'cake':
      return (
        <G>
          <Rect x={x - 10} y={cy - 1} width={20} height={9} rx={2} fill="#F7E3C8" />
          <Path d={`M${x - 10} ${cy + 1} q0 -3 3 -3 h14 q3 0 3 3 v1 q-2 3 -4 0 q-2 3 -4 0 q-2 3 -4 0 q-2 3 -4 0 q-2 3 -4 0 Z`} fill={accent} />
          <Rect x={x - 0.9} y={cy - 9} width={1.8} height={7} rx={0.9} fill="#FFFFFF" />
          <Path d={`M${x} ${cy - 13.5} q2.4 2.6 0 4.4 q-2.4 -1.8 0 -4.4 Z`} fill="#FFB347" />
          <Circle cx={x - 5} cy={cy - 3} r={1.6} fill="#E8394A" />
        </G>
      );
    case 'crown':
      return (
        <G>
          <Path d={`M${x - 11} ${cy + 5} L${x - 12} ${cy - 6} L${x - 5} ${cy} L${x} ${cy - 9} L${x + 5} ${cy} L${x + 12} ${cy - 6} L${x + 11} ${cy + 5} Z`} fill={GOLD} stroke={GOLD_DEEP} strokeWidth={1} strokeLinejoin="round" />
          <Circle cx={x} cy={cy + 1.5} r={1.8} fill="#E8394A" />
          <Circle cx={x - 6.5} cy={cy + 2} r={1.3} fill="#6FC3FF" />
          <Circle cx={x + 6.5} cy={cy + 2} r={1.3} fill="#6EE7A0" />
        </G>
      );
    case 'tree':
      return (
        <G>
          <Circle cx={x - 7} cy={cy + 1} r={7} fill="#3E9A4A" />
          <Circle cx={x + 7} cy={cy + 1} r={7} fill="#3E9A4A" />
          <Circle cx={x} cy={cy - 5} r={8.5} fill={accent} />
          <Circle cx={x - 3} cy={cy - 8} r={2.4} fill="#FFFFFF" opacity={0.3} />
          <Circle cx={x + 6} cy={cy + 2} r={1.3} fill="#E8394A" />
          <Circle cx={x - 8} cy={cy - 1} r={1.1} fill="#FFD24A" />
        </G>
      );
    case 'cream':
      return (
        <G>
          <Ellipse cx={x} cy={cy + 4} rx={11} ry={4} fill={accent} />
          <Ellipse cx={x} cy={cy} rx={8} ry={3.6} fill="#FFFFFF" />
          <Ellipse cx={x} cy={cy - 3.6} rx={5} ry={3} fill={accent} />
          <Path d={`M${x} ${cy - 6} q1 -3 3 -4`} stroke="#FFFFFF" strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <Circle cx={x + 3.5} cy={cy - 11} r={2.6} fill="#E8394A" />
        </G>
      );
    case 'balloons':
      return (
        <G>
          {[
            [-9, -10, accent],
            [0, -16, '#FF85C8'],
            [9, -10, '#FFD24A'],
          ].map(([dx, dy, c]) => (
            <G key={String(dx)}>
              <Path d={`M${x} ${cy + 6} L${x + (dx as number)} ${cy + (dy as number) + 6}`} stroke="#FFFFFF" strokeWidth={0.6} opacity={0.7} />
              <Ellipse cx={x + (dx as number)} cy={cy + (dy as number)} rx={5} ry={6} fill={c as string} />
              <Ellipse cx={x + (dx as number) - 1.6} cy={cy + (dy as number) - 2} rx={1.2} ry={1.8} fill="#FFFFFF" opacity={0.6} />
            </G>
          ))}
        </G>
      );
    case 'bolt':
      return <Path d={`M${x + 2} ${cy - 12} L${x - 7} ${cy + 1} L${x - 1} ${cy + 1} L${x - 3} ${cy + 11} L${x + 7} ${cy - 3} L${x + 1} ${cy - 3} Z`} fill={accent} stroke="#FFFFFF" strokeWidth={1} strokeLinejoin="round" />;
    case 'flower':
      return (
        <G>
          {[0, 60, 120, 180, 240, 300].map((a) => {
            const px = x + Math.sin(rad(a)) * 6.5;
            const py = cy - Math.cos(rad(a)) * 6.5;
            return <Ellipse key={a} cx={px} cy={py} rx={3.8} ry={5.4} fill={accent} transform={`rotate(${a} ${px} ${py})`} />;
          })}
          <Circle cx={x} cy={cy} r={3.6} fill="#FFE9A8" />
        </G>
      );
    case 'daisy':
      return (
        <G>
          {Array.from({ length: 10 }, (_, i) => {
            const a = 36 * i;
            const px = x + Math.sin(rad(a)) * 6;
            const py = cy - Math.cos(rad(a)) * 6;
            return <Ellipse key={a} cx={px} cy={py} rx={2.2} ry={4.4} fill="#FFFFFF" transform={`rotate(${a} ${px} ${py})`} />;
          })}
          <Circle cx={x} cy={cy} r={3.4} fill="#FFC861" />
        </G>
      );
    case 'stars':
      return (
        <G>
          <Path d={starPath(x, cy - 5, 6.5, 2.8)} fill={accent} />
          <Path d={starPath(x - 10, cy + 2, 4, 1.7)} fill="#FFFFFF" opacity={0.9} />
          <Path d={starPath(x + 10, cy + 2, 4, 1.7)} fill={accent} opacity={0.9} />
        </G>
      );
    case 'star':
      return <Path d={starPath(x, cy, 10, 4.4)} fill={accent} stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={0.8} strokeLinejoin="round" />;
    case 'feather':
      return (
        <G>
          <Path d={`M${x - 2} ${cy + 8} C${x - 10} ${cy - 2} ${x - 2} ${cy - 14} ${x + 7} ${cy - 15} C${x + 6} ${cy - 5} ${x + 4} ${cy + 3} ${x - 2} ${cy + 8} Z`} fill={accent} />
          <Path d={`M${x - 2} ${cy + 8} Q${x + 1} ${cy - 3} ${x + 7} ${cy - 15}`} stroke="#FFFFFF" strokeWidth={0.8} opacity={0.7} fill="none" />
        </G>
      );
    case 'record':
      return (
        <G>
          <Circle cx={x} cy={cy} r={9} fill="#141024" />
          <Circle cx={x} cy={cy} r={6.4} fill="none" stroke="#3A3458" strokeWidth={0.6} />
          <Circle cx={x} cy={cy} r={3.2} fill={accent} />
          <Circle cx={x} cy={cy} r={0.9} fill="#141024" />
        </G>
      );
    case 'note':
      return (
        <G>
          <Path d={`M${x - 2} ${cy + 5} L${x - 2} ${cy - 10} L${x + 8} ${cy - 12} L${x + 8} ${cy + 2}`} stroke={accent} strokeWidth={2.2} fill="none" strokeLinejoin="round" />
          <Ellipse cx={x - 4.6} cy={cy + 5.4} rx={3.4} ry={2.6} fill={accent} />
          <Ellipse cx={x + 5.4} cy={cy + 2.4} rx={3.4} ry={2.6} fill={accent} />
        </G>
      );
    case 'heart':
      return <Path d={heartPath(x, cy, 1.15)} fill={accent} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={0.8} />;
    case 'speaker':
      return (
        <G>
          <Circle cx={x} cy={cy} r={8} fill="#22305C" />
          <Circle cx={x} cy={cy} r={6} fill={accent} />
          <Circle cx={x} cy={cy} r={2.4} fill="#22305C" />
          <Path d={`M${x - 12} ${cy - 6} q-3.5 6 0 12 M${x + 12} ${cy - 6} q3.5 6 0 12`} stroke={accent} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.85} />
        </G>
      );
    case 'moon':
      return (
        <G>
          <Path d={`M${x + 2} ${cy - 10} A10 10 0 1 0 ${x + 9} ${cy + 6} A8 8 0 1 1 ${x + 2} ${cy - 10} Z`} fill={accent} />
          <Path d={starPath(x + 9, cy - 9, 3, 1.3)} fill="#FFFFFF" />
        </G>
      );
    default:
      return null;
  }
}

/** On the body. `under` parts sit beneath the face. */
export function ArtistWear({ wear, x, y, rx, ry, accent, layer }: { wear: Wear; x: number; y: number; rx: number; ry: number; accent: string; layer: 'under' | 'over' }) {
  const topY = y - ry * 0.9;
  if (layer === 'under') {
    if (wear === 'mask')
      return (
        <G>
          <Ellipse cx={x - 7} cy={y + 1.5} rx={6} ry={4.4} fill="#4A3220" opacity={0.85} transform={`rotate(-15 ${x - 7} ${y + 1.5})`} />
          <Ellipse cx={x + 7} cy={y + 1.5} rx={6} ry={4.4} fill="#4A3220" opacity={0.85} transform={`rotate(15 ${x + 7} ${y + 1.5})`} />
          <Ellipse cx={x} cy={y + 6} rx={3} ry={2} fill="#4A3220" />
        </G>
      );
    if (wear === 'wings')
      return (
        <G>
          {[-1, 1].map((d) => (
            <G key={d}>
              <Path d={`M${x + d * (rx - 3)} ${y - 2} Q${x + d * (rx + 14)} ${y - 16} ${x + d * (rx + 12)} ${y + 4} Q${x + d * (rx + 4)} ${y + 2} ${x + d * (rx - 2)} ${y + 6} Z`} fill={accent} />
              <Path d={`M${x + d * (rx - 1)} ${y + 1} Q${x + d * (rx + 9)} ${y - 7} ${x + d * (rx + 9)} ${y + 3}`} stroke="#FFE08A" strokeWidth={1.4} fill="none" strokeLinecap="round" />
            </G>
          ))}
        </G>
      );
    if (wear === 'snake')
      return <Path d={`M${x - rx - 2} ${y + 10} Q${x - rx - 6} ${y - 4} ${x - rx + 2} ${y - 8}`} stroke={accent} strokeWidth={5} fill="none" strokeLinecap="round" />;
    return null;
  }
  switch (wear) {
    case 'horns':
      return (
        <G>
          <Path d={`M${x - 11} ${topY + 5} Q${x - 15} ${topY - 4} ${x - 9} ${topY - 8} Q${x - 10} ${topY - 1} ${x - 6} ${topY + 3} Z`} fill={accent} stroke="#5B2E9A" strokeWidth={0.8} />
          <Path d={`M${x + 11} ${topY + 5} Q${x + 15} ${topY - 4} ${x + 9} ${topY - 8} Q${x + 10} ${topY - 1} ${x + 6} ${topY + 3} Z`} fill={accent} stroke="#5B2E9A" strokeWidth={0.8} />
        </G>
      );
    case 'devil':
      return (
        <G>
          <Path d={`M${x - 10} ${topY + 4} L${x - 13} ${topY - 6} L${x - 5} ${topY + 2} Z`} fill="#E8394A" />
          <Path d={`M${x + 10} ${topY + 4} L${x + 13} ${topY - 6} L${x + 5} ${topY + 2} Z`} fill="#E8394A" />
        </G>
      );
    case 'fringe':
      // A swooping side fringe and the shaved side.
      return (
        <G>
          <Path d={`M${x - rx + 1} ${y - 4} C${x - rx - 2} ${topY - 2} ${x + 4} ${topY - 10} ${x + rx - 2} ${topY + 2} C${x + 6} ${topY + 1} ${x - 6} ${topY + 6} ${x - rx + 4} ${y + 2} Z`} fill={DARK} />
          <Path d={`M${x + 2} ${topY - 2} q6 -2 11 2`} stroke="#3A3458" strokeWidth={1} fill="none" />
        </G>
      );
    case 'wool':
      return (
        <G>
          {[-12, -6, 0, 6, 12].map((dx, i) => (
            <Circle key={dx} cx={x + dx} cy={topY + 3 - (i % 2 ? 3 : 0)} r={5.6} fill="#FFFFFF" />
          ))}
          {[-1, 1].map((d) => (
            <Path key={d} d={`M${x + d * (rx - 2)} ${y - 6} q${d * 8} -2 ${d * 7} 6 q${d * -1} 5 ${d * -6} 3 q${d * -3} -2 ${d * -1} -4`} stroke="#B89A6A" strokeWidth={2.4} fill="none" strokeLinecap="round" />
          ))}
        </G>
      );
    case 'helmet':
      return (
        <G>
          <Circle cx={x} cy={y - 6} r={rx + 7} fill="#BFEAFF" fillOpacity={0.12} stroke="#BFEAFF" strokeWidth={1.4} strokeOpacity={0.8} />
          <Path d={`M${x - rx - 1} ${y - 16} A${rx + 5} ${rx + 5} 0 0 1 ${x - 6} ${y - rx - 10}`} stroke="#FFFFFF" strokeWidth={2} fill="none" opacity={0.6} strokeLinecap="round" />
          <Rect x={x - rx - 3} y={y + 8} width={(rx + 3) * 2} height={5} rx={2.5} fill="#E6EEF8" />
        </G>
      );
    case 'bunny':
      return (
        <G>
          {[-1, 1].map((d) => (
            <G key={d}>
              <Ellipse cx={x + d * 9} cy={topY - 10} rx={4.8} ry={13} fill="#FFF4FA" stroke="#C27BA6" strokeWidth={0.8} transform={`rotate(${d * 12} ${x + d * 9} ${topY})`} />
              <Ellipse cx={x + d * 9} cy={topY - 10} rx={2.2} ry={9} fill={accent} transform={`rotate(${d * 12} ${x + d * 9} ${topY})`} />
            </G>
          ))}
        </G>
      );
    case 'stitches':
      return (
        <G>
          <Path d={`M${x - 14} ${y - 9} L${x - 4} ${y - 13}`} stroke="#3A2A1A" strokeWidth={1.2} strokeLinecap="round" />
          {[0, 1, 2, 3].map((i) => (
            <Path key={i} d={`M${x - 12.5 + i * 2.6} ${y - 12.4 + i * -1} l1 3`} stroke="#3A2A1A" strokeWidth={1} strokeLinecap="round" />
          ))}
          <Rect x={x + 9} y={y + 6} width={6} height={5} rx={1} fill="#8A6A9A" transform={`rotate(12 ${x + 12} ${y + 8})`} />
        </G>
      );
    case 'snake':
      // A friendly snake wrapped round, its head resting on the side.
      return (
        <G>
          <Path d={`M${x - rx + 1} ${y + 9} Q${x} ${y + 17} ${x + rx - 1} ${y + 7}`} stroke={accent} strokeWidth={5} fill="none" strokeLinecap="round" />
          <Path d={`M${x - rx + 1} ${y + 9} Q${x} ${y + 17} ${x + rx - 1} ${y + 7}`} stroke="#FFFFFF" strokeWidth={0.8} strokeDasharray="2 3" fill="none" opacity={0.5} />
          <Ellipse cx={x + rx + 1} cy={y + 4} rx={4.6} ry={3.8} fill={accent} />
          <Circle cx={x + rx + 2} cy={y + 3} r={0.9} fill={INK} />
          <Path d={`M${x + rx + 5} ${y + 5} l2.6 0.6 m-2.6 -0.6 l2.4 1.6`} stroke="#E8394A" strokeWidth={0.7} strokeLinecap="round" />
        </G>
      );
    case 'antennae':
      return (
        <G>
          {[-1, 1].map((d) => (
            <G key={d}>
              <Path d={`M${x + d * 7} ${topY + 3} Q${x + d * 12} ${topY - 6} ${x + d * 14} ${topY - 12}`} stroke="#118A55" strokeWidth={1.6} fill="none" strokeLinecap="round" />
              <Circle cx={x + d * 14} cy={topY - 12} r={2.6} fill={accent} />
            </G>
          ))}
        </G>
      );
    case 'monster':
      return (
        <G>
          <Path d={`M${x - 9} ${topY + 4} Q${x - 13} ${topY - 4} ${x - 7} ${topY - 6} Q${x - 9} ${topY} ${x - 5} ${topY + 3} Z`} fill="#FFE9F4" />
          <Path d={`M${x + 9} ${topY + 4} Q${x + 13} ${topY - 4} ${x + 7} ${topY - 6} Q${x + 9} ${topY} ${x + 5} ${topY + 3} Z`} fill="#FFE9F4" />
          <Circle cx={x - 12} cy={y + 8} r={2} fill={accent} opacity={0.7} />
          <Circle cx={x + 13} cy={y - 4} r={1.6} fill={accent} opacity={0.7} />
        </G>
      );
    case 'hood':
      return (
        <Path
          d={`M${x - rx - 3} ${y + 12} C${x - rx - 6} ${topY - 16} ${x + rx + 6} ${topY - 16} ${x + rx + 3} ${y + 12} L${x + rx - 3} ${y + 12} C${x + rx - 2} ${y - 12} ${x - rx + 2} ${y - 12} ${x - rx + 3} ${y + 12} Z`}
          fill="#2A2640"
        />
      );
    case 'headphones':
      return (
        <G>
          <Path d={`M${x - rx - 1} ${y - 2} C${x - rx - 1} ${y - ry * 1.55} ${x + rx + 1} ${y - ry * 1.55} ${x + rx + 1} ${y - 2}`} stroke="#22305C" strokeWidth={3} fill="none" strokeLinecap="round" />
          <Rect x={x - rx - 5} y={y - 6} width={8} height={12} rx={3.5} fill={accent} stroke="#22305C" strokeWidth={1.4} />
          <Rect x={x + rx - 3} y={y - 6} width={8} height={12} rx={3.5} fill={accent} stroke="#22305C" strokeWidth={1.4} />
        </G>
      );
    case 'cap':
      // A cap worn backwards.
      return (
        <G>
          <Path d={`M${x - rx + 2} ${topY + 7} C${x - rx + 2} ${topY - 6} ${x + rx - 2} ${topY - 6} ${x + rx - 2} ${topY + 7} Z`} fill={accent} />
          <Path d={`M${x - rx + 2} ${topY + 6} q-8 1 -10 4 q6 1 11 -1 Z`} fill={accent} stroke="#000000" strokeOpacity={0.2} strokeWidth={0.6} />
          <Circle cx={x} cy={topY - 2.6} r={1.4} fill="#FFFFFF" opacity={0.6} />
        </G>
      );
    case 'chain':
      return <Path d={`M${x - rx * 0.6} ${y + ry * 0.32} Q${x} ${y + ry * 0.75} ${x + rx * 0.6} ${y + ry * 0.32}`} stroke={GOLD} strokeWidth={1.8} strokeDasharray="1.6 1.2" fill="none" strokeLinecap="round" />;
    case 'bow':
      return (
        <G>
          <Path d={`M${x + 9} ${topY + 3} l-7 -5 l0 10 Z M${x + 9} ${topY + 3} l7 -5 l0 10 Z`} fill={accent} />
          <Circle cx={x + 9} cy={topY + 3} r={2} fill="#FFFFFF" opacity={0.85} />
        </G>
      );
    case 'beanie':
      return (
        <G>
          <Path d={`M${x - rx + 1} ${topY + 8} C${x - rx + 1} ${topY - 8} ${x + rx - 1} ${topY - 8} ${x + rx - 1} ${topY + 8} Z`} fill={accent} />
          <Rect x={x - rx} y={topY + 5} width={rx * 2} height={5} rx={2.5} fill="#FFFFFF" opacity={0.85} />
          <Circle cx={x} cy={topY - 5} r={3.6} fill="#FFFFFF" />
        </G>
      );
    case 'mohawk':
      return (
        <G>
          {[-6, -2, 2, 6].map((dx, i) => (
            <Path key={dx} d={`M${x + dx - 2.4} ${topY + 3} L${x + dx} ${topY - 9 - (i === 1 || i === 2 ? 3 : 0)} L${x + dx + 2.4} ${topY + 3} Z`} fill={accent} />
          ))}
        </G>
      );
    case 'scarf':
      return (
        <G>
          <Path d={`M${x - rx + 2} ${y + 7} Q${x} ${y + 13} ${x + rx - 2} ${y + 7} L${x + rx - 3} ${y + 11} Q${x} ${y + 17} ${x - rx + 3} ${y + 11} Z`} fill={accent} />
          <Path d={`M${x + 8} ${y + 12} l3 9 l4 -1 l-2 -9 Z`} fill={accent} />
        </G>
      );
    default:
      return null;
  }
}

/** Faces only artist sprouts have; drawn around (x, y), the middle of the eyes. */
export function ArtistFace({ face, x, y, s, accent }: { face: Face; x: number; y: number; s: number; accent: string }) {
  const ex = 6.5 * s;
  const mouthY = y + 5.5 * s;
  const smile = <Path d={`M${x - 3.2 * s} ${mouthY - 0.4 * s} Q${x} ${mouthY + 2.8 * s} ${x + 3.2 * s} ${mouthY - 0.4 * s}`} stroke={INK} strokeWidth={1.6 * s} strokeLinecap="round" fill="none" />;
  switch (face) {
    case 'cyclops':
      return (
        <G>
          <Circle cx={x} cy={y - 1 * s} r={6.4 * s} fill="#FFFFFF" stroke={INK} strokeWidth={1.1 * s} />
          <Circle cx={x} cy={y - 0.6 * s} r={3.8 * s} fill={accent} />
          <Circle cx={x} cy={y - 0.6 * s} r={1.9 * s} fill={INK} />
          <Circle cx={x + 1.4 * s} cy={y - 2.2 * s} r={1.1 * s} fill="#FFFFFF" />
          <Path d={`M${x - 6.8 * s} ${y - 5 * s} Q${x} ${y - 10 * s} ${x + 6.8 * s} ${y - 5 * s}`} stroke={INK} strokeWidth={1.2 * s} fill="none" strokeLinecap="round" />
          <Path d={`M${x - 3.4 * s} ${mouthY + 1.4 * s} Q${x} ${mouthY + 4.4 * s} ${x + 3.4 * s} ${mouthY + 1.4 * s}`} stroke={INK} strokeWidth={1.6 * s} strokeLinecap="round" fill="none" />
        </G>
      );
    case 'hollow':
      return (
        <G>
          <Ellipse cx={x - ex} cy={y} rx={3.3 * s} ry={4.2 * s} fill={INK} />
          <Ellipse cx={x + ex} cy={y} rx={3.3 * s} ry={4.2 * s} fill={INK} />
          <Circle cx={x - ex + 1 * s} cy={y - 1.6 * s} r={0.9 * s} fill="#FFFFFF" />
          <Circle cx={x + ex + 1 * s} cy={y - 1.6 * s} r={0.9 * s} fill="#FFFFFF" />
          <Ellipse cx={x} cy={mouthY + 1 * s} rx={1.4 * s} ry={1.8 * s} fill={INK} />
        </G>
      );
    case 'glasses':
      return (
        <G>
          <Circle cx={x - ex} cy={y} r={2.2 * s} fill={INK} />
          <Circle cx={x + ex} cy={y} r={2.2 * s} fill={INK} />
          <Rect x={x - ex - 4.4 * s} y={y - 3.4 * s} width={8.8 * s} height={6.8 * s} rx={1.6 * s} fill="none" stroke={DARK} strokeWidth={1.6 * s} />
          <Rect x={x + ex - 4.4 * s} y={y - 3.4 * s} width={8.8 * s} height={6.8 * s} rx={1.6 * s} fill="none" stroke={DARK} strokeWidth={1.6 * s} />
          <Path d={`M${x - ex + 4.4 * s} ${y - 1 * s} L${x + ex - 4.4 * s} ${y - 1 * s}`} stroke={DARK} strokeWidth={1.4 * s} />
          {smile}
        </G>
      );
    case 'alien':
      return (
        <G>
          <Ellipse cx={x - ex} cy={y} rx={3.2 * s} ry={4.6 * s} fill={INK} transform={`rotate(-25 ${x - ex} ${y})`} />
          <Ellipse cx={x + ex} cy={y} rx={3.2 * s} ry={4.6 * s} fill={INK} transform={`rotate(25 ${x + ex} ${y})`} />
          <Circle cx={x - ex + 0.8 * s} cy={y - 1.8 * s} r={1 * s} fill="#FFFFFF" />
          <Circle cx={x + ex + 0.8 * s} cy={y - 1.8 * s} r={1 * s} fill="#FFFFFF" />
          <Path d={`M${x - 2 * s} ${mouthY + 0.8 * s} Q${x} ${mouthY + 2.4 * s} ${x + 2 * s} ${mouthY + 0.8 * s}`} stroke={INK} strokeWidth={1.4 * s} strokeLinecap="round" fill="none" />
        </G>
      );
    case 'stitched':
      return (
        <G>
          <Circle cx={x - ex} cy={y} r={2.6 * s} fill={INK} />
          <Circle cx={x - ex + 0.8 * s} cy={y - 0.9 * s} r={0.9 * s} fill="#FFFFFF" />
          <Circle cx={x + ex} cy={y} r={2.8 * s} fill="#E8E2D0" stroke={INK} strokeWidth={0.9 * s} />
          <Path d={`M${x + ex - 1.4 * s} ${y - 1.4 * s} l2.8 2.8 m0 -2.8 l-2.8 2.8`} stroke={INK} strokeWidth={0.8 * s} />
          <Path d={`M${x - 4 * s} ${mouthY} L${x + 4 * s} ${mouthY}`} stroke={INK} strokeWidth={1.4 * s} strokeLinecap="round" />
          {[-2.4, 0, 2.4].map((d) => (
            <Path key={d} d={`M${x + d * s} ${mouthY - 1.4 * s} l0 2.8`} stroke={INK} strokeWidth={0.9 * s} strokeLinecap="round" />
          ))}
        </G>
      );
    case 'fang':
      return (
        <G>
          <Circle cx={x - ex} cy={y} r={2.5 * s} fill={INK} />
          <Circle cx={x + ex} cy={y} r={2.5 * s} fill={INK} />
          <Circle cx={x - ex + 0.8 * s} cy={y - 0.9 * s} r={0.9 * s} fill="#FFFFFF" />
          <Circle cx={x + ex + 0.8 * s} cy={y - 0.9 * s} r={0.9 * s} fill="#FFFFFF" />
          <Path d={`M${x - 3.6 * s} ${mouthY - 0.6 * s} Q${x} ${mouthY + 3.6 * s} ${x + 3.6 * s} ${mouthY - 0.6 * s} Z`} fill={INK} />
          <Path d={`M${x + 1 * s} ${mouthY - 0.2 * s} l1.2 2.4 l1.2 -2.6 Z`} fill="#FFFFFF" />
        </G>
      );
    default:
      return null;
  }
}

/** Faces drawn here rather than by Sprout's own face. */
export const ARTIST_FACES: readonly Face[] = ['cyclops', 'hollow', 'glasses', 'alien', 'stitched', 'fang'];
