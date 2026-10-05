import { useLocalSearchParams } from 'expo-router';
import { PageTitle } from '../../components/PageTitle';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Missing } from '../../components/Missing';
import { PageActions } from '../../components/PageActions';
import { WEB_URL } from '../../config/app';
import { FestivalPage } from '../../features/festivals/FestivalPage';
import { festivalShareText } from '../../features/share/pages';
import { useSendOrShare } from '../../features/messages/useSendOrShare';
import { useCatalog } from '../../state/catalog';
import { useWeekends } from '../../state/weekends';
import { color, space } from '../../theme/tokens';

export default function FestivalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const festival = useCatalog().festival(id);
  const { forYou } = useWeekends();
  const insets = useSafeAreaInsets();
  const sendOrShare = useSendOrShare();
  if (!festival) return <Missing title="Festival not found" line="This festival isn’t on Afterglow any more, or the link isn’t quite right." />;

  return (
    <View style={styles.root}>
      <PageTitle title={festival.name} />
      <FestivalPage festival={festival} topSpace={insets.top + 64} bottomSpace={insets.bottom + space.xxxl} />
      <PageActions
        shareLabel={`Share ${festival.name}`}
        onShare={() => sendOrShare({ kind: 'festival', id: festival.id }, festivalShareText(forYou(festival), WEB_URL), festival.name)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
});
