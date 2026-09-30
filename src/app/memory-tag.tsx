import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { SearchField } from '../components/SearchField';
import { CheckIcon } from '../components/TabIcons';
import type { Artist, Festival } from '../data/models';
import { matchesName } from '../features/festivals/search';
import { artistConfidence, festivalConfidence, guessArtists, guessFestivals, reasonLine, type ArtistGuess } from '../features/memories/guess';
import type { MemoryTagInput } from '../features/memories/models';
import { momentLine } from '../features/memories/organize';
import { festivalRoute } from '../features/plan/route';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { useMemories } from '../state/memories';
import { usePlan } from '../state/plan';
import { useTaste } from '../state/taste';
import { color, radius, space, type } from '../theme/tokens';

/** Guesses shown as big rows before "Someone else". */
const TOP_GUESSES = 3;

/**
 * Tagging a memory: who was playing, at which festival and night. Opens on
 * Afterglow's best guess (from when and where it was filmed, the set times
 * and your plan), so saving is usually one tap; everything is a tap or a
 * short search to change. The same sheet retags a saved memory (`id`).
 */
export default function MemoryTagScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const catalog = useCatalog();
  const { going } = useGoing();
  const { taste, informed } = useTaste();
  const { mustSeesAt } = usePlan();
  const mem = useMemories();
  const existing = id ? mem.memories.find((m) => m.id === id) : undefined;
  const draft = existing ? undefined : mem.draft;

  // When it was filmed, as a number so it's stable between renders.
  const whenMs = existing ? Date.parse(existing.capturedAt) : draft?.moment.when?.getTime();
  const place = existing ? existing.place : draft?.moment.place;
  const city = place?.city;
  const region = place?.region;
  const videoUri = existing ? mem.uriOf(existing.file) : draft?.uri;

  // Festivals, the guessed ones first, then the rest (so any festival is a tap away).
  const guesses = useMemo(
    () =>
      guessFestivals(
        catalog.festivals,
        { when: whenMs !== undefined && Number.isFinite(whenMs) ? new Date(whenMs) : undefined, place: { city, region } },
        going,
      ),
    [catalog.festivals, whenMs, city, region, going],
  );
  const festivals = useMemo(() => {
    const first = guesses.map((g) => g.festival);
    return [...first, ...catalog.festivals.filter((f) => !first.includes(f))];
  }, [guesses, catalog.festivals]);
  const topFestival = guesses[0];
  const festivalSure = festivalConfidence(topFestival) !== 'maybe';

  const [festivalId, setFestivalId] = useState<string | undefined>(() => existing?.festivalId ?? (festivalSure ? topFestival?.festival.id : undefined));
  const festival = festivalId ? catalog.festival(festivalId) : undefined;
  const guessedHere = guesses.find((g) => g.festival.id === festivalId);
  const [night, setNight] = useState<string | undefined>(() => existing?.night ?? (festivalSure ? topFestival?.night : undefined));
  // A new festival starts on the night the date says (or none).
  const pickFestival = (f: Festival | undefined) => {
    haptic.select();
    setFestivalId(f?.id);
    setNight(f ? guesses.find((g) => g.festival.id === f.id)?.night : undefined);
    setArtistId(undefined);
    setTouchedArtist(false);
  };

  const artistGuesses = useMemo(() => {
    if (!festival) return [];
    const minute = guessedHere && guessedHere.night === night ? guessedHere.minute : undefined;
    const pinned = mustSeesAt(festival.id);
    const route = festival.sets?.length ? festivalRoute({ festival, artists: catalog.artists, taste, informed, pinned }) : undefined;
    return guessArtists({ festival, night, minute, artists: catalog.artists, taste, pinned, route });
  }, [festival, night, guessedHere, catalog.artists, taste, informed, mustSeesAt]);
  const artistSure = artistConfidence(artistGuesses);

  // The artist: yours when retagging, otherwise the top guess when it's a confident one, until you choose.
  const [artistId, setArtistId] = useState<string | undefined>(existing?.artistId);
  const [touchedArtist, setTouchedArtist] = useState(!!existing);
  const chosenArtist = touchedArtist ? artistId : artistSure !== 'maybe' ? artistGuesses[0]?.artist.id : undefined;

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const pool: Artist[] = festival ? artistGuesses.map((g) => g.artist) : catalog.artists;
  const found = query.trim() ? pool.filter((a) => matchesName(a.name, query)).slice(0, 20) : [];

  const tag: MemoryTagInput = { festivalId, night: festivalId ? night : undefined, artistId: chosenArtist };

  // Nothing to tag (opened without a video, or the memory was deleted): step back, unless we're already leaving
  // (saving clears the draft, and going back twice would close the screen underneath too).
  const missing = !existing && !draft;
  const leaving = useRef(false);
  const leave = () => {
    leaving.current = true;
    router.back();
  };
  useEffect(() => {
    if (missing && !leaving.current && router.canGoBack()) router.back();
  }, [missing]);

  const player = useVideoPlayer(videoUri ?? null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const save = async () => {
    if (existing) {
      mem.tag(existing.id, tag);
      haptic.settle();
      leave();
      return;
    }
    const kept = await mem.keepDraft(tag);
    if (!kept) {
      Alert.alert('Couldn’t save this video', 'There may not be enough space on your phone. Try again.');
      return;
    }
    haptic.settle();
    leave();
  };

  const cancel = () => {
    if (draft?.source === 'camera') {
      Alert.alert('Discard this video?', 'You just recorded it, and it isn’t saved anywhere else.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            leaving.current = true;
            mem.setDraft(undefined);
            router.back();
          },
        },
      ]);
      return;
    }
    leaving.current = true;
    if (draft) mem.setDraft(undefined);
    router.back();
  };

  if (missing) return <View style={styles.root} />;
  const aspect = (existing?.width ?? draft?.width ?? 9) / (existing?.height ?? draft?.height ?? 16);
  const videoH = Math.min(height * 0.34, 300);
  const top = artistGuesses.slice(0, TOP_GUESSES);
  const chosen = chosenArtist ? catalog.artist(chosenArtist) : undefined;
  const chosenIsTop = !!chosen && top.some((g) => g.artist.id === chosen.id);
  const whenWhere = momentLine(whenMs !== undefined && Number.isFinite(whenMs) ? new Date(whenMs) : undefined, place);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: Platform.OS === 'ios' ? space.lg : insets.top + space.sm }]}>
        <Pressable onPress={cancel} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.barButton}>Cancel</Text>
        </Pressable>
        <Text style={styles.barTitle} accessibilityRole="header">
          {existing ? 'Tag memory' : 'New memory'}
        </Text>
        <Pressable onPress={() => void save()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Save to Memories">
          <Text style={[styles.barButton, styles.save]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.videoWrap}>
          {videoUri ? (
            <VideoView
              player={player}
              style={[styles.video, { height: videoH, width: Math.min(videoH * aspect, 340) }]}
              contentFit="cover"
              nativeControls={false}
              accessibilityLabel="Your video"
            />
          ) : null}
          {whenWhere ? <Text style={styles.when}>{whenWhere}</Text> : null}
        </View>

        <Text style={styles.section}>Festival</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {festivals.map((f) => (
            <Chip key={f.id} label={f.name} on={f.id === festivalId} onPress={() => pickFestival(f.id === festivalId ? undefined : f)} />
          ))}
          <Chip label="Not at a festival" on={!festivalId} onPress={() => pickFestival(undefined)} />
        </ScrollView>

        {festival && festival.days.length > 1 ? (
          <>
            <Text style={styles.section}>Night</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {festival.days.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  on={d === night}
                  onPress={() => {
                    haptic.select();
                    setNight(d === night ? undefined : d);
                    setTouchedArtist(false);
                  }}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.section}>Who’s playing?</Text>
        {festival ? (
          <View style={styles.rows}>
            {top.map((g) => (
              <ArtistChoice
                key={g.artist.id}
                guess={g}
                night={night}
                on={g.artist.id === chosenArtist}
                likely={g === top[0] && artistSure !== 'maybe' && !touchedArtist}
                onPress={() => {
                  haptic.select();
                  setTouchedArtist(true);
                  setArtistId(g.artist.id === chosenArtist ? undefined : g.artist.id);
                }}
              />
            ))}
            {chosen && !chosenIsTop ? (
              <ArtistChoice guess={{ artist: chosen, reason: 'lineup', score: 0 }} on onPress={() => setArtistId(undefined)} />
            ) : null}
          </View>
        ) : null}

        <View style={styles.pad}>
          {searching || !festival ? (
            <>
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder={festival ? `Search ${festival.name}` : 'Search artists'}
                label="Search for the artist"
                autoFocus={searching}
              />
              <View style={styles.rows}>
                {found.map((a) => (
                  <ArtistChoice
                    key={a.id}
                    guess={{ artist: a, reason: 'lineup', score: 0 }}
                    on={a.id === chosenArtist}
                    onPress={() => {
                      haptic.select();
                      setTouchedArtist(true);
                      setArtistId(a.id);
                      setQuery('');
                      setSearching(false);
                    }}
                  />
                ))}
                {query.trim() && !found.length ? <Text style={styles.quiet}>No one matches “{query.trim()}”.</Text> : null}
              </View>
            </>
          ) : (
            <View style={styles.links}>
              <Pressable onPress={() => setSearching(true)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.link}>Someone else</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic.select();
                  setTouchedArtist(true);
                  setArtistId(undefined);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Not sure who's playing"
              >
                <Text style={[styles.link, !chosenArtist && touchedArtist && styles.linkOn]}>Not sure</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ArtistChoice({ guess, night, on, likely, onPress }: { guess: ArtistGuess; night?: string; on: boolean; likely?: boolean; onPress: () => void }) {
  const why = reasonLine(guess, night);
  const detail = [likely ? 'Probably' : undefined, why].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${guess.artist.name}${detail ? `, ${detail}` : ''}`}
      style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && styles.pressed]}
    >
      <ArtistAvatar artist={guess.artist} size={40} />
      <View style={styles.choiceText}>
        <Text style={styles.choiceName} numberOfLines={1}>
          {guess.artist.name}
        </Text>
        {detail ? (
          <Text style={styles.choiceWhy} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={[styles.tick, on && styles.tickOn]}>{on ? <CheckIcon color={color.night} size={14} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.nightRaised },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.md },
  barTitle: { ...type.headline, color: color.moon },
  barButton: { ...type.body, color: color.moonDim },
  save: { color: color.glow, fontWeight: '600' },
  videoWrap: { alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  video: { borderRadius: radius.md, backgroundColor: color.night, overflow: 'hidden' },
  when: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: space.xl, marginTop: space.xl, marginBottom: space.sm },
  chips: { paddingHorizontal: space.xl, gap: space.sm },
  chip: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipOn: { backgroundColor: 'rgba(169,124,255,0.2)', borderColor: 'rgba(169,124,255,0.55)' },
  chipText: { ...type.label, color: color.moonDim },
  chipTextOn: { color: color.moon },
  rows: { gap: space.sm, paddingHorizontal: space.xl },
  pad: { marginTop: space.md, gap: space.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  choiceOn: { borderColor: 'rgba(169,124,255,0.6)', backgroundColor: 'rgba(169,124,255,0.12)' },
  choiceText: { flex: 1, gap: 2 },
  choiceName: { ...type.headline, color: color.moon },
  choiceWhy: { ...type.caption, color: color.moonDim },
  tick: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: color.hairline, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: color.glow, borderColor: color.glow },
  links: { flexDirection: 'row', gap: space.xl, paddingHorizontal: space.xl, paddingTop: space.xs },
  link: { ...type.label, color: color.glow },
  linkOn: { color: color.moon },
  quiet: { ...type.caption, color: color.moonDim, paddingVertical: space.sm },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
