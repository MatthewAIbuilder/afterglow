import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { APP_NAME } from '../../config/app';
import type { Festival } from '../../data/models';
import { color, space, type } from '../../theme/tokens';
import type { Standing } from '../social/models';
import { StandingAvatar } from '../standing/StandingAvatar';
import { type Badge, earnedLine, pinLook } from './badges';
import { EnamelPin } from './EnamelPin';

/** The card is a phone story (9:16), this wide at most. */
export const BADGE_CARD_WIDTH = 330;

/**
 * A badge as a picture to share, shaped for stories: the pin big on a glow
 * in its own colours, "COLLECTED", the festival, its dates and town, when it
 * was earned, and whose it is (with a founder's gold ring).
 */
export function BadgeCard({
  festival,
  badge,
  width,
  person,
}: {
  festival: Festival;
  badge?: Badge;
  width: number;
  person?: { name: string; handle: string; avatarUrl?: string; standing?: Standing };
}) {
  const look = pinLook(festival);
  const height = Math.round((width * 16) / 9);
  const pin = Math.round(width * 0.72);
  return (
    <View style={[styles.card, { width, height }]} accessible accessibilityLabel={`${festival.name} badge${person ? `, collected by ${person.name}` : ''}`} collapsable={false}>
      <LinearGradient colors={[look.palette.sky[0], '#140F33', color.night]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={width} style={[styles.glow, { top: height * 0.12 }]} pointerEvents="none">
        <Defs>
          <RadialGradient id="badge-card-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={look.palette.accent} stopOpacity={0.45} />
            <Stop offset="1" stopColor={look.palette.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={width / 2} cy={width / 2} r={width / 2} fill="url(#badge-card-glow)" />
      </Svg>
      <Text style={styles.brand}>{APP_NAME.toUpperCase()}</Text>
      <View style={styles.pin}>
        <EnamelPin look={look} size={pin} />
      </View>
      <Text style={styles.kicker}>{badge ? 'COLLECTED' : 'FESTIVAL BADGE'}</Text>
      <Text style={styles.name} numberOfLines={2}>
        {festival.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {[festival.dates, festival.location?.split(',').pop()?.trim()].filter(Boolean).join(' · ')}
      </Text>
      {badge ? <Text style={styles.earned}>{earnedLine(badge)}</Text> : null}
      <View style={{ flex: 1 }} />
      {person ? (
        <View style={styles.person}>
          <StandingAvatar name={person.name} url={person.avatarUrl} size={34} standing={person.standing} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.personName} numberOfLines={1}>
              {person.name}
            </Text>
            <Text style={styles.personHandle} numberOfLines={1}>
              @{person.handle}
            </Text>
          </View>
        </View>
      ) : null}
      <Text style={styles.foot}>Only people who filmed there get one · afterglowmusic.app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 26, overflow: 'hidden', alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg },
  glow: { position: 'absolute', left: 0 },
  brand: { ...type.label, color: color.moon, letterSpacing: 6, opacity: 0.85 },
  pin: { marginTop: space.lg },
  kicker: { ...type.label, color: '#FFE38A', letterSpacing: 4, marginTop: space.sm },
  name: { ...type.largeTitle, fontSize: 28, lineHeight: 32, color: color.moon, textAlign: 'center', marginTop: space.xs },
  meta: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: 4 },
  earned: { ...type.label, color: color.glow, marginTop: space.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'stretch', justifyContent: 'center', marginBottom: space.md },
  personName: { ...type.headline, color: color.moon },
  personHandle: { ...type.caption, color: color.moonDim },
  foot: { ...type.caption, fontSize: 11, color: color.moonFaint, textAlign: 'center' },
});
