import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { SearchField } from '../components/SearchField';
import { CheckIcon } from '../components/TabIcons';
import type { Artist, Festival } from '../data/models';
import { matchesName, searchFestivals } from '../features/festivals/search';
import { festivalsAround, isMany } from '../features/festivals/shelves';
import { artistConfidence, festivalConfidence, guessArtists, guessFestivals, reasonLine, type ArtistGuess } from '../features/memories/guess';
import type { MemoryTagInput } from '../features/memories/models';
import { momentLine } from '../features/memories/organize';
import { PastPicker } from '../features/memories/PastPicker';
import { type PastEvent, pastLabel } from '../features/memories/past';
import { throwbackSharesLine } from '../features/memories/throwbackLimit';
import { useThrowbackShares } from '../features/memories/useThrowbackShares';
import { festivalRoute } from '../features/plan/route';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { useMemories } from '../state/memories';
import { usePlan } from '../state/plan';
import { useTaste } from '../state/taste';
import { color, radius, space, type } from '../theme/tokens';
import { showAlert } from '../lib/dialog';
import { shareDetail, shareOffer } from '../features/social/shareChoice';
import { clock } from '../features/crews/updates';
import { useCrews } from '../state/crews';
import { useCrewUpdates } from '../state/crewUpdates';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../features/social/service';
import { useSocial } from '../state/social';
import { goBack } from '../lib/nav';
import { SheetClose } from '../components/SheetClose';

/** Guesses shown as big rows before "Someone else". */
const TOP_GUESSES = 3;
/** A video filmed longer ago than this, matching nothing on Afterglow, is probably from a past festival. */
const OLD_VIDEO_MS = 30 * 24 * 3600_000;

/**
 * Tagging a memory: who was playing, at which festival and night. Opens on
 * Afterglow's best guess (from when and where it was filmed, the set times
 * and your plan), so saving is usually one tap; everything is a tap or a
 * short search to change. The same sheet retags a saved memory (`id`).
 */
