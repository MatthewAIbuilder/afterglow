import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { artistLook } from '../features/sprouts/artistLook';
import { GardenScene } from '../features/sprouts/GardenScene';
import { gardenCounts, type PublicResident } from '../features/sprouts/publicGarden';
import { visitResidents } from '../features/sprouts/visitGarden';
import { t, tn } from '../i18n';
import { useCatalog } from '../state/catalog';
import { useSocial } from '../state/social';
import { color, space, type } from '../theme/tokens';

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
  const [garden, setGarden] = useState<PublicResident[] | null>();
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
      .then((g) => live && setGarden(g))
      .catch(() => live && setGarden(null));
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
            <GardenScene residents={residents} account={`visit:${uid}`} width={Math.min(CONTENT_MAX, windowWidth) - 2 * space.xl} focused={focused} ready visiting onOpen={() => {}} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, gap: space.md, maxWidth: CONTENT_MAX, width: '100%', alignSelf: 'center' },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim },
});
