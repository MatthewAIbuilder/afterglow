import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useSprouts } from '../../state/sprouts';
import { color, radius, space, type } from '../../theme/tokens';
import { ShelfHead } from '../profile/ShelfHead';
import { SPROUT_GREEN } from './look';
import { SproutOf } from './SproutOf';
import { gardenLine, sproutName } from './sprouts';
import { stackSame } from './stack';
import { useCatalog } from '../../state/catalog';
import { t } from '../../i18n';

const SHOWN = 8;

/** Your garden on your profile: your sprouts swaying in a row, and a tile to give one. */
export function GardenShelf({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const { garden, artists } = useSprouts();
  const catalog = useCatalog();
  // Your artist sprouts first (most filmed), then the rest of your garden.
  const items = [
    ...artists.flatMap((a) => {
      const artist = catalog.artist(a.artistId);
      return artist ? [{ id: `artist:${a.artistId}`, count: 1, label: t('{artist} sprout', { artist: artist.name }), el: <SproutOf artist={{ id: artist.id, name: artist.name }} tier={a.tier} shiny={a.shiny} size={62} /> }] : [];
    }),
    // The same sprout more than once shows once, with how many.
    ...stackSame(garden).map(({ item: s, count }) => ({
      id: s.id,
      count,
      label: s.shown === 'seedling' && !s.artist ? t('Sprout') : sproutName({ kind: s.shown, artist: s.artist }),
      el: <SproutOf kind={s.shown} artist={s.artist} stage={s.stage} size={62} />,
    })),
  ].slice(0, SHOWN);
  const open = (to: '/garden' | '/give-sprout') => {
    haptic.select();
    router.push(to);
  };
  return (
    <View style={styles.wrap}>
      <ShelfHead title={t('Your garden')} hidden={hidden} onToggle={onToggle} link={gardenLine(garden.filter((s) => !s.artist))} onLink={() => open('/garden')} />
      {hidden ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {items.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => open('/garden')}
              accessibilityRole="button"
              accessibilityLabel={`${s.count > 1 ? t('{n} × {sprout}', { n: s.count, sprout: s.label }) : s.label}. ${t('Opens your garden.')}`}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              {s.el}
              {s.count > 1 ? (
                <View style={styles.count}>
                  <Text style={styles.countText}>{`×${s.count}`}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
          <Pressable onPress={() => open('/give-sprout')} accessibilityRole="button" accessibilityLabel={t('Give someone a sprout')} style={({ pressed }) => [styles.give, pressed && styles.pressed]}>
            <Text style={styles.plus}>+</Text>
            <Text style={styles.giveText}>{t('Give')}</Text>
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
  count: { position: 'absolute', right: 0, bottom: 2, minWidth: 26, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: SPROUT_GREEN, alignItems: 'center' },
  countText: { ...type.caption, color: color.night, fontWeight: '700', fontVariant: ['tabular-nums'] },
  give: { width: 58, height: 58, borderRadius: radius.pill, marginLeft: space.xs, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: SPROUT_GREEN },
  plus: { ...type.headline, color: SPROUT_GREEN, lineHeight: 20 },
  giveText: { ...type.caption, color: SPROUT_GREEN },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
});
