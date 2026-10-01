import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { PageTitle } from '../../components/PageTitle';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ArtistAvatar, artistColors } from '../../components/ArtistAvatar';
import { Missing } from '../../components/Missing';
import { PageActions } from '../../components/PageActions';
import { WEB_URL } from '../../config/app';
import { starsLine } from '../../features/crews/together';
import { artistShareText } from '../../features/share/pages';
import { shareMessage } from '../../lib/share';
import { useCrews } from '../../state/crews';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon } from '../../components/TabIcons';
import { setFor } from '../../data/festival';
import type { Artist, Clip } from '../../data/types';
import { PlayIcon } from '../../features/discover/icons';
import { alsoWatch, theirClips } from '../../features/discover/nextToWatch';
import { posterUrl } from '../../features/discover/youtube';
import { StarIcon } from '../../features/plan/icons';
import { artistMix } from '../../features/taste/lean';
import { FollowArtistButton } from '../../features/artists/FollowArtistButton';
import { RateArtist } from '../../features/taste/RateArtist';
import { useFollowedArtists } from '../../state/followedArtists';
import { SoundBreakdown } from '../../features/taste/SoundBreakdown';
import { mostSimilar } from '../../features/taste/similarity';
import { listenLinks } from '../../features/taste/listen';
import { artistSignals, whyLine } from '../../features/taste/why';
import { PROVIDER_NAME } from '../../features/music/models';
import { MemoryTile } from '../../features/memories/MemoryTile';
import { useMemories } from '../../state/memories';
import { dayList, daysOf } from '../../features/festivals/days';
import { describeSet, formatDuration } from '../../features/festivals/format';
import { countdown, setLine } from '../../features/festivals/when';
import { distanceLabel, NEAR_KM } from '../../features/festivals/near';
import { playingList } from '../../features/festivals/playing';
import { useNearby } from '../../state/nearby';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { usePlan } from '../../state/plan';
import { useGoing } from '../../state/going';
import { useRatings } from '../../state/ratings';
import { useToday } from '../../lib/useToday';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';

const HERO = 132;

