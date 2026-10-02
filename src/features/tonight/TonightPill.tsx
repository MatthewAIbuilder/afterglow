import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { tonightTitle, type Tonight } from './tonight';

/** Its height, so Discover keeps videos clear of it. */
export const TONIGHT_PILL_H = 40;

/** On a festival night, a glowing way back to Tonight from Discover. */
export function TonightPill({ tonight }: { tonight: Tonight }) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          haptic.select();
          router.push('/tonight');
        }}
        accessibilityRole="button"
        accessibilityLabel={`Tonight: ${tonightTitle(tonight)}. Your plan, your crew and looking after yourself.`}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
      >
        <View style={styles.dot} />
        <Text style={styles.text} numberOfLines={1}>
          Tonight · {tonightTitle(tonight)}
        </Text>
        <ChevronIcon color={color.moonDim} size={11} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: TONIGHT_PILL_H, justifyContent: 'center', paddingHorizontal: space.lg },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(169,124,255,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.55)',
    maxWidth: '100%',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.glow, shadowColor: color.glow, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  text: { ...type.label, color: color.moon, flexShrink: 1 },
});
