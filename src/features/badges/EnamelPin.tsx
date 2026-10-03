import { useId } from 'react';
import { Platform } from 'react-native';
import Animated, { type SharedValue, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { PinLook, PinMotif, PinShape } from './badges';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
/** A heavy, clean sans for the struck letters (SVG text doesn't use the app's font by itself). */
const FONT = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-black', default: '"Helvetica Neue", Arial, sans-serif' });

/** The pin is drawn on a 120 × 120 grid; the face sits a little high, the year ribbon below it. */
const CX = 60;
const CY = 56;
const R = 48;

/** A shape's outline at radius r around the face's centre. */
export function shapePath(shape: PinShape, r: number, cx = CX, cy = CY): string {
  const pts = (n: number, inner: number | undefined, turn = -Math.PI / 2) => {
    const out: string[] = [];
    const steps = inner ? n * 2 : n;
    for (let i = 0; i < steps; i++) {
      const rr = inner && i % 2 ? inner : r;
      const a = turn + (i / steps) * Math.PI * 2;
      out.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
    }
    return `M ${out.join(' L ')} Z`;
  };
  switch (shape) {
    case 'circle':
      return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
    case 'hexagon':
      return pts(6, undefined);
    case 'diamond':
      return pts(4, undefined);
    case 'burst':
      return pts(16, r * 0.88);
    case 'shield': {
      const w = r * 0.88;
      return `M ${cx - w} ${cy - r * 0.78} Q ${cx} ${cy - r * 1.02} ${cx + w} ${cy - r * 0.78} L ${cx + w} ${cy + r * 0.05} Q ${cx + w} ${cy + r * 0.72} ${cx} ${cy + r} Q ${cx - w} ${cy + r * 0.72} ${cx - w} ${cy + r * 0.05} Z`;
    }
  }
}

/** Raised metal lines across the enamel, different for each festival. */
function Motif({ motif, metal }: { motif: PinMotif; metal: string }) {
  switch (motif) {
    case 'rays':
      return (
        <G>
          {Array.from({ length: 18 }, (_, i) => {
            const a1 = (i / 18) * Math.PI * 2;
            const a2 = ((i + 0.5) / 18) * Math.PI * 2;
            return (
              <Path
                key={i}
                d={`M ${CX} ${CY} L ${CX + 80 * Math.cos(a1)} ${CY + 80 * Math.sin(a1)} L ${CX + 80 * Math.cos(a2)} ${CY + 80 * Math.sin(a2)} Z`}
                fill="#FFFFFF"
                opacity={0.09}
              />
            );
          })}
        </G>
      );
    case 'waves':
      return (
        <G>
          {[0, 1, 2, 3].map((i) => {
            const y = CY + 12 + i * 8;
            return <Path key={i} d={`M 0 ${y} Q 15 ${y - 6} 30 ${y} T 60 ${y} T 90 ${y} T 120 ${y}`} stroke={metal} strokeWidth={1.6} fill="none" opacity={0.85 - i * 0.15} />;
          })}
        </G>
      );
    case 'peaks':
      return (
        <G>
          <Circle cx={CX + 20} cy={CY - 26} r={6} fill={metal} opacity={0.9} />
          <Path d={`M 0 ${CY + 34} L 24 ${CY + 18} L 40 ${CY + 26} L 62 ${CY + 12} L 84 ${CY + 28} L 98 ${CY + 20} L 120 ${CY + 34} L 120 120 L 0 120 Z`} fill="#000000" opacity={0.28} />
          <Path d={`M 0 ${CY + 34} L 24 ${CY + 18} L 40 ${CY + 26} L 62 ${CY + 12} L 84 ${CY + 28} L 98 ${CY + 20} L 120 ${CY + 34}`} stroke={metal} strokeWidth={1.6} fill="none" />
        </G>
      );
    case 'stars':
      return (
        <G>
          {[
            [30, 30, 3],
            [88, 26, 2.4],
            [24, 70, 2],
            [94, 66, 3],
            [72, 86, 2],
            [44, 88, 1.6],
            [100, 44, 1.6],
          ].map(([x, y, s], i) => (
            <Path key={i} d={`M ${x} ${y - s * 2} Q ${x} ${y} ${x + s * 2} ${y} Q ${x} ${y} ${x} ${y + s * 2} Q ${x} ${y} ${x - s * 2} ${y} Q ${x} ${y} ${x} ${y - s * 2} Z`} fill={metal} />
          ))}
        </G>
      );
    case 'rings':
      return (
        <G>
          {[14, 24, 34, 44].map((r, i) => (
            <Circle key={r} cx={CX} cy={CY} r={r} stroke={metal} strokeWidth={1.2} fill="none" opacity={0.6 - i * 0.1} />
          ))}
          <Line x1={0} y1={CY} x2={120} y2={CY} stroke={metal} strokeWidth={0.8} opacity={0.35} />
        </G>
      );
  }
}

type Props = {
  look: PinLook;
  size: number;
  /** Not collected yet: a dim silver outline of the pin to come. */
  locked?: boolean;
  /** Where the shine is, -1 (left) to 1 (right): follows the phone's tilt on the badge's own page. */
  sheen?: SharedValue<number>;
};

/**
 * A festival's enamel pin, drawn: a gold shape with a bevelled edge, the
 * festival's own enamel colours with raised metal lines, its mark struck in
 * gold, a ribbon with the year, a soft gloss, and (when given) a shine that
 * moves as you tilt. Locked pins are dim silver.
 */
export function EnamelPin({ look, size, locked, sheen }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const u = (name: string) => `url(#${name}${id})`;
  const [e1, e2] = locked ? (['#3A3850', '#232235'] as const) : look.enamel;
  const metalStops = locked
    ? ['#C9C8D6', '#8C8AA3', '#55536A', '#B5B3C6', '#6E6C84']
    : ['#FFF6CF', '#E8B84A', '#9C6B1F', '#F7D57A', '#B8862B'];
  const face = shapePath(look.shape, R);
  const enamel = shapePath(look.shape, R * 0.8);
  const bevel = shapePath(look.shape, R * 0.86);
  const markSize = look.mark.length >= 3 ? 25 : look.mark.length === 2 ? 30 : 34;
  const sheenProps = useAnimatedProps(() => ({ x: CX - 30 + (sheen ? sheen.get() : -0.4) * 70 }));

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
        <RadialGradient id={`enamel${id}`} cx="35%" cy="30%" r="80%">
          <Stop offset="0" stopColor={e2} />
          <Stop offset="1" stopColor={e1} />
        </RadialGradient>
        <LinearGradient id={`sheen${id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={locked ? 0.12 : 0.38} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <ClipPath id={`face${id}`}>
          <Path d={face} />
        </ClipPath>
        <ClipPath id={`enamelClip${id}`}>
          <Path d={enamel} />
        </ClipPath>
      </Defs>

      {/* Its shadow on the surface below. */}
      <Path d={face} fill="#000000" opacity={0.4} transform="translate(0 3.5)" />
      {/* The gold (or, locked, silver) body, with a bevel. */}
      <Path d={face} fill={u('metal')} />
      <Path d={bevel} fill={u('metalDark')} />
      {/* The enamel, its raised lines, and the metal edge around it. */}
      <Path d={enamel} fill={u('enamel')} />
      <G clipPath={u('enamelClip')}>
        <Motif motif={look.motif} metal={u('metal')} />
      </G>
      <Path d={enamel} fill="none" stroke={u('metal')} strokeWidth={1.8} />

      {/* The festival's mark, struck in metal: a dark outline under the gold so it reads on any enamel. */}
      <SvgText x={CX} y={CY + markSize * 0.36 + 1.8} fontSize={markSize} fontFamily={FONT} fontWeight="900" textAnchor="middle" fill="#000000" opacity={0.45} letterSpacing={0.5}>
        {look.mark}
      </SvgText>
      <SvgText x={CX} y={CY + markSize * 0.36} fontSize={markSize} fontFamily={FONT} fontWeight="900" textAnchor="middle" fill="none" stroke={locked ? '#1E1D2B' : '#3A2606'} strokeWidth={3.2} strokeLinejoin="round" letterSpacing={0.5}>
        {look.mark}
      </SvgText>
      <SvgText x={CX} y={CY + markSize * 0.36} fontSize={markSize} fontFamily={FONT} fontWeight="900" textAnchor="middle" fill={u('metal')} letterSpacing={0.5}>
        {look.mark}
      </SvgText>

      {/* The year, on a ribbon across the bottom. */}
      {look.year ? (
        <G>
          <Path d={`M 26 ${CY + 36} L 94 ${CY + 36} L 88 ${CY + 45} L 94 ${CY + 54} L 26 ${CY + 54} L 32 ${CY + 45} Z`} fill="#000000" opacity={0.35} transform="translate(0 2)" />
          <Path d={`M 26 ${CY + 36} L 94 ${CY + 36} L 88 ${CY + 45} L 94 ${CY + 54} L 26 ${CY + 54} L 32 ${CY + 45} Z`} fill={u('metal')} />
          <Rect x={34} y={CY + 39} width={52} height={12} rx={2} fill={e1} />
          <SvgText x={CX} y={CY + 48.5} fontSize={9} fontFamily={FONT} fontWeight="800" textAnchor="middle" fill={locked ? '#9896AE' : '#FFF6CF'} letterSpacing={2.4}>
            {look.year}
          </SvgText>
        </G>
      ) : null}

      {/* Gloss and shine, only on the pin itself. */}
      <G clipPath={u('face')}>
        <Ellipse cx={CX - 14} cy={CY - 26} rx={34} ry={13} fill="#FFFFFF" opacity={locked ? 0.06 : 0.2} transform={`rotate(-22 ${CX - 14} ${CY - 26})`} />
        <AnimatedRect animatedProps={sheenProps} y={-10} width={26} height={140} fill={u('sheen')} transform={`rotate(18 ${CX} ${CY})`} />
      </G>
    </Svg>
  );
}
