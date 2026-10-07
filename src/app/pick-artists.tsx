import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { NightSky } from '../components/NightSky';
import { PageTitle } from '../components/PageTitle';
import { HeartIcon } from '../features/discover/icons';
import { watchFestival } from '../features/welcome/firstRun';
import { PICK_PAGE, pickCandidates, pickDoneLabel } from '../features/taste/quickPick';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useRatings } from '../state/ratings';
import { color, radius, space, type, accentEdge } from '../theme/tokens';
import { goBack } from '../lib/nav';
import { t } from '../i18n';
import { BottomFade } from '../components/BottomFade';

/**
 * Pick the artists you know: tap everyone you love in a grid of faces from
 * your festivals, then Done. Each pick is a love rating, so My Sound, your
 * plan and Discover follow at once. A modal from the welcome and My Sound.
 *
 * Params: `festivals` (comma-separated ids; all festivals when missing) and
 * `then` ("discover" goes to Discover after, otherwise back).
 */
const COLUMNS = 3;

export default function PickArtistsScreen() {
  const params = useLocalSearchParams<{ festivals?: string; then?: string }>();
  const catalog = useCatalog();
  const { ratings, rate } = useRatings();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const chosen = useMemo(() => {
    const ids = (params.festivals ?? '').split(',').filter(Boolean);
    const picked = ids.map((id) => catalog.festival(id)).filter((f) => !!f);
    return picked.length ? picked : catalog.festivals;
  }, [params.festivals, catalog]);
  // The candidates are fixed when the grid opens, so tapping never reshuffles it.
  const [candidates] = useState(() => pickCandidates(chosen, catalog.artist, ratings, (id) => catalog.festivalsOf(id).length));
  const [shown, setShown] = useState(PICK_PAGE);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const toggle = (id: string) => {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) {
        next.delete(id);
        haptic.select();
      } else {
        next.add(id);
        haptic.tap();
      }
      return next;
    });
  };

  const done = () => {
    haptic.settle();
    for (const id of picked) rate(id, 'love');
    if (params.then === 'discover') {
      const f = watchFestival(chosen.length === catalog.festivals.length ? undefined : chosen[0], catalog.clips);
      router.dismissTo(f ? { pathname: '/', params: { festival: f.id } } : '/');
    } else if (router.canGoBack()) goBack();
    else router.replace('/sound');
  };

  const cell = Math.floor((Math.min(width, 560) - space.xl * 2 - space.md * (COLUMNS - 1)) / COLUMNS);
  const face = Math.min(96, cell - space.md);

  return (
    <View style={styles.root}>
      <PageTitle title={t('Pick artists you know')} />
      <NightSky />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + 120 }]}>
        <Text style={styles.title}>{t('Tap the artists you love')}</Text>
        <Text style={styles.sub}>{t('Tap again to undo. The more you pick, the better your plan and your sound.')}</Text>
        <View style={styles.grid}>
          {candidates.slice(0, shown).map((a) => {
            const on = picked.has(a.id);
            return (
              <Pressable
                key={a.id}
                onPress={() => toggle(a.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={on ? t('{artist}, you love their sound', { artist: a.name }) : t("Love {artist}'s sound", { artist: a.name })}
                style={({ pressed }) => [styles.cell, { width: cell }, pressed && { transform: [{ scale: 0.96 }] }]}
              >
                <View style={[styles.face, on && styles.faceOn, { borderRadius: (face + 6) / 2 }]}>
                  <ArtistAvatar artist={a} size={face} />
                  {on ? (
                    <View style={styles.badge}>
                      <HeartIcon color={color.moon} size={12} filled />
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.name, on && styles.nameOn]} numberOfLines={2}>
                  {a.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {candidates.length > shown ? (
          <Pressable
            onPress={() => {
              haptic.select();
              setShown((n) => n + PICK_PAGE);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Show more artists')}
            style={({ pressed }) => [styles.more, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.moreText}>{t('Show more')}</Text>
          </Pressable>
        ) : null}
        {candidates.length === 0 ? <Text style={styles.sub}>{t('You’ve rated everyone here already.')}</Text> : null}
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.lg }]}>
        <BottomFade />
        <Pressable
          onPress={done}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, picked.size === 0 && styles.quiet, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.primaryText}>{pickDoneLabel(picked.size)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 560 },
  title: { ...type.largeTitle, color: color.moon, textAlign: 'center' },
  sub: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.xl, justifyContent: 'flex-start' },
  cell: { alignItems: 'center', paddingVertical: space.sm },
  face: { padding: 3, borderWidth: 2, borderColor: 'transparent' },
  faceOn: { borderColor: color.glow, shadowColor: color.glow, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  badge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glowDeep,
    borderWidth: 2,
    borderColor: color.night,
  },
  name: { ...type.caption, color: color.moonDim, textAlign: 'center', marginTop: space.sm },
  nameOn: { color: color.moon },
  more: { alignSelf: 'center', marginTop: space.lg, paddingVertical: space.sm, paddingHorizontal: space.xl, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  moreText: { ...type.label, color: color.moonDim },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.lg },
  primary: { minHeight: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glowDeep, ...accentEdge, alignSelf: 'center', width: '100%', maxWidth: 520 },
  quiet: { backgroundColor: color.glass },
  primaryText: { ...type.headline, color: color.moon },
});
