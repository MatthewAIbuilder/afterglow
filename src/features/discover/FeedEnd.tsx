import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useRatings } from '../../state/ratings';
import { color, radius, space, type } from '../../theme/tokens';
import { otherFestivalsWithClips } from '../festivals/links';
import { leftToRate } from '../festivals/tune';
import { HeartIcon, PlayIcon } from './icons';

type Props = {
  festival: Festival;
  width: number;
  height: number;
  /** Space reserved at the bottom for the floating tab bar. */
  bottomSpace: number;
  onRestart: () => void;
};

/**
 * The last page of the feed: you've seen every clip from this lineup. Offers
 * the next step instead of a dead end: rate the rest of the lineup, see your
 * plan, discover another festival, or start again.
 */
export function FeedEnd({ festival, width, height, bottomSpace, onRestart }: Props) {
  const catalog = useCatalog();
  const { ratings } = useRatings();
  const insets = useSafeAreaInsets();
  const toRate = leftToRate(festival, ratings, (a) => !!catalog.artist(a));
  const others = otherFestivalsWithClips(catalog.festivals, catalog.clips, festival.id);

  const row = (label: string, detail: string | undefined, onPress: () => void, icon?: React.ReactNode, primary = false) => (
    <Pressable
      key={label}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={({ pressed }) => [styles.row, primary && styles.primary, pressed && styles.pressed]}
    >
      {icon}
      <Text style={[styles.rowText, primary && { color: color.moon }]}>{label}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      <View style={styles.spacer} />
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );

  return (
    <View style={[styles.page, { width, height, paddingTop: insets.top + 100, paddingBottom: bottomSpace + space.xl }]}>
      <Text style={styles.kicker}>That’s the lineup</Text>
      <Text style={styles.title}>You’ve seen every clip from {festival.name}</Text>
      <Text style={styles.body}>
        {toRate > 0
          ? 'Rate the rest of the lineup to shape your plan, or keep discovering.'
          : 'Your plan is up to date. Keep discovering, or watch again.'}
      </Text>

      <View style={styles.actions}>
        {toRate > 0 &&
          row('Tune your lineup', `${toRate} to rate`, () => router.push(`/tune/${festival.id}`), <HeartIcon color={color.moon} size={16} />, true)}
        {row('See your festival', undefined, () => router.push(`/festival/${festival.id}`))}
        {others.map((f) =>
          row(`Discover ${f.name}`, undefined, () => router.navigate({ pathname: '/', params: { festival: f.id } }), <PlayIcon color={color.moonDim} size={14} />),
        )}
        {row('Watch again from the top', undefined, onRestart)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, justifyContent: 'center' },
  kicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { ...type.largeTitle, color: color.moon, marginTop: space.sm },
  body: { ...type.body, color: color.moonDim, marginTop: space.md },
  actions: { marginTop: space.xxl, gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  primary: { backgroundColor: 'rgba(169,124,255,0.22)', borderColor: 'rgba(169,124,255,0.45)' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  rowText: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  spacer: { flex: 1 },
});