/** A clip's video still, or the artist's colours when it has none, with a small play mark. */
function ClipStill({ clip, colors, style }: { clip: Clip; colors: [string, string]; style: object }) {
  const source = clip.source?.provider === 'youtube' ? clip.source : undefined;
  const still = source ? posterUrl(source) : clip.source?.provider === 'community' ? clip.source.thumbUrl : undefined;
  return (
    <LinearGradient colors={colors} style={[style, { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
      {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
      <View style={styles.playMark}>
        <PlayIcon color={color.moon} size={14} />
      </View>
    </LinearGradient>
  );
}
const HALO = HERO * 2;

export default function ArtistScreen() {
  // `festival` is set when opened from a festival page; must-see stars apply to that festival only.
  const { id, festival: festivalId } = useLocalSearchParams<{ id: string; festival?: string }>();
  const catalog = useCatalog();
  const artist = catalog.artist(id);
  const insets = useSafeAreaInsets();
  const { taste, informed, similarity, importedFrom, imported, importing, tasteClips } = useTaste();
  const { memories, uriOf } = useMemories();
  const { isMustSee, toggleMustSee } = usePlan();
  const { reactions } = useReactions();
  const { ratings } = useRatings();
  const { crewStarsFor } = useCrews();
  const { going } = useGoing();
  const today = useToday();
  const { distanceTo, units } = useNearby();
  const { isFollowing } = useFollowedArtists();
  const { seen } = useSeen();
  if (!artist) return <Missing title="Artist not found" line="This artist isn’t on Afterglow any more, or the link isn’t quite right." />;
  const yours = memories.filter((m) => m.artistId === artist.id);
  const context = festivalId ? catalog.festival(festivalId) : undefined;
  const starFestival = context?.lineup.includes(artist.id) ? context : undefined;
  const mustSee = !!starFestival && isMustSee(starFestival.id, artist.id);
  const crewLine = starFestival ? starsLine(crewStarsFor(starFestival.id, artist.id)) : undefined;

  const pct = Math.round((taste[artist.id] ?? 0) * 100);
  const mix = artistMix(artist);
  // Opened from a festival: who sounds like them on that lineup, so you can plan around it.
  // Otherwise (or if no one there does), the closest across everything we know.
  const lineupArtists = starFestival
    ? starFestival.lineup.map((a) => catalog.artist(a)).filter((a): a is Artist => !!a)
    : [];
  const similarThere = starFestival ? mostSimilar(artist, lineupArtists, similarity) : [];
  const similar = similarThere.length ? similarThere : mostSimilar(artist, catalog.artists, similarity);
  const similarAt = similarThere.length ? starFestival : undefined;
  const festivals = catalog.festivalsOf(artist.id);
  // Yours first, then near you (when it's on), then the soonest; what's over last.
  const playing = playingList(festivals, { going, today, distanceTo, nearKm: NEAR_KM });
  // Their clips, ones you haven't watched first; then one each from artists who sound like them.
  const clips = theirClips(catalog.clipsOf(artist.id), seen);
  const fansWatch = alsoWatch(artist, catalog.artists, catalog.clipsOf, similarity, seen);
  const [deep, bright] = artistColors(artist.id, artist.color);
  const play = (c: Clip) => {
    haptic.select();
    // Opened from a festival: keep discovering that lineup.
    router.navigate({ pathname: '/', params: starFestival ? { clip: c.id, festival: starFestival.id } : { clip: c.id } });
  };

  return (
    <View style={styles.root}>
      <PageTitle title={artist.name} />
      <NightSky />
      {/* Their photo as a soft light behind the top of the page, fading into the night. */}
      {artist.imageUrl ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={{ uri: artist.imageUrl }} style={[styles.photoGlow, { height: insets.top + 56 + HERO + 260 }]} contentFit="cover" blurRadius={45} transition={400} />
          <LinearGradient
            colors={['rgba(10,9,24,0.3)', 'rgba(10,9,24,0.72)', 'rgba(10,9,24,0.95)', 'rgba(10,9,24,0.97)']}
            locations={[0, 0.2, 0.42, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Svg width={HALO} height={HALO} style={styles.halo}>
            <Defs>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0.35" stopColor={artist.color ? bright : color.glow} stopOpacity={0.55 * (taste[artist.id] ?? 0)} />
                <Stop offset="1" stopColor={color.glowDeep} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#halo)" />
          </Svg>
          <ArtistAvatar artist={artist} size={HERO} />
          <Text style={styles.name}>{artist.name}</Text>
          <Text style={styles.match}>{pct}% match</Text>
          {/* What the match rests on, so it never feels arbitrary. */}
          <Text style={styles.why}>
            {whyLine(
              artistSignals(artist.id, tasteClips, reactions, ratings, (importedFrom[artist.id] ?? []).map((p) => PROVIDER_NAME[p])),
              !!informed[artist.id],
              // Lifted only because they sound like your library: say which.
              !importedFrom[artist.id] && (imported[artist.id] ?? 0) > 0 ? importing.map((p) => PROVIDER_NAME[p]) : [],
            )}
          </Text>
          <View style={styles.follow}>
            <FollowArtistButton artist={artist} />
            <Text style={styles.followNote}>
              {isFollowing(artist.id) ? 'You’ll hear when they’re added to a lineup.' : 'Follow to hear when they’re added to a lineup.'}
            </Text>
          </View>
          <RateArtist artist={artist} />
          {starFestival && (
            <Pressable
              onPress={() => {
                if (mustSee) haptic.select();
                else haptic.tap();
                toggleMustSee(starFestival.id, artist.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: mustSee }}
              accessibilityLabel={
                mustSee
                  ? `Remove from your must sees at ${starFestival.name}`
                  : `Mark as a must see at ${starFestival.name}`
              }
              style={({ pressed }) => [styles.mustSee, mustSee && styles.mustSeeOn, pressed && { opacity: 0.7 }]}
            >
              <StarIcon color={mustSee ? color.glow : color.moonDim} filled={mustSee} size={16} />
              <Text style={[styles.mustSeeText, mustSee && { color: color.moon }]}>
                {mustSee ? 'On your must-see list' : 'Mark as must see'}
              </Text>
            </Pressable>
          )}
          {/* Crewmates who starred them at this festival. */}
          {starFestival && crewLine ? (
            <Text style={styles.crewLine}>
              <Text style={{ color: color.glow }}>★ </Text>
              {crewLine}
            </Text>
          ) : null}
        </View>

        {/* Their sound as a mix, e.g. 80% melodic bass, 20% dubstep. */}
        {mix.length > 0 && (
          <Section title="Their sound">
            <View style={styles.mix}>
              <SoundBreakdown shares={mix} />
            </View>
          </Section>
        )}

        {festivals.length > 0 && (
          <Section title="Playing">
            {playing.map(({ festival: f, going: mine, over, km }) => {
              const set = setFor(f, artist.id);
              const when = over ? 'Over' : countdown(f, today);
              const extra = [mine ? 'Going' : '', when ?? '', km !== undefined && !over ? distanceLabel(km, units) : ''].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    haptic.select();
                    router.push(`/festival/${f.id}`);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.row, over && { opacity: 0.55 }, pressed && { opacity: 0.6 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{f.name}</Text>
                    <Text style={styles.rowMeta}>
                      {setLine(
                        set ? describeSet(f, set) : `${dayList(daysOf(f, artist.id)) ?? f.dates}, set time not announced yet`,
                        f.notes?.[artist.id],
                      )}
                    </Text>
                    {extra ? <Text style={[styles.rowMeta, mine && { color: color.glow }]}>{extra}</Text> : null}
                  </View>
                  <ChevronIcon color={color.moonFaint} size={14} />
                </Pressable>
              );
            })}
          </Section>
        )}

        {clips.length > 0 && (
          <Section title="Live clips">
            {clips.map((c) => {
              const watched = c.id in seen;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => play(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${c.title}${watched ? ', watched' : ''}`}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                >
                  <ClipStill clip={c} colors={[bright, deep]} style={styles.thumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{c.title}</Text>
                    <Text style={styles.rowMeta}>
                      {catalog.festival(c.festivalId)?.name}, {formatDuration(c.durationSec)}
                      {watched ? ' · Watched' : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </Section>
        )}

        {/* One artist leads to the next: a clip each from artists who sound like them. */}
        {fansWatch.length > 0 && (
          <Section title="Fans also watch">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memoryScroll} contentContainerStyle={styles.alsoRow}>
              {fansWatch.map(({ artist: a, clip: c, seen: watched }) => {
                const [aDeep, aBright] = artistColors(a.id, a.color);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => play(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${a.name}, ${c.title}${watched ? ', watched' : ''}. ${Math.round((taste[a.id] ?? 0) * 100)} percent match.`}
                    style={({ pressed }) => [styles.also, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
                  >
                    <ClipStill clip={c} colors={[aBright, aDeep]} style={styles.alsoStill} />
                    <Text style={styles.alsoName} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {Math.round((taste[a.id] ?? 0) * 100)}% · {watched ? 'Watched' : c.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>
        )}

        {/* Your own videos of them, from Memories. */}
        {yours.length > 0 && (
          <Section title="Your memories">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memoryRow} style={styles.memoryScroll}>
              {yours.map((m) => (
                <MemoryTile
                  key={m.id}
                  memory={m}
                  thumbUri={m.thumb ? uriOf(m.thumb) : undefined}
                  width={96}
                  label={`Your memory of ${artist.name}${m.night ? `, ${m.night}` : ''}`}
                  onPress={() => router.push({ pathname: '/memory/[id]', params: { id: m.id } })}
                />
              ))}
            </ScrollView>
          </Section>
        )}

        {/* Somewhere to hear them before you rate them. Plain links out to the services' own search. */}
        <Section title="Listen">
          <View style={styles.listen}>
            {listenLinks(artist.name).map((l) => (
              <Pressable
                key={l.service}
                onPress={() => {
                  haptic.select();
                  Linking.openURL(l.url).catch(() => {});
                }}
                accessibilityRole="link"
                accessibilityLabel={`Listen to ${artist.name} on ${l.service}`}
                style={({ pressed }) => [styles.listenPill, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.listenText}>{l.service}</Text>
                <ChevronIcon color={color.moonFaint} size={11} />
              </Pressable>
            ))}
          </View>
        </Section>

        {similar.length > 0 && (
          <Section title={similarAt ? `Similar sound at ${similarAt.name}` : 'Similar sound'}>
            <View style={styles.similar}>
              {similar.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    haptic.select();
                    // Stay in the festival's context, so their set and must-see star show.
                    router.push({ pathname: '/artist/[id]', params: { id: a.id, festival: similarAt?.id } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.name}, ${Math.round((taste[a.id] ?? 0) * 100)} percent match`}
                  style={({ pressed }) => [styles.similarItem, pressed && { opacity: 0.6 }]}
                >
                  <ArtistAvatar artist={a} size={64} />
                  <Text style={styles.similarName} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={styles.rowMeta}>{Math.round((taste[a.id] ?? 0) * 100)}%</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        )}
        {/* Photos from the nightly photo list credit where they're from. */}
        {artist.imageUrl && artist.imageCredit ? <Text style={styles.credit}>Photo from {artist.imageCredit}</Text> : null}
      </ScrollView>

      <PageActions shareLabel={`Share ${artist.name}`} onShare={() => void shareMessage(artistShareText(artist, festivals, WEB_URL), artist.name)} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  crewLine: { ...type.label, color: color.moonDim, marginTop: space.md, textAlign: 'center' },
  hero: { alignItems: 'center', paddingHorizontal: space.xl },
  credit: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.xxl },
  halo: { position: 'absolute', top: HERO / 2 - HALO / 2 },
  photoGlow: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.9 },
  name: { ...type.largeTitle, color: color.moon, marginTop: space.xl, textAlign: 'center' },
  match: { ...type.headline, color: color.glow, fontVariant: ['tabular-nums'], marginTop: space.xs },
  why: { ...type.caption, color: color.moonDim, marginTop: 4, textAlign: 'center', paddingHorizontal: space.xl },
  mix: { marginTop: space.sm },
  follow: { alignItems: 'center', marginTop: space.lg, gap: space.xs },
  followNote: { ...type.caption, color: color.moonFaint, textAlign: 'center' },
  mustSee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  mustSeeOn: { backgroundColor: 'rgba(169,124,255,0.18)', borderColor: 'rgba(169,124,255,0.4)' },
  mustSeeText: { ...type.label, color: color.moonDim },
  listen: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  listenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  listenText: { ...type.label, color: color.moon },
  section: { marginTop: space.xxl, paddingHorizontal: space.xl },
  memoryScroll: { marginHorizontal: -space.xl },
  memoryRow: { paddingHorizontal: space.xl, gap: space.sm },
  sectionTitle: { ...type.title, fontSize: 22, color: color.moon, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, gap: space.md },
  rowTitle: { ...type.headline, color: color.moon },
  rowMeta: { ...type.caption, color: color.moonDim, marginTop: 2 },
  thumb: { width: 52, height: 64, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  similar: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  playMark: { width: 28, height: 28, borderRadius: 14, paddingLeft: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,9,24,0.5)' },
  alsoRow: { paddingHorizontal: space.xl, gap: space.md },
  also: { width: 168 },
  alsoStill: { width: 168, height: 94, borderRadius: radius.md },
  alsoName: { ...type.label, color: color.moon, marginTop: space.sm },
  similarItem: { width: 88, alignItems: 'center' },
  similarName: { ...type.label, color: color.moon, marginTop: space.sm, textAlign: 'center' },
});
