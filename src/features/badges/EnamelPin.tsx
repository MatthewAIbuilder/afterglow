import { type ReactNode, useId } from 'react';
import { Platform } from 'react-native';
import Animated, { type SharedValue, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText, TextPath } from 'react-native-svg';
import { hashOf, type PinBacking, type PinLook, type PinPalette, type PinTheme } from './badges';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
/** A heavy, clean sans for the struck letters (SVG text doesn't use the app's font by itself). */
const FONT = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-black', default: '"Helvetica Neue", Arial, sans-serif' });

/** The pin on a 120 × 120 grid: a round body with a rim, a scene inside, a ribbon across the bottom. */
const CX = 60;
const CY = 56;
/** The rim's outside and inside, and the scene's edge. */
const RO = 44;
const RI = 35.6;
const RS = 34.4;

const pt = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;
};
/** A steady list of numbers 0..1 from a seed, for glitter and confetti. */
const seeded = (seed: number, n: number) => {
  let x = seed || 1;
  return Array.from({ length: n }, () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  });
};

/** Grey everything for a pin not collected yet. */
const LOCKED: PinPalette = { sky: ['#2A2938', '#3E3C52'], accent: '#6E6C84', accent2: '#5A586E', ground: '#232232', rim: '#1C1B28', ribbon: '#3A3850' };

type Ink = { p: PinPalette; metal: string; sky: string; seed: number; city: string };

/** Little white specks in the enamel, the way glitter enamel catches light. */
function Glitter({ seed, n = 18, top = CY - RS, height = RS * 1.3 }: { seed: number; n?: number; top?: number; height?: number }) {
  const r = seeded(seed, n * 3);
  return (
    <G>
      {Array.from({ length: n }, (_, i) => (
        <Circle key={i} cx={CX - RS + r[i * 3] * RS * 2} cy={top + r[i * 3 + 1] * height} r={0.35 + r[i * 3 + 2] * 0.6} fill="#FFFFFF" opacity={0.35 + r[i * 3 + 2] * 0.5} />
      ))}
    </G>
  );
}

/** A firework: lines bursting from a point, gold-tipped. */
function Burst({ x, y, r, color, metal }: { x: number; y: number; r: number; color: string; metal: string }) {
  return (
    <G>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <Line key={i} x1={x + Math.cos(a) * r * 0.25} y1={y + Math.sin(a) * r * 0.25} x2={x + Math.cos(a) * r} y2={y + Math.sin(a) * r} stroke={color} strokeWidth={1.1} strokeLinecap="round" />;
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <Circle key={`t${i}`} cx={x + Math.cos(a) * r} cy={y + Math.sin(a) * r} r={0.7} fill={metal} />;
      })}
    </G>
  );
}

/** Gold wave lines across water. */
function Waves({ y, metal, n = 3 }: { y: number; metal: string; n?: number }) {
  return (
    <G>
      {Array.from({ length: n }, (_, i) => {
        const yy = y + i * 5;
        return <Path key={i} d={`M 20 ${yy} Q 26 ${yy - 2.4} 32 ${yy} T 44 ${yy} T 56 ${yy} T 68 ${yy} T 80 ${yy} T 92 ${yy} T 104 ${yy}`} stroke={metal} strokeWidth={0.9} fill="none" opacity={0.95 - i * 0.2} />;
      })}
    </G>
  );
}

