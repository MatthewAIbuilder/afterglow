import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import type { FilterChoice, MomentFilter } from './momentFilter';

/**
 * The quick filters above Moments: All, Artists, Festivals & shows, Tagged.
 * Artists and Festivals & shows open a second row with what's in your videos
 * (most first); tapping one shows just those.
 */
export function MomentFilters({
  value,
  onChange,
  artists,
  places,
  taggedCount,
}: {
  value: MomentFilter;
  onChange: (f: MomentFilter) => void;
  artists: FilterChoice[];
  places: FilterChoice[];
  /** Videos you're tagged in (and approved); undefined hides the filter. */
  taggedCount?: number;
}) {
  const pick = (f: MomentFilter) => {
    haptic.select();
    onChange(f);
  };
  const second = value.kind === 'artist' ? artists : value.kind === 'place' ? places : undefined;
  const chosen = value.kind === 'artist' ? value.id : value.kind === 'place' ? value.key : undefined;
  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip label={t('All')} on={value.kind === 'all'} onPress={() => pick({ kind: 'all' })} />
        {artists.length ? <Chip label={t('Artists')} on={value.kind === 'artist'} onPress={() => pick({ kind: 'artist' })} /> : null}
        {places.length ? <Chip label={t('Festivals & shows')} on={value.kind === 'place'} onPress={() => pick({ kind: 'place' })} /> : null}
        {taggedCount !== undefined ? <Chip label={taggedCount ? t('Tagged · {n}', { n: taggedCount }) : t('Tagged')} on={value.kind === 'tagged'} onPress={() => pick({ kind: 'tagged' })} /> : null}
      </ScrollView>
      {second?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {second.map((c) => (
            <Chip
              key={c.key}
              small
              label={`${c.label} · ${c.count}`}
              a11y={t('{name}, {n} videos', { name: c.label, n: c.count })}
              on={chosen === c.key}
              onPress={() => pick(value.kind === 'artist' ? { kind: 'artist', id: chosen === c.key ? undefined : c.key } : { kind: 'place', key: chosen === c.key ? undefined : c.key })}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function Chip({ label, a11y, on, small, onPress }: { label: string; a11y?: string; on: boolean; small?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={a11y ?? label}
      style={({ pressed }) => [styles.chip, small && styles.small, on && styles.chipOn, pressed && { opacity: 0.75 }]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm, marginBottom: space.md },
  row: { paddingHorizontal: space.lg, gap: space.sm },
  chip: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  small: { paddingHorizontal: space.md, paddingVertical: space.xs + 2 },
  chipOn: { backgroundColor: glowA(0.2), borderColor: glowA(0.55) },
  chipText: { ...type.label, color: color.moonDim },
  chipTextOn: { color: color.moon },
});
