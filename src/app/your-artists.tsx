import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { FilterChips, type Chip } from '../components/FilterChips';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import type { Artist } from '../data/models';
import { artistsCount, followSuggestions } from '../features/artists/follow';
import { FollowArtistButton } from '../features/artists/FollowArtistButton';
import { showDateBlock, showDateSpoken } from '../features/artists/shows';
import { useWhereTheyPlay } from '../features/artists/useWhereTheyPlay';
import {
  artistNames,
  byMonth,
  datesCount,
  datesOf,
  shortDate,
  whereCounts,
  whereFilter,
  type WhereDate,
  type WhereFilter,
} from '../features/artists/where';
import { distanceShort, NEAR_KM, reachLabel, type Units } from '../features/festivals/near';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useCatalog } from '../state/catalog';
import { useFollowedArtists } from '../state/followedArtists';
import { useNearby } from '../state/nearby';
import { useRatings } from '../state/ratings';
import { useTaste } from '../state/taste';
import { useLoves } from '../state/useLoves';
import { color, glowA, radius, space, type } from '../theme/tokens';

/** Faces drawn on one date; with more, the first two and "+N". */
const FACES_MAX = 3;
/** One face with its ring, and the width every row's faces take. */
const FACE = 46;
const FACES_W = 56;
const RING = 2;

/**
 * Where they play: every upcoming festival date and club show for the
 * artists you follow and love, soonest first, by month, with filters; then
 * the artists themselves (with Follow) and a few you might follow.
 */
