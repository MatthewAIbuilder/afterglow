import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { CloseIcon } from '../../components/TabIcons';
import { SOUND_LABEL } from '../../data/models';
import { distanceText } from '../../features/care/trail';
import { unitsFor } from '../../features/festivals/near';
import { useYearStats } from '../../features/recap/useRecap';
import { VERDICT_LABEL } from '../../features/seen/seen';
import { haptic } from '../../lib/haptics';
import { goBack } from '../../lib/nav';
import { useToday } from '../../lib/useToday';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { t, tn } from '../../i18n';

const locale = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
};

type Slide = { key: string; kicker: string; big: string; line?: string; body?: React.ReactNode };

/**
 * Afterglow Wrapped (`/wrapped/2026`): your year as a story, one card at a
 * time: festivals, the sets you saw and who you saw most, your set of the
 * year, your top artists, your sound and how far you walked. The last card
 * shares it (the year card, as a picture or text).
 */
export default function WrappedScreen() {
  const params = useLocalSearchParams<{ year: string }>();
  const today = useToday();
  const asked = Number(params.year);
  const year = Number.isInteger(asked) && asked > 2000 && asked < 3000 ? asked : today.getFullYear();
  const { stats, sounds } = useYearStats(year);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const miles = unitsFor(locale()) === 'mi';
  const festivals = stats.been.length + stats.coming.length;

  const slides: Slide[] = [
    {
      key: 'intro',
      kicker: t('Afterglow Wrapped'),
      big: t('Your {year}', { year }),
      line: [festivals ? tn(festivals, '{n} festival', '{n} festivals') : undefined, stats.sets ? tn(stats.sets, '{n} set seen live', '{n} sets seen live') : undefined, stats.videos ? tn(stats.videos, '{n} video', '{n} videos') : undefined].filter(Boolean).join(' · ') || t('Your festival year, so far'),
    },
    ...(stats.sets
      ? [
          {
            key: 'sets',
            kicker: t('Live'),
            big: tn(stats.sets, '{n} set', '{n} sets'),
            line: stats.seenMost[0] ? tn(stats.seenMost[0].times, 'You saw {artist} {n} time', 'You saw {artist} {n} times', { artist: stats.seenMost[0].artist.name }) : t('Every one of them, in Sets you’ve seen.'),
            body: stats.seenMost[0] ? <ArtistAvatar artist={stats.seenMost[0].artist} size={132} /> : undefined,
          },
        ]
      : []),
    ...(stats.setOfYear
      ? [
          {
            key: 'best',
            kicker: t('Your set of the year'),
            big: stats.setOfYear.artist.name,
            line: [stats.setOfYear.festival?.name, VERDICT_LABEL[stats.setOfYear.verdict]].filter(Boolean).join(' · '),
            body: <ArtistAvatar artist={stats.setOfYear.artist} size={148} />,
          },
        ]
      : []),
    ...(stats.top.length
      ? [
          {
            key: 'top',
            kicker: t('Your top artists'),
            big: stats.top[0].artist.name,
            body: (
              <View style={styles.list}>
                {stats.top.slice(0, 5).map((x, i) => (
                  <View key={x.artist.id} style={styles.listRow}>
                    <Text style={styles.rank}>{i + 1}</Text>
                    <ArtistAvatar artist={x.artist} size={40} />
                    <Text style={styles.listName} numberOfLines={1}>
                      {x.artist.name}
                    </Text>
                  </View>
                ))}
              </View>
            ),
          },
        ]
      : []),
    ...(sounds.length
      ? [
          {
            key: 'sound',
            kicker: t('Your sound'),
            big: SOUND_LABEL[sounds[0].tag],
            body: (
              <View style={styles.list}>
                {sounds.slice(0, 3).map((x) => (
                  <View key={x.tag} style={styles.bar}>
                    <Text style={styles.barName}>{SOUND_LABEL[x.tag]}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${x.percent}%` }]} />
                    </View>
                    <Text style={styles.barPct}>{x.percent}%</Text>
                  </View>
                ))}
              </View>
            ),
          },
        ]
      : []),
    ...(stats.walkedMeters >= 100 || stats.fits
      ? [
          {
            key: 'walk',
            kicker: t('On your feet'),
            big: stats.walkedMeters >= 100 ? distanceText(stats.walkedMeters, miles) : tn(stats.fits, '{n} fit check', '{n} fit checks'),
            line: stats.walkedMeters >= 100 ? (stats.fits ? tn(stats.fits, 'walked at festivals, and {n} fit check', 'walked at festivals, and {n} fit checks') : t('walked at festivals')) : t('one for every festival day'),
          },
        ]
      : []),
    { key: 'share', kicker: t('That’s your year'), big: t('Share your {year}', { year }), line: t('As a picture or as text.') },
  ];

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (p !== page) {
      setPage(p);
      haptic.select();
    }
  };
  const go = (p: number) => scroller.current?.scrollTo({ x: p * width, animated: true });

  return (
    <View style={styles.root}>
      <PageTitle title={t('Afterglow Wrapped {year}', { year })} />
      <NightSky />
      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} onScroll={onScroll} scrollEventThrottle={64}>
        {slides.map((s, i) => (
          <View key={s.key} style={[styles.slide, { width, height, paddingTop: insets.top + 96, paddingBottom: insets.bottom + 120 }]} accessible accessibilityLabel={[s.kicker, s.big, s.line].filter(Boolean).join('. ')}>
            <LinearGradient colors={[glowA(0.06 + (i % 3) * 0.05), glowA(0)]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Text style={styles.kicker}>{s.kicker}</Text>
            <Text style={styles.big} numberOfLines={3} adjustsFontSizeToFit>
              {s.big}
            </Text>
            {s.line ? <Text style={styles.line}>{s.line}</Text> : null}
            {s.body ? <View style={styles.body}>{s.body}</View> : null}
            {s.key === 'share' ? (
              <Pressable
                onPress={() => {
                  haptic.tap();
                  router.replace({ pathname: '/year/[year]', params: { year: String(year) } });
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.share, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.shareText}>{t('Share my year')}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <Pressable key={s.key} onPress={() => go(i)} accessibilityRole="button" accessibilityLabel={t('Card {n} of {m}', { n: i + 1, m: slides.length })} hitSlop={6} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
        <GlassCircleButton label={t('Close')} onPress={() => goBack()}>
          <CloseIcon color={color.moon} />
        </GlassCircleButton>
      </View>
      {page < slides.length - 1 ? (
        <Pressable onPress={() => go(page + 1)} accessibilityRole="button" accessibilityLabel={t('Next card')} style={[styles.next, { bottom: insets.bottom + space.xl }]}>
          <Text style={styles.nextText}>{t('Next')} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  slide: { paddingHorizontal: space.xl, justifyContent: 'center', gap: space.md },
  kicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1.5 },
  big: { ...type.largeTitle, fontSize: 52, lineHeight: 58, color: color.moon },
  line: { ...type.title, color: color.moonDim },
  body: { marginTop: space.lg, alignItems: 'flex-start' },
  list: { gap: space.md, alignSelf: 'stretch' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rank: { ...type.title, color: color.glow, width: 28 },
  listName: { ...type.headline, color: color.moon, flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  barName: { ...type.label, color: color.moon, width: 110 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: color.hairline, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: color.glow },
  barPct: { ...type.label, color: color.moonDim, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  share: { alignSelf: 'flex-start', marginTop: space.xl, paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glow },
  shareText: { ...type.headline, color: color.night },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, zIndex: 2 },
  dots: { flex: 1, flexDirection: 'row', gap: 4 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { backgroundColor: color.moon },
  next: { position: 'absolute', right: space.xl, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glass, zIndex: 2 },
  nextText: { ...type.label, color: color.moon },
});
