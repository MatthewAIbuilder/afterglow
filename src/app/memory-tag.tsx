import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { SearchField } from '../components/SearchField';
import { CheckIcon } from '../components/TabIcons';
import type { Artist, Festival } from '../data/models';
import { matchesName, normalize, searchFestivals } from '../features/festivals/search';
import { trackArtistOn, type Track } from '../features/memories/track';
import { TrackSuggestion } from '../features/memories/TrackSuggestion';
import { cleanArtistName, newArtistId, noteArtist } from '../data/extraArtists';
import { useHqRequests } from '../features/memories/useHqRequests';
import { festivalsAround, isMany } from '../features/festivals/shelves';
import { artistConfidence, festivalConfidence, guessArtists, guessFestivals, reasonLine, type ArtistGuess } from '../features/memories/guess';
import type { Memory, MemoryTagInput } from '../features/memories/models';
import { sharedAsMemory } from '../features/memories/webVideo';
import { momentLine } from '../features/memories/organize';
import { PastPicker } from '../features/memories/PastPicker';
import { ShowPicker } from '../features/memories/ShowPicker';
import { goingShowTag, showBill, showLabel, showTagOf, type ShowTag } from '../features/memories/show';
import { nightDate, showIdOf } from '../features/festivalMode/showEvent';
import { useTonight } from '../features/tonight/useTonight';
import { useGoingShows } from '../state/goingShows';
import { TrimBar } from '../features/memories/TrimBar';
import { allArtists, B2B_MAX, b2bLine } from '../features/memories/b2b';
import { TagPeople } from '../features/social/TagPeople';
import { VideoPreview } from '../features/memories/VideoPreview';
import { loudnessOf } from '../features/memories/loudness';
import { CLIP_SUGGESTED, clipMaxFor, needsTrim, suggestWindow, type ClipWindow } from '../features/memories/trim';
import { removeDraft, saveVideoToPhone } from '../features/memories/webDrafts';
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
import { color, radius, space, type, glowA } from '../theme/tokens';
import { showAlert } from '../lib/dialog';
import { shareDetail, shareOffer } from '../features/social/shareChoice';
import { clock } from '../features/crews/updates';
import { useCrews } from '../state/crews';
import { useCrewUpdates } from '../state/crewUpdates';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../features/social/service';
import { useSocial } from '../state/social';
import { goBack } from '../lib/nav';
import { SheetClose } from '../components/SheetClose';
import { t } from '../i18n';

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
/** Festivals shown as choices before searching, and search results shown. */
const FESTIVAL_CHIPS = 5;
const FESTIVAL_RESULTS = 8;

/** A video just filmed (or chosen on the website) can be trimmed when it's longer than this. */
const TRIM_FROM_SEC = 5;

export default function MemoryTagScreen() {
  // `shared`: a video you already shared (on the website, the only copy is the shared one): its tags change there.
  const { shared } = useLocalSearchParams<{ shared?: string }>();
  const social = useSocial();
  const [sharedMemory, setSharedMemory] = useState<Memory | null | undefined>(undefined);
  const uid = social.user?.uid;
  useEffect(() => {
    if (!shared || !uid) return;
    let live = true;
    void social.service
      .sharedMemory(shared)
      .then((m) => live && setSharedMemory(m && m.uid === uid ? sharedAsMemory(m) : null))
      .catch(() => live && setSharedMemory(null));
    return () => {
      live = false;
    };
  }, [shared, uid, social.service]);
  useEffect(() => {
    if (shared && sharedMemory === null) goBack();
  }, [shared, sharedMemory]);
  if (shared && !sharedMemory)
    return (
      <View style={styles.root}>
        <SheetClose />
      </View>
    );
  return <MemoryTagSheet key={sharedMemory?.id ?? 'local'} sharedMemory={sharedMemory ?? undefined} />;
}

