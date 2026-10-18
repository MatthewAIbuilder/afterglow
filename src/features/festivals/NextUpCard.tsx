import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { CountUp } from '../../components/CountUp';
import { PersonAvatar } from '../../components/PersonAvatar';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { usePlan } from '../../state/plan';
import { useTaste } from '../../state/taste';
import { color, radius, space, tintA, type } from '../../theme/tokens';
import { PlayIcon } from '../discover/icons';
import { usePrep } from '../prep/usePrep';
import { goersLine } from '../social/going';
import { useGoers } from '../social/useGoers';
import { festivalLights } from './light';
import { datesLine, whereWhen } from './format';
import { distanceLabel } from './near';
import { bigCountdown } from './timeline';
import { countdownLights, topForYou } from './upNext';
import { nextRun } from './when';
import { lovedLine, useFestivalSummary } from './useFestivalSummary';
import { t, tn } from '../../i18n';


/**
 * A festival you're going to, at the top of the Festivals tab in the list
 * view (the next one first, the rest beside it to swipe to; the grid view
 * shows them as tiles instead). Compact (the user, 2026-10-18: the cards
 * "take up the entire screen"): the name and the countdown (the last
 * fortnight as a row of lights), one line of your top artists there with
 * their match, one line of friends going, and where your plan stands
 * (set times, must-sees, Get ready, which opens the checklist), with Watch.
 * Tapping it opens the festival. While it's on, it glows "Now" and offers
 * Tonight. It wears the festival's own light.
 */
