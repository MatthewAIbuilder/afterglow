import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { nightA, space } from '../theme/tokens';

/**
 * The back of a bar pinned to the bottom of a page (a Done button, a theme's
 * Use button): the page melts into it instead of stopping at a line, the way
 * iOS 26 softens a scroll edge. Starts a little above the bar.
 */
export function BottomFade() {
  return (
    <View pointerEvents="none" style={styles.fade}>
      <LinearGradient colors={[nightA(0), nightA(0.86), nightA(0.96)]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: -space.xxl },
});
