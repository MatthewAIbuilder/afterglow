import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, space, type } from '../theme/tokens';
import { GlassFill } from './LiquidGlass';

/** A page with nothing on it yet: its icon in a glass disc, and what will fill it. */
export function EmptyState({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.disc}>
        <GlassFill radius={DISC / 2} tint={0.3} />
        {/* Its own layer, so the glass (positioned) never paints over the icon in a browser. */}
        <View pointerEvents="none">{icon}</View>
      </View>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const DISC = 60;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.xxl, paddingBottom: space.xl, gap: space.lg },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, alignItems: 'center', justifyContent: 'center' },
  text: { ...type.body, color: color.moonDim, textAlign: 'center', maxWidth: 340 },
});
