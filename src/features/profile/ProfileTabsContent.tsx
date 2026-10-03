import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { artistColors } from '../../components/ArtistAvatar';
import { BookmarkIcon, ChevronIcon, PlusIcon } from '../../components/TabIcons';
import type { Artist, Clip, Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { CameraIcon } from '../camera/icons';
import { HeartIcon, PlayIcon } from '../discover/icons';
import { posterUrl } from '../discover/youtube';
import type { Memory } from '../memories/models';
import { clipLength, memoryLine } from '../memories/organize';
import { festivalMark } from './profileView';

const GAP = 2;
const COLUMNS = 3;
/** Tiles are 3:4, like a profile grid. */
const tileHeight = (w: number) => Math.round((w * 4) / 3);

type Lookup = { festival: (id: string) => Festival | undefined; artist: (id: string) => Artist | undefined };

/** Videos: your memories newest first, three across, edge to edge; a + tile to film another (in the app). */
export function VideosTab({ memories, width, uriOf, lookup }: { memories: Memory[]; width: number; uriOf: (file: string) => string; lookup: Lookup }) {
  const canFilm = Platform.OS !== 'web';
  const tile = (width - GAP * (COLUMNS - 1)) / COLUMNS;
  if (!memories.length) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <CameraIcon color={color.moon} size={26} />
        </View>
        <Text style={styles.emptyTitle}>Your festival moments</Text>
        <Text style={styles.emptyBody}>
          {canFilm
            ? 'Film a set, tag who was playing, and share it to Discover if you like.'
            : 'Film a set in the Afterglow app, tag who was playing, and it shows up here.'}
        </Text>
        {canFilm ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              router.push('/camera');
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.emptyButton, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.emptyButtonText}>Film a video</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <View>
      <Pressable
        onPress={() => {
          haptic.select();
          router.push('/memories');
        }}
        accessibilityRole="button"
        accessibilityLabel={`Memories, ${memories.length}`}
        accessibilityHint="Your videos by festival, night and set"
        style={({ pressed }) => [styles.byFestival, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.byFestivalText}>By festival</Text>
        <ChevronIcon color={color.moonFaint} size={11} />
      </Pressable>
      <View style={styles.grid}>
        {canFilm ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              router.push('/camera');
            }}
            accessibilityRole="button"
            accessibilityLabel="Film a video"
            style={({ pressed }) => [styles.newTile, { width: tile, height: tileHeight(tile) }, pressed && { opacity: 0.75 }]}
          >
            <View style={styles.newPlus}>
              <PlusIcon color={color.moon} size={18} />
            </View>
            <Text style={styles.newText}>New</Text>
          </Pressable>
        ) : null}
        {memories.map((m) => {
          const untagged = !m.festivalId && !m.artistId;
          const [from, to] = artistColors(m.artistId ?? m.id);
          const length = clipLength(m.durationSec);
          const artist = m.artistId ? lookup.artist(m.artistId)?.name : undefined;
          const where = [m.festivalId ? festivalMark(lookup.festival(m.festivalId)?.name ?? '') : undefined, m.night].filter(Boolean).join(' · ');
          return (
            <Pressable
              key={m.id}
              onPress={() => {
                haptic.select();
                if (untagged) router.push({ pathname: '/memory-tag', params: { id: m.id } });
                else router.push({ pathname: '/memory/[id]', params: { id: m.id } });
              }}
              accessibilityRole="button"
              accessibilityLabel={untagged ? 'Untagged video. Tag it' : `Video: ${memoryLine(m, lookup)}${m.sharedId ? ', shared' : ''}`}
              style={({ pressed }) => [styles.tile, { width: tile, height: tileHeight(tile) }, pressed && { opacity: 0.8 }]}
            >
              <LinearGradient colors={[to, from]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
              {m.thumb ? <Image source={{ uri: uriOf(m.thumb) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(3,2,10,0.65)']} style={styles.scrim} pointerEvents="none" />
              {length ? (
                <View style={styles.length}>
                  <PlayIcon color={color.moon} size={8} />
                  <Text style={styles.lengthText}>{length}</Text>
                </View>
              ) : null}
              {artist || where ? (
                <View style={styles.momentLabel} pointerEvents="none">
                  {artist ? (
                    <Text style={styles.momentArtist} numberOfLines={1}>
                      {artist}
                    </Text>
                  ) : null}
                  {where ? (
                    <Text style={styles.momentWhere} numberOfLines={1}>
                      {where}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {m.sharedId ? <View style={styles.sharedDot} /> : null}
              {untagged ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Tag</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export type CrewLine = { id: string; name: string; festival?: string; people: number };

/** Your crews, under the festival passport. */
export function CrewsList({ crews }: { crews: CrewLine[] }) {
  if (!crews.length) return null;
  return (
    <View style={[styles.list, { marginTop: space.lg }]}>
      <Text style={styles.listHead}>Crews</Text>
      {crews.map((c) => (
        <Row
          key={c.id}
          title={c.name}
          detail={[c.festival, c.people === 1 ? 'Just you' : `${c.people} of you`].filter(Boolean).join(' · ')}
          label={`Your crew ${c.name}, ${c.festival ?? ''}, ${c.people} ${c.people === 1 ? 'person' : 'people'}`}
          onPress={() => router.push({ pathname: '/crew/[id]', params: { id: c.id } })}
        />
      ))}
    </View>
  );
}

/** Saved: clips you kept (stills, three across) and the artists you follow. */
export function SavedTab({ clips, clipCount, followedCount, artistOf, width }: { clips: Clip[]; clipCount: number; followedCount: number; artistOf: (id: string) => Artist | undefined; width: number }) {
  const tile = (width - GAP * (COLUMNS - 1)) / COLUMNS;
  return (
    <View>
      <View style={styles.list}>
        <Row
          title="Saved and liked clips"
          detail={clipCount ? `${clipCount}` : 'Save clips in Discover'}
          label={`Your clips, ${clipCount}`}
          icon={<BookmarkIcon color={color.moon} size={18} />}
          onPress={() => router.push('/saved')}
        />
        <Row
          title="Artists you follow"
          detail={followedCount ? `${followedCount}` : 'Follow artists'}
          label={`Your artists, ${followedCount ? followedCount : 'none followed yet'}`}
          icon={<HeartIcon color={color.moon} size={18} />}
          onPress={() => router.push('/your-artists')}
        />
      </View>
      {clips.length ? (
        <View style={[styles.grid, { marginTop: space.lg }]}>
          {clips.map((c) => {
            const a = artistOf(c.artistId);
            const [from, to] = artistColors(c.artistId, a?.color);
            const still = c.source?.provider === 'youtube' ? posterUrl(c.source) : c.source?.provider === 'community' ? c.source.thumbUrl : undefined;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  haptic.select();
                  router.navigate({ pathname: '/', params: { clip: c.id } });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Play ${a?.name ?? 'clip'}, ${c.title}`}
                style={({ pressed }) => [styles.tile, { width: tile, height: tileHeight(tile) }, pressed && { opacity: 0.8 }]}
              >
                <LinearGradient colors={[to, from]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
                {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
                <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(3,2,10,0.7)']} style={styles.scrim} pointerEvents="none" />
                <Text style={styles.clipArtist} numberOfLines={1}>
                  {a?.name ?? ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function Row({ title, detail, label, onPress, glow, icon }: { title: string; detail: string; label: string; onPress: () => void; glow?: boolean; icon?: React.ReactNode }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.rowDetail, glow && { color: color.glow }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { overflow: 'hidden', backgroundColor: color.nightRaised },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  length: { position: 'absolute', right: space.sm, top: space.sm, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(3,2,10,0.55)' },
  momentLabel: { position: 'absolute', left: space.sm, right: space.sm, bottom: space.sm },
  momentArtist: { ...type.caption, color: color.moon, fontWeight: '700' },
  momentWhere: { ...type.caption, fontSize: 11, color: color.moonDim },
  lengthText: { ...type.caption, color: color.moon, fontVariant: ['tabular-nums'] },
  sharedDot: { position: 'absolute', left: space.sm, top: space.sm + 2, width: 7, height: 7, borderRadius: 4, backgroundColor: color.glow },
  tag: { position: 'absolute', left: space.sm, top: space.sm, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(169,124,255,0.85)' },
  tagText: { ...type.caption, color: color.moon },
  newTile: { alignItems: 'center', justifyContent: 'center', gap: space.xs, backgroundColor: color.glass },
  newPlus: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.hairline },
  newText: { ...type.caption, color: color.moonDim },
  clipArtist: { ...type.caption, color: color.moon, position: 'absolute', left: space.sm, right: space.sm, bottom: space.sm },
  byFestival: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, paddingHorizontal: space.xl, paddingVertical: space.sm },
  byFestivalText: { ...type.caption, color: color.moonDim },
  empty: { alignItems: 'center', paddingHorizontal: space.xxl, paddingTop: space.xxl, paddingBottom: space.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: color.hairline, marginBottom: space.lg },
  emptyTitle: { ...type.headline, color: color.moon, textAlign: 'center' },
  emptyBody: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.xs },
  emptyButton: { marginTop: space.lg, paddingHorizontal: space.xl, paddingVertical: space.sm + 2, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  emptyButtonText: { ...type.label, color: color.moon },
  list: { paddingHorizontal: space.xl, paddingTop: space.sm },
  listHead: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.lg, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass },
  rowTitle: { ...type.headline, fontSize: 16, color: color.moon },
  rowDetail: { ...type.caption, color: color.moonDim, marginTop: 2 },
});
