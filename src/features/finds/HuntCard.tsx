import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { APP_NAME } from '../../config/app';
import { color, radius, space, type } from '../../theme/tokens';
import { Collectible, TIER_COLOR } from '../sprouts/Collectible';
import { counts, huntDateLine, huntLine, type HuntProgress, lookOf } from './finds';

const GOLD = TIER_COLOR[3];
const PAD = space.xl;
const GAP = space.sm;

/**
 * A hunt as a picture to share: night gradient with a glow (gold once it's
 * finished), the hunt's name, every sticker in it (the ones you found in
 * colour, the rest as grey figures) and how far you got. `width` is the
 * card's width, so the stickers fill it.
 */
export function HuntCard({ progress, width }: { progress: HuntProgress; width: number }) {
  const { hunt, found, done } = progress;
  const shown = hunt.items.map((item, i) => ({ item, i })).filter(({ i }) => counts(hunt, found, i));
  const cols = shown.length <= 4 ? 2 : shown.length <= 9 ? 3 : 4;
  const size = Math.floor((width - PAD * 2 - GAP * (cols - 1)) / cols);
  const glow = done ? GOLD : color.glow;
  const g = width * 1.1;
  return (
    <View style={[styles.card, { width }, done && styles.done]} accessible accessibilityLabel={`${hunt.name}: ${huntLine(progress)}.`}>
      <LinearGradient colors={done ? ['#3A2A10', '#17112B', color.night] : ['#2A1A5E', '#140F33', color.night]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <Svg width={g} height={g} style={[styles.glow, { left: (width - g) / 2 }]} pointerEvents="none">
        <Defs>
          <RadialGradient id="hunt-card-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={glow} stopOpacity={0.32} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={g / 2} cy={g / 2} r={g / 2} fill="url(#hunt-card-glow)" />
      </Svg>
      <Text style={styles.brand}>{APP_NAME.toUpperCase()}</Text>
      <Text style={[styles.kicker, { color: done ? GOLD : color.glow }]}>{done ? 'HUNT COMPLETE' : 'STICKER HUNT'}</Text>
      <Text style={styles.title}>{hunt.name}</Text>
      <View style={[styles.grid, { gap: GAP }]}>
        {shown.map(({ item, i }) => (
          <View key={i} style={{ width: size, alignItems: 'center' }}>
            <Collectible look={lookOf(item.creature)} size={size} tier={found[i] && done ? 3 : 0} locked={!found[i]} still />
            <Text style={[styles.name, !found[i] && styles.faint]} numberOfLines={2}>
              {found[i] ? item.name : 'Still out there'}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[styles.line, done && { color: GOLD }]}>{huntLine(progress)}</Text>
      <Text style={styles.date}>{huntDateLine(progress)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', padding: PAD, gap: space.xs, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  done: { borderColor: 'rgba(255,210,74,0.55)' },
  glow: { position: 'absolute', top: -40 },
  brand: { ...type.caption, color: color.moonFaint, letterSpacing: 3 },
  kicker: { ...type.label, letterSpacing: 2, marginTop: space.sm },
  title: { ...type.title, color: color.moon, textAlign: 'center', marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignSelf: 'stretch' },
  name: { ...type.caption, color: color.moon, textAlign: 'center', marginTop: 4, marginBottom: space.sm },
  faint: { color: color.moonFaint },
  line: { ...type.headline, color: color.moon, marginTop: space.sm },
  date: { ...type.caption, color: color.moonDim },
});
