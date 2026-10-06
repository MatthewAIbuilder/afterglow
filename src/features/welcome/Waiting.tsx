import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { PeopleIcon } from '../../components/TabIcons';
import { color, radius, space, type } from '../../theme/tokens';
import { Sprout } from '../sprouts/Sprout';
import { t } from '../../i18n';

type Row = { key: string; title: string; body: string; icon: ReactNode; tint: string };

const GOLD = '#FFC861';
const PINK = '#FF7EB6';
const GREEN = '#6EE7A0';

/** Three arcs filling up, like the quest ring on Discover. */
function QuestGlyph() {
  const r = 12;
  const arc = (from: number, to: number) => {
    const p = (t: number) => [16 + r * Math.sin(t * 2 * Math.PI), 16 - r * Math.cos(t * 2 * Math.PI)];
    const [x1, y1] = p(from);
    const [x2, y2] = p(to);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  return (
    <Svg width={32} height={32}>
      <Path d={arc(0.04, 0.29)} stroke={GOLD} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d={arc(0.37, 0.62)} stroke={GOLD} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d={arc(0.71, 0.96)} stroke="rgba(255,200,97,0.3)" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Circle cx={16} cy={16} r={3} fill={GOLD} />
    </Svg>
  );
}

function HeartGlyph() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Path
        d="M12 20.5s-7.5-4.6-7.5-10.2C4.5 7.4 6.6 5.5 9 5.5c1.4 0 2.4.7 3 1.6.6-.9 1.6-1.6 3-1.6 2.4 0 4.5 1.9 4.5 4.8 0 5.6-7.5 10.2-7.5 10.2z"
        fill={PINK}
      />
    </Svg>
  );
}

/**
 * The welcome's third step: what's waiting in the app, so a newcomer knows
 * the playful and social parts exist before they land in Discover. Rows
 * rise in one after another (still with reduced motion).
 */
export function Waiting() {
  const reduceMotion = useReducedMotion();
  const web = Platform.OS === 'web';
  const rows: Row[] = [
    {
      key: 'sprout',
      title: t('Your first sprout'),
      body: t('It’s already in your garden. Give sprouts to people you meet at festivals, and watch yours grow.'),
      icon: <Sprout size={40} still={reduceMotion} />,
      tint: GREEN,
    },
    {
      key: 'quests',
      title: t('Three quests a day'),
      body: t('Small things to try, a streak to keep and a glow level that grows. Find them in the ring at the top of Discover.'),
      icon: <QuestGlyph />,
      tint: GOLD,
    },
    {
      key: 'crew',
      title: t('Plan with your crew'),
      body: t('Share picks, check in and chat on the day. Messages wait for signal and keep the time you sent them.'),
      icon: <PeopleIcon color={color.glow} size={26} />,
      tint: color.glow,
    },
    {
      key: 'care',
      title: t('Look after yourself'),
      body: web
        ? t('A private page for festival nights: timers, water, how you feel and help close by. It’s in Settings, and stays on your device.')
        : t('Hold the camera button for a private page: timers, water, how you feel and help close by. It stays on your phone.'),
      icon: <HeartGlyph />,
      tint: PINK,
    },
  ];
  return (
    <View style={styles.list}>
      {rows.map((r, i) => (
        <Animated.View
          key={r.key}
          entering={reduceMotion ? undefined : FadeInDown.delay(120 + i * 110).duration(420)}
          style={styles.row}
          accessible
          accessibilityLabel={`${r.title}. ${r.body}`}
        >
          <View style={[styles.icon, { backgroundColor: `${r.tint}1F`, borderColor: `${r.tint}55` }]}>{r.icon}</View>
          <View style={styles.text}>
            <Text style={styles.title}>{r.title}</Text>
            <Text style={styles.body}>{r.body}</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md, marginTop: space.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  icon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  text: { flex: 1, minWidth: 0 },
  title: { ...type.headline, color: color.moon },
  body: { ...type.caption, color: color.moonDim, marginTop: 2, lineHeight: 18 },
});
