import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { KandiLine } from '../features/kandi/KandiLine';
import { GlowButton } from '../features/sprouts/GlowButton';
import { haptic } from '../lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { artistLook } from '../features/sprouts/artistLook';
import { GardenScene } from '../features/sprouts/GardenScene';
import { gardenCounts, type PublicResident, showcaseOf } from '../features/sprouts/publicGarden';
import { ShowcaseRow } from '../features/sprouts/ShowcaseRow';
import type { PublicKandi } from '../features/kandi/kandi';
import { visitResidents } from '../features/sprouts/visitGarden';
import { DECOR, type DecorId } from '../features/sprouts/decor';
import { t, tn } from '../i18n';
import { useCatalog } from '../state/catalog';
import { useSocial } from '../state/social';
import { color, space, type, accentEdge } from '../theme/tokens';

const CONTENT_MAX = 640;

/**
 * Someone else's garden, as they show it on their profile: the same night
 * meadow, everyone wandering about. Nothing can be moved; a tap makes one
 * dance. `?uid=…&handle=…`.
 */
export default function GardenVisitScreen() {
  const { uid, handle } = useLocalSearchParams<{ uid?: string; handle?: string }>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const social = useSocial();
  const catalog = useCatalog();
  const [visit, setVisit] = useState<{ residents: PublicResident[]; kandi: PublicKandi[]; decor?: DecorId[] } | null>();
  const garden = visit === undefined ? undefined : (visit?.residents ?? null);
  const kandi = visit?.kandi ?? [];
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const { service } = social;
  const signedIn = !!social.user;
  useEffect(() => {
    if (!uid || !signedIn) return;
    let live = true;
    service
      .gardenOf(uid)
      .then((g) => live && setVisit(g))
      .catch(() => live && setVisit(null));
    return () => {
      live = false;
    };
  }, [uid, signedIn, service]);
  const residents = useMemo(
    () => visitResidents(garden ?? [], (id, name) => artistLook(catalog.artist(id) ?? { id, name, sound: {} })),
    [garden, catalog],
  );
  const counts = gardenCounts(garden ?? []);
  const title = handle ? t('@{handle}’s garden', { handle }) : t('Their garden');

  return (
    <View style={styles.root}>
      <PageTitle title={title} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {garden === undefined && signedIn ? (
          <ActivityIndicator color={color.glow} style={{ marginTop: space.xl }} />
        ) : !signedIn ? (
          <Text style={styles.sub}>{t('Sign in to visit gardens.')}</Text>
        ) : !garden?.length ? (
          <Text style={styles.sub}>{t('Nothing growing here yet.')}</Text>
        ) : (
          <>
            <Text style={styles.sub}>
              {counts.collectibles
                ? t('{sprouts} and {collectibles}. Tap one to make it dance.', { sprouts: tn(counts.sprouts, '{n} sprout', '{n} sprouts'), collectibles: tn(counts.collectibles, '{n} artist collectible', '{n} artist collectibles') })
                : t('{sprouts}. Tap one to make it dance.', { sprouts: tn(counts.sprouts, '{n} sprout', '{n} sprouts') })}
            </Text>
            <GardenScene residents={residents} account={`visit:${uid}`} width={Math.min(CONTENT_MAX, windowWidth) - 2 * space.xl} focused={focused} ready visiting decor={visit?.decor ?? []} onOpen={() => {}} />
            {uid && uid !== social.user?.uid && social.profile ? <GlowButton uid={uid} handle={handle} /> : null}
            {visit?.decor?.length ? (
              <Text style={styles.sky}>{t('In their sky: {list}', { list: DECOR.filter((d) => visit.decor?.includes(d.id)).map((d) => d.name.toLowerCase()).join(', ') })}</Text>
            ) : null}
          </>
        )}
        {/* The cards they pinned. */}
        {garden?.length ? (
          <View style={styles.showcase}>
            <ShowcaseRow cards={showcaseOf(garden)} handle={handle} />
          </View>
        ) : null}
        <KandiLine items={kandi.map((k, i) => ({ key: String(i), word: k.word, beads: k.beads, charm: k.charm, from: k.from }))} />
        {signedIn && uid && uid !== social.user?.uid && visit !== null ? (
          <Pressable
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/kandi-make', params: { uid, handle: handle ?? '' } });
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.kandi, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.kandiText}>{t('Leave kandi in this garden')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, gap: space.md, maxWidth: CONTENT_MAX, width: '100%', alignSelf: 'center' },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim },
  // The row brings its own side margin; the page already has one.
  showcase: { marginHorizontal: -space.xl },
  sky: { ...type.caption, color: color.moonDim, textAlign: 'center' },
  kandi: { alignItems: 'center', paddingVertical: space.md, borderRadius: 999, backgroundColor: color.glowDeep, ...accentEdge, marginTop: space.md },
  kandiText: { ...type.headline, color: color.moon },
});
