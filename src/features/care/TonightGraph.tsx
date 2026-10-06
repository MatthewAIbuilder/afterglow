import { useId, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { color, space, type } from '../../theme/tokens';
import { type FeelingPoint, graphTimes, lowestPoints, MOOD_LABEL, nightSummary } from './care';
import { smoothPath } from './curve';
import { LEVEL_COLOR } from './feelings';
import { mix } from '../sprouts/artistLook';

const MIN = 60_000;
const HEIGHT = 112;
const TOP = 14;
const BOTTOM = 26;
const PAD_X = 10;
const LABEL_W = 72;
const TIME_W = 44;

/**
 * Tonight at a glance: a smooth line through your check-ins (great at the
 * top, not great at the bottom) from the first one to now, coloured by how
 * you felt at each, a soft glow under it, the latest check-in lit, and the
 * lowest moments named underneath.
 */
export function TonightGraph({ points, now }: { points: FeelingPoint[]; now: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [width, setWidth] = useState(0);
  const from = points[0].at;
  const to = Math.max(now, points[points.length - 1].at, from + MIN);
  const inner = Math.max(1, width - PAD_X * 2);
  const x = (at: number) => PAD_X + ((at - from) / (to - from)) * inner;
  const y = (level: number) => TOP + ((5 - level) / 4) * (HEIGHT - TOP - BOTTOM);
  const xy = points.map((p) => ({ x: x(p.at), y: y(p.level) }));
  const line = smoothPath(xy);
  const first = xy[0];
  const last = xy[xy.length - 1];
  const area = `${line} L${last.x} ${HEIGHT} L${first.x} ${HEIGHT} Z`;
  const span = last.x - first.x;
  const latest = points[points.length - 1];

  // Name the lowest moments, leaving out any that would sit on top of another.
  const lows: { p: FeelingPoint; x: number; y: number }[] = [];
  for (const p of lowestPoints(points)) {
    const at = { p, x: x(p.at), y: y(p.level) };
    if (!lows.length || at.x - lows[lows.length - 1].x >= LABEL_W) lows.push(at);
  }
  // Times along the bottom: first, a couple between when there's room, and now.
  const times = graphTimes(from, to).filter((t, i, all) => i === 0 || i === all.length - 1 || (x(t.at) - x(all[0].at) >= TIME_W && x(all[all.length - 1].at) - x(t.at) >= TIME_W));

  return (
    <View accessible accessibilityLabel={nightSummary(points)}>
      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <>
            <Svg width={width} height={HEIGHT}>
              <Defs>
                <LinearGradient id={`l${id}`} gradientUnits="userSpaceOnUse" x1={first.x} y1={0} x2={span > 0 ? last.x : first.x + 1} y2={0}>
                  {points.map((p, i) => (
                    <Stop key={p.at} offset={span > 0 ? (xy[i].x - first.x) / span : i / Math.max(1, points.length - 1)} stopColor={LEVEL_COLOR[p.level]} />
                  ))}
                </LinearGradient>
                <LinearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color.glow} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={color.glow} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={area} fill={`url(#a${id})`} />
              <Path d={line} fill="none" stroke={`url(#l${id})`} strokeWidth={7} strokeOpacity={0.22} strokeLinecap="round" strokeLinejoin="round" />
              <Path d={line} fill="none" stroke={`url(#l${id})`} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
              {points.slice(0, -1).map((p, i) => (
                <Circle key={p.at} cx={xy[i].x} cy={xy[i].y} r={4.5} fill={LEVEL_COLOR[p.level]} />
              ))}
              <Circle cx={last.x} cy={last.y} r={10} fill={LEVEL_COLOR[latest.level]} opacity={0.28} />
              <Circle cx={last.x} cy={last.y} r={6.5} fill={LEVEL_COLOR[latest.level]} stroke={mix(LEVEL_COLOR[latest.level], '#FFFFFF', 0.5)} strokeWidth={1} />
            </Svg>
            {lows.map(({ p, x: lx, y: ly }) => (
              <Text
                key={p.at}
                numberOfLines={1}
                style={[styles.low, { left: Math.min(Math.max(0, lx - LABEL_W / 2), width - LABEL_W), top: ly + 9, color: mix(LEVEL_COLOR[p.level], '#FFFFFF', 0.35) }]}
              >
                {MOOD_LABEL[p.mood]}
              </Text>
            ))}
          </>
        ) : null}
      </View>
      <View style={styles.times}>
        {width
          ? times.map((t, i) => {
              const tx = x(t.at);
              const edge = i === 0 ? { left: Math.max(0, tx - PAD_X), textAlign: 'left' as const } : i === times.length - 1 ? { left: Math.min(width, tx + PAD_X) - TIME_W, textAlign: 'right' as const } : { left: tx - TIME_W / 2, textAlign: 'center' as const };
              return (
                <Text key={`${t.label}${t.at}`} numberOfLines={1} style={[styles.time, edge]}>
                  {t.label}
                </Text>
              );
            })
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { height: HEIGHT },
  low: { ...type.caption, position: 'absolute', width: LABEL_W, textAlign: 'center' },
  times: { height: 16, marginTop: space.xs },
  time: { ...type.caption, fontSize: 11, color: color.moonFaint, position: 'absolute', width: TIME_W },
});
