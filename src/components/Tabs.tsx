import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '../lib/haptics';
import { color, motion, space, type } from '../theme/tokens';

export type TabItem<K extends string> = {
  key: K;
  label: string;
  /** Drawn left of the label, in the tab's colour. */
  icon?: (tint: string) => ReactNode;
  /** A count after the label ("Videos 12"); hidden at 0. */
  count?: number;
};

/**
 * Tabs that split a long page into short ones (like a profile's Videos and
 * Saved): equal widths, the chosen one bright with a glow line under it that
 * slides across (still with reduced motion), a hairline under the row.
 */
export function Tabs<K extends string>({ items, value, onChange }: { items: TabItem<K>[]; value: K; onChange: (key: K) => void }) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, items.findIndex((t) => t.key === value));
  const reduce = useReducedMotion();
  const x = useSharedValue(0);
  const each = items.length ? width / items.length : 0;
  useEffect(() => {
    const to = index * each;
    x.set(reduce ? to : withSpring(to, motion.snappy));
  }, [index, each, reduce, x]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  // Narrow tabs (four on a small phone) drop their icons so the words fit.
  const tight = each > 0 && each < 96;

  return (
    <View style={styles.root} accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {items.map((t) => {
        const on = t.key === value;
        const tint = on ? color.moon : color.moonFaint;
        return (
          <Pressable
            key={t.key}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(t.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.count ? `${t.label}, ${t.count}` : t.label}
            style={styles.tab}
          >
            {t.icon && !tight ? t.icon(tint) : null}
            <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
              {t.label}
            </Text>
            {t.count ? <Text style={[styles.count, on && styles.countOn]}>{t.count}</Text> : null}
          </Pressable>
        );
      })}
      {each > 0 ? <Animated.View pointerEvents="none" style={[styles.line, { width: each }, line]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space.md, minHeight: 44 },
  label: { ...type.label },
  count: { ...type.caption, color: color.moonFaint, fontVariant: ['tabular-nums'] },
  countOn: { color: color.moonDim },
  line: { position: 'absolute', left: 0, bottom: -StyleSheet.hairlineWidth, height: 2, borderRadius: 1, backgroundColor: color.glow },
});
