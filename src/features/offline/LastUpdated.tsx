import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useNow } from '../../lib/useNow';
import { color, space, type } from '../../theme/tokens';
import { lastUpdatedLine } from './lastKnown';
import { isOffline } from './status';

/**
 * A quiet line under something read from the server, instead of a spinner or
 * an error: "No signal, showing what you had · Last updated 9:41 PM", or just
 * "Last updated 9:41 PM" when the latest read didn't get through. Nothing
 * when it's up to date. `at`: when what's shown was read; `live`: the latest
 * read got through.
 */
export function LastUpdated({ at, live, style }: { at?: number; live: boolean; style?: StyleProp<ViewStyle> }) {
  const offline = isOffline(useNetworkState());
  const now = useNow().getTime();
  const line = lastUpdatedLine({ at, offline, live, now });
  if (!line) return null;
  return (
    <View style={[styles.row, style]} accessible accessibilityRole="text" accessibilityLabel={line}>
      <View style={[styles.dot, offline && styles.dotOff]} />
      <Text style={styles.text}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.glow, opacity: 0.7 },
  dotOff: { backgroundColor: color.moonFaint, opacity: 1 },
  text: { ...type.caption, color: color.moonDim, flexShrink: 1 },
});
