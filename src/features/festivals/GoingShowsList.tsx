import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { color, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import { showDateSpoken } from '../artists/shows';
import type { GoingShow } from './goingShows';
import { ShowDateBlock } from './ShowCards';
import { festivalLight } from './light';

/**
 * One-night shows someone is going to (or went to), as a short list: date,
 * name, where and who's on. A show still on Afterglow opens its page.
 * Without a title, just the rows (under a heading of the screen's own).
 */
export function GoingShowsList({ title, shows }: { title?: string; shows: readonly GoingShow[] }) {
  const catalog = useCatalog();
  if (!shows.length) return null;
  return (
    <View style={[styles.root, !title && styles.bare]}>
      {title ? (
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {shows.map((s) => {
        const live = catalog.shows.some((x) => x.id === s.id);
        const who = s.artistIds
          .map((id) => catalog.artist(id)?.name)
          .filter(Boolean)
          .slice(0, 3)
          .join(', ');
        return (
          <Pressable
            key={s.id}
            disabled={!live}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/show/[id]', params: { id: s.id } });
            }}
            accessibilityRole={live ? 'button' : 'text'}
            accessibilityLabel={[s.title, showDateSpoken(s.date), s.where, who].filter(Boolean).join(', ')}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
          >
            <ShowDateBlock date={s.date} light={festivalLight(s.id)} />
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {s.title}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {[s.where, who].filter(Boolean).join(' · ') || t('Show')}
              </Text>
            </View>
            {live ? <ChevronIcon color={color.moonFaint} size={11} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm, marginTop: space.lg },
  bare: { marginTop: 0 },
  title: { ...type.headline, color: color.moon },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  text: { flex: 1, gap: 2 },
  name: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim },
});
