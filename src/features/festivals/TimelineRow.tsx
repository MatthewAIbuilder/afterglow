import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { distanceLabel } from './near';
import { PlayIcon } from '../discover/icons';
import { isOver } from './shelves';
import { dateBlock } from './timeline';
import { isLive } from './when';
import { lovedLine, useFestivalSummary } from './useFestivalSummary';
import { datesLine } from './format';
import { t, tn } from '../../i18n';

/**
 * One festival on the Festivals tab's timeline: a calendar date block, its
 * name and place, what's there for you and when, and a few faces. Finished
 * festivals are dimmed. Tapping opens the festival; its clips are an action
 * for screen readers.
 */
export function TimelineRow({ festival, going }: { festival: Festival; going?: boolean }) {
  const s = useFestivalSummary(festival);
  const block = dateBlock(festival);
  const over = isOver(festival, s.today);
  const live = isLive(festival, s.today);
  const when = [s.soon && s.soon !== t('Over') ? s.soon : undefined, s.timesOut && !over ? t('Set times out') : undefined].filter(Boolean).join(' · ');
  const watch = () => {
    haptic.tap();
    router.navigate({ pathname: '/', params: { festival: festival.id } });
  };
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push(`/festival/${festival.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={[
        festival.name,
        datesLine(festival),
        s.soon,
        s.loved > 0 ? t("{loved} of {n} artists you'll love", { loved: s.loved, n: s.ranked.length }) : t('{n} artists', { n: s.ranked.length }),
        s.timesOut ? t('set times are out') : undefined,
        going ? t('going') : undefined,
      ]
        .filter((x) => x !== undefined)
        .join(', ')}
      accessibilityActions={s.reach.clips > 0 ? [{ name: 'discover', label: t('Discover the lineup') }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'discover') watch();
      }}
      style={({ pressed }) => [styles.row, over && styles.over, pressed && styles.pressed]}
    >
      <View style={[styles.block, going && styles.blockGoing, live && styles.blockLive]}>
        {block ? (
          <>
            <Text style={[styles.month, going && { color: color.night }]}>{block.month}</Text>
            <Text style={[styles.days, going && { color: color.night }]} numberOfLines={1} adjustsFontSizeToFit>
              {block.days}
            </Text>
          </>
        ) : (
          <Text style={styles.tba}>{t('TBA')}</Text>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {festival.name}
        </Text>
        <Text style={styles.place} numberOfLines={1}>
          {festival.location}
          {s.away !== undefined ? ` · ${distanceLabel(s.away, s.units)}` : ''}
        </Text>
        <Text style={styles.line} numberOfLines={1}>
          <Text style={s.loved > 0 ? styles.loved : undefined}>{lovedLine(s.loved, s.ranked.length)}</Text>
          {when ? <Text style={live ? { color: '#FF7EB6' } : s.timesOut && !over ? { color: color.glow } : undefined}>{` · ${when}`}</Text> : null}
        </Text>
      </View>
      {/* Its clips, one tap into Discover; otherwise a couple of faces from the lineup. */}
      {s.reach.clips > 0 ? (
        <Pressable
          onPress={watch}
          accessibilityRole="button"
          accessibilityLabel={tn(s.reach.clips, 'Discover the {festival} lineup, {n} clip', 'Discover the {festival} lineup, {n} clips', { festival: festival.name })}
          hitSlop={8}
          style={({ pressed }) => [styles.clips, pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] }]}
        >
          <PlayIcon color={color.moon} size={11} />
          <Text style={styles.clipsText}>{s.reach.clips}</Text>
        </Pressable>
      ) : (
        <View style={styles.faces}>
          {s.ranked.slice(0, 2).map((a, i) => (
            <View key={a.id} style={[styles.face, { marginLeft: i === 0 ? 0 : -12, zIndex: 10 - i }]}>
              <ArtistAvatar artist={a} size={28} />
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  over: { opacity: 0.55 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  block: {
    width: 54,
    height: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glowA(0.14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  blockGoing: { backgroundColor: color.glow, borderColor: color.glow },
  blockLive: { borderColor: '#FF7EB6', borderWidth: 1.5 },
  month: { ...type.caption, fontSize: 11, fontWeight: '700', color: color.glow, letterSpacing: 1 },
  days: { fontSize: 18, fontWeight: '700', color: color.moon, fontVariant: ['tabular-nums'] },
  tba: { ...type.caption, fontWeight: '700', color: color.moonFaint, letterSpacing: 1 },
  body: { flex: 1, gap: 1 },
  name: { ...type.headline, color: color.moon },
  place: { ...type.caption, color: color.moonDim },
  line: { ...type.caption, color: color.moonDim },
  loved: { color: color.moon, fontWeight: '600' },
  faces: { flexDirection: 'row' },
  clips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  clipsText: { ...type.caption, color: color.moon, fontVariant: ['tabular-nums'] },
  face: { borderRadius: 16, borderWidth: 2, borderColor: color.night },
});
