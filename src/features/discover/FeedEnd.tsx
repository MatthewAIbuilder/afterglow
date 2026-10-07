import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useRatings } from '../../state/ratings';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { otherFestivalsWithClips } from '../festivals/links';
import { leftToRate } from '../festivals/tune';
import { MIX } from './focus';
import { HeartIcon, PlayIcon } from './icons';
import { t } from '../../i18n';
import { eventPath, isShowEvent } from '../festivalMode/showEvent';

type Props = {
  /** The lineup you were discovering; none when it was your mix or Following. */
  festival?: Festival;
  /** You were watching videos from the people you follow. */
  following?: boolean;
  /** You were watching one sound from every lineup ("Dubstep"). */
  soundLabel?: string;
  /** You were on a station ("Sounds like SUBTRONICS"): its artist's name. */
  station?: string;
  width: number;
  height: number;
  /** Space reserved at the bottom for the floating tab bar. */
  bottomSpace: number;
  onRestart: () => void;
};

/**
 * The last page of the feed: you've seen every clip from this lineup (or, in
 * your mix, every clip there is; in Following, every video from the people
 * you follow). Offers the next step instead of a dead end:
 * rate the rest of the lineup, see your plan, discover another festival or
 * your mix, or start again.
 */
export function FeedEnd({ festival, following = false, soundLabel, station, width, height, bottomSpace, onRestart }: Props) {
  const catalog = useCatalog();
  const { ratings } = useRatings();
  const insets = useSafeAreaInsets();
  const toRate = festival ? leftToRate(festival, ratings, (a) => !!catalog.artist(a)) : 0;
  // Worked out again only when the catalogue or the festival changes, not on every swipe (the feed redraws this page with each).
  const festivalId = festival?.id;
  const others = useMemo(() => otherFestivalsWithClips(catalog.festivals, catalog.clips, festivalId), [catalog.festivals, catalog.clips, festivalId]);

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
      <Text style={styles.kicker}>{festival ? t('That’s the lineup') : following ? t('That’s everyone you follow') : soundLabel ? t('That’s {sound}', { sound: soundLabel.toLowerCase() }) : station ? t('That’s the station') : t('That’s your mix')}</Text>
      <Text style={styles.title}>
        {festival
          ? t('You’ve seen every clip from {festival}', { festival: festival.name })
          : following
            ? t('You’ve seen every video from people you follow')
            : soundLabel
              ? t('You’ve seen every {sound} clip', { sound: soundLabel.toLowerCase() })
              : station
                ? t('You’ve seen everything that sounds like {artist}', { artist: station })
                : t('You’ve seen every clip')}
      </Text>
      <Text style={styles.body}>
        {following
          ? t('Find more people to follow, try your mix, or watch again.')
          : !festival
          ? t('Focus on a festival to shape your plan, or watch again.')
          : toRate > 0
            ? t('Rate the rest of the lineup to shape your plan, or keep discovering.')
            : t('Your plan is up to date. Keep discovering, or watch again.')}
      </Text>

      <View style={styles.actions}>
        {festival &&
          toRate > 0 &&
          row(t('Tune your lineup'), t('{n} to rate', { n: toRate }), () => router.push(`/tune/${festival.id}`), <HeartIcon color={color.moon} size={16} />, true)}
        {festival && row(isShowEvent(festival) ? t('The show') : t('See your festival'), undefined, () => router.push(eventPath(festival)))}
        {others.map((f) =>
          row(t('Discover {festival}', { festival: f.name }), undefined, () => router.navigate({ pathname: '/', params: { festival: f.id } }), <PlayIcon color={color.moonDim} size={14} />),
        )}
        {following && row(t('Find people'), undefined, () => router.push('/people'), undefined, true)}
        {(festival || following || soundLabel || station) &&
          row(t('Try your mix'), t('a bit of everything'), () => router.navigate({ pathname: '/', params: { festival: MIX } }), <PlayIcon color={color.moonDim} size={14} />)}
        {row(t('Watch again from the top'), undefined, onRestart)}
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
    borderTopColor: color.rim,
  },
  primary: { backgroundColor: glowA(0.22), borderColor: glowA(0.45) },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  rowText: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  spacer: { flex: 1 },
});
