import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { SHEET_BACKGROUND } from '../components/LiquidGlass';
import { PageTitle } from '../components/PageTitle';
import { SheetClose } from '../components/SheetClose';
import { stageName } from '../data/festival';
import { ratingAfter, seenKey, type SetVerdict, VERDICT_LABEL, VERDICTS } from '../features/seen/seen';
import { RATING_SAID } from '../features/taste/ratings';
import { haptic } from '../lib/haptics';
import { goBack } from '../lib/nav';
import { useCatalog } from '../state/catalog';
import { useRatings } from '../state/ratings';
import { useSetsSeen } from '../state/setsSeen';
import { color, glowA, pageColumn, radius, space, type } from '../theme/tokens';
import { t } from '../i18n';

/**
 * "How was it?" for one set (`/rate-set?festival=&artist=&day=`), from the
 * notification after a set on your route ends, or the card in the app. One
 * tap: it goes in Sets you've seen, and fills in or warms up your rating of
 * the artist (never cools it). "I wasn't there" stops it asking.
 */
export default function RateSetScreen() {
  const params = useLocalSearchParams<{ festival?: string; artist?: string; day?: string }>();
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const festival = params.festival ? catalog.festival(params.festival) : undefined;
  const artist = params.artist ? catalog.artist(params.artist) : undefined;
  const day = params.day || undefined;
  const { sets, mark, wave } = useSetsSeen();
  const { ratings, rate } = useRatings();

  if (!festival || !artist) {
    return (
      <View style={styles.root}>
        <PageTitle title={t('How was it?')} />
        <SheetClose />
        <View style={[pageColumn, styles.pad, { paddingTop: space.xxl }]}>
          <Text style={styles.title}>{t('This set isn’t on Afterglow any more')}</Text>
        </View>
      </View>
    );
  }

  const set = festival.sets?.find((s) => s.artistId === artist.id && (!day || s.day === day));
  const before = sets[seenKey(festival.id, artist.id, day)]?.verdict;
  const choose = (verdict: SetVerdict) => {
    haptic.settle();
    mark({ festivalId: festival.id, artistId: artist.id, ...(day ? { day } : {}), verdict });
    const next = ratingAfter(ratings[artist.id], verdict);
    if (next) rate(artist.id, next);
    goBack();
  };

  return (
    <View style={styles.root}>
      <PageTitle title={t('How was {artist}?', { artist: artist.name })} />
      <SheetClose />
      <ScrollView contentContainerStyle={[pageColumn, styles.pad, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.head}>
          <ArtistAvatar artist={artist} size={72} />
          <Text style={styles.title} accessibilityRole="header">
            {t('How was {artist}?', { artist: artist.name })}
          </Text>
          <Text style={styles.sub}>
            {set ? `${festival.name} · ${stageName(festival, set.stageId)}${day ? ` · ${t(day)}` : ''}` : festival.name}
          </Text>
        </View>
        <View style={styles.choices}>
          {VERDICTS.map((v) => (
            <Pressable
              key={v}
              onPress={() => choose(v)}
              accessibilityRole="button"
              accessibilityState={{ selected: before === v }}
              accessibilityLabel={t('{verdict}: rate the set', { verdict: VERDICT_LABEL[v] })}
              style={({ pressed }) => [styles.choice, v === 'unreal' && styles.unreal, before === v && styles.chosen, pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] }]}
            >
              <Text style={[styles.choiceText, v === 'unreal' && { color: color.moon }]}>{VERDICT_LABEL[v]}</Text>
            </Pressable>
          ))}
        </View>
        {ratings[artist.id] ? (
          <Text style={styles.note}>{t('You said before: {said}. One set only ever warms that up.', { said: RATING_SAID[ratings[artist.id]] })}</Text>
        ) : (
          <Text style={styles.note}>{t('It goes in Sets you’ve seen, and tells Afterglow what you like.')}</Text>
        )}
        <Pressable
          onPress={() => {
            haptic.select();
            wave(festival.id, artist.id, day);
            goBack();
          }}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.skip, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.skipText}>{t('I wasn’t there')}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptic.select();
            router.replace('/seen');
          }}
          accessibilityRole="link"
          hitSlop={8}
          style={({ pressed }) => [styles.skip, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.link}>{t('Sets you’ve seen')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHEET_BACKGROUND },
  pad: { paddingHorizontal: space.xl, paddingTop: space.xxl, gap: space.lg },
  head: { alignItems: 'center', gap: space.sm },
  title: { ...type.title, color: color.moon, textAlign: 'center' },
  sub: { ...type.caption, color: color.moonDim, textAlign: 'center' },
  choices: { gap: space.sm, marginTop: space.md },
  choice: {
    paddingVertical: space.lg,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  unreal: { backgroundColor: glowA(0.22), borderColor: glowA(0.55) },
  chosen: { borderColor: color.glow, borderWidth: 1.5 },
  choiceText: { ...type.headline, color: color.moon },
  note: { ...type.caption, color: color.moonDim, textAlign: 'center' },
  skip: { alignSelf: 'center', paddingVertical: space.xs },
  skipText: { ...type.label, color: color.moonDim },
  link: { ...type.label, color: color.glow },
});
