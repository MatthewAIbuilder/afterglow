import { StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';

/** The website can't record where you walk: the trail is drawn in the phone app. */
export function TrailMap({ height }: { days?: unknown; chosen?: string; height: number }) {
  return (
    <View style={[styles.box, { height }]}>
      <Text style={styles.text}>{t('Your festival trail is drawn in the Afterglow app on your phone.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, backgroundColor: color.glass, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  text: { ...type.body, color: color.moonDim, textAlign: 'center' },
});
