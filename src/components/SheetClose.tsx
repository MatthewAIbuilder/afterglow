import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { goBack } from '../lib/nav';
import { color, space } from '../theme/tokens';
import { GlassCircleButton } from './GlassCircleButton';
import { CloseIcon } from './TabIcons';

/**
 * A close button at the top right of a sheet or pop-up. On a phone a sheet
 * also closes by swiping down, but that's easy to miss, and a browser has no
 * swipe at all. `fullScreen` sits it below the status bar.
 */
export function SheetClose({ fullScreen, onPress }: { fullScreen?: boolean; onPress?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { top: (fullScreen ? insets.top : 0) + space.md }]}>
      <GlassCircleButton label="Close" onPress={onPress ?? goBack}>
        <CloseIcon color={color.moon} size={16} />
      </GlassCircleButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: space.lg, zIndex: 20, elevation: 20 },
});
