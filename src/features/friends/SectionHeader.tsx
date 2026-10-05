import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { color, space, type } from '../../theme/tokens';

/** A Friends section's heading, in moonlight, with an optional link on the right ("See all"). */
export function SectionHeader({ title, action, actionLabel, onAction }: { title: string; action?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable
          onPress={() => {
            haptic.select();
            onAction();
          }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel ?? action}
          hitSlop={10}
        >
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm, paddingHorizontal: space.xs },
  title: { ...type.headline, color: color.moon },
  action: { ...type.label, color: color.glow },
});
