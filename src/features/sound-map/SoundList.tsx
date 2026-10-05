import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { FilterChips } from '../../components/FilterChips';
import { SearchField } from '../../components/SearchField';
import { ChevronIcon } from '../../components/TabIcons';
import { SOUND_LABEL, type Artist, type SoundTag, type TasteProfile } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useFollowedArtists } from '../../state/followedArtists';
import { useRatings } from '../../state/ratings';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { HeartIcon } from '../discover/icons';
import { RATING_SAID, type Rating } from '../taste/ratings';
import { SOUND_COLOR } from './colors';
import { listView, rankArtists, type ListRow, type ListSort } from './list';

/** Every row is the same height, so the list stays steady as it scrolls. */
const ROW_H = 64;

/**
 * My Sound as a ranked list: everyone the map draws from (all artists, or the
 * chosen festival's lineup), best match first, with search, a sound filter
 * and A to Z. `header` is the page's top (title, view switch, festival choice),
 * scrolling away with the list.
 */
export function SoundList({
  header,
  candidates,
  taste,
  informed,
  festivalId,
  festivalName,
  top,
  bottom,
}: {
  header: ReactElement;
  candidates: Artist[];
  taste: TasteProfile;
  informed: Record<string, boolean>;
  festivalId: string | undefined;
  festivalName: string | undefined;
  top: number;
  bottom: number;
}) {
  const [query, setQuery] = useState('');
  const [sound, setSound] = useState<SoundTag | undefined>();
  const [sort, setSort] = useState<ListSort>('match');
  const [showRest, setShowRest] = useState(false);
  const ranking = useMemo(() => rankArtists(candidates, taste, informed), [candidates, taste, informed]);
  const view = useMemo(() => listView(ranking, { query, sound, sort, showRest }), [ranking, query, sound, sort, showRest]);
  // A sound chosen before the search narrowed it away still shows, so it can be turned off.
  const chips = useMemo(() => {
    const counts = sound && !view.counts.some((c) => c.tag === sound) ? [...view.counts, { tag: sound, count: 0 }] : view.counts;
    return [
      { key: undefined, label: 'All sounds', accessibilityLabel: 'Every sound' },
      ...counts.map((c) => ({
        key: c.tag,
        label: SOUND_LABEL[c.tag],
        count: c.count,
        dot: SOUND_COLOR[c.tag],
        accessibilityLabel: `Only ${SOUND_LABEL[c.tag].toLowerCase()}, ${c.count} ${c.count === 1 ? 'artist' : 'artists'}`,
      })),
    ];
  }, [view.counts, sound]);

  const { ratings } = useRatings();
  const { isFollowing } = useFollowedArtists();
  const renderItem = useCallback<ListRenderItem<ListRow>>(
    ({ item }) => <SoundListRow row={item} rating={ratings[item.artist.id]} following={isFollowing(item.artist.id)} festivalId={festivalId} />,
    [ratings, isFollowing, festivalId],
  );

  const n = view.rows.length;
  const soundName = sound ? SOUND_LABEL[sound].toLowerCase() : undefined;
  const q = query.trim();
  const listHeader = (
    <View>
      {header}
      <View style={styles.search}>
        <SearchField value={query} onChange={setQuery} placeholder="Artist or sound, like dubstep" label="Search the list for an artist or a sound" />
      </View>
      {chips.length > 2 || sound ? (
        <View style={styles.chips}>
          <FilterChips chips={chips} value={sound} onChange={(k) => setSound(k as SoundTag | undefined)} inset={space.xl} />
        </View>
      ) : null}
      {n > 0 ? (
        <View style={styles.meta}>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {n} {soundName ? `${soundName} ` : ''}
            {n === 1 ? 'artist' : 'artists'}
            {festivalName ? ` at ${festivalName}` : ''}
          </Text>
          <Pressable
            onPress={() => {
              haptic.select();
              setSort(sort === 'match' ? 'name' : 'match');
            }}
            accessibilityRole="button"
            accessibilityLabel={sort === 'match' ? 'Sorted by best match. Sort A to Z instead' : 'Sorted A to Z. Sort by best match instead'}
            hitSlop={8}
            style={({ pressed }) => [styles.sort, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.sortText}>{sort === 'match' ? 'Best match' : 'A–Z'}</Text>
            <ChevronIcon color={color.moonDim} size={10} direction="down" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const empty = (
    <Text style={styles.empty}>
      {q
        ? `No ${soundName ? `${soundName} ` : ''}artist or sound matches “${q}”.`
        : soundName
          ? `No ${soundName} artists ranked yet.`
          : festivalName
            ? `None of ${festivalName}’s artists are ranked yet. Rate the lineup or react to their clips to rank them.`
            : 'Nobody’s ranked yet. Like, save or skip a few clips, or pick artists you love.'}
    </Text>
  );
  const footer =
    view.hidden > 0 ? (
      <Pressable
        onPress={() => {
          haptic.tap();
          setShowRest(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Show ${view.hidden} more ${view.hidden === 1 ? 'artist' : 'artists'} you haven’t reacted to yet`}
        style={({ pressed }) => [styles.more, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
      >
        <Text style={styles.moreText}>
          Show {view.hidden} more you haven’t reacted to yet
        </Text>
      </Pressable>
    ) : null;

  return (
    <FlatList
      data={view.rows}
      keyExtractor={keyOf}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      initialNumToRender={14}
      maxToRenderPerBatch={16}
      windowSize={9}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom }]}
    />
  );
}

const keyOf = (r: ListRow) => r.artist.id;

/**
 * One artist: rank, photo, name (with your heart), their sounds, and match.
 * Artists the app knows nothing about yet say "New" instead. Opens the artist.
 */
const SoundListRow = memo(function SoundListRow({ row, rating, following, festivalId }: { row: ListRow; rating: Rating | undefined; following: boolean; festivalId: string | undefined }) {
  const { artist, rank, sounds } = row;
  const pct = Math.round(row.match * 100);
  const passed = rating === 'pass';
  const cold = rating === 'pass' ? 'Not for you' : rating === 'meh' ? 'Not really for you' : undefined;
  const said = rating === 'love' || rating === 'like' || rating === 'ok' ? `, ${RATING_SAID[rating]}` : '';
  const soundLine = sounds.map((t) => SOUND_LABEL[t]).join(' · ');
  const line = [soundLine, following ? 'Following' : undefined, cold].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/artist/[id]', params: { id: artist.id, festival: festivalId } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${rank ? `Number ${rank}, ${artist.name}, ${pct} percent match` : `${artist.name}, new to your sound`}${said}${line ? `, ${line}` : ''}`}
      style={({ pressed }) => [styles.row, passed && styles.passed, pressed && { opacity: 0.6 }]}
    >
      <Text style={[styles.rank, rank !== undefined && rank <= 3 && { color: color.glow }]} numberOfLines={1}>
        {rank ?? ''}
      </Text>
      <ArtistAvatar artist={artist} size={40} />
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {artist.name}
          </Text>
          {rating === 'love' ? <HeartIcon color={color.glow} filled size={13} /> : rating === 'like' ? <HeartIcon color={color.moonDim} size={13} /> : null}
        </View>
        {line ? (
          <View style={styles.detailRow}>
            {sounds[0] ? <View style={[styles.dot, { backgroundColor: SOUND_COLOR[sounds[0]] }]} /> : null}
            <Text style={styles.detail} numberOfLines={1}>
              {line}
            </Text>
          </View>
        ) : null}
      </View>
      {rank !== undefined ? (
        <Text style={[styles.pct, pct >= 80 && { color: color.glow }]}>{pct}%</Text>
      ) : (
        <View style={styles.newPill}>
          <Text style={styles.newText}>New</Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl },
  search: { marginTop: space.md },
  chips: { marginTop: space.md, marginHorizontal: -space.xl },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.xs },
  count: { ...type.caption, color: color.moonDim, flexShrink: 1 },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  sortText: { ...type.caption, color: color.moonDim },
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: space.md },
  passed: { opacity: 0.5 },
  rank: { ...type.label, width: 26, textAlign: 'right', color: color.moonFaint, fontVariant: ['tabular-nums'] },
  text: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...type.headline, color: color.moon, flexShrink: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  detail: { ...type.caption, color: color.moonDim, flexShrink: 1 },
  pct: { ...type.label, color: color.moonDim, fontVariant: ['tabular-nums'], minWidth: 38, textAlign: 'right' },
  newPill: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: glowA(0.14), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.35) },
  newText: { ...type.caption, color: color.moon },
  empty: { ...type.body, color: color.moonDim, marginTop: space.xl },
  more: {
    alignSelf: 'center',
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  moreText: { ...type.label, color: color.moon },
});
