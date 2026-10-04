import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { APP_NAME, WEB_URL } from '../../config/app';
import { color, radius, space, type } from '../../theme/tokens';
import type { MustSeeCard } from './mustSeeCard';

/**
 * Your must-sees as a picture: the festival, then your top picks, each with
 * their face, your match and why they're on your list. Captured as an image on
 * phones (`sharePoster`).
 */
export function MustSeeCardView({ card }: { card: MustSeeCard }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`My must-sees at ${card.festival}: ${card.lines.map((l) => `${l.artist.name}, ${l.why}`).join(' ')}`}>
      <LinearGradient colors={['#2A1A5E', '#160F36', color.night]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Svg width={GLOW} height={GLOW} style={styles.glow} pointerEvents="none">
        <Defs>
          <RadialGradient id="must-see-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color.glow} stopOpacity={0.42} />
            <Stop offset="1" stopColor={color.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#must-see-glow)" />
      </Svg>
      <Text style={styles.kicker}>MY MUST-SEES</Text>
      <Text style={styles.title}>{card.festival}</Text>
      {card.subtitle ? <Text style={styles.subtitle}>{card.subtitle}</Text> : null}
      <View style={styles.list}>
        {card.lines.map((l, i) => (
          <View key={l.artist.id} style={[styles.row, i > 0 && styles.divided]}>
            <Text style={styles.rank}>{i + 1}</Text>
            <ArtistAvatar artist={l.artist} size={46} />
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {l.star ? <Text style={styles.star}>★ </Text> : null}
                {l.artist.name}
              </Text>
              <Text style={styles.why} numberOfLines={2}>
                {l.why}
              </Text>
            </View>
            {l.match !== undefined ? <Text style={styles.match}>{Math.round(l.match * 100)}%</Text> : null}
          </View>
        ))}
      </View>
      <Text style={styles.foot}>
        Made with {APP_NAME} · {WEB_URL.replace('https://', '')}
      </Text>
    </View>
  );
}

const GLOW = 340;

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', padding: space.xl, backgroundColor: color.night },
  glow: { position: 'absolute', top: -GLOW / 2.4, left: -GLOW / 4 },
  kicker: { ...type.caption, color: color.glow, letterSpacing: 2.5 },
  title: { ...type.largeTitle, color: color.moon, marginTop: space.sm },
  subtitle: { ...type.label, color: color.moonDim, marginTop: space.xs },
  list: { marginTop: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  rank: { ...type.title, color: color.moonFaint, width: 20, textAlign: 'center', fontVariant: ['tabular-nums'] },
  text: { flex: 1 },
  name: { ...type.headline, color: color.moon },
  star: { color: color.glow },
  why: { ...type.caption, color: color.moonDim, marginTop: 2 },
  match: { ...type.label, color: color.glow, fontVariant: ['tabular-nums'] },
  foot: { ...type.caption, color: color.moonFaint, marginTop: space.lg },
});
