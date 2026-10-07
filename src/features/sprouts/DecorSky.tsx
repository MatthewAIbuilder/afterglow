import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import type { DecorId } from './decor';

/** A string sagging between two points: the point `t` (0 to 1) along it. */
const swag = (x0: number, y0: number, x1: number, y1: number, sag: number, t: number) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)] as const;
const swagPath = (x0: number, y0: number, x1: number, y1: number, sag: number) => `M${x0} ${y0} Q${(x0 + x1) / 2} ${(y0 + y1) / 2 + sag * 2} ${x1} ${y1}`;

const BULBS = ['#FFE58A', '#FF8AD8', '#8AE6FF', '#B8FF8A', '#FFB86B'];

/**
 * Decorations in a garden's sky, behind the hills (the aurora, a rainbow,
 * the moon) or in front of them (fairy lights, bunting, paper lanterns).
 * Drawn inside the meadow's picture, `width` wide, the horizon at `hz`.
 */
export function DecorBehind({ decor, width, hz }: { decor: readonly DecorId[]; width: number; hz: number }) {
  const has = (d: DecorId) => decor.includes(d);
  return (
    <G>
      <Defs>
        <LinearGradient id="decor-aurora" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#5BE3B5" stopOpacity={0} />
          <Stop offset="0.3" stopColor="#5BE3B5" stopOpacity={0.35} />
          <Stop offset="0.65" stopColor="#B99CFF" stopOpacity={0.3} />
          <Stop offset="1" stopColor="#B99CFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {has('aurora') ? (
        <G>
          <Path d={`M0 ${hz * 0.5} C${width * 0.25} ${hz * 0.05} ${width * 0.45} ${hz * 0.75} ${width * 0.7} ${hz * 0.2} S${width * 0.95} ${hz * 0.15} ${width} ${hz * 0.35}`} stroke="url(#decor-aurora)" strokeWidth={16} fill="none" strokeLinecap="round" />
          <Path d={`M0 ${hz * 0.75} C${width * 0.3} ${hz * 0.35} ${width * 0.55} ${hz * 0.95} ${width * 0.8} ${hz * 0.45} S${width} ${hz * 0.5} ${width} ${hz * 0.6}`} stroke="url(#decor-aurora)" strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.7} />
        </G>
      ) : null}
      {has('rainbow') ? (
        <G opacity={0.4}>
          {['#FF6A8A', '#FFB86B', '#FFE58A', '#8AFFB0', '#8AB8FF', '#B99CFF'].map((c, i) => (
            <Path key={c} d={`M${width * 0.12 + i * 3} ${hz + 20} A${width * 0.38 - i * 3} ${hz + 6 - i * 3} 0 0 1 ${width * 0.88 - i * 3} ${hz + 20}`} stroke={c} strokeWidth={3} fill="none" />
          ))}
        </G>
      ) : null}
      {has('moon') ? (
        <G>
          <Circle cx={22} cy={14} r={15} fill="#FFF3C8" opacity={0.08} />
          <Path d="M25 4 A10 10 0 1 0 31 21 A7.8 7.8 0 1 1 25 4 Z" fill="#FFF3C8" opacity={0.92} />
        </G>
      ) : null}
    </G>
  );
}

