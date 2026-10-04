import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useSprouts } from '../../state/sprouts';
import { radius, space, type } from '../../theme/tokens';
import { ShelfHead } from '../profile/ShelfHead';
import { SPROUT_GREEN } from './look';
import { SproutOf } from './SproutOf';
import { gardenLine, sproutName } from './sprouts';
import { useCatalog } from '../../state/catalog';

const SHOWN = 8;

/** Your garden on your profile: your sprouts swaying in a row, and a tile to give one. */
export function GardenShelf({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const { garden, artists } = useSprouts();
  const catalog = useCatalog();
  // Your artist sprouts first (most filmed), then the rest of your garden.
  const items = [
    ...artists.flatMap((a) => {
      const artist = catalog.artist(a.artistId);
      return artist ? [{ id: `artist:${a.artistId}`, label: `${artist.name} sprout`, el: <SproutOf artist={{ id: artist.id, name: artist.name }} tier={a.tier} size={62} /> }] : [];
    }),
    ...garden.map((s) => ({ id: s.id, label: s.shown === 'seedling' && !s.artist ? 'Sprout' : sproutName({ kind: s.shown, artist: s.artist }), el: <SproutOf kind={s.shown} artist={s.artist} stage={s.stage} size={62} /> })),
  ].slice(0, SHOWN);
  const open = (to: '/garden' | '/give-sprout') => {
    haptic.select();
    router.push(to);
  };
  return (
    <View style={styles.wrap}>
      <ShelfHead title="Your garden" hidden={hidden} onToggle={onToggle} link={gardenLine(garden)} onLink={() => open('/garden')} />
      {hidden ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {items.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => open('/garden')}
              accessibilityRole="button"
              accessibilityLabel={`${s.label}. Opens your garden.`}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              {s.el}
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
