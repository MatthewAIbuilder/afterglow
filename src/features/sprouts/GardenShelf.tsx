import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useSprouts } from '../../state/sprouts';
import { radius, space, type } from '../../theme/tokens';
import { ShelfHead } from '../profile/ShelfHead';
import { SPROUT_GREEN } from './look';
import { Sprout } from './Sprout';
import { gardenLine, kindOf } from './sprouts';

const SHOWN = 8;

/** Your garden on your profile: your sprouts swaying in a row, and a tile to give one. */
export function GardenShelf({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const { garden } = useSprouts();
  const open = (to: '/garden' | '/give-sprout') => {
    haptic.select();
    router.push(to);
  };
  return (
    <View style={styles.wrap}>
      <ShelfHead title="Your garden" hidden={hidden} onToggle={onToggle} link={gardenLine(garden)} onLink={() => open('/garden')} />
      {hidden ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {garden.slice(0, SHOWN).map((s) => (
            <Pressable
              key={s.id}
              onPress={() => open('/garden')}
              accessibilityRole="button"
              accessibilityLabel={`${s.shown === 'seedling' ? 'Sprout' : kindOf(s.shown).name}. Opens your garden.`}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Sprout kind={s.shown} stage={s.stage} size={62} />
            </Pressable>
          ))}
          <Pressable onPress={() => open('/give-sprout')} accessibilityRole="button" accessibilityLabel="Give someone a sprout" style={({ pressed }) => [styles.give, pressed && styles.pressed]}>
            <Text style={styles.plus}>+</Text>
            <Text style={styles.giveText}>Give</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.lg },
  row: { paddingHorizontal: space.xl, gap: space.xs, alignItems: 'center' },
  item: { width: 66, alignItems: 'center' },
  give: { width: 58, height: 58, borderRadius: radius.pill, marginLeft: space.xs, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: SPROUT_GREEN },
  plus: { ...type.headline, color: SPROUT_GREEN, lineHeight: 20 },
  giveText: { ...type.caption, color: SPROUT_GREEN },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
});