export function NextUpCard({ festival, first = true, style }: { festival: Festival; first?: boolean; style?: StyleProp<ViewStyle> }) {
  const s = useFestivalSummary(festival);
  const { taste } = useTaste();
  const big = bigCountdown(festival, s.today);
  const live = !!big?.live;
  const run = nextRun(festival, s.today);
  const lights = run && run.index === 0 ? countdownLights(run.until) : undefined;
  const top = topForYou(s.ranked, taste);
  const goers = useGoers(festival.id);
  const goersText = goers ? goersLine(goers) : undefined;
  const goerFaces = goers ? [...goers.friends, ...goers.others].slice(0, 4) : [];
  const stars = usePlan().mustSeesAt(festival.id).size;
  const prep = usePrep(festival).progress;
  const [light, dusk] = festivalLights(festival.id);
  const facts = [lovedLine(s.loved, s.ranked.length), s.loved ? tn(s.ranked.length, '{n} act', '{n} acts') : undefined, s.timesOut ? t('Set times out') : t('Set times to come')].filter(Boolean).join(' · ');
  // Read out with the card: your top artists there and who's going.
  const heard = [facts, top.length ? t('Your top artists here: {names}', { names: top.map((x) => x.artist.name).join(', ') }) : undefined, goersText].filter(Boolean).join('. ');
  const open = () => {
    haptic.select();
    router.push(`/festival/${festival.id}`);
  };
  const watch = () => {
    haptic.tap();
    router.navigate({ pathname: '/', params: { festival: festival.id } });
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={s.soon ? t('Up next: {festival}, {dates}, {countdown}. {facts}', { festival: festival.name, dates: datesLine(festival), countdown: s.soon, facts: heard }) : t('Up next: {festival}, {dates}. {facts}', { festival: festival.name, dates: datesLine(festival), facts: heard })}
      accessibilityActions={s.reach.clips > 0 ? [{ name: 'discover', label: t('Discover the lineup') }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'discover') watch();
      }}
      style={({ pressed }) => [styles.card, style, { borderColor: tintA(light, 0.45) }, live && styles.live, pressed && styles.pressed]}
    >
      {/* Its light shining in from the top corner, the one before it low on the other side. */}
      <LinearGradient
        colors={[tintA(light, 0.3), tintA(light, 0.03), tintA(dusk, 0.14)]}
        locations={[0, 0.55, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.head}>
        <View style={styles.headText}>
          <View style={styles.kickerRow}>
            {live ? <View style={styles.dot} /> : null}
            <Text style={[styles.kicker, { color: light }, live && { color: '#FF7EB6' }]}>{live ? t('Happening now') : first ? t('Up next') : t('Also going')}</Text>
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {festival.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {whereWhen(festival)}
            {s.away !== undefined ? ` · ${distanceLabel(s.away, s.units)}` : ''}
          </Text>
        </View>
        {big ? (
          <View style={styles.count} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <CountUp value={big.value} style={[styles.countValue, live && { color: '#FF7EB6' }]} />
            <Text style={styles.countUnit}>{big.unit}</Text>
          </View>
        ) : null}
      </View>

      {lights ? (
        <View style={styles.lights} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {lights.map((lit, i) => (
            <View key={i} style={[styles.light, lit ? { backgroundColor: light, shadowColor: light } : styles.lightDark]} />
          ))}
        </View>
      ) : null}

      {/* Your top artists there, with their match: one line. */}
      <View style={styles.line}>
        <View style={styles.faces}>
          {(top.length ? top.map((x) => x.artist) : s.ranked.slice(0, 3)).map((a, i) => (
            <View key={a.id} style={[styles.face, { marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }]}>
              <ArtistAvatar artist={a} size={28} />
            </View>
          ))}
        </View>
        <Text style={styles.lineText} numberOfLines={1}>
          {top.length ? (
            top.map(({ artist, match }, i) => (
              <Text key={artist.id}>
                {i > 0 ? <Text style={styles.sep}>{'  ·  '}</Text> : null}
                {artist.name} <Text style={{ color: light }}>{t('{n}%', { n: match })}</Text>
              </Text>
            ))
          ) : (
            <Text style={styles.dim}>{facts}</Text>
          )}
        </Text>
      </View>

      {goersText ? (
        <View style={styles.line}>
          <View style={styles.faces}>
            {goerFaces.map((p, i) => (
              <View key={p.uid} style={[styles.face, { marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }]}>
                <PersonAvatar name={p.displayName} url={p.avatarUrl} uid={p.uid} size={28} />
              </View>
            ))}
          </View>
          <Text style={styles.lineText} numberOfLines={1}>
            {goersText}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.chips}>
          {top.length ? <Text style={[styles.chip, s.timesOut && { color: color.glow }]}>{s.timesOut ? t('Set times out') : t('Set times to come')}</Text> : null}
          {stars > 0 ? <Text style={styles.chip}>{tn(stars, '★ {n} must-see', '★ {n} must-sees')}</Text> : null}
          {prep.total > 0 && !live ? (
            <Pressable
              onPress={() => {
                haptic.select();
                router.push({ pathname: '/prep/[id]', params: { id: festival.id } });
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Get ready: {done} of {total} done', { done: prep.done, total: prep.total })}
              hitSlop={6}
              style={({ pressed }) => [styles.chipBox, pressed && styles.pressed]}
            >
              <Text style={styles.chipText}>{t('Get ready {done}/{total}', { done: prep.done, total: prep.total })}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round((prep.done / prep.total) * 100)}%`, backgroundColor: light }]} />
              </View>
            </Pressable>
          ) : null}
        </View>
        {live ? (
          <Pressable
            onPress={() => router.push('/tonight')}
            accessibilityRole="button"
            accessibilityLabel={t('Open Tonight')}
            style={({ pressed }) => [styles.small, { backgroundColor: light }, pressed && styles.pressed]}
          >
            <Text style={styles.smallDark}>{t('Tonight')}</Text>
          </Pressable>
        ) : s.reach.clips > 0 ? (
          <Pressable
            onPress={watch}
            accessibilityRole="button"
            accessibilityLabel={tn(s.reach.clips, 'Discover the {festival} lineup, {n} clip', 'Discover the {festival} lineup, {n} clips', { festival: festival.name })}
            style={({ pressed }) => [styles.small, styles.smallGlass, pressed && styles.pressed]}
          >
            <PlayIcon color={color.moon} size={10} />
            <Text style={styles.smallText}>{s.reach.clips}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.lg,
    marginBottom: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: 1,
    overflow: 'hidden',
    gap: space.md,
  },
  live: { borderColor: 'rgba(255,126,182,0.55)' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  headText: { flex: 1, minWidth: 0 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF7EB6' },
  kicker: { ...type.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  name: { ...type.title, fontSize: 22, lineHeight: 27, color: color.moon },
  meta: { ...type.caption, color: color.moonDim, marginTop: 2 },
  count: { alignItems: 'flex-end' },
  countValue: { fontSize: 38, lineHeight: 42, fontWeight: '200', color: color.moon, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  countUnit: { ...type.caption, color: color.moonDim, marginTop: -2 },
  lights: { flexDirection: 'row', gap: 4 },
  light: { flex: 1, height: 3, borderRadius: 2, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  lightDark: { backgroundColor: color.hairline },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 16, borderWidth: 2, borderColor: color.night },
  lineText: { ...type.label, color: color.moon, flex: 1 },
  sep: { color: color.moonFaint },
  dim: { color: color.moonDim },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    ...type.caption,
    color: color.moon,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipBox: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { ...type.caption, color: color.moon },
  track: { width: 28, height: 3, borderRadius: 2, backgroundColor: color.hairline, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
  small: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingHorizontal: space.md, borderRadius: radius.pill },
  smallGlass: { backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  smallText: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  smallDark: { ...type.label, color: color.night },
});