export default function MemoryTagScreen() {
  // `fresh`: a video just filmed, already kept untagged (so it's never lost) and tagged here for the first time.
  const { id, fresh: freshParam } = useLocalSearchParams<{ id?: string; fresh?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const catalog = useCatalog();
  const { going } = useGoing();
  const { taste, informed } = useTaste();
  const { mustSeesAt } = usePlan();
  const mem = useMemories();
  const existing = id ? mem.memories.find((m) => m.id === id) : undefined;
  const draft = existing ? undefined : mem.draft;
  const fresh = !!existing && freshParam === '1';
  // Retagging something already saved, rather than tagging a new video.
  const retagging = !!existing && !fresh;

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
  // With many festivals: the guesses, yours and the ones around that date, and a search for the rest.
  const many = isMany(catalog.festivals);
  const [festivalQuery, setFestivalQuery] = useState('');
  const [searchingFestival, setSearchingFestival] = useState(false);
  const festivals = useMemo(() => {
    const first = guesses.map((g) => g.festival);
    if (!many) return [...first, ...catalog.festivals.filter((f) => !first.includes(f))];
    if (festivalQuery.trim()) return searchFestivals(catalog.festivals, festivalQuery);
    const chosen = existing?.festivalId ? catalog.festival(existing.festivalId) : undefined;
    const mine = catalog.festivals.filter((f) => going.includes(f.id));
    const when = whenMs !== undefined && Number.isFinite(whenMs) ? new Date(whenMs) : undefined;
    return festivalsAround(catalog.festivals, { first: [...first, ...(chosen ? [chosen] : []), ...mine], when });
  }, [guesses, catalog, many, festivalQuery, existing?.festivalId, going, whenMs]);
  const topFestival = guesses[0];
  const festivalSure = festivalConfidence(topFestival) !== 'maybe';

  const [festivalId, setFestivalId] = useState<string | undefined>(() => existing?.festivalId ?? (festivalSure ? topFestival?.festival.id : undefined));
  // A festival from before Afterglow (a video from your camera roll): its name and year instead of a festival on Afterglow.
  const capturedAt = existing?.capturedAt ?? (whenMs !== undefined && Number.isFinite(whenMs) ? new Date(whenMs).toISOString() : new Date().toISOString());
  const [past, setPast] = useState<PastEvent | undefined>(existing?.past);
  // Filmed a while ago, at nothing on Afterglow: open on finding the past festival.
  const [pickingPast, setPickingPast] = useState(() => !retagging && !guesses.length && whenMs !== undefined && Date.now() - whenMs > OLD_VIDEO_MS);
  const festival = festivalId ? catalog.festival(festivalId) : undefined;
  const guessedHere = guesses.find((g) => g.festival.id === festivalId);
  const [night, setNight] = useState<string | undefined>(() => existing?.night ?? (festivalSure ? topFestival?.night : undefined));
  // A new festival starts on the night the date says (or none).
  const pickFestival = (f: Festival | undefined) => {
    haptic.select();
    setFestivalId(f?.id);
    setPast(undefined);
    setPickingPast(false);
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
  const [touchedArtist, setTouchedArtist] = useState(retagging);
  const chosenArtist = touchedArtist ? artistId : artistSure !== 'maybe' ? artistGuesses[0]?.artist.id : undefined;

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const pool: Artist[] = festival ? artistGuesses.map((g) => g.artist) : catalog.artists;
  const found = query.trim() ? pool.filter((a) => matchesName(a.name, query)).slice(0, 20) : [];

  const tag: MemoryTagInput = { festivalId, night: festivalId ? night : undefined, past: festivalId ? undefined : past, artistId: chosenArtist };

  // Share to Discover: on by default once it's tagged and you have a profile; always your choice.
  const social = useSocial();
  const offer = shareOffer({
    available: social.availability.ok,
    signedIn: !!social.user,
    hasProfile: !!social.profile,
    tagged: (!!tag.festivalId || !!tag.past) && !!tag.artistId,
    // Already on Discover, or on its way there.
    alreadyShared: !!existing?.sharedId || (!!existing && (social.waiting.has(existing.id) || existing.id in social.sharing)),
  });
  const [shareChoice, setShareChoice] = useState<boolean | undefined>();
  // Throwbacks: a few free shares, as many as you like with Plus.
  const throwback = !!tag.past && !tag.festivalId;
  const throwbackLimit = useThrowbackShares(throwback && offer === 'ready');
  const overLimit = throwback && !!throwbackLimit && !throwbackLimit.canShare;
  const shareOn = offer === 'ready' && !overLimit && (shareChoice ?? true);
  // Send to my crew: your crews at this festival see it with the time you filmed it. On by default for a new video.
  const crewUpdates = useCrewUpdates();
  const { crewsAt } = useCrews();
  const crewsHere = festivalId && crewUpdates.ready ? crewsAt(festivalId) : [];
  const [crewChoice, setCrewChoice] = useState<boolean | undefined>();
  const crewOn = crewsHere.length > 0 && (crewChoice ?? !retagging);
  // With no signal it waits on the phone and goes by itself (Memories says "Waiting for signal"): no alert for that.
  const shareIt = (m: Parameters<typeof social.share>[0]) =>
    void social.share(m).catch((e) => {
      const kind = socialErrorKind(e);
      // The throwback limit's own words already say where it is.
      showAlert('Couldn’t share it to Discover', kind === 'throwback-limit' ? SOCIAL_ERROR_COPY[kind] : `${SOCIAL_ERROR_COPY[kind]} It’s saved in your Memories, so you can share it from there.`);
    });

  // Nothing to tag (opened without a video, or the memory was deleted): step back, unless we're already leaving
  // (saving clears the draft, and going back twice would close the screen underneath too).
  const missing = !existing && !draft;
  const leaving = useRef(false);
  const leave = () => {
    leaving.current = true;
    goBack();
  };
  useEffect(() => {
    // Wait for your memories to load (a link straight here on a cold start) before deciding there's nothing to tag.
    if (missing && mem.hydrated && !leaving.current) goBack();
  }, [missing, mem.hydrated]);

  const player = useVideoPlayer(videoUri ?? null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // One save at a time: a second tap while the video is being kept would find nothing left to keep.
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving || leaving.current) return;
    if (existing) {
      mem.tag(existing.id, tag);
      haptic.settle();
      if (shareOn) shareIt({ ...existing, ...tag });
      if (crewOn) crewUpdates.sendVideo({ ...existing, ...tag });
      leave();
      return;
    }
    setSaving(true);
    const kept = await mem.keepDraft(tag);
    setSaving(false);
    if (!kept) {
      showAlert('Couldn’t save this video', 'There may not be enough space on your phone. Try again.');
      return;
    }
    haptic.settle();
    // It uploads in the background; Memories shows the progress.
    if (shareOn) shareIt(kept);
    // Waits for signal (and for the Discover upload, if any) on its own.
    if (crewOn) crewUpdates.sendVideo(kept);
    leave();
  };

  const cancel = () => {
    if (fresh || draft?.source === 'camera') {
      showAlert('Discard this video?', 'You just recorded it. Discarding deletes it from your Memories, and it isn’t saved anywhere else.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            leaving.current = true;
            if (fresh && existing) void mem.remove(existing.id);
            else mem.setDraft(undefined);
            goBack();
          },
        },
      ]);
      return;
    }
    leaving.current = true;
    if (draft) mem.setDraft(undefined);
    goBack();
  };

  if (missing)
    return (
      <View style={styles.root}>
        <SheetClose />
      </View>
    );
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
          {retagging ? 'Tag memory' : 'New memory'}
        </Text>
        <Pressable onPress={() => void save()} disabled={saving} hitSlop={10} accessibilityRole="button" accessibilityLabel="Save to Memories" accessibilityState={{ disabled: saving, busy: saving }}>
          <Text style={[styles.barButton, styles.save, saving && styles.saving]}>Save</Text>
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
          {past ? <Chip label={pastLabel(past)} on onPress={() => setPickingPast((v) => !v)} /> : null}
          {[...(festival && !festivals.includes(festival) ? [festival] : []), ...festivals].map((f) => (
            <Chip key={f.id} label={f.name} on={f.id === festivalId} onPress={() => pickFestival(f.id === festivalId ? undefined : f)} />
          ))}
          {past ? null : (
            <Chip
              label="A past festival…"
              on={pickingPast}
              onPress={() => {
                haptic.select();
                setPickingPast((v) => !v);
              }}
            />
          )}
          <Chip label="Not at a festival" on={!festivalId && !past} onPress={() => pickFestival(undefined)} />
          {many && !searchingFestival ? (
            <Chip
              label="Another festival…"
              on={false}
              onPress={() => {
                haptic.select();
                setSearchingFestival(true);
              }}
            />
          ) : null}
        </ScrollView>
        {many && searchingFestival ? (
          <View style={styles.festivalSearch}>
            <SearchField value={festivalQuery} onChange={setFestivalQuery} placeholder="Find the festival" label="Find the festival" />
          </View>
        ) : null}

        {pickingPast || past ? (
          <PastPicker
            capturedAt={capturedAt}
            city={city}
            value={past}
            searching={pickingPast}
            onSearch={() => setPickingPast(true)}
            onChange={(p) => {
              haptic.select();
              setPast(p);
              setFestivalId(undefined);
              setNight(undefined);
              if (p) setPickingPast(false);
            }}
          />
        ) : null}

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
        {crewsHere.length > 0 ? (
          <>
            <Text style={styles.section}>Your crew</Text>
            <View style={styles.shareRow}>
              <View style={styles.shareText}>
                <Text style={styles.shareTitle}>Send to my crew</Text>
                <Text style={styles.shareDetail}>
                  {crewOn
                    ? `${crewsHere.map((c) => c.name).join(' and ')} ${crewsHere.length === 1 ? 'sees' : 'see'} it marked ${whenMs ? `filmed ${clock(new Date(whenMs).toISOString())}` : 'with when you filmed it'}, even if your signal holds it back. Only your crew.`
                    : 'Only in your Memories.'}
                </Text>
              </View>
              <Switch
                value={crewOn}
                onValueChange={(v) => {
                  haptic.select();
                  setCrewChoice(v);
                }}
                trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }}
                accessibilityLabel="Send to my crew"
                testID="send-to-crew"
              />
            </View>
          </>
        ) : null}
        {offer === 'hidden' && existing && social.availability.ok && (existing.sharedId || social.waiting.has(existing.id)) ? (
          <>
            <Text style={styles.section}>Discover</Text>
            <Text style={[styles.shareDetail, styles.sharedNote]} testID="shared-note">
              {existing.sharedId
                ? 'It’s already on Discover. The copy there keeps the tags it was shared with; changes here are for your Memories.'
                : 'Waiting for signal to share it to Discover. It goes by itself, with the tags you save here.'}
            </Text>
          </>
        ) : null}
        {offer !== 'hidden' ? (
          <>
            <Text style={styles.section}>Discover</Text>
            <View style={styles.shareRow}>
              <View style={styles.shareText}>
                <Text style={styles.shareTitle}>Share to Discover</Text>
                {overLimit ? null : (
                  <Text style={styles.shareDetail}>{shareDetail(offer, { handle: social.profile?.handle, festival: festival?.name ?? (past ? pastLabel(past) : undefined), on: shareOn })}</Text>
                )}
                {throwback && offer === 'ready' && throwbackLimit && throwbackSharesLine(throwbackLimit) ? (
                  <Text style={[styles.shareDetail, overLimit && styles.limit]} testID="throwback-limit">
                    {throwbackSharesLine(throwbackLimit)}
                  </Text>
                ) : null}
                {offer === 'needs-account' || offer === 'needs-profile' ? (
                  <Pressable
                    onPress={() => {
                      haptic.select();
                      router.push(offer === 'needs-account' ? '/account' : '/profile-edit');
                    }}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text style={[styles.link, styles.shareLink]}>{offer === 'needs-account' ? 'Sign in' : 'Make a profile'}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Switch
                value={shareOn}
                disabled={offer !== 'ready' || overLimit}
                onValueChange={(v) => {
                  haptic.select();
                  setShareChoice(v);
                }}
                trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }}
                accessibilityLabel="Share to Discover"
                testID="share-to-discover"
              />
            </View>
          </>
        ) : null}
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
  saving: { opacity: 0.5 },
  videoWrap: { alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  video: { borderRadius: radius.md, backgroundColor: color.night, overflow: 'hidden' },
  when: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: space.xl, marginTop: space.xl, marginBottom: space.sm },
  chips: { paddingHorizontal: space.xl, gap: space.sm },
  festivalSearch: { paddingHorizontal: space.xl, marginTop: space.md },
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
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.xl,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  shareText: { flex: 1, gap: 2 },
  shareTitle: { ...type.headline, color: color.moon },
  shareDetail: { ...type.caption, color: color.moonDim },
  shareLink: { marginTop: space.xs },
  limit: { color: '#F2B8A6' },
  sharedNote: { paddingHorizontal: space.xl },
});
