import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { CountUp } from '../../components/CountUp';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { color, radius, space, tintA, type } from '../../theme/tokens';
import { PlayIcon } from '../discover/icons';
import { FestivalCover } from './FestivalCover';
import { festivalLights } from './light';
import { datesLine, whereWhen } from './format';
import { distanceLabel } from './near';
import { bigCountdown } from './timeline';
import { lovedLine, useFestivalSummary } from './useFestivalSummary';
import { t, tn } from '../../i18n';

const COVER = 170;

/**
 * The festival you're going to next, as the top of the Festivals tab: its
 * headliners' faces, a big countdown, what's there for you, and the two
 * things you'd do: open your plan, or watch the lineup. While it's on, it
 * glows "Now" and offers Tonight. It wears the festival's own light.
 */
export function NextUpCard({ festival }: { festival: Festival }) {
  const s = useFestivalSummary(festival);
  const big = bigCountdown(festival, s.today);
  const live = !!big?.live;
  const [light, dusk] = festivalLights(festival.id);
  const facts = [lovedLine(s.loved, s.ranked.length), s.loved ? tn(s.ranked.length, '{n} act', '{n} acts') : undefined, s.timesOut ? t('Set times out') : t('Set times to come')].filter(Boolean).join(' · ');
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
      accessibilityLabel={s.soon ? t('Up next: {festival}, {dates}, {countdown}. {facts}', { festival: festival.name, dates: datesLine(festival), countdown: s.soon, facts }) : t('Up next: {festival}, {dates}. {facts}', { festival: festival.name, dates: datesLine(festival), facts })}
      accessibilityActions={s.reach.clips > 0 ? [{ name: 'discover', label: t('Discover the lineup') }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'discover') watch();
      }}
      style={({ pressed }) => [styles.card, { borderColor: tintA(light, 0.45) }, s.cover.length > 0 && styles.covered, live && styles.live, pressed && styles.pressed]}
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
          <Text style={[styles.kicker, { color: light }, live && { color: '#FF7EB6' }]}>{live ? t('Happening now') : t('Up next')}</Text>
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

      <View style={styles.factsRow}>
        <View style={styles.faces}>
          {s.ranked.slice(0, 5).map((a, i) => (
            <View key={a.id} style={[styles.face, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
              <ArtistAvatar artist={a} size={32} />
            </View>
          ))}
        </View>
        <Text style={[styles.facts, s.timesOut && { color: color.glow }]} numberOfLines={2}>
          {facts}
        </Text>
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
