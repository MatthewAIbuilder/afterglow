import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SOUND_LABEL } from '../data/models';
import { mapCandidates } from '../features/sound-map/layout';
import { tasteMix } from '../features/taste/lean';
import { SOUND_COLOR } from '../features/sound-map/colors';
import { SoundBreakdown } from '../features/taste/SoundBreakdown';
import { useCatalog } from '../state/catalog';
import { useTaste } from '../state/taste';
import { useWeekends } from '../state/weekends';
import { color, space, type } from '../theme/tokens';
import { SheetClose } from '../components/SheetClose';
import { t } from '../i18n';
import { SHEET_BACKGROUND } from '../components/LiquidGlass';

/**
 * Your sound as a breakdown: how much of your taste is each sound, from the
 * artists you match best (the same pull as "Leaning …" on My Sound). With a
 * festival, only its lineup counts. A sheet over My Sound.
 */
export default function YourSoundScreen() {
  const { festival: festivalId } = useLocalSearchParams<{ festival?: string }>();
  const catalog = useCatalog();
  const { forYou } = useWeekends();
  const whole = festivalId ? catalog.festival(festivalId) : undefined;
  const festival = whole && forYou(whole);
  const { taste, informed, summary, rated } = useTaste();
  const insets = useSafeAreaInsets();
  const mix = useMemo(
    () => tasteMix(mapCandidates(catalog.artists, festival?.lineup), taste, informed),
    [catalog.artists, festival, taste, informed],
  );
  const yours = summary.likes + summary.saves + summary.skips + summary.watched + rated > 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.title}>{festival ? t('Your sound at {festival}', { festival: festival.name }) : t('Your sound')}</Text>
        <Text style={styles.body}>
          {yours
            ? t('What your likes, saves, ratings and watching add up to, from the artists you match best.')
            : t('A first guess from where everyone starts. Like clips or rate artists and it becomes yours.')}
        </Text>
        {mix.length > 0 ? (
          <>
            <Text style={[styles.headline, { color: SOUND_COLOR[mix[0].tag] }]} accessibilityRole="header">
              {t('{pct}% {sound}', { pct: mix[0].percent, sound: SOUND_LABEL[mix[0].tag].toLowerCase() })}
            </Text>
            <SoundBreakdown shares={mix} colored />
          </>
        ) : (
          <Text style={styles.empty}>
            {festival
              ? t('Nothing on the {festival} lineup matches you strongly yet. Tune your lineup to change that.', { festival: festival.name })
              : t('Nothing matches you strongly yet. Like a few clips and your sound shows here.')}
          </Text>
        )}
      </ScrollView>
      <SheetClose />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHEET_BACKGROUND },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.xs },
  headline: { ...type.largeTitle, color: color.glow, marginTop: space.xl, marginBottom: space.lg, fontVariant: ['tabular-nums'] },
  empty: { ...type.body, color: color.moonFaint, marginTop: space.xl },
});
