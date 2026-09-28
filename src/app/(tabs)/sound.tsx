import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { ARTISTS } from '../../data/artists';
import { ArtistSheet } from '../../features/sound-map/ArtistSheet';
import { SoundMap } from '../../features/sound-map/SoundMap';
import { haptic } from '../../lib/haptics';
import { useTaste } from '../../state/taste';
import { color, space, type } from '../../theme/tokens';
import type { TasteSummary } from '../../features/taste/engine';

const HEADER_H = 96;

export default function MySoundScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tabSpace = useTabBarSpace();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The map shows the taste you last saw, then reshapes a beat after you
  // arrive, so you can watch what your likes and skips changed.
  const live = useTaste();
  const liveRef = useRef(live);
  liveRef.current = live;
  const [shown, setShown] = useState(live);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => {
        if (shownRef.current.taste === liveRef.current.taste) return;
        haptic.settle();
        setShown(liveRef.current);
      }, 450);
      return () => clearTimeout(t);
    }, []),
  );

  const close = useCallback(() => setSelectedId(null), []);
  const mapTop = insets.top + HEADER_H;
  const mapHeight = height - mapTop - tabSpace;

  return (
    <View style={styles.root}>
      <NightSky />

      <View style={{ position: 'absolute', top: mapTop, left: 0 }}>
        <SoundMap
          artists={ARTISTS}
          taste={shown.taste}
          width={width}
          height={mapHeight}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onBackgroundTap={close}
        />
      </View>

      <View style={[styles.header, { paddingTop: insets.top + space.lg }]} pointerEvents="none">
        <Text style={styles.title}>My Sound</Text>
        <Text style={styles.subtitle}>{subtitle(shown.summary)}</Text>
      </View>

      <ArtistSheet artistId={selectedId} taste={shown.taste} bottomInset={tabSpace} onClose={close} />
    </View>
  );
}

function subtitle({ likes, saves, skips }: TasteSummary) {
  if (likes + saves + skips === 0) return 'Bigger means a closer match. Similar sounds sit together.';
  const parts = [
    likes && `${likes} ${likes === 1 ? 'like' : 'likes'}`,
    saves && `${saves} ${saves === 1 ? 'save' : 'saves'}`,
    skips && `${skips} ${skips === 1 ? 'skip' : 'skips'}`,
  ].filter(Boolean) as string[];
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `Shaped by your ${list}. Bigger means a closer match.`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  header: { paddingHorizontal: space.xl },
  title: { ...type.largeTitle, color: color.moon },
  subtitle: { ...type.body, color: color.moonDim, marginTop: space.xs },
});
