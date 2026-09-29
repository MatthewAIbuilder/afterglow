import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SOUND_LABEL } from '../data/models';
import { mapCandidates } from '../features/sound-map/layout';
import { tasteMix } from '../features/taste/lean';
import { SoundBreakdown } from '../features/taste/SoundBreakdown';
import { useCatalog } from '../state/catalog';
import { useTaste } from '../state/taste';
import { color, space, type } from '../theme/tokens';

/**
 * Your sound as a breakdown: how much of your taste is each sound, from the
 * artists you match best (the same pull as "Leaning …" on My Sound). With a
 * festival, only its lineup counts. A sheet over My Sound.
 */
export default function YourSoundScreen() {
  const { festival: festivalId } = useLocalSearchParams<{ festival?: string }>();
  const catalog = useCatalog();
  const festival = festivalId ? catalog.festival(festivalId) : undefined;
  const { taste, informed, summary, rated } = useTaste();
  const insets = useSafeAreaInsets();
  const mix = useMemo(
    () => tasteMix(mapCandidates(catalog.artists, festival?.lineup), taste, informed),
    [catalog.artists, festival, taste, informed],
  );
  const yours = summary.likes + summary.saves + summary.skips + summary.watched + rated > 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
      <Text style={styles.title}>{festival ? `Your sound at ${festival.name}` : 'Your sound'}</Text>
      <Text style={styles.body}>
        {yours
          ? 'What your likes, saves, ratings and watching add up to, from the artists you match best.'
          : 'A first guess from where everyone starts. Like clips or rate artists and it becomes yours.'}
      </Text>
      {mix.length > 0 ? (
        <>
          <Text style={styles.headline} accessibilityRole="header">
            {mix[0].percent}% {SOUND_LABEL[mix[0].tag].toLowerCase()}
          </Text>
          <SoundBreakdown shares={mix} />
        </>
      ) : (
        <Text style={styles.empty}>
          {festival
            ? `Nothing on the ${festival.name} lineup matches you strongly yet. Tune your lineup to change that.`
            : 'Nothing matches you strongly yet. Like a few clips and your sound shows here.'}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.nightRaised },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.xs },
  headline: { ...type.largeTitle, color: color.glow, marginTop: space.xl, marginBottom: space.lg, fontVariant: ['tabular-nums'] },
  empty: { ...type.body, color: color.moonFaint, marginTop: space.xl },
});
