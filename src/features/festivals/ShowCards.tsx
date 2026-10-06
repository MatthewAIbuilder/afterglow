import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar, artistColors } from '../../components/ArtistAvatar';
import { ChevronIcon } from '../../components/TabIcons';
import type { Artist } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useFollowedArtists } from '../../state/followedArtists';
import { useNearby } from '../../state/nearby';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import { showDateBlock, showDateSpoken, showTitle, showWhere } from '../artists/shows';
import { distanceLabel, distanceShort } from './near';
import { matchLabel, type RankedShow, type ShowTaste } from './showsForYou';

/** What show ranking reads, from your live taste, ratings and the artists you follow. */
export function useShowTaste(): ShowTaste {
  const { taste, informed } = useTaste();
  const { ratings } = useRatings();
  const { isFollowing } = useFollowedArtists();
  return useMemo(() => ({ taste, informed, ratings, isFollowing }), [taste, informed, ratings, isFollowing]);
}

const openShow = (id: string) => {
  haptic.select();
  router.push({ pathname: '/show/[id]', params: { id } });
};

/** The bill's artists on Afterglow, best for you first (anyone you turned down last). */
function useBill(r: RankedShow): Artist[] {
  const { artist } = useCatalog();
  return r.bill.flatMap((b) => artist(b.id) ?? []);
}

/** What a screen reader hears for a show card or row. */
function spoken(r: RankedShow, best: Artist | undefined, away: string | undefined) {
  const where = showWhere(r.show);
  const match = best && r.best ? t('{pct} percent match with {artist}', { pct: Math.round(r.match * 100), artist: best.name }) : undefined;
  return [`${showTitle(r.show)}, ${showDateSpoken(r.show.date)}`, where, away, match].filter(Boolean).join('. ') + t('. Opens the show.');
}

/** The calendar block: "OCT" over "18" over "Sat". */
export function ShowDateBlock({ date, big }: { date: string; big?: boolean }) {
  const b = showDateBlock(date);
  return (
    <View style={[styles.block, big && styles.blockBig]}>
      <Text style={[styles.month, big && styles.monthBig]}>{b.month}</Text>
      <Text style={[styles.day, big && styles.dayBig]}>{b.day}</Text>
      <Text style={[styles.weekday, big && styles.weekdayBig]}>{b.weekday}</Text>
    </View>
  );
}

/** A show in a list: date, name, where (and how far), who's on, your best match. */
export function ShowRow({ ranked: r }: { ranked: RankedShow }) {
  const bill = useBill(r);
  const { units } = useNearby();
  const away = r.km !== undefined ? distanceLabel(r.km, units) : undefined;
  const best = r.best ? bill.find((a) => a.id === r.best!.id) : undefined;
  const where = [showWhere(r.show), away].filter(Boolean).join(' · ');
  const names = bill.map((a) => a.name);
  const pct = matchLabel(r);
  return (
    <Pressable
      onPress={() => openShow(r.show.id)}
      accessibilityRole="button"
      accessibilityLabel={spoken(r, best, away)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ShowDateBlock date={r.show.date} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {showTitle(r.show)}
        </Text>
        {where ? (
          <Text style={styles.place} numberOfLines={1}>
            {where}
          </Text>
        ) : null}
        <Text style={styles.with} numberOfLines={1}>
          {names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(' & ')}
        </Text>
      </View>
      {pct ? <Text style={styles.pct}>{pct}</Text> : null}
      <ChevronIcon color={color.moonFaint} size={14} />
    </Pressable>
  );
}

/** Cards on the "Shows for you" shelf are this wide. */
export const SHOW_CARD_W = 208;

/** A show on the Festivals tab's shelf: date and match, name, town, faces. */
export function ShowCard({ ranked: r }: { ranked: RankedShow }) {
  const bill = useBill(r);
  const { units } = useNearby();
  const best = r.best ? bill.find((a) => a.id === r.best!.id) : undefined;
  const away = r.km !== undefined ? distanceShort(r.km, units) : undefined;
  const town = r.show.location || r.show.venue;
  const [, bright] = artistColors(best?.id ?? r.show.id, best?.color);
  const pct = matchLabel(r);
  return (
    <Pressable
      onPress={() => openShow(r.show.id)}
      accessibilityRole="button"
      accessibilityLabel={spoken(r, best, away && t('{distance} away', { distance: away }))}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
    >
      <LinearGradient colors={[`${bright}33`, 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.cardTop}>
        <ShowDateBlock date={r.show.date} />
        {pct ? (
          <View style={styles.match}>
            <Text style={styles.matchText}>{pct}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardName} numberOfLines={2}>
        {showTitle(r.show)}
      </Text>
      <Text style={styles.cardTown} numberOfLines={1}>
        {[town, away].filter(Boolean).join(' · ')}
      </Text>
      <View style={styles.cardFill} />
      <View style={styles.cardBottom}>
        <View style={styles.faces}>
          {bill.slice(0, 3).map((a, i) => (
            <View key={a.id} style={[styles.face, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
              <ArtistAvatar artist={a} size={26} />
            </View>
          ))}
        </View>
        <Text style={styles.cardWho} numberOfLines={1}>
          {bill[0]?.name}
          {bill.length > 1 ? ` +${bill.length - 1}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    width: 48,
    paddingVertical: 5,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: glowA(0.14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  blockBig: { width: 76, paddingVertical: space.sm, borderRadius: radius.md },
  month: { ...type.caption, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: color.glow },
  monthBig: { fontSize: 12 },
  day: { ...type.headline, fontSize: 19, lineHeight: 23, color: color.moon, fontVariant: ['tabular-nums'] },
  dayBig: { ...type.largeTitle },
  weekday: { ...type.caption, fontSize: 10, color: color.moonDim },
  weekdayBig: { fontSize: 12 },
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
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  body: { flex: 1, gap: 1 },
  name: { ...type.headline, color: color.moon },
  place: { ...type.caption, color: color.moonDim },
  with: { ...type.caption, color: color.glow },
  pct: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  card: {
    width: SHOW_CARD_W,
    height: 200,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  match: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  matchText: { ...type.caption, color: color.moon, fontVariant: ['tabular-nums'] },
  cardName: { ...type.headline, color: color.moon, marginTop: space.md },
  cardTown: { ...type.caption, color: color.moonDim, marginTop: 2 },
  cardFill: { flex: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardWho: { ...type.caption, color: color.moonDim, flex: 1 },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 20, borderWidth: 2, borderColor: color.night },
});