function MemoryTagSheet({ sharedMemory }: { sharedMemory?: Memory }) {
  // `fresh`: a video just filmed, already kept untagged (so it's never lost) and tagged here for the first time.
  // `artist` and `show`: filmed from their page ("Film the set"), so who was playing (and where) is already known.
  const { id, fresh: freshParam, artist: artistParam, show: showParam } = useLocalSearchParams<{ id?: string; fresh?: string; artist?: string; show?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const catalog = useCatalog();
  const { going } = useGoing();
  const { taste, informed } = useTaste();
  const { mustSeesAt } = usePlan();
  const mem = useMemories();
  const existing = sharedMemory ?? (id ? mem.memories.find((m) => m.id === id) : undefined);
  const draft = existing ? undefined : mem.draft;
  const fresh = !!existing && freshParam === '1';
  // Retagging something already saved, rather than tagging a new video.
  const retagging = !!existing && !fresh;
  const presetArtist = !retagging && artistParam && catalog.artist(artistParam) ? artistParam : undefined;
  const presetShowOf = catalog.shows.find((s) => s.id === showParam);
  const presetShow = !retagging && presetShowOf ? showTagOf(presetShowOf) : undefined;
  // Chosen on the website: a browser keeps no files, so the video is kept by sharing it to Discover.
  const webPost = !!draft?.keptBySharing;

  // When it was filmed, as a number so it's stable between renders.
  const whenMs = existing ? Date.parse(existing.capturedAt) : draft?.moment.when?.getTime();
  const place = existing ? existing.place : draft?.moment.place;
  const city = place?.city;
  const region = place?.region;
  const videoUri = sharedMemory ? sharedMemory.file : existing ? mem.uriOf(existing.file) : draft?.uri;

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
    if (festivalQuery.trim()) return searchFestivals(catalog.festivals, festivalQuery);
    if (!many) return [...first, ...catalog.festivals.filter((f) => !first.includes(f))];
    const chosen = existing?.festivalId ? catalog.festival(existing.festivalId) : undefined;
    const mine = catalog.festivals.filter((f) => going.includes(f.id));
    const when = whenMs !== undefined && Number.isFinite(whenMs) ? new Date(whenMs) : undefined;
    return festivalsAround(catalog.festivals, { first: [...first, ...(chosen ? [chosen] : []), ...mine], when });
  }, [guesses, catalog, many, festivalQuery, existing?.festivalId, going, whenMs]);
  const topFestival = guesses[0];
  const festivalSure = festivalConfidence(topFestival) !== 'maybe';

  const [festivalId, setFestivalId] = useState<string | undefined>(() => existing?.festivalId ?? (festivalSure && !presetShow ? topFestival?.festival.id : undefined));
  // A festival from before Afterglow (a video from your camera roll): its name and year instead of a festival on Afterglow.
  const capturedAt = existing?.capturedAt ?? (whenMs !== undefined && Number.isFinite(whenMs) ? new Date(whenMs).toISOString() : new Date().toISOString());
  const [past, setPast] = useState<PastEvent | undefined>(existing?.past);
  // Filmed a while ago, at nothing on Afterglow: open on finding the past festival.
  const [pickingPast, setPickingPast] = useState(() => !retagging && !guesses.length && whenMs !== undefined && Date.now() - whenMs > OLD_VIDEO_MS);
  // A one-night show (a club night or concert) instead of a festival. Filmed tonight at the show you're going to: tagged with it from the start.
  const tonight = useTonight();
  const { shows: goingShows } = useGoingShows();
  const tonightShowId = showIdOf(tonight?.festival.id);
  const tonightShow = useMemo(() => {
    if (!tonightShowId) return undefined;
    const live = catalog.shows.find((x) => x.id === tonightShowId);
    const mine = goingShows.find((x) => x.id === tonightShowId);
    return live ? showTagOf(live) : mine ? goingShowTag(mine) : undefined;
  }, [tonightShowId, catalog.shows, goingShows]);
  const [show, setShow] = useState<ShowTag | undefined>(
    () =>
      existing?.show ??
      presetShow ??
      (!retagging && !existing?.festivalId && !festivalSure && tonightShow && whenMs !== undefined && Number.isFinite(whenMs) && nightDate(new Date(whenMs)) === tonightShow.date
        ? tonightShow
        : undefined),
  );
  const [pickingShow, setPickingShow] = useState(false);
  const festival = festivalId ? catalog.festival(festivalId) : undefined;
  const guessedHere = guesses.find((g) => g.festival.id === festivalId);
  const [night, setNight] = useState<string | undefined>(() => existing?.night ?? (festivalSure && !presetShow ? topFestival?.night : undefined));
  // A new festival starts on the night the date says (or none).
  const pickFestival = (f: Festival | undefined) => {
    haptic.select();
    setFestivalId(f?.id);
    setPast(undefined);
    setPickingPast(false);
    setShow(undefined);
    setPickingShow(false);
    setNight(f ? guesses.find((g) => g.festival.id === f.id)?.night : undefined);
    setArtistIds([]);
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
  // Who was playing: one artist, or a few for a back to back (the first is the one it's filed under).
  const [artistIds, setArtistIds] = useState<string[]>(() => (existing ? allArtists(existing) : []));
  const [touchedArtist, setTouchedArtist] = useState(retagging);
  const guessed = artistSure !== 'maybe' ? artistGuesses[0]?.artist.id : undefined;
  // Filmed from their page: them, until you choose otherwise.
  const chosenList = touchedArtist ? artistIds : presetArtist ? [presetArtist] : guessed ? [guessed] : [];
  const chosenArtist = chosenList[0];
  /** Tick or untick someone (ticking a second makes it a back to back). */
  const toggleArtist = (id: string) => {
    haptic.select();
    setTouchedArtist(true);
    setArtistIds(chosenList.includes(id) ? chosenList.filter((x) => x !== id) : [...chosenList, id].slice(0, 1 + B2B_MAX));
  };
  const clearArtists = () => {
    setTouchedArtist(true);
    setArtistIds([]);
  };

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // A show on Afterglow: its bill first (anyone else is a search away).
  const bill = useMemo(() => (festival ? [] : showBill(show, catalog.shows, catalog.artist)), [festival, show, catalog]);
  const pool: Artist[] = festival ? artistGuesses.map((g) => g.artist) : catalog.artists;
  const inPool = query.trim() ? pool.filter((a) => matchesName(a.name, query)).slice(0, 20) : [];
  // Not on this festival's lineup: anyone on Afterglow.
  const found = inPool.length || !festival || !query.trim() ? inPool : catalog.artists.filter((a) => matchesName(a.name, query)).slice(0, 20);
  // Someone not on Afterglow yet: added by name (data/extraArtists.ts), and HQ is asked to add them properly.
  const typedName = cleanArtistName(query);
  const typedId = typedName ? newArtistId(typedName) : undefined;
  const onAfterglow = useMemo(() => new Set(catalog.artists.map((a) => a.id)), [catalog.artists]);
  const canAddNew = !!typedName && !!typedId && !onAfterglow.has(typedId) && !found.some((a) => normalize(a.name) === normalize(typedName));
  const [named, setNamed] = useState<Record<string, string>>(() => (existing?.artistId && existing.artistName ? { [existing.artistId]: existing.artistName } : {}));

  // The part that plays, for a new video (a long one always has one; it starts on the loudest stretch).
  const draftLength = draft?.durationSec;
  // A big file can share less than a minute (its part is cut out and uploaded on its own).
  const draftBytes = draft?.bytes;
  const clipMax = clipMaxFor(draftLength, draftBytes);
  const [clip, setClip] = useState<ClipWindow | undefined>(() =>
    draftLength && needsTrim(draftLength, draftBytes) ? suggestWindow(draftLength, undefined, Math.min(CLIP_SUGGESTED, clipMax), clipMax) : fresh ? existing?.clip : undefined,
  );
  // A video you can trim here: a new one on the website, or one you just filmed (any longer than a few seconds).
  const trimLength = draft ? (webPost || draft.source === 'camera' ? draftLength : undefined) : fresh ? existing?.durationSec : undefined;
  const canTrim = !!trimLength && trimLength > TRIM_FROM_SEC;
  const touchedClip = useRef(false);
  const draftUri = draft?.uri;
  useEffect(() => {
    if (!draftUri || !draftLength || !needsTrim(draftLength, draftBytes)) return;
    let live = true;
    void loudnessOf(draftUri, draftLength, draftBytes).then((loud) => {
      const w = loud ? suggestWindow(draftLength, loud, Math.min(CLIP_SUGGESTED, clipMax), clipMax) : undefined;
      if (live && w && !touchedClip.current) setClip(w);
    });
    return () => {
      live = false;
    };
  }, [draftUri, draftLength, draftBytes, clipMax, setClip]);

  // The song playing, once you keep the one Shazam heard (it shows on the video wherever it's shared).
  const [track, setTrack] = useState<Track | undefined>(existing?.track);
  // The song's artist, when they're on Afterglow and nobody's tagged yet: maybe it was their own set.
  const trackArtist = useMemo(() => (track && !chosenArtist ? trackArtistOn(track, catalog.artists, normalize) : undefined), [track, chosenArtist, catalog.artists]);

  // People in it, tagged once it's on Discover (it shows on their profiles; they can hide it).
  const [people, setPeople] = useState<string[]>(() => existing?.people ?? []);
  const touchedPeople = useRef(false);

  const tag: MemoryTagInput = {
    festivalId,
    night: festivalId ? night : undefined,
    past: festivalId ? undefined : past,
    show: festivalId || past ? undefined : show,
    artistId: chosenArtist,
    withArtistIds: chosenList.length > 1 ? chosenList.slice(1) : undefined,
    artistName: chosenArtist && !onAfterglow.has(chosenArtist) ? named[chosenArtist] : undefined,
    ...(draft || fresh ? { clip } : {}),
    people: people.length ? people : undefined,
    track,
  };

  // Share to Discover: on by default once it's tagged and you have a profile; always your choice.
  const social = useSocial();
  // Already on Discover as yours: saving changes the shared copy's tags too.
  const sharedCopy = !!sharedMemory || (!!existing?.sharedId && !!social.user && existing.sharedBy === social.user.uid);
  // Once shared, a throwback stays one (its year and name can change) and nothing else becomes one.
  const throwbackLocked = sharedCopy && !!existing?.past && !existing.festivalId;
  // The choices wrap rather than scroll off the edges, so only the likeliest few festivals show; the rest are a search away.
  const listed = [...(festival && !festivals.includes(festival) ? [festival] : []), ...festivals];
  const shownFestivals = searchingFestival && festivalQuery.trim() ? listed.slice(0, FESTIVAL_RESULTS) : listed.slice(0, FESTIVAL_CHIPS);
  const moreFestivals = many || listed.length > FESTIVAL_CHIPS;
  // Who's tagged in it already, from Discover (where the tags live once it's shared).
  const sharedTagsId = sharedCopy ? existing?.sharedId : undefined;
  useEffect(() => {
    if (!sharedTagsId) return;
    let live = true;
    void social.service
      .videoTags(sharedTagsId)
      .then((tags) => {
        if (live && !touchedPeople.current) setPeople(tags.map((x) => x.uid));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sharedTagsId, social.service, setPeople]);
  const offer = shareOffer({
    available: social.availability.ok,
    signedIn: !!social.user,
    hasProfile: !!social.profile,
    // Who was playing is enough: a festival, a past one or a show is extra.
    tagged: !!tag.artistId,
    // Already on Discover, or on its way there.
    alreadyShared: !!existing?.sharedId || (!!existing && (social.waiting.has(existing.id) || existing.id in social.sharing)),
  });
  const [shareChoice, setShareChoice] = useState<boolean | undefined>();
  // Throwbacks: a few free shares, as many as you like with Plus.
  const throwback = !!tag.past && !tag.festivalId;
  const throwbackLimit = useThrowbackShares(throwback && offer === 'ready');
  const overLimit = throwback && !!throwbackLimit && !throwbackLimit.canShare;
  const shareOn = offer === 'ready' && !overLimit && (webPost || (shareChoice ?? true));
  // Send to my crew: your crews at this festival see it with the time you filmed it. On by default for a new video.
  const crewUpdates = useCrewUpdates();
  const { crewsAt } = useCrews();
  // (Not for a website post: crew videos wait on the phone for signal, and a browser keeps nothing.)
  const crewsHere = festivalId && crewUpdates.ready && !webPost ? crewsAt(festivalId) : [];
  const [crewChoice, setCrewChoice] = useState<boolean | undefined>();
  const crewOn = crewsHere.length > 0 && (crewChoice ?? !retagging);
  // With no signal it waits on the phone and goes by itself (Memories says "Waiting for signal"): no alert for that.
  const draftId = draft?.draftId;
  const shareIt = (m: Parameters<typeof social.share>[0]) =>
    void social
      .share(m)
      // Shared to Discover: it's kept there, so its draft goes.
      .then((r) => {
        if (r === 'shared' && draftId) void removeDraft(draftId);
      })
      .catch((e) => {
      const kind = socialErrorKind(e);
      // The throwback limit's own words already say where it is.
      showAlert(
        t('Couldn’t share it to Discover'),
        kind === 'throwback-limit'
          ? SOCIAL_ERROR_COPY[kind]
          : webPost
            ? t('{error} It stays in your Memories until you close this page, so you can try again from there.', { error: SOCIAL_ERROR_COPY[kind] })
            : t('{error} It’s saved in your Memories, so you can share it from there.', { error: SOCIAL_ERROR_COPY[kind] }),
      );
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

  // One save at a time: a second tap while the video is being kept would find nothing left to keep.
  const [saving, setSaving] = useState(false);
  // A new past festival (its own badge) or a new artist: HQ hears about it by itself.
  const askHq = useHqRequests();
  const save = async () => {
    if (saving || leaving.current) return;
    void askHq(tag);
    if (sharedMemory) {
      setSaving(true);
      try {
        await social.service.retagShared(sharedMemory.id, tag);
        await social.service.setVideoTags(sharedMemory.id, people);
      } catch (e) {
        setSaving(false);
        showAlert(t('Couldn’t save the changes'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
        return;
      }
      haptic.settle();
      leave();
      return;
    }
    if (existing) {
      mem.tag(existing.id, tag);
      haptic.settle();
      // The copy on Discover follows (best effort: your Memories have the change either way).
      if (sharedCopy && existing.sharedId) {
        const sharedId = existing.sharedId;
        void social.service
          .retagShared(sharedId, tag)
          .then(() => social.service.setVideoTags(sharedId, people))
          .catch((e) => showAlert(t('Couldn’t update it on Discover'), SOCIAL_ERROR_COPY[socialErrorKind(e)]));
      }
      if (shareOn) shareIt({ ...existing, ...tag });
      if (crewOn) crewUpdates.sendVideo({ ...existing, ...tag });
      leave();
      return;
    }
    // On the website, saving is sharing: say what's still needed rather than keep it nowhere.
    if (webPost && !shareOn) {
      const why = overLimit
        ? t('You’ve shared as many throwbacks as the free plan allows. Unlimited throwbacks come with Afterglow Plus.')
        : offer === 'hidden'
          ? t('Sharing isn’t available right now.')
          : shareDetail(offer, { on: false });
      const go = offer === 'needs-account' ? { text: t('Sign in'), path: '/account' as const } : offer === 'needs-profile' ? { text: t('Make a profile'), path: '/profile-edit' as const } : undefined;
      showAlert(t('Share it to keep it'), t('{why} On the website, videos are kept by sharing them.', { why }), [
        { text: go ? t('Not now') : t('OK'), style: 'cancel' },
        ...(go ? [{ text: go.text, onPress: () => router.push(go.path) }] : []),
      ]);
      return;
    }
    setSaving(true);
    const kept = await mem.keepDraft(tag);
    setSaving(false);
    if (!kept) {
      showAlert(t('Couldn’t save this video'), webPost ? t('Try again, or choose it again.') : t('There may not be enough space on your phone. Try again.'));
      return;
    }
    haptic.settle();
    // It uploads in the background; Memories shows the progress.
    if (shareOn) shareIt(kept);
    // Waits for signal (and for the Discover upload, if any) on its own.
    if (crewOn) crewUpdates.sendVideo(kept);
    if (webPost) {
      // The upload runs in this page: Memories shows how far along it is.
      leaving.current = true;
      router.replace('/memories');
      return;
    }
    leave();
  };

  const cancel = () => {
    // Filmed just now and already kept (in your Memories in the app, in Drafts on the website): ask whether to keep it.
    if ((fresh && existing) || draftId) {
      showAlert(
        t('Keep this video?'),
        draftId
          ? t('It’s in Drafts on this browser. Finish it and share it from there any time.')
          : t('It’s in your Memories, not tagged yet. Tag it and share it from there any time.'),
        [
          { text: t('Keep editing'), style: 'cancel' },
          {
            text: t('Delete video'),
            style: 'destructive',
            onPress: () => {
              leaving.current = true;
              if (draftId) {
                void removeDraft(draftId);
                mem.setDraft(undefined);
              } else if (existing) void mem.remove(existing.id);
              goBack();
            },
          },
          {
            text: draftId ? t('Keep in drafts') : t('Keep in Memories'),
            onPress: () => {
              leaving.current = true;
              if (draftId) mem.setDraft(undefined);
              goBack();
            },
          },
        ],
      );
      return;
    }
    if (draft?.source === 'camera') {
      showAlert(t('Discard this video?'), t('You just recorded it. Discarding deletes it from your Memories, and it isn’t saved anywhere else.'), [
        { text: t('Keep editing'), style: 'cancel' },
        {
          text: t('Discard'),
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
  // Everyone ticked who isn't already a row above (found by searching).
  const shownIds = new Set(festival ? top.map((g) => g.artist.id) : bill.slice(0, TOP_GUESSES).map((a) => a.id));
  const extraChosen = chosenList.filter((id) => !shownIds.has(id)).map((id) => catalog.artist(id)).filter((a): a is Artist => !!a);
  const whenWhere = momentLine(whenMs !== undefined && Number.isFinite(whenMs) ? new Date(whenMs) : undefined, place);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: Platform.OS === 'ios' ? space.lg : insets.top + space.sm }]}>
        <Pressable onPress={cancel} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Cancel')}>
          <Text style={styles.barButton}>{t('Cancel')}</Text>
        </Pressable>
        <Text style={styles.barTitle} accessibilityRole="header">
          {retagging ? t('Tag memory') : t('New memory')}
        </Text>
        <Pressable
          onPress={() => void save()}
          disabled={saving}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={webPost ? t('Share this video') : t('Save to Memories')}
          accessibilityState={{ disabled: saving, busy: saving }}
        >
          <Text style={[styles.barButton, styles.save, saving && styles.saving]}>{webPost ? t('Share') : t('Save')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.videoWrap}>
          {videoUri ? <VideoPreview uri={videoUri} clip={draft || fresh ? clip : existing?.clip} style={[styles.video, { height: videoH, width: Math.min(videoH * aspect, 340) }]} /> : null}
          {whenWhere ? <Text style={styles.when}>{whenWhere}</Text> : null}
          {/* Filmed with the website's camera: a copy to keep in Photos (the app saves its recordings there by itself). */}
          {draft?.draftId && videoUri ? (
            <Pressable
              onPress={() => {
                haptic.select();
                void saveVideoToPhone(videoUri, 'Afterglow.mp4').then((r) => {
                  if (r === 'failed') showAlert(t('Couldn’t save it'), t('Try again, or share it to Discover to keep it.'));
                });
              }}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [styles.savePhone, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.savePhoneText}>{t('Save to phone')}</Text>
            </Pressable>
          ) : null}
        </View>
        {/* A video chosen on the website, or one just filmed (the iPhone's own picker trims what you choose in the app). */}
        {canTrim && trimLength ? (
          <>
            <Text style={styles.section}>{needsTrim(trimLength, draftBytes) ? t('Trim') : t('Trim (optional)')}</Text>
            <TrimBar
              durationSec={trimLength}
              bytes={draftBytes}
              value={clip}
              onChange={(w) => {
                touchedClip.current = true;
                setClip(w);
              }}
            />
          </>
        ) : null}

        <Text style={styles.section}>{t('Festival or show')}</Text>
        {/* A throwback or a show, once chosen, shows as its card below (with Change and Remove), so the choices step aside. */}
        {past || show ? null : throwbackLocked ? (
          <View style={styles.wrap}>
            <Chip label={t('A past festival…')} on={pickingPast} onPress={() => setPickingPast(true)} />
          </View>
        ) : (
          <View style={styles.wrap}>
            {shownFestivals.map((f) => (
              <Chip key={f.id} label={f.name} on={f.id === festivalId} onPress={() => pickFestival(f.id === festivalId ? undefined : f)} />
            ))}
            {moreFestivals && !searchingFestival ? (
              <Chip
                label={t('Another festival…')}
                on={false}
                onPress={() => {
                  haptic.select();
                  setSearchingFestival(true);
                }}
              />
            ) : null}
            {sharedCopy ? null : (
              <Chip
                label={t('A past festival…')}
                on={pickingPast}
                onPress={() => {
                  haptic.select();
                  setPickingPast((v) => !v);
                  setPickingShow(false);
                }}
              />
            )}
            <Chip
              label={t('A one-night show…')}
              on={pickingShow}
              onPress={() => {
                haptic.select();
                setPickingShow((v) => !v);
                setPickingPast(false);
              }}
            />
            <Chip label={t('Not at a festival or show')} on={!festivalId && !past && !show} onPress={() => pickFestival(undefined)} />
          </View>
        )}
        {searchingFestival && !past && !show ? (
          <View style={styles.festivalSearch}>
            <SearchField value={festivalQuery} onChange={setFestivalQuery} placeholder={t('Find the festival')} label={t('Find the festival')} />
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
              if (p) {
                setPickingPast(false);
                setShow(undefined);
                setPickingShow(false);
              }
            }}
          />
        ) : null}

        {pickingShow || show ? (
          <ShowPicker
            capturedAt={capturedAt}
            city={city}
            artistId={chosenArtist}
            value={show}
            searching={pickingShow}
            onSearch={() => setPickingShow(true)}
            onChange={(sh) => {
              haptic.select();
              setShow(sh);
              if (sh) {
                setFestivalId(undefined);
                setNight(undefined);
                setPast(undefined);
                setPickingPast(false);
                setPickingShow(false);
              }
            }}
          />
        ) : null}

        {festival && festival.days.length > 1 ? (
          <>
            <Text style={styles.section}>{t('Night')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {festival.days.map((d) => (
                <Chip
                  key={d}
                  label={t(d)}
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

        <Text style={styles.section}>{t('Who’s playing?')}</Text>
        <View style={styles.rows}>
          {festival
            ? top.map((g) => (
                <ArtistChoice
                  key={g.artist.id}
                  guess={g}
                  night={night}
                  on={chosenList.includes(g.artist.id)}
                  likely={g === top[0] && artistSure !== 'maybe' && !touchedArtist}
                  onPress={() => toggleArtist(g.artist.id)}
                />
              ))
            : // No festival: the show's bill (when it's one of Afterglow's).
              bill.slice(0, TOP_GUESSES).map((a) => (
                <ArtistChoice key={a.id} guess={{ artist: a, reason: 'lineup', score: 0 }} on={chosenList.includes(a.id)} onPress={() => toggleArtist(a.id)} />
              ))}
          {extraChosen.map((a) => (
            <ArtistChoice key={a.id} guess={{ artist: a, reason: 'lineup', score: 0 }} on onPress={() => toggleArtist(a.id)} />
          ))}
          {chosenList.length === 1 ? <Text style={styles.quiet}>{t('Playing back to back? Tick everyone who was on.')}</Text> : null}
          {chosenList.length > 1 ? (
            <Text style={styles.quiet}>{t('Back to back: {artists}', { artists: b2bLine(chosenList.map((id) => catalog.artist(id)?.name ?? '')) })}</Text>
          ) : null}
        </View>

        <View style={styles.pad}>
          {searching || !festival ? (
            <>
              <View style={styles.searchPad}>
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder={festival ? t('Search {festival}', { festival: festival.name }) : chosen ? t('Someone else?') : t('Search artists')}
                label={t('Search for the artist')}
                autoFocus={searching}
              />
              </View>
              <View style={styles.rows}>
                {found.map((a) => (
                  <ArtistChoice
                    key={a.id}
                    guess={{ artist: a, reason: 'lineup', score: 0 }}
                    on={chosenList.includes(a.id)}
                    onPress={() => {
                      if (!chosenList.includes(a.id)) toggleArtist(a.id);
                      setQuery('');
                      setSearching(false);
                    }}
                  />
                ))}
                {canAddNew ? (
                  <Pressable
                    onPress={() => {
                      noteArtist(typedId, typedName);
                      setNamed((n) => ({ ...n, [typedId!]: typedName! }));
                      if (!chosenList.includes(typedId!)) toggleArtist(typedId!);
                      setQuery('');
                      setSearching(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Add {name} as a new artist', { name: typedName! })}
                    style={({ pressed }) => [styles.addArtist, pressed && { opacity: 0.75 }]}
                  >
                    <Text style={styles.addArtistText} numberOfLines={1}>
                      {t('+ Add “{name}”', { name: typedName! })}
                    </Text>
                    <Text style={styles.quiet}>{t('Not on Afterglow yet. Your video shows them by this name, and we’ll add them properly.')}</Text>
                  </Pressable>
                ) : query.trim() && !found.length ? (
                  <Text style={styles.quiet}>{t('No one matches “{query}”.', { query: query.trim() })}</Text>
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.links}>
              <Pressable onPress={() => setSearching(true)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.link}>{t('Someone else')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic.select();
                  clearArtists();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("Not sure who's playing")}
              >
                <Text style={[styles.link, !chosenArtist && touchedArtist && styles.linkOn]}>{t('Not sure')}</Text>
              </Pressable>
            </View>
          )}
        </View>
        <TrackSuggestion
          uri={sharedMemory ? undefined : videoUri}
          track={track}
          onChange={setTrack}
          headingStyle={styles.section}
          artistToTag={trackArtist}
          onTagArtist={(artistId) => {
            if (!chosenList.includes(artistId)) toggleArtist(artistId);
          }}
        />
        {social.availability.ok && social.profile && (shareOn || sharedCopy) ? (
          <>
            <Text style={styles.section}>{t('Who’s in it?')}</Text>
            <TagPeople
              value={people}
              onChange={(uids) => {
                touchedPeople.current = true;
                setPeople(uids);
              }}
            />
          </>
        ) : null}
        {crewsHere.length > 0 ? (
          <>
            <Text style={styles.section}>{t('Your crew')}</Text>
            <View style={styles.shareRow}>
              <View style={styles.shareText}>
                <Text style={styles.shareTitle}>{t('Send to my crew')}</Text>
                <Text style={styles.shareDetail}>
                  {crewOn ? crewLine(crewsHere.map((c) => c.name), whenMs ? clock(new Date(whenMs).toISOString()) : undefined) : t('Only in your Memories.')}
                </Text>
              </View>
              <Switch
                value={crewOn}
                onValueChange={(v) => {
                  haptic.select();
                  setCrewChoice(v);
                }}
                trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }}
                accessibilityLabel={t('Send to my crew')}
                testID="send-to-crew"
              />
            </View>
          </>
        ) : null}
        {offer === 'hidden' && existing && social.availability.ok && (existing.sharedId || social.waiting.has(existing.id)) ? (
          <>
            <Text style={styles.section}>{t('Discover')}</Text>
            <Text style={[styles.shareDetail, styles.sharedNote]} testID="shared-note">
              {existing.sharedId
                ? sharedCopy
                  ? t('It’s on Discover. Changes you save here update it there too.')
                  : t('It’s already on Discover. The copy there keeps the tags it was shared with; changes here are for your Memories.')
                : t('Waiting for signal to share it to Discover. It goes by itself, with the tags you save here.')}
            </Text>
          </>
        ) : null}
        {offer !== 'hidden' ? (
          <>
            <Text style={styles.section}>{t('Discover')}</Text>
            <View style={styles.shareRow}>
              <View style={styles.shareText}>
                <Text style={styles.shareTitle}>{t('Share to Discover')}</Text>
                {overLimit ? null : (
                  <Text style={styles.shareDetail}>{shareDetail(offer, { handle: social.profile?.handle, festival: festival?.name ?? (past ? pastLabel(past) : show ? showLabel(show) : undefined), on: shareOn })}</Text>
                )}
                {webPost ? (
                  <Text style={[styles.shareDetail, styles.webNote]} testID="web-keeps-by-sharing">
                    {t('On the website, videos are kept by sharing them. Nothing is uploaded until you tap Share.')}
                  </Text>
                ) : null}
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
                    <Text style={[styles.link, styles.shareLink]}>{offer === 'needs-account' ? t('Sign in') : t('Make a profile')}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Switch
                value={shareOn}
                disabled={offer !== 'ready' || overLimit || webPost}
                onValueChange={(v) => {
                  haptic.select();
                  setShareChoice(v);
                }}
                trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }}
                accessibilityLabel={t('Share to Discover')}
                testID="share-to-discover"
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** "Lunar crew sees it marked filmed 11:48 PM, …": who in your crews sees the video, and how it's marked. */
function crewLine(names: string[], filmed: string | undefined): string {
  const crews = names.reduce((a, b) => t('{a} and {b}', { a, b }));
  if (names.length === 1)
    return filmed
      ? t('{crews} sees it marked filmed {time}, even if your signal holds it back. Only your crew.', { crews, time: filmed })
      : t('{crews} sees it marked with when you filmed it, even if your signal holds it back. Only your crew.', { crews });
  return filmed
    ? t('{crews} see it marked filmed {time}, even if your signal holds it back. Only your crew.', { crews, time: filmed })
    : t('{crews} see it marked with when you filmed it, even if your signal holds it back. Only your crew.', { crews });
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
  const detail = [likely ? t('Probably') : undefined, why].filter(Boolean).join(' · ');
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
  savePhone: { alignSelf: 'center', marginTop: space.sm, paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  savePhoneText: { ...type.label, color: color.moon },
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.xl, gap: space.sm },
  festivalSearch: { paddingHorizontal: space.xl, marginTop: space.md },
  chip: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  chipOn: { backgroundColor: glowA(0.2), borderColor: glowA(0.55) },
  chipText: { ...type.label, color: color.moonDim },
  chipTextOn: { color: color.moon },
  rows: { gap: space.sm, paddingHorizontal: space.xl },
  pad: { marginTop: space.md, gap: space.sm },
  searchPad: { paddingHorizontal: space.xl },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  choiceOn: { borderColor: glowA(0.6), backgroundColor: glowA(0.12) },
  choiceText: { flex: 1, gap: 2 },
  choiceName: { ...type.headline, color: color.moon },
  choiceWhy: { ...type.caption, color: color.moonDim },
  tick: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: color.hairline, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: color.glow, borderColor: color.glow },
  links: { flexDirection: 'row', gap: space.xl, paddingHorizontal: space.xl, paddingTop: space.xs },
  link: { ...type.label, color: color.glow },
  linkOn: { color: color.moon },
  quiet: { ...type.caption, color: color.moonDim, paddingVertical: space.sm },
  addArtist: { paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: glowA(0.5) },
  addArtistText: { ...type.headline, color: color.glow },
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
    borderTopColor: color.rim,
  },
  shareText: { flex: 1, gap: 2 },
  shareTitle: { ...type.headline, color: color.moon },
  shareDetail: { ...type.caption, color: color.moonDim },
  shareLink: { marginTop: space.xs },
  limit: { color: '#F2B8A6' },
  sharedNote: { paddingHorizontal: space.xl },
  webNote: { color: color.moon, marginTop: space.xs },
});
