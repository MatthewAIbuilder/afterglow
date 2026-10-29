import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Missing } from '../../components/Missing';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { PageTitle } from '../../components/PageTitle';
import { localDay } from '../../features/artists/shows';
import { whereWhen } from '../../features/festivals/format';
import { useEventLookup } from '../../features/festivalMode/useEvent';
import { StayCard } from '../../features/partners/StayCard';
import { STAY_GUESTS_MAX } from '../../features/messages/shares';
import { useToday } from '../../lib/useToday';
import { color, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import { PageFeedback } from '../../components/PageFeedback';

/**
 * Places to stay for a festival or a show, on a page of its own: what a crew
 * opens from its page or from a stays card in its chat (`?guests=6` searches
 * for all of them). The website link opens it too.
 */
export default function StayScreen() {
  const { id, guests } = useLocalSearchParams<{ id: string; guests?: string }>();
  const insets = useSafeAreaInsets();
  const event = useEventLookup()(id);
  const today = localDay(useToday());
  if (!event) return <Missing title={t('Festival not found')} line={t('This festival isn’t on Afterglow any more, or the link isn’t quite right.')} />;
  const n = Number(guests);
  const size = Number.isInteger(n) && n >= 2 ? Math.min(n, STAY_GUESTS_MAX) : undefined;
  const over = (event.endDate ?? event.startDate ?? '9999') < today;
  return (
    <View style={styles.root}>
      <PageTitle title={t('Where to stay · {festival}', { festival: event.name })} />
      <NightSky />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.title}>{event.name}</Text>
        <Text style={styles.sub}>{whereWhen(event)}</Text>
        {over ? <Text style={styles.sub}>{t('This has passed, so there’s nowhere to book any more.')}</Text> : <StayCard trip={event} name={event.name} crew={size ? { size } : undefined} />}
        <PageFeedback />
      </ScrollView>
      <PageActions />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640 },
  title: { ...type.largeTitle, color: color.moon, marginTop: space.xs },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs },
});
