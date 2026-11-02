import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { stageName } from '../../data/festival';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { usePlan } from '../../state/plan';
import { useTaste } from '../../state/taste';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { formatTime } from '../festivals/format';
import { hourLabel } from './grid';
import { MustSeeToggle } from './MustSeeToggle';
import { pickHours } from './pickSets';
import { t, tn } from '../../i18n';

/**
 * Pick sets: the whole day, hour by hour, every act on every stage at the
 * same size, each with a star. Star who you want to see and the Full day
 * follows; clashes you make are said on the row.
 */
export function PickSets({ festival, day }: { festival: Festival; day: string }) {
  const catalog = useCatalog();
  const { taste, informed } = useTaste();
  const { mustSeesAt, editsAt } = usePlan();
  const pinned = mustSeesAt(festival.id);
  const out = editsAt(festival.id).out;
  const hours = useMemo(() => pickHours(festival, day, { artist: catalog.artist, taste, informed, pinned, out }), [festival, day, catalog.artist, taste, informed, pinned, out]);
  const starred = hours.reduce((n, h) => n + h.rows.filter((r) => r.pinned).length, 0);
  if (!hours.length) return <Text style={styles.summary}>{t('No set times on this day.')}</Text>;
  return (
    <View>
      <Text style={styles.summary}>
        {starred ? tn(starred, '{n} starred today. Star anyone else you want to see.', '{n} starred today. Star anyone else you want to see.') : t('Everyone on today, hour by hour. Star who you want to see.')}
      </Text>
      {hours.map((h) => (
        <View key={h.hour} style={styles.hour}>
          <Text style={styles.hourLabel}>{hourLabel(h.hour * 60)}</Text>
          {h.rows.map((r) => (
            <View key={`${r.artist.id}-${r.set.stageId}-${r.start}`} style={[styles.row, r.pinned && styles.rowOn]}>
              <Pressable
                onPress={() => {
                  haptic.select();
                  router.push({ pathname: '/artist/[id]', params: { id: r.artist.id, festival: festival.id } });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${r.artist.name}, ${stageName(festival, r.set.stageId)}, ${formatTime(r.set.start)} ${t('to')} ${formatTime(r.set.end)}${r.known ? `, ${t('{n} percent match', { n: Math.round(r.match * 100) })}` : ''}${r.clashesWith.length ? `. ${t('Clashes with {names}', { names: r.clashesWith.map((a) => a.name).join(', ') })}` : ''}`}
                style={({ pressed }) => [styles.main, pressed && { opacity: 0.6 }]}
              >
                <ArtistAvatar artist={r.artist} size={32} />
                <View style={styles.text}>
                  <Text style={styles.name} numberOfLines={1}>
                    {r.artist.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {`${formatTime(r.set.start)}–${formatTime(r.set.end)} · ${stageName(festival, r.set.stageId)}`}
                  </Text>
                  {r.clashesWith.length ? (
                    <Text style={styles.clash} numberOfLines={1}>
                      {t('Clashes with {names}', { names: r.clashesWith.map((a) => a.name).join(', ') })}
                    </Text>
                  ) : null}
                </View>
                {r.known ? <Text style={[styles.pct, r.match >= 0.9 && { color: color.glow }]}>{Math.round(r.match * 100)}%</Text> : null}
              </Pressable>
              <MustSeeToggle artist={r.artist} festivalId={festival.id} size={20} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { ...type.caption, color: color.moonDim, marginTop: space.lg, marginBottom: space.sm },
  hour: { marginTop: space.md, gap: space.xs },
  hourLabel: { ...type.label, color: color.moonFaint, marginBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.sm,
    paddingRight: space.xs,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  rowOn: { borderColor: glowA(0.45), backgroundColor: glowA(0.1) },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  text: { flex: 1 },
  name: { ...type.label, color: color.moon },
  meta: { ...type.caption, color: color.moonDim, marginTop: 1 },
  clash: { ...type.caption, color: color.glow, marginTop: 1 },
  pct: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
});
