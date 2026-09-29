import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ArtistAvatar, artistColors } from '../../components/ArtistAvatar';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon } from '../../components/TabIcons';
import { setFor } from '../../data/festival';
import { SOUND_LABEL, type Artist, type SoundTag } from '../../data/types';
import { PlayIcon } from '../../features/discover/icons';
import { StarIcon } from '../../features/plan/icons';
import { RateArtist } from '../../features/taste/RateArtist';
import { mostSimilar } from '../../features/taste/similarity';
import { artistSignals, whyLine } from '../../features/taste/why';
import { describeSet, formatDuration } from '../../features/festivals/format';
import { setLine } from '../../features/festivals/when';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { usePlan } from '../../state/plan';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';

const HERO = 132;
const HALO = HERO * 2;

export default function ArtistScreen() {
  // `festival` is set when opened from a festival page; must-see stars apply to that festival only.
  const { id, festival: festivalId } = useLocalSearchParams<{ id: string; festival?: string }>();
  const catalog = useCatalog();
  const artist = catalog.artist(id);
  const insets = useSafeAreaInsets();
  const { taste, informed, similarity } = useTaste();
  const { isMustSee, toggleMustSee } = usePlan();
  const { reactions } = useReactions();
  const { ratings } = useRatings();
  if (!artist) return null;
  const context = festivalId ? catalog.festival(festivalId) : undefined;
  const starFestival = context?.lineup.includes(artist.id) ? context : undefined;
  const mustSee = !!starFestival && isMustSee(starFestival.id, artist.id);

  const pct = Math.round((taste[artist.id] ?? 0) * 100);
  const tags = (Object.entries(artist.sound) as [SoundTag, number][]).sort((a, b) => b[1] - a[1]);
  // Opened from a festival: who sounds like them on that lineup, so you can plan around it.
  // Otherwise (or if no one there does), the closest across everything we know.
  const lineupArtists = starFestival
    ? starFestival.lineup.map((a) => catalog.artist(a)).filter((a): a is Artist => !!a)
    : [];
  const similarThere = starFestival ? mostSimilar(artist, lineupArtists, similarity) : [];
  const similar = similarThere.length ? similarThere : mostSimilar(artist, catalog.artists, similarity);
  const similarAt = similarThere.length ? starFestival : undefined;
  const festivals = catalog.festivalsOf(artist.id);
  const clips = catalog.clipsOf(artist.id);
  const [deep, bright] = artistColors(artist.id);

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Svg width={HALO} height={HALO} style={styles.halo}>
            <Defs>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0.35" stopColor={color.glow} stopOpacity={0.55 * (taste[artist.id] ?? 0)} />
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
            {whyLine(artistSignals(artist.id, catalog.clips, reactions, ratings), !!informed[artist.id])}
          </Text>
          <View style={styles.tags}>
            {tags.map(([tag]) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{SOUND_LABEL[tag]}</Text>
              </View>
            ))}
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
        </View>

        {festivals.length > 0 && (
          <Section title="Playing">
            {festivals.map((f) => {
              const set = setFor(f, artist.id);
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    haptic.select();
                    router.push(`/festival/${f.id}`);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{f.name}</Text>
                    <Text style={styles.rowMeta}>
                      {setLine(set ? describeSet(f, set) : `${f.dates}, set time not announced yet`, f.notes?.[artist.id])}
                    </Text>
                  </View>
                  <ChevronIcon color={color.moonFaint} size={14} />
                </Pressable>
              );
            })}
          </Section>
        )}

        {clips.length > 0 && (
          <Section title="Live clips">
            {clips.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  haptic.select();
                  // Opened from a festival: keep discovering that lineup.
                  router.navigate({ pathname: '/', params: starFestival ? { clip: c.id, festival: starFestival.id } : { clip: c.id } });
                }}
                accessibilityRole="button"
                accessibilityLabel={`Play ${c.title}`}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              >
                <LinearGradient colors={[bright, deep]} style={styles.thumb}>
                  <PlayIcon color={color.moon} size={20} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{c.title}</Text>
                  <Text style={styles.rowMeta}>
                    {catalog.festival(c.festivalId)?.name}, {formatDuration(c.durationSec)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Section>
        )}

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
      </ScrollView>

      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => router.back()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
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
  back: { position: 'absolute', left: space.lg },
  hero: { alignItems: 'center', paddingHorizontal: space.xl },
  halo: { position: 'absolute', top: HERO / 2 - HALO / 2 },
  name: { ...type.largeTitle, color: color.moon, marginTop: space.xl, textAlign: 'center' },
  match: { ...type.headline, color: color.glow, fontVariant: ['tabular-nums'], marginTop: space.xs },
  why: { ...type.caption, color: color.moonDim, marginTop: 4, textAlign: 'center', paddingHorizontal: space.xl },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, marginTop: space.lg },
  tag: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  tagText: { ...type.caption, color: color.moon },
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
  section: { marginTop: space.xxl, paddingHorizontal: space.xl },
  sectionTitle: { ...type.title, fontSize: 22, color: color.moon, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, gap: space.md },
  rowTitle: { ...type.headline, color: color.moon },
  rowMeta: { ...type.caption, color: color.moonDim, marginTop: 2 },
  thumb: { width: 52, height: 64, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  similar: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  similarItem: { width: 88, alignItems: 'center' },
  similarName: { ...type.label, color: color.moon, marginTop: space.sm, textAlign: 'center' },
});
