import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { goBack } from '../lib/nav';
import { color, space } from '../theme/tokens';
import { GlassCircleButton } from './GlassCircleButton';
import { ChevronIcon, ShareIcon } from './TabIcons';

/** The glass Back button at the top left of a page, and an optional Share button at the top right. */
export function PageActions({ onShare, shareLabel }: { onShare?: () => void; shareLabel?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <View style={[styles.left, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={goBack}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
      {onShare ? (
        <View style={[styles.right, { top: insets.top + space.sm }]}>
          <GlassCircleButton label={shareLabel ?? 'Share'} onPress={onShare}>
            <ShareIcon color={color.moon} size={17} />
          </GlassCircleButton>
        </View>
      ) : null}
    </>
  );
}

// Above the page's own content, wherever a screen draws them (a page's scroll view would otherwise sit on top and take the taps).
const styles = StyleSheet.create({
  left: { position: 'absolute', left: space.lg, zIndex: 20, elevation: 20 },
  right: { position: 'absolute', right: space.lg, zIndex: 20, elevation: 20 },
});