/** The festival's scene inside the rim, drawn as enamel with raised gold lines. */
function Scene({ theme, ink }: { theme: PinTheme; ink: Ink }) {
  const { p, metal, sky, seed, city } = ink;
  const back = <Rect x={0} y={0} width={120} height={120} fill={sky} />;
  switch (theme) {
    case 'eye':
      return (
        <G>
          {back}
          <Glitter seed={seed} />
          <Path d={`M 20 ${CY + 13} Q 40 ${CY + 9} 60 ${CY + 13} T 100 ${CY + 13} L 100 120 L 20 120 Z`} fill={p.ground} />
          <Waves y={CY + 17} metal={metal} />
          {/* The cyclops: one great eye over the sea. */}
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI + (i + 1) * (Math.PI / 10);
            return <Line key={i} x1={CX + Math.cos(a) * 21} y1={CY - 3 + Math.sin(a) * 15} x2={CX + Math.cos(a) * 27} y2={CY - 3 + Math.sin(a) * 21} stroke={metal} strokeWidth={1.2} strokeLinecap="round" />;
          })}
          <Path d={`M ${CX - 25} ${CY - 2} Q ${CX} ${CY - 25} ${CX + 25} ${CY - 2} Q ${CX} ${CY + 18} ${CX - 25} ${CY - 2} Z`} fill="#F7F3FF" stroke={metal} strokeWidth={1.3} />
          <Circle cx={CX} cy={CY - 3.5} r={9.5} fill={p.accent} stroke={metal} strokeWidth={0.9} />
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            return <Line key={`r${i}`} x1={CX + Math.cos(a) * 4.6} y1={CY - 3.5 + Math.sin(a) * 4.6} x2={CX + Math.cos(a) * 9} y2={CY - 3.5 + Math.sin(a) * 9} stroke={p.ground} strokeWidth={0.6} opacity={0.6} />;
          })}
          <Circle cx={CX} cy={CY - 3.5} r={4.4} fill="#0A0918" />
          <Circle cx={CX + 3} cy={CY - 6.5} r={1.8} fill="#FFFFFF" />
        </G>
      );
    case 'daisy':
      return (
        <G>
          {back}
          <Glitter seed={seed} n={22} />
          {/* The electric daisy: petals in two enamels, a gold heart and two bolts of lightning. */}
          {Array.from({ length: 14 }, (_, i) => (
            <Ellipse key={i} cx={CX} cy={CY + 1 - 14.5} rx={4.6} ry={12} fill={i % 2 ? p.accent : '#E9D8FF'} stroke={metal} strokeWidth={0.7} transform={`rotate(${(i * 360) / 14} ${CX} ${CY + 1})`} />
          ))}
          <Circle cx={CX} cy={CY + 1} r={8.4} fill={p.accent2} stroke={metal} strokeWidth={1.1} />
          {seeded(seed, 14).map((v, i) => {
            const a = i * 2.4;
            const rr = Math.sqrt(i / 14) * 6.2;
            return <Circle key={`s${i}`} cx={CX + Math.cos(a) * rr} cy={CY + 1 + Math.sin(a) * rr} r={0.7 + v * 0.3} fill="#7A4E00" opacity={0.6} />;
          })}
          <Path d={`M 31 ${CY - 22} L 36 ${CY - 13} L 32.5 ${CY - 13} L 37 ${CY - 4} L 29 ${CY - 15} L 32.6 ${CY - 15} Z`} fill={metal} />
          <Path d={`M 86 ${CY + 6} L 91 ${CY + 15} L 87.5 ${CY + 15} L 92 ${CY + 24} L 84 ${CY + 13} L 87.6 ${CY + 13} Z`} fill={metal} />
        </G>
      );
    case 'skyline': {
      const heights = [14, 22, 17, 28, 19, 33, 24, 16, 26, 18, 12];
      const w = 72 / heights.length;
      return (
        <G>
          {back}
          <Circle cx={CX} cy={CY + 4} r={14} fill={p.accent} />
          {[0, 1, 2, 3].map((i) => (
            <Rect key={i} x={CX - 15} y={CY + 6 + i * 3.4} width={30} height={1.4} fill={sky} opacity={0.9} />
          ))}
          {/* The city, with lit windows; Austin gets its capitol dome. */}
          {city.includes('AUSTIN') ? (
            <G>
              <Path d={`M ${CX - 7} ${CY + 6} Q ${CX} ${CY - 6} ${CX + 7} ${CY + 6} Z`} fill={p.ground} stroke={metal} strokeWidth={0.8} />
              <Rect x={CX - 1} y={CY - 11} width={2} height={6} fill={metal} />
              <Circle cx={CX} cy={CY - 12} r={1.4} fill={metal} />
            </G>
          ) : null}
          {heights.map((h, i) => (
            <G key={i}>
              <Rect x={24 + i * w} y={CY + 26 - h} width={w - 0.6} height={h + 20} fill={p.ground} stroke={metal} strokeWidth={0.5} />
              {seeded(seed + i, 6).map((v, k) => (v > 0.45 ? <Rect key={k} x={24 + i * w + 1.2 + (k % 2) * (w / 2 - 0.6)} y={CY + 28 - h + Math.floor(k / 2) * 4.5} width={1.5} height={1.8} fill={p.accent} opacity={0.9} /> : null))}
            </G>
          ))}
          <Rect x={20} y={CY + 26} width={80} height={30} fill={p.ground} />
          <Line x1={20} y1={CY + 26} x2={100} y2={CY + 26} stroke={metal} strokeWidth={1} />
        </G>
      );
    }
    case 'infinity': {
      const d = `M ${CX} ${CY} C ${CX + 7} ${CY - 12} ${CX + 25} ${CY - 12} ${CX + 25} ${CY} C ${CX + 25} ${CY + 12} ${CX + 7} ${CY + 12} ${CX} ${CY} C ${CX - 7} ${CY - 12} ${CX - 25} ${CY - 12} ${CX - 25} ${CY} C ${CX - 25} ${CY + 12} ${CX - 7} ${CY + 12} ${CX} ${CY} Z`;
      return (
        <G>
          {back}
          <Glitter seed={seed} n={26} height={RS * 2} />
          <Burst x={36} y={CY - 18} r={8} color={p.accent2} metal={metal} />
          <Burst x={86} y={CY - 14} r={6} color={p.accent} metal={metal} />
          <Burst x={80} y={CY + 22} r={5} color={p.accent2} metal={metal} />
          {/* Eternal: an infinity sign that glows. */}
          <Path d={d} stroke={p.accent2} strokeWidth={9} fill="none" opacity={0.3} />
          <Path d={d} stroke={metal} strokeWidth={5.2} fill="none" strokeLinejoin="round" />
          <Path d={d} stroke={p.accent} strokeWidth={1.6} fill="none" />
        </G>
      );
    }
    case 'clock':
      return (
        <G>
          {back}
          <Glitter seed={seed} n={20} height={RS * 2} />
          {seeded(seed, 36).map((v, i) =>
            i % 3 === 0 ? <Rect key={i} x={24 + v * 72} y={CY - 30 + seeded(seed + i, 1)[0] * 60} width={2.2} height={1} fill={i % 2 ? p.accent2 : metal} transform={`rotate(${v * 180} ${24 + v * 72} ${CY})`} /> : null,
          )}
          {/* Countdown: a clock a breath before midnight. */}
          <Circle cx={CX} cy={CY} r={20} fill={p.accent} stroke={metal} strokeWidth={2.4} />
          <Circle cx={CX} cy={CY} r={17} fill="none" stroke={p.ground} strokeWidth={0.5} opacity={0.4} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const long = i % 3 === 0;
            return <Line key={i} x1={CX + Math.cos(a) * (long ? 13 : 14.5)} y1={CY + Math.sin(a) * (long ? 13 : 14.5)} x2={CX + Math.cos(a) * 17} y2={CY + Math.sin(a) * 17} stroke={p.ground} strokeWidth={long ? 1.6 : 0.8} />;
          })}
          <Line x1={CX} y1={CY} x2={CX} y2={CY - 12} stroke="#0A0918" strokeWidth={2} strokeLinecap="round" />
          <Line x1={CX} y1={CY} x2={CX - 1.6} y2={CY - 15} stroke={p.accent2} strokeWidth={1} strokeLinecap="round" />
          <Circle cx={CX} cy={CY} r={1.8} fill={metal} />
        </G>
      );
    case 'fireworks':
      return (
        <G>
          {back}
          <Glitter seed={seed} n={22} height={RS * 2} />
          <Burst x={CX} y={CY - 10} r={14} color={p.accent} metal={metal} />
          <Burst x={38} y={CY + 4} r={9} color={p.accent2} metal={metal} />
          <Burst x={84} y={CY - 2} r={8} color={p.accent2} metal={metal} />
          <Path d={`M 20 ${CY + 28} L 30 ${CY + 22} L 38 ${CY + 25} L 46 ${CY + 18} L 54 ${CY + 24} L 64 ${CY + 20} L 72 ${CY + 25} L 82 ${CY + 19} L 92 ${CY + 24} L 100 ${CY + 22} L 100 120 L 20 120 Z`} fill="#05040F" stroke={metal} strokeWidth={0.8} />
        </G>
      );
    case 'beach':
      return (
        <G>
          {back}
          <Circle cx={CX + 6} cy={CY + 8} r={15} fill={p.accent} />
          {[0, 1, 2].map((i) => (
            <Rect key={i} x={CX - 10} y={CY + 9 + i * 3.4} width={32} height={1.4} fill={sky} opacity={0.85} />
          ))}
          <Rect x={20} y={CY + 16} width={80} height={40} fill={p.ground} />
          <Waves y={CY + 20} metal={metal} />
          {/* A palm leaning in from the left. */}
          <Path d={`M 40 ${CY + 18} Q 38 ${CY + 2} 46 ${CY - 13}`} stroke="#1A0F24" strokeWidth={2.6} fill="none" strokeLinecap="round" />
          {[-150, -110, -70, -30, 10].map((deg, i) => {
            const a = (deg * Math.PI) / 180;
            const x2 = 46 + Math.cos(a) * 15;
            const y2 = CY - 13 + Math.sin(a) * 9 + 5;
            return <Path key={i} d={`M 46 ${CY - 13} Q ${46 + Math.cos(a) * 8} ${CY - 13 + Math.sin(a) * 9 - 3} ${x2} ${y2}`} stroke="#1A0F24" strokeWidth={2.4} fill="none" strokeLinecap="round" />;
          })}
        </G>
      );
    case 'desert':
      return (
        <G>
          {back}
          <Glitter seed={seed} n={10} />
          <Circle cx={CX + 4} cy={CY - 4} r={13} fill={p.accent} />
          <Path d={`M 20 ${CY + 12} L 30 ${CY + 12} L 32 ${CY + 2} L 50 ${CY + 2} L 53 ${CY + 12} L 70 ${CY + 12} L 72 ${CY + 6} L 86 ${CY + 6} L 89 ${CY + 12} L 100 ${CY + 12} L 100 120 L 20 120 Z`} fill={p.ground} opacity={0.75} stroke={metal} strokeWidth={0.7} />
          <Path d={`M 20 ${CY + 22} Q 50 ${CY + 15} 100 ${CY + 22} L 100 120 L 20 120 Z`} fill={p.ground} stroke={metal} strokeWidth={0.8} />
          {/* A saguaro. */}
          <Path d={`M 74 ${CY + 22} L 74 ${CY - 2} M 74 ${CY + 8} Q 66 ${CY + 8} 66 ${CY + 1} M 74 ${CY + 4} Q 81 ${CY + 4} 81 ${CY - 3}`} stroke={p.accent2} strokeWidth={4} fill="none" strokeLinecap="round" />
        </G>
      );
    case 'lake':
      return (
        <G>
          {back}
          <Glitter seed={seed} n={14} height={RS} />
          <Circle cx={CX + 13} cy={CY - 16} r={6} fill={p.accent} />
          <Path d={`M 20 ${CY + 8} L 38 ${CY - 12} L 50 ${CY} L 62 ${CY - 18} L 80 ${CY + 2} L 90 ${CY - 6} L 100 ${CY + 8} Z`} fill={p.accent} opacity={0.35} stroke={metal} strokeWidth={0.7} />
          <Rect x={20} y={CY + 8} width={80} height={50} fill={p.accent2} opacity={0.55} />
          <Waves y={CY + 14} metal={metal} n={2} />
          {/* Pines along the shore. */}
          {[26, 33, 84, 92, 99].map((x, i) => (
            <Path key={i} d={`M ${x} ${CY + 10 - (i % 2 ? 16 : 20)} L ${x + 5} ${CY + 10} L ${x - 5} ${CY + 10} Z`} fill={p.ground} stroke={metal} strokeWidth={0.5} />
          ))}
          <Rect x={20} y={CY + 24} width={80} height={30} fill={p.ground} />
        </G>
      );
    case 'castle':
      return (
        <G>
          {back}
          <Glitter seed={seed} n={22} height={RS * 1.2} />
          <Circle cx={CX + 16} cy={CY - 17} r={5} fill={p.accent} />
          {/* A fairytale castle with flags. */}
          <Path
            d={`M 36 ${CY + 24} L 36 ${CY - 2} L 41 ${CY - 10} L 46 ${CY - 2} L 46 ${CY + 6} L 52 ${CY + 6} L 52 ${CY - 8} L 60 ${CY - 20} L 68 ${CY - 8} L 68 ${CY + 6} L 74 ${CY + 6} L 74 ${CY - 2} L 79 ${CY - 10} L 84 ${CY - 2} L 84 ${CY + 24} Z`}
            fill={p.ground}
            stroke={metal}
            strokeWidth={1}
          />
          <Path d={`M 56 ${CY + 24} L 56 ${CY + 14} Q 60 ${CY + 9} 64 ${CY + 14} L 64 ${CY + 24} Z`} fill={p.accent} />
          {[
            [41, CY - 10],
            [60, CY - 20],
            [79, CY - 10],
          ].map(([x, y], i) => (
            <G key={i}>
              <Line x1={x} y1={y} x2={x} y2={y - 7} stroke={metal} strokeWidth={0.8} />
              <Path d={`M ${x} ${y - 7} L ${x + 5} ${y - 5.5} L ${x} ${y - 4} Z`} fill={p.accent2} />
            </G>
          ))}
          <Rect x={20} y={CY + 24} width={80} height={30} fill={p.ground} />
        </G>
      );
    case 'sound':
    default: {
      const bars = [6, 11, 17, 24, 19, 28, 21, 14, 22, 16, 9, 5];
      return (
        <G>
          {back}
          <Glitter seed={seed} n={24} height={RS * 2} />
          {bars.map((h, i) => (
            <Rect key={i} x={28 + i * 5.5} y={CY + 6 - h} width={3.6} height={h * 2 - 6} rx={1.8} fill={i % 2 ? p.accent : p.accent2} stroke={metal} strokeWidth={0.5} />
          ))}
          <Path d={`M 22 ${CY + 18} Q 32 ${CY + 10} 42 ${CY + 18} T 62 ${CY + 18} T 82 ${CY + 18} T 102 ${CY + 18}`} stroke={metal} strokeWidth={1.2} fill="none" />
        </G>
      );
    }
  }
}