export function DecorFront({ decor, width, hz }: { decor: readonly DecorId[]; width: number; hz: number }) {
  const has = (d: DecorId) => decor.includes(d);
  const n = Math.max(8, Math.round(width / 26));
  return (
    <G>
      {has('bunting') ? (
        <G>
          <Path d={swagPath(44, 3, width + 4, 6, 6)} stroke="#D8DCE6" strokeWidth={0.7} fill="none" opacity={0.6} />
          {Array.from({ length: n - 2 }, (_, i) => {
            const [x, y] = swag(44, 3, width + 4, 6, 6, (i + 0.5) / (n - 2));
            return <Path key={i} d={`M${x - 5} ${y} L${x + 5} ${y} L${x} ${y + 9}Z`} fill={BULBS[i % BULBS.length]} opacity={0.85} />;
          })}
        </G>
      ) : null}
      {has('lights') || has('lanterns') ? (
        <G>
          <Path d={swagPath(-4, hz * 0.42, width + 4, hz * 0.36, 7)} stroke="#2A3A2E" strokeWidth={0.9} fill="none" opacity={0.9} />
          {has('lights')
            ? Array.from({ length: n + 4 }, (_, i) => {
                const [x, y] = swag(-4, hz * 0.42, width + 4, hz * 0.36, 7, (i + 0.5) / (n + 4));
                const c = BULBS[i % BULBS.length];
                return (
                  <G key={i}>
                    <Circle cx={x} cy={y + 2.4} r={5} fill={c} opacity={0.18} />
                    <Ellipse cx={x} cy={y + 2.4} rx={1.6} ry={2.2} fill={c} />
                  </G>
                );
              })
            : null}
          {has('lanterns')
            ? [0.18, 0.42, 0.66, 0.88].map((tt, i) => {
                const [x, y] = swag(-4, hz * 0.42, width + 4, hz * 0.36, 7, tt);
                const c = ['#FF7A8A', '#FFB86B', '#B99CFF', '#5BE3B5'][i];
                return (
                  <G key={tt}>
                    <Path d={`M${x} ${y} L${x} ${y + 4}`} stroke="#2A3A2E" strokeWidth={0.8} />
                    <Circle cx={x} cy={y + 11} r={11} fill={c} opacity={0.16} />
                    <Ellipse cx={x} cy={y + 11} rx={6.4} ry={7.4} fill={c} />
                    <Path d={`M${x - 6} ${y + 9} Q${x} ${y + 7} ${x + 6} ${y + 9} M${x - 6} ${y + 13} Q${x} ${y + 15} ${x + 6} ${y + 13}`} stroke="#FFFFFF" strokeWidth={0.6} opacity={0.4} fill="none" />
                    <Ellipse cx={x - 2} cy={y + 8.6} rx={1.6} ry={2.4} fill="#FFFFFF" opacity={0.35} />
                  </G>
                );
              })
            : null}
        </G>
      ) : null}
    </G>
  );
}

/** A decoration on its own, as a little picture (for the collection), `size` wide. */
export function DecorIcon({ id, size = 64 }: { id: DecorId; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={32} cy={32} r={30} fill="#141024" />
      {id === 'lights' ? (
        <G>
          <Path d="M6 22 Q32 44 58 22" stroke="#2A3A2E" strokeWidth={1.2} fill="none" />
          {[0.12, 0.3, 0.5, 0.7, 0.88].map((tt, i) => {
            const [x, y] = swag(6, 22, 58, 22, 11, tt);
            return (
              <G key={tt}>
                <Circle cx={x} cy={y + 3} r={5} fill={BULBS[i]} opacity={0.25} />
                <Ellipse cx={x} cy={y + 3} rx={2.2} ry={3} fill={BULBS[i]} />
              </G>
            );
          })}
        </G>
      ) : id === 'bunting' ? (
        <G>
          <Path d="M6 18 Q32 34 58 18" stroke="#D8DCE6" strokeWidth={1} fill="none" />
          {[0.14, 0.32, 0.5, 0.68, 0.86].map((tt, i) => {
            const [x, y] = swag(6, 18, 58, 18, 8, tt);
            return <Path key={tt} d={`M${x - 5} ${y} L${x + 5} ${y} L${x} ${y + 11}Z`} fill={BULBS[i]} />;
          })}
        </G>
      ) : id === 'moon' ? (
        <G>
          <Circle cx={32} cy={32} r={18} fill="#FFF3C8" opacity={0.1} />
          <Path d="M35 16 A16 16 0 1 0 45 44 A12.5 12.5 0 1 1 35 16 Z" fill="#FFF3C8" />
        </G>
      ) : id === 'rainbow' ? (
        <G>
          {['#FF6A8A', '#FFB86B', '#FFE58A', '#8AFFB0', '#8AB8FF', '#B99CFF'].map((c, i) => (
            <Path key={c} d={`M${10 + i * 3} 44 A${22 - i * 3} ${22 - i * 3} 0 0 1 ${54 - i * 3} 44`} stroke={c} strokeWidth={3} fill="none" />
          ))}
        </G>
      ) : id === 'lanterns' ? (
        <G>
          {[
            [22, '#FF7A8A'],
            [42, '#B99CFF'],
          ].map(([x, c]) => (
            <G key={String(x)}>
              <Path d={`M${x} 12 L${x} 20`} stroke="#8A8AA0" strokeWidth={1} />
              <Circle cx={Number(x)} cy={32} r={14} fill={String(c)} opacity={0.18} />
              <Ellipse cx={Number(x)} cy={32} rx={8.4} ry={10.4} fill={String(c)} />
              <Ellipse cx={Number(x) - 2.6} cy={28} rx={2} ry={3} fill="#FFFFFF" opacity={0.35} />
            </G>
          ))}
        </G>
      ) : (
        <G>
          <Path d="M4 30 C18 14 30 40 44 22 S60 20 62 26" stroke="#5BE3B5" strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.6} />
          <Path d="M4 40 C20 26 32 50 46 34 S60 34 62 38" stroke="#B99CFF" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.55} />
        </G>
      )}
    </Svg>
  );
}
