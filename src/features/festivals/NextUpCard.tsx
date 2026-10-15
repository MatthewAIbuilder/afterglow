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
import { FestivalCover } from './FestivalCover';
import { festivalLights } from './light';
import { datesLine, whereWhen } from './format';
import { distanceLabel } from './near';
import { bigCountdown } from './timeline';
import { countdownLights, topForYou } from './upNext';
import { nextRun } from './when';
import { lovedLine, useFestivalSummary } from './useFestivalSummary';
import { t, tn } from '../../i18n';

const COVER = 170;

/**
 * A festival you're going to, at the top of the Festivals tab (the next one
 * first, the rest beside it to swipe to): a big countdown (the last fortnight
 * as a row of lights, one a night), your top artists on its lineup, friends
 * who are going, and where your plan stands (must-sees, Get ready, set
 * times), with the two things you'd do: open your plan, or watch the lineup.
 * While it's on, it glows "Now" and offers Tonight. It wears the festival's
 * own light.
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
      style={({ pressed }) => [styles.card, style, { borderColor: tintA(light, 0.45) }, s.cover.length > 0 && styles.covered, live && styles.live, pressed && styles.pressed]}
    >
      <FestivalCover photos={s.cover} style={styles.cover} />
      {/* Its light shining in from the top corner, the one before it low on the other side. */}
      <LinearGradient
        colors={[tintA(light, s.cover.length > 0 ? 0.26 : 0.34), tintA(light, 0.03), tintA(dusk, 0.16)]}
        locations={[0, 0.55, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        <View style={styles.kickerRow}>
          {live ? <View style={styles.dot} /> : null}
          <Text style={[styles.kicker, { color: light }, live && { color: '#FF7EB6' }]}>{live ? t('Happening now') : first ? t('Up next') : t('Also going')}</Text>
        </View>
        {big ? (
          <View style={styles.count} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <CountUp value={big.value} style={[styles.countValue, live && { color: '#FF7EB6' }]} />
            <Text style={styles.countUnit}>{big.unit}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.name}>{festival.name}</Text>
      <Text style={styles.meta}>
        {whereWhen(festival)}
        {s.away !== undefined ? ` · ${distanceLabel(s.away, s.units)}` : ''}
      </Text>

      {lights ? (
        <View style={styles.lights} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {lights.map((lit, i) => (
            <View key={i} style={[styles.light, lit ? { backgroundColor: light, shadowColor: light } : styles.lightDark]} />
          ))}
        </View>
      ) : null}

      {top.length > 0 ? (
        <View style={styles.topBlock}>
          <Text style={styles.blockHead}>{t('Your top artists here')}</Text>
          <View style={styles.topRow2}>
            {top.map(({ artist, match }) => (
              <Pressable
                key={artist.id}
                onPress={() => {
                  haptic.select();
                  router.push(`/artist/${artist.id}`);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('{artist}, {n}% match', { artist: artist.name, n: match })}
                style={({ pressed }) => [styles.topArtist, pressed && styles.pressed]}
              >
                <View style={[styles.topFace, { borderColor: tintA(light, 0.7) }]}>
                  <ArtistAvatar artist={artist} size={56} />
                </View>
                <Text style={styles.topName} numberOfLines={1}>
                  {artist.name}
                </Text>
                <Text style={[styles.topMatch, { color: light }]}>{t('{n}% match', { n: match })}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.factsRow}>
          <View style={styles.faces}>
            {s.ranked.slice(0, 5).map((a, i) => (
              <View key={a.id} style={[styles.face, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
                <ArtistAvatar artist={a} size={32} />
              </View>
            ))}
          </View>
        </View>
      )}

      {goersText ? (
        <View style={styles.goers}>
          <View style={styles.faces}>
            {goerFaces.map((p, i) => (
              <View key={p.uid} style={[styles.goerFace, { marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }]}>
                <PersonAvatar name={p.displayName} url={p.avatarUrl} uid={p.uid} size={26} />
              </View>
            ))}
          </View>
          <Text style={styles.goersText} numberOfLines={2}>
            {goersText}
          </Text>
        </View>
      ) : null}

      <View style={styles.chips}>
        <Text style={[styles.chip, s.timesOut && { color: color.glow }]}>{facts}</Text>
        {stars > 0 ? <Text style={styles.chip}>{tn(stars, '★ {n} must-see', '★ {n} must-sees')}</Text> : null}
        {prep.total > 0 && !live ? (
          <View style={styles.chipBox} accessibilityLabel={t('Get ready: {done} of {total} done', { done: prep.done, total: prep.total })}>
            <Text style={styles.chipText}>{t('Get ready {done}/{total}', { done: prep.done, total: prep.total })}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((prep.done / prep.total) * 100)}%`, backgroundColor: light }]} />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={live ? () => router.push('/tonight') : open}
          accessibilityRole="button"
          accessibilityLabel={live ? t('Open Tonight') : t('Open your plan for {festival}', { festival: festival.name })}
          style={({ pressed }) => [styles.primary, { backgroundColor: light }, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{live ? t('Tonight') : t('Your plan')}</Text>
        </Pressable>
        {s.reach.clips > 0 ? (
          <Pressable
            onPress={watch}
            accessibilityRole="button"
            accessibilityLabel={tn(s.reach.clips, 'Discover the {festival} lineup, {n} clip', 'Discover the {festival} lineup, {n} clips', { festival: festival.name })}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <PlayIcon color={color.moon} size={12} />
            <Text style={styles.secondaryText}>{t('Watch · {n}', { n: s.reach.clips })}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.lg,
    marginBottom: space.xl,
    padding: space.xl,
    borderRadius: radius.lg + 4,
    backgroundColor: color.glass,
    borderWidth: 1,
    overflow: 'hidden',
  },
  covered: { paddingTop: COVER - space.xl * 2, backgroundColor: color.night },
  live: { borderColor: 'rgba(255,126,182,0.55)' },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, height: COVER },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  topRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF7EB6' },
  kicker: { ...type.label, textTransform: 'uppercase', letterSpacing: 1.2 },
  count: { alignItems: 'flex-end' },
  countValue: { fontSize: 48, lineHeight: 52, fontWeight: '200', color: color.moon, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  countUnit: { ...type.caption, color: color.moonDim, marginTop: -2 },
  name: { ...type.largeTitle, fontSize: 30, lineHeight: 35, color: color.moon, marginTop: space.sm },
  meta: { ...type.body, color: color.moonDim, marginTop: 2 },
  lights: { flexDirection: 'row', gap: 5, marginTop: space.md },
  light: { flex: 1, height: 4, borderRadius: 2, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  lightDark: { backgroundColor: color.hairline },
  topBlock: { marginTop: space.lg },
  blockHead: { ...type.caption, color: color.moonDim, textTransform: 'uppercase', letterSpacing: 1 },
  topRow2: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  topArtist: { flex: 1, alignItems: 'center', minWidth: 0 },
  topFace: { borderRadius: 32, borderWidth: 2, padding: 2 },
  topName: { ...type.label, color: color.moon, marginTop: 6, textAlign: 'center', alignSelf: 'stretch' },
  topMatch: { ...type.caption, marginTop: 1, fontVariant: ['tabular-nums'] },
  goers: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  goerFace: { borderRadius: 15, borderWidth: 2, borderColor: color.night },
  goersText: { ...type.label, color: color.moon, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  chip: {
    ...type.caption,
    color: color.moon,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipText: { ...type.caption, color: color.moon },
  track: { width: 36, height: 4, borderRadius: 2, backgroundColor: color.hairline, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  factsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 18, borderWidth: 2, borderColor: color.night },
  facts: { ...type.label, color: color.moon, flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  primary: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  primaryText: { ...type.headline, color: color.night },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  secondaryText: { ...type.headline, color: color.moon },
});