/** The gold behind the round pin. */
function Backing({ backing, metal }: { backing: PinBacking; metal: string }) {
  switch (backing) {
    case 'rays': {
      const pts = Array.from({ length: 48 }, (_, i) => pt(i % 2 ? RO + 1 : RO + 11, (i / 48) * 360 - 90));
      return <Path d={`M ${pts.join(' L ')} Z`} fill={metal} />;
    }
    case 'star': {
      const pts = Array.from({ length: 16 }, (_, i) => pt(i % 2 ? RO + 2 : RO + 13, (i / 16) * 360 - 90));
      return <Path d={`M ${pts.join(' L ')} Z`} fill={metal} />;
    }
    case 'scallop':
      return (
        <G>
          {Array.from({ length: 18 }, (_, i) => {
            const a = ((i / 18) * 360 * Math.PI) / 180;
            return <Circle key={i} cx={CX + Math.cos(a) * (RO + 3)} cy={CY + Math.sin(a) * (RO + 3)} r={5.4} fill={metal} />;
          })}
        </G>
      );
    case 'none':
      return null;
  }
}

type Props = {
  look: PinLook;
  size: number;
  /** Not collected yet: a grey outline of the pin to come. */
  locked?: boolean;
  /** Where the shine is, -1 (left) to 1 (right): follows the phone's tilt on the badge's own page. */
  sheen?: SharedValue<number>;
};