export default function WhereTheyPlayScreen() {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const today = useToday();
  const { status, units, turnOn } = useNearby();
  const { followed, hydrated } = useFollowedArtists();
  const { hydrated: rated } = useRatings();
  const { taste } = useTaste();
  const loves = useLoves();
  const { ids, dates } = useWhereTheyPlay();
  const [filter, setFilter] = useState<WhereFilter>('all');

  const artists = useMemo(() => ids.flatMap((id) => catalog.artist(id) ?? []), [ids, catalog]);
  const counts = useMemo(() => whereCounts(dates), [dates]);
  const months = useMemo(() => byMonth(whereFilter(dates, filter), today), [dates, filter, today]);
  // Worked out once what you follow and rate has loaded, then fixed while
  // you're here, so following one doesn't pull its row away.
  const suggestions = useMemo(
    () => (hydrated && rated ? followSuggestions(catalog.artists, { followed: ids, loves, taste, plays: (id) => catalog.festivalsOf(id).length > 0 }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, hydrated, rated],
  );
  const followedCount = followed.filter((id) => catalog.artist(id)).length;
  const anyShows = dates.some((d) => d.kind === 'show');

  const chips: Chip[] = [
    { key: 'all', label: 'All', count: counts.all, accessibilityLabel: `All dates, ${counts.all}` },
    { key: 'near', label: 'Near you', count: status === 'on' ? counts.near : undefined, accessibilityLabel: `Near you, ${counts.near}` },
    { key: 'festivals', label: 'Festivals', count: counts.festivals, accessibilityLabel: `Festivals, ${counts.festivals}` },
    { key: 'shows', label: 'Shows', count: counts.shows, accessibilityLabel: `Shows, ${counts.shows}` },
    ...(counts.going ? [{ key: 'going', label: 'Going', count: counts.going, accessibilityLabel: `Going, ${counts.going}` }] : []),
  ];

  return (
    <View style={styles.root}>
      <PageTitle title="Where they play" />
      <NightSky />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <View style={styles.inset}>
          <Text style={styles.title} accessibilityRole="header">
            Where they play
          </Text>
          <Text style={styles.sub}>
            {artists.length ? `${artistsCount(artists.length)} you follow and love` : 'Follow or love artists to see where they play.'}
          </Text>
        </View>

        {artists.length > 0 && (
          <>
            <View style={styles.chips}>
              <FilterChips chips={chips} value={filter} onChange={(k) => setFilter((k as WhereFilter | undefined) ?? 'all')} />
            </View>

            {months.length ? (
              months.map((m) => (
                <View key={m.key} style={[styles.inset, styles.month]}>
                  <Text style={styles.monthTitle} accessibilityRole="header">
                    {m.title}
                  </Text>
                  {m.dates.map((d) => (
                    <DateRow key={d.key} date={d} units={units} />
                  ))}
                </View>
              ))
            ) : (
              <View style={[styles.inset, styles.empty]}>
                <Text style={styles.emptyText}>{emptyLine(filter, status === 'on', units)}</Text>
                {filter === 'near' && status !== 'on' ? (
                  <Pressable
                    onPress={() => {
                      haptic.select();
                      void turnOn();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Use my location to see dates near you"
                    style={({ pressed }) => [styles.emptyButton, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.emptyButtonText}>Use my location</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            {anyShows ? (
              <Pressable
                onPress={() => void Linking.openURL('https://edmtrain.com').catch(() => {})}
                accessibilityRole="link"
                accessibilityLabel="Show info from EDMTrain. Opens their site."
                style={({ pressed }) => [styles.inset, styles.credit, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.creditText}>Show info from EDMTrain ↗</Text>
              </Pressable>
            ) : null}

            <View style={[styles.inset, styles.section]}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Your artists
              </Text>
              {artists.map((a) => {
                const theirs = datesOf(dates, a.id);
                const next = theirs.find((d) => d.date);
                const line = theirs.length
                  ? [datesCount(theirs.length), next?.date ? `next ${shortDate(next.date)}` : ''].filter(Boolean).join(' · ')
                  : followed.includes(a.id)
                    ? 'No dates yet. We’ll tell you when they’re added to a lineup'
                    : 'No dates yet';
                return <ArtistLine key={a.id} artist={a} line={line} />;
              })}
            </View>
          </>
        )}

        {suggestions.length > 0 && (
          <View style={[styles.inset, styles.section]}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {artists.length ? 'You might follow' : 'Artists you’d love'}
            </Text>
            {suggestions.map((a) => (
              <ArtistLine key={a.id} artist={a} line={`${Math.round((taste[a.id] ?? 0) * 100)}% match`} />
            ))}
          </View>
        )}

        <View style={styles.inset}>
          {!artists.length && !suggestions.length ? (
            <Text style={styles.note}>Open an artist and tap Follow. Rate a few artists or like some clips and we’ll suggest who to follow.</Text>
          ) : (
            <Text style={styles.note}>
              {followedCount ? 'Following stays on this phone and never changes your match. ' : ''}Festival dates come from the lineups, club shows from EDMTrain.
            </Text>
          )}
        </View>
      </ScrollView>
      <PageActions />
    </View>
  );
}

function emptyLine(filter: WhereFilter, nearOn: boolean, units: Units): string {
  switch (filter) {
    case 'near':
      return nearOn ? `None of their dates are ${reachLabel(units, NEAR_KM).toLowerCase()} of you yet.` : 'Turn on your location to see which dates are near you.';
    case 'festivals':
      return 'None of them are on a festival lineup yet. We’ll tell you when they’re added.';
    case 'shows':
      return 'No club shows listed for them yet.';
    case 'going':
      return 'You’re not going to a festival they play yet.';
    default:
      return 'No dates for them yet. We’ll tell you when they’re added to a lineup.';
  }
}

/** What a screen reader hears for a date. */
function dateLabel(d: WhereDate, units: Units): string {
  const when = d.date ? showDateSpoken(d.date) : 'Date to come';
  const where = [d.where, d.km !== undefined ? `${distanceShort(d.km, units)} away` : ''].filter(Boolean).join(', ');
  const tags = [d.kind === 'festival' ? 'Festival' : 'Show', d.weekend ? `Weekend ${d.weekend}` : '', d.going ? 'Going' : '', d.near ? 'Near you' : '']
    .filter(Boolean)
    .join(', ');
  const opens = d.kind === 'festival' ? 'Opens the festival.' : 'Opens the event page on EDMTrain.';
  return `${artistNames(d.artists)} at ${d.title}, ${when}. ${where ? `${where}. ` : ''}${tags}. ${opens}`;
}

function DateRow({ date: d, units }: { date: WhereDate; units: Units }) {
  const block = d.date ? showDateBlock(d.date) : undefined;
  const away = d.km !== undefined ? distanceShort(d.km, units) : '';
  const open = () => {
    haptic.select();
    if (d.festival) router.push(`/festival/${d.festival.id}`);
    else if (d.show) Linking.openURL(d.show.link).catch(() => {});
  };
  return (
    <Pressable
      onPress={open}
      accessibilityRole={d.kind === 'show' ? 'link' : 'button'}
      accessibilityLabel={dateLabel(d, units)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.dateBlock, d.going && styles.dateGoing]}>
        {block ? (
          <>
            <Text style={styles.dateMonth}>{block.month}</Text>
            <Text style={styles.dateDay}>{block.day}</Text>
            <Text style={styles.dateWeekday}>{block.weekday}</Text>
          </>
        ) : (
          <Text style={styles.dateSoon}>Soon</Text>
        )}
      </View>
      <Faces artists={d.artists} festivalId={d.festival?.id} />
      <View style={styles.rowText}>
        <Text style={styles.rowArtists} numberOfLines={1}>
          {artistNames(d.artists)}
        </Text>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {d.title}
        </Text>
        {d.where || away ? (
          // The distance stays whole; a long place gives way.
          <View style={styles.metaRow}>
            <Text style={[styles.rowMeta, styles.place]} numberOfLines={1}>
              {d.where}
            </Text>
            {away ? (
              <Text style={[styles.rowMeta, styles.away]} numberOfLines={1}>
                {d.where ? `\u00a0· ${away}` : away}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.tags}>
          <Tag text={d.kind === 'festival' ? 'Festival' : 'Show'} />
          {d.weekend ? <Tag text={`Weekend ${d.weekend}`} /> : null}
          {d.going ? <Tag text="Going" glow /> : null}
          {d.near ? <Tag text="Near you" glow /> : null}
        </View>
      </View>
      {d.kind === 'show' ? <Text style={styles.out}>↗</Text> : null}
    </Pressable>
  );
}

function Tag({ text, glow }: { text: string; glow?: boolean }) {
  return (
    <View style={[styles.tag, glow && styles.tagGlow]}>
      <Text style={[styles.tagText, glow && { color: color.glow }]}>{text}</Text>
    </View>
  );
}

/**
 * One face, or a few overlapping when several of your artists play the same
 * date (the first two and a "+N" disc when four or more do); each opens the
 * artist. Always the same width, so every row's words line up.
 */
function Faces({ artists, festivalId }: { artists: Artist[]; festivalId?: string }) {
  const shown = artists.length > FACES_MAX ? artists.slice(0, FACES_MAX - 1) : artists;
  const extra = artists.length - shown.length;
  const slots = shown.length + (extra ? 1 : 0);
  // Each disc with its night-coloured ring, side by side and overlapping inside FACES_W.
  const disc = slots === 1 ? FACE : slots === 2 ? FACE - 10 : FACE - 14;
  const step = slots > 1 ? (FACES_W - disc) / (slots - 1) : 0;
  const first = slots === 1 ? (FACES_W - disc) / 2 : 0;
  const at = (i: number) => ({ left: first + i * step, top: (FACE - disc) / 2, width: disc, height: disc, borderRadius: disc / 2, zIndex: slots - i });
  return (
    <View style={styles.faces}>
      {shown.map((a, i) => (
        <Pressable
          key={a.id}
          onPress={() => {
            haptic.select();
            router.push({ pathname: '/artist/[id]', params: { id: a.id, ...(festivalId ? { festival: festivalId } : {}) } });
          }}
          accessibilityRole="button"
          accessibilityLabel={`Open ${a.name}`}
          hitSlop={4}
          style={[styles.face, at(i)]}
        >
          <ArtistAvatar artist={a} size={disc - RING * 2} />
        </Pressable>
      ))}
      {extra > 0 ? (
        <View style={[styles.face, styles.more, at(shown.length)]}>
          <Text style={styles.moreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ArtistLine({ artist, line }: { artist: Artist; line: string }) {
  return (
    <View style={styles.artistRow}>
      <Pressable
        onPress={() => {
          haptic.select();
          router.push(`/artist/${artist.id}`);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${artist.name}, ${line}`}
        style={({ pressed }) => [styles.open, pressed && { opacity: 0.6 }]}
      >
        <ArtistAvatar artist={artist} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {artist.name}
          </Text>
          <Text style={styles.line} numberOfLines={2}>
            {line}
          </Text>
        </View>
      </Pressable>
      <FollowArtistButton artist={artist} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { alignSelf: 'center', width: '100%', maxWidth: 640 },
  inset: { paddingHorizontal: space.xl },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs },
  chips: { marginTop: space.lg },
  month: { marginTop: space.xl },
  monthTitle: { ...type.title, fontSize: 20, lineHeight: 26, color: color.moon, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  dateBlock: {
    width: 52,
    paddingVertical: 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  dateGoing: { backgroundColor: glowA(0.14), borderColor: glowA(0.45) },
  dateMonth: { ...type.caption, fontSize: 10, letterSpacing: 1.2, fontWeight: '700', color: color.glow },
  dateDay: { ...type.headline, fontSize: 20, lineHeight: 24, color: color.moon, fontVariant: ['tabular-nums'] },
  dateWeekday: { ...type.caption, fontSize: 10, color: color.moonDim },
  dateSoon: { ...type.caption, color: color.moonDim, paddingVertical: space.sm },
  faces: { width: FACES_W, height: FACE },
  face: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: RING, borderColor: color.night },
  more: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.nightRaised },
  moreText: { ...type.caption, color: color.moonDim },
  rowText: { flex: 1 },
  rowArtists: { ...type.caption, color: color.moonDim, textTransform: 'uppercase', letterSpacing: 0.6 },
  rowTitle: { ...type.headline, color: color.moon, marginTop: 1 },
  metaRow: { flexDirection: 'row', marginTop: 2 },
  place: { flexShrink: 1 },
  away: { flexShrink: 0 },
  rowMeta: { ...type.caption, color: color.moonDim },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  tagGlow: { backgroundColor: glowA(0.14), borderColor: glowA(0.4) },
  tagText: { ...type.caption, fontSize: 11, lineHeight: 14, color: color.moonDim },
  out: { ...type.label, color: color.moonFaint },
  empty: { marginTop: space.xl, alignItems: 'flex-start', gap: space.md },
  emptyText: { ...type.body, color: color.moonDim },
  emptyButton: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.22),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.45),
  },
  emptyButtonText: { ...type.label, color: color.moon },
  credit: { alignSelf: 'flex-start', paddingVertical: space.sm, marginTop: space.sm },
  creditText: { ...type.caption, color: color.moonFaint },
  section: { marginTop: space.xxl },
  sectionTitle: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.xs },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { ...type.headline, color: color.moon },
  line: { ...type.caption, color: color.moonDim, marginTop: 2 },
  note: { ...type.caption, color: color.moonFaint, marginTop: space.xl },
});
