import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageFeedback } from '../components/PageFeedback';
import { PageTitle } from '../components/PageTitle';
import { fitKey, fitsByFestival } from '../features/fitCheck/fitCheck';
import { showActionSheet } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useFitChecks } from '../state/fitChecks';
import { color, radius, space, type } from '../theme/tokens';
import { t, weekdays } from '../i18n';

/** Your fit checks: one photo a festival day, festival by festival. Kept on this phone. */
export default function FitsScreen() {
  const insets = useSafeAreaInsets();
  const { fits, loaded, remove } = useFitChecks();
  const catalog = useCatalog();
  const groups = fitsByFestival(fits);
  return (
    <View style={styles.root}>
      <PageTitle title={t('Your fit checks')} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('Your fit checks')}</Text>
        <Text style={styles.sub}>{t('What you wore, day by day. Kept only on this phone.')}</Text>
        {groups.map((g) => (
          <View key={g.festivalId} style={styles.group}>
            <Text style={styles.festival}>{catalog.festival(g.festivalId)?.name ?? t('A festival')}</Text>
            <View style={styles.grid}>
              {g.fits.map((f) => {
                const [y, m, d] = f.date.split('-').map(Number);
                const day = weekdays()[new Date(y, m - 1, d).getDay()];
                return (
                  <Pressable
                    key={fitKey(f)}
                    onLongPress={() => {
                      haptic.select();
                      showActionSheet({ title: t('Fit check · {day}', { day }), options: [t('Delete'), t('Cancel')], cancelButtonIndex: 1, destructiveButtonIndex: 0 }, (i) => {
                        if (i === 0) void remove(fitKey(f));
                      });
                    }}
                    accessibilityRole="image"
                    accessibilityLabel={t('Your fit on {day}', { day })}
                    style={styles.cell}
                  >
                    <Image source={{ uri: f.uri }} style={styles.photo} />
                    <Text style={styles.day}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        {loaded && !groups.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('No fit checks yet')}</Text>
            <Text style={styles.sub}>{t('On a festival day, snap your outfit from Tonight. Each day’s fit collects here.')}</Text>
          </View>
        ) : null}
        <PageFeedback />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640, gap: space.md },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim },
  group: { marginTop: space.lg, gap: space.sm },
  festival: { ...type.headline, color: color.moon },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { width: 104, gap: 4 },
  photo: { width: 104, height: 140, borderRadius: radius.sm, backgroundColor: color.glass },
  day: { ...type.caption, color: color.moonDim },
  empty: { marginTop: space.lg, gap: space.xs },
  emptyTitle: { ...type.headline, color: color.moon },
});