/**
 * A festival's enamel pin, drawn: gold backing, a round body whose rim
 * carries the festival's name and town in raised letters, a scene that says
 * which festival it is in its own enamel colours with gold lines and
 * glitter, a ribbon with the dates, a gloss, and (when given) a shine that
 * moves as you tilt. Locked pins are grey.
 */
export function EnamelPin({ look, size, locked, sheen }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const u = (name: string) => `url(#${name}${id})`;
  const p = locked ? LOCKED : look.palette;
  const metalStops = locked ? ['#C9C8D6', '#8C8AA3', '#55536A', '#B5B3C6', '#6E6C84'] : ['#FFF6CF', '#E8B84A', '#9C6B1F', '#F7D57A', '#B8862B'];
  const seed = hashOf(look.rimText);
  // The rim text runs over the top, from low on the left to low on the right.
  const arc = `M ${pt(38.6, 158)} A 38.6 38.6 0 1 1 ${pt(38.6, 22)}`;
  // Fit the name to the rim: about 130 units of arc, letters ~0.78 of their size wide plus spacing.
  const rimSize = Math.max(4, Math.min(6.6, (130 / Math.max(10, look.rimText.length) - 0.7) / 0.78));
  const sheenProps = useAnimatedProps(() => ({ x: CX - 30 + (sheen ? sheen.get() : -0.4) * 70 }));
  const ink: Ink = { p, metal: u('metal'), sky: u('sky'), seed, city: look.rimText };

  const body: ReactNode = (
    <G>
      {/* Gold backing and its shadow. */}
      <G opacity={0.4} transform="translate(0 3.5)">
        <Circle cx={CX} cy={CY} r={RO + 1} fill="#000000" />
      </G>
      <Backing backing={look.backing} metal={u('metal')} />
      {/* The rim: gold edge, enamel band with the name, gold edge. */}
      <Circle cx={CX} cy={CY} r={RO} fill={u('metal')} />
      <Circle cx={CX} cy={CY} r={RO - 1.6} fill={u('metalDark')} />
      <Circle cx={CX} cy={CY} r={RO - 2.6} fill={p.rim} />
      <SvgText fontSize={rimSize} fontFamily={FONT} fontWeight="900" fill={u('metal')} letterSpacing={0.7}>
        <TextPath href={`#arc${id}`} startOffset="50%" textAnchor="middle">
          {look.rimText}
        </TextPath>
      </SvgText>
      <Circle cx={CX} cy={CY} r={RI} fill={u('metal')} />
      {/* The scene. */}
      <G clipPath={u('scene')}>
        <Scene theme={look.theme} ink={ink} />
      </G>
      <Circle cx={CX} cy={CY} r={RS} fill="none" stroke={u('metalDark')} strokeWidth={0.8} />
    </G>
  );

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessible={false}>
      <Defs>
        <LinearGradient id={`metal${id}`} x1="0" y1="0" x2="1" y2="1">
          {metalStops.map((c, i) => (
            <Stop key={i} offset={i / (metalStops.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
        <LinearGradient id={`metalDark${id}`} x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={locked ? '#4A4860' : '#7A5214'} />
          <Stop offset="1" stopColor={locked ? '#9896AE' : '#E3B24E'} />
        </LinearGradient>
        <LinearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.15" stopColor={p.sky[0]} />
          <Stop offset="0.75" stopColor={p.sky[1]} />
        </LinearGradient>
        <RadialGradient id={`gloss${id}`} cx="35%" cy="25%" r="60%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={locked ? 0.08 : 0.32} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={`sheen${id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={locked ? 0.12 : 0.42} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <ClipPath id={`scene${id}`}>
          <Circle cx={CX} cy={CY} r={RS} />
        </ClipPath>
        <ClipPath id={`face${id}`}>
          <Circle cx={CX} cy={CY} r={RO} />
        </ClipPath>
        <Path id={`arc${id}`} d={arc} />
      </Defs>

      <G opacity={locked ? 0.55 : 1}>{body}</G>

      {/* The ribbon with the dates. */}
      {look.ribbon ? (
        <G opacity={locked ? 0.7 : 1}>
          <Path d={`M 14 ${CY + 33} L 30 ${CY + 33} L 30 ${CY + 47} L 14 ${CY + 47} L 19 ${CY + 40} Z`} fill={u('metalDark')} />
          <Path d={`M 106 ${CY + 33} L 90 ${CY + 33} L 90 ${CY + 47} L 106 ${CY + 47} L 101 ${CY + 40} Z`} fill={u('metalDark')} />
          <Path d={`M 24 ${CY + 30} Q ${CX} ${CY + 35} 96 ${CY + 30} L 96 ${CY + 44} Q ${CX} ${CY + 49} 24 ${CY + 44} Z`} fill="#000000" opacity={0.35} transform="translate(0 2)" />
          <Path d={`M 24 ${CY + 30} Q ${CX} ${CY + 35} 96 ${CY + 30} L 96 ${CY + 44} Q ${CX} ${CY + 49} 24 ${CY + 44} Z`} fill={u('metal')} />
          <Path d={`M 27 ${CY + 32.4} Q ${CX} ${CY + 37.2} 93 ${CY + 32.4} L 93 ${CY + 41.6} Q ${CX} ${CY + 46.4} 27 ${CY + 41.6} Z`} fill={p.ribbon} />
          <SvgText x={CX} y={CY + 42.4} fontSize={look.ribbon.length > 16 ? 5 : look.ribbon.length > 14 ? 5.6 : 6.4} fontFamily={FONT} fontWeight="800" textAnchor="middle" fill={locked ? '#B5B3C6' : '#FFF6CF'} letterSpacing={0.9}>
            {look.ribbon}
          </SvgText>
        </G>
      ) : null}

      {/* Gloss and shine on the pin's face. */}
      <G clipPath={u('face')}>
        <Circle cx={CX} cy={CY} r={RO} fill={u('gloss')} />
        <AnimatedRect animatedProps={sheenProps} y={-10} width={24} height={140} fill={u('sheen')} transform={`rotate(18 ${CX} ${CY})`} />
      </G>
    </Svg>
  );
}
