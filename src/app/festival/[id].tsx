import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { ChevronIcon } from '../../components/TabIcons';
import { FestivalPage } from '../../features/festivals/FestivalPage';
import { useCatalog } from '../../state/catalog';
import { color, space } from '../../theme/tokens';

export default function FestivalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const festival = useCatalog().festival(id);
  const insets = useSafeAreaInsets();
  if (!festival) return null;

  return (
    <View style={styles.root}>
      <FestivalPage festival={festival} topSpace={insets.top + 64} bottomSpace={insets.bottom + space.xxxl} />
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => router.back()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  back: { position: 'absolute', left: space.lg },
});
