import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../data/types';
import { whereWhen } from '../features/festivals/format';
import { countdown } from '../features/festivals/when';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { color, space, type } from '../theme/tokens';
import { ChevronIcon } from './TabIcons';

/** A festival in search results: name and when/where, opening its page. `onOpen` runs first (e.g. to remember the search). */
export function FestivalRow({ festival, onOpen }: { festival: Festival; onOpen?: () => void }) {
  const today = useToday();
  const soon = countdown(festival, today);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onOpen?.();
        router.push(`/festival/${festival.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${festival.name}, ${whereWhen(festival)}${soon ? `, ${soon}` : ''}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {festival.name}
        </Text>
        <Text style={styles.status} numberOfLines={1}>
          {soon ? `${soon} · ` : ''}
          {whereWhen(festival)}
        </Text>
      </View>
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  name: { ...type.headline, color: color.moon },
  status: { ...type.caption, color: color.moonDim, marginTop: 2 },
});
