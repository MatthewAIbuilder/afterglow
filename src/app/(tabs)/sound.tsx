import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { ArtistSheet } from '../../features/sound-map/ArtistSheet';
import { artistsOnMap } from '../../features/sound-map/layout';
import { SoundMap } from '../../features/sound-map/SoundMap';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';
import type { TasteSummary } from '../../features/taste/engine';

const HEADER_H = 96;

export default function MySoundScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tabSpace = useTabBarSpace();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The map shows the taste you last saw, then reshapes a beat after you
  // arrive, so you can watch what your likes, skips and viewing changed.
  const { artists } = useCatalog();
  const live = useTaste();
  const liveRef = useRef(live);
  liveRef.current = live;
  const [shown, setShown] = useState(live);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const reshapeSoon = useCallback(() => {
    const t = setTimeout(() => {
      if (shownRef.current.taste === liveRef.current.taste) return;
      haptic.settle();
      setShown(liveRef.current);
    }, 450);
    return () => clearTimeout(t);
  }, []);
  useFocusEffect(reshapeSoon);

  // Who's on the map: artists the app knows something about, best matches first (see artistsOnMap).
  const onMap = useMemo(() => artistsOnMap(artists, shown.taste, shown.informed), [artists, shown]);

  const close = useCallback(() => setSelectedId(null), []);
  const mapTop = insets.top + HEADER_H;
  const mapHeight = height - mapTop - tabSpace;

  return (
    <View style={styles.root}>
      <NightSky />

      <View style={{ position: 'absolute', top: mapTop, left: 0 }}>
        <SoundMap
          artists={onMap}
          taste={shown.taste}
          width={width}
          height={mapHeight}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onBackgroundTap={close}
        />
      </View>

      <View style={[styles.header, { paddingTop: insets.top + space.lg }]} pointerEvents="box-none">
        <View style={styles.titleRow} pointerEvents="box-none">
          <Text style={styles.title} pointerEvents="none">
            My Sound
          </Text>
          {hasSignal(live.summary, live.rated) && <StartOver onCleared={reshapeSoon} />}
        </View>
        <Text style={styles.subtitle} pointerEvents="none">
          {subtitle(shown.summary, shown.rated)}
        </Text>
      </View>

      <ArtistSheet artistId={selectedId} taste={shown.taste} bottomInset={tabSpace} onClose={close} />
    </View>
  );
}

const hasSignal = ({ likes, saves, skips, watched }: TasteSummary, rated: number) =>
  likes + saves + skips + watched + rated > 0;

/**
 * Clear everything your sound has learned (likes, saves, skips, watching,
 * ratings) and the feed's viewing history. Plans stay: festivals you're going
 * to and starred sets are yours, not your taste.
 */
function StartOver({ onCleared }: { onCleared: () => void }) {
  const reactions = useReactions();
  const ratings = useRatings();
  const seen = useSeen();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        Alert.alert(
          'Start your sound over?',
          'This clears your likes, saves, skips, watched clips and artist ratings. Festivals you’re going to and your starred sets stay.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Start over',
              style: 'destructive',
              onPress: () => {
                reactions.clear();
                ratings.clear();
                seen.clear();
                // The map reshapes to the starting sound a beat later, as when you come back to it.
                onCleared();
              },
            },
          ],
        );
      }}
      accessibilityRole="button"
      accessibilityLabel="Start your sound over"
      hitSlop={10}
      style={({ pressed }) => [styles.startOver, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.startOverText}>Start over</Text>
    </Pressable>
  );
}

function subtitle(summary: TasteSummary, rated: number) {
  const { likes, saves, skips, watched } = summary;
  if (!hasSignal(summary, rated)) return 'Bigger means a closer match. Similar sounds sit together.';
  const parts = [
    likes && `${likes} ${likes === 1 ? 'like' : 'likes'}`,
    saves && `${saves} ${saves === 1 ? 'save' : 'saves'}`,
    skips && `${skips} ${skips === 1 ? 'skip' : 'skips'}`,
    watched && `${watched} watched ${watched === 1 ? 'clip' : 'clips'}`,
    rated && `${rated} rated ${rated === 1 ? 'artist' : 'artists'}`,
  ].filter(Boolean) as string[];
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `Shaped by your ${list}. Bigger means a closer match.`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  header: { paddingHorizontal: space.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.largeTitle, color: color.moon },
  startOver: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  startOverText: { ...type.caption, color: color.moonDim },
  subtitle: { ...type.body, color: color.moonDim, marginTop: space.xs },
});
