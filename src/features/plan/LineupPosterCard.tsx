import { LinearGradient } from 'expo-linear-gradient';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { APP_NAME } from '../../config/app';
import { color, radius, space, type } from '../../theme/tokens';
import type { LineupPoster } from './lineupPoster';

/**
 * Your lineup as a festival poster: the festival up top, your headliners big,
 * then smaller rows, centred, names split by soft dots. Captured as an image
 * on phones (`sharePoster`).
 */
export function LineupPosterCard({ poster }: { poster: LineupPoster }) {
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`Your ${poster.festival} lineup poster: ${poster.rows.flatMap((r) => r.names.map((n) => n.name)).join(', ')}${poster.more ? `, and ${poster.more} more` : ''}`}
    >
      <LinearGradient colors={['#1B1240', '#2A1A5E', '#140F33', color.night]} locations={[0, 0.35, 0.7, 1]} style={StyleSheet.absoluteFill} />
      <Svg width={GLOW} height={GLOW} style={styles.glow} pointerEvents="none">
        <Defs>
          <RadialGradient id="poster-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color.glow} stopOpacity={0.45} />
            <Stop offset="1" stopColor={color.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#poster-glow)" />
      </Svg>
      <Text style={styles.brand}>{APP_NAME.toUpperCase()} PRESENTS</Text>
      <Text style={styles.festival}>{poster.festival}</Text>
      <Text style={styles.kicker}>Your lineup</Text>
      <View style={styles.rule} />
      {poster.rows.map((row, i) => (
        <Text key={row.size} style={[styles.row, ROW[row.size], i > 0 && { marginTop: row.size === 'mid' ? space.lg : space.md }]}>
          {row.names.map((n, k) => (
            <Fragment key={`${n.name}-${k}`}>
              {k > 0 ? <Text style={styles.dot}>{'  ·  '}</Text> : null}
              {n.star ? <Text style={styles.star}>★ </Text> : null}
              {n.name}
            </Fragment>
          ))}
        </Text>
      ))}
      {poster.more > 0 ? <Text style={styles.more}>and {poster.more} more</Text> : null}
      <View style={styles.rule} />
      {poster.subtitle ? <Text style={styles.where}>{poster.subtitle}</Text> : null}
      <Text style={styles.foot}>Made with {APP_NAME}</Text>
    </View>
  );
}

const GLOW = 360;

const ROW = StyleSheet.create({
  top: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5, color: color.moon },
  mid: { fontSize: 18, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2, color: color.moon },
  rest: { fontSize: 13, lineHeight: 20, fontWeight: '600', letterSpacing: 0.2, color: color.moonDim },
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', paddingHorizontal: space.xl, paddingVertical: space.xxl, backgroundColor: color.night, alignItems: 'center' },
  glow: { position: 'absolute', top: -GLOW / 2.2, alignSelf: 'center' },
  brand: { ...type.caption, color: color.glow, letterSpacing: 3, textAlign: 'center' },
  festival: { ...type.largeTitle, color: color.moon, textAlign: 'center', marginTop: space.sm, textTransform: 'uppercase' },
  kicker: { ...type.label, color: color.moonDim, letterSpacing: 2, textTransform: 'uppercase', marginTop: space.xs },
  rule: { width: 48, height: 2, borderRadius: 1, backgroundColor: color.glow, opacity: 0.6, marginVertical: space.lg },
  row: { textAlign: 'center', textTransform: 'uppercase' },
  dot: { color: color.glow },
  star: { color: color.glow },
  more: { ...type.caption, color: color.moonFaint, marginTop: space.sm, textAlign: 'center' },
  where: { ...type.label, color: color.moonDim, textAlign: 'center' },
  foot: { ...type.caption, color: color.moonFaint, marginTop: space.md, textAlign: 'center' },
});
