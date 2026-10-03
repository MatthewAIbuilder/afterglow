import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { NightSky } from '../components/NightSky';
import { PageTitle } from '../components/PageTitle';
import { SOUND_LABEL, type Clip } from '../data/models';
import { ClipPlayer } from '../features/discover/ClipPlayer';
import { clipMedia } from '../features/discover/media';
import { useFeedLive } from '../features/discover/useFeedLive';
import { SOUND_COLOR } from '../features/sound-map/colors';
import { SoundSpectrum } from '../features/sound-map/SoundSpectrum';
import { tasteMix } from '../features/taste/lean';
import { likedBy, pickedLine, ROUNDS_MIN, roundLine, thisOrThatPairs, topSound, type Answer } from '../features/taste/thisOrThat';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { useRatings } from '../state/ratings';
import { bumpQuestEvent } from '../state/dailyQuests';
import { useReactions } from '../state/reactions';
import { useTaste } from '../state/taste';
import { color, radius, space, type } from '../theme/tokens';

/**
 * This or that: two live sets, tap the one you'd rather hear, about eight
 * rounds. Each pick is a like on that clip (Both likes both, Neither likes
 * nothing), so My Sound takes shape within a minute. One set plays at a
 * time; tap the other to hear it. A modal from the welcome and My Sound.
 *
 * Param `then`: "discover" goes to Discover at the end, otherwise My Sound.
 */
export default function ThisOrThatScreen() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const { going } = useGoing();
  const { ratings } = useRatings();
  const { reactions, setLiked } = useReactions();

  // Fixed when it opens: your answers never reshuffle the rounds.
  const [pairs] = useState(() => {
    const skip = new Set(Object.keys(ratings));
    for (const id of Object.keys(reactions)) {
      const c = catalog.clips.find((x) => x.id === id);
      if (c) skip.add(c.artistId);
    }
    return thisOrThatPairs(catalog.clips, catalog.artist, { prefer: going, skip });
  });
  const [round, setRound] = useState(0);
  const [liked, setLikedCount] = useState(0);

  const answer = (a: Answer) => {
    const pair = pairs[round];
    if (!pair) return;
    const ids = likedBy(a, pair);
    for (const id of ids) setLiked(id, true);
    setLikedCount((n) => n + ids.length);
    if (ids.length) haptic.tap();
    else haptic.select();
    setRound((r) => r + 1);
    // Playing to the end counts for the "Head to head" daily quest.
    if (round + 1 === pairs.length) bumpQuestEvent('thisorthat');
  };

  const close = () => router.back();
  const finish = () => {
    haptic.settle();
    if (then === 'discover') router.dismissTo('/');
    else router.dismissTo('/sound');
  };

  return (
    <View style={styles.root}>
      <PageTitle title="This or that" />
      <NightSky />
      <View style={[styles.top, { paddingTop: insets.top + space.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header">
            This or that
          </Text>
          {pairs.length >= ROUNDS_MIN && round < pairs.length ? (
            <Text style={styles.sub}>{`${roundLine(round, pairs.length)} · Tap the set you’d rather hear`}</Text>
          ) : null}
        </View>
        <Pressable onPress={close} accessibilityRole="button" hitSlop={10}>
          <Text style={styles.skip}>{round < pairs.length && pairs.length >= ROUNDS_MIN ? 'Skip for now' : 'Close'}</Text>
        </Pressable>
      </View>

      {pairs.length < ROUNDS_MIN ? (
        <NotEnough onPick={() => router.replace('/pick-artists')} />
      ) : round < pairs.length ? (
        <Round key={round} a={pairs[round].a} b={pairs[round].b} onAnswer={answer} bottom={insets.bottom} />
      ) : (
        <Finished liked={liked} onDone={finish} discover={then === 'discover'} bottom={insets.bottom} />
      )}
    </View>
  );
}

/** One round: two sets, one playing at a time, and the four answers. */
function Round({ a, b, onAnswer, bottom }: { a: Clip; b: Clip; onAnswer: (a: Answer) => void; bottom: number }) {
  const [playing, setPlaying] = useState<'a' | 'b'>('a');
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(260)} exiting={reduceMotion ? undefined : FadeOut.duration(160)} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.round, { paddingBottom: bottom + space.xl }]}>
        <SetCard clip={a} side="a" playing={playing === 'a'} onListen={() => setPlaying('a')} onPick={() => onAnswer('a')} />
        <Text style={styles.or} accessibilityElementsHidden importantForAccessibility="no">
          or
        </Text>
        <SetCard clip={b} side="b" playing={playing === 'b'} onListen={() => setPlaying('b')} onPick={() => onAnswer('b')} />
        <View style={styles.answers}>
          <Pressable onPress={() => onAnswer('both')} accessibilityRole="button" accessibilityLabel="I like both" style={({ pressed }) => [styles.small, pressed && styles.pressed]}>
            <Text style={styles.smallText}>Both</Text>
          </Pressable>
          <Pressable onPress={() => onAnswer('neither')} accessibilityRole="button" accessibilityLabel="Neither, next pair" style={({ pressed }) => [styles.small, pressed && styles.pressed]}>
            <Text style={styles.smallText}>Neither</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function SetCard({ clip, side, playing, onListen, onPick }: { clip: Clip; side: 'a' | 'b'; playing: boolean; onListen: () => void; onPick: () => void }) {
  const catalog = useCatalog();
  const live = useFeedLive();
  const artist = catalog.artist(clip.artistId);
  const media = useMemo(() => clipMedia(clip), [clip]);
  const progress = useSharedValue(0);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const sound = topSound(artist);
  const name = artist?.name ?? 'This artist';

  return (
    <View style={[styles.card, playing && styles.cardOn]}>
      <View style={styles.player}>
        {media && !failed ? (
          <ClipPlayer
            media={media}
            load
            active={playing}
            live={playing && live}
            paused={paused}
            progress={progress}
            onPausedChange={setPaused}
            onFail={() => setFailed(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <Text style={styles.quiet}>This set can’t play here. Go by the name.</Text>
          </View>
        )}
        {!playing ? (
          <Pressable
            onPress={() => {
              haptic.select();
              onListen();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Hear ${name}`}
            style={[StyleSheet.absoluteFill, styles.listen]}
          >
            <Text style={styles.listenText}>▶  Tap to hear</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.cardRow}>
        {artist ? <ArtistAvatar artist={artist} size={40} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {sound ? (
            <Text style={[styles.sound, { color: SOUND_COLOR[sound] }]} numberOfLines={1}>
              {SOUND_LABEL[sound]}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onPick}
          accessibilityRole="button"
          accessibilityLabel={`I’d rather hear ${name}`}
          testID={`pick-${side}`}
          style={({ pressed }) => [styles.pick, pressed && styles.pressed]}
        >
          <Text style={styles.pickText}>This one</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Finished({ liked, onDone, discover, bottom }: { liked: number; onDone: () => void; discover: boolean; bottom: number }) {
  const catalog = useCatalog();
  const { taste, informed } = useTaste();
  const mix = useMemo(() => tasteMix(catalog.artists, taste, informed), [catalog.artists, taste, informed]);
  return (
    <View style={[styles.done, { paddingBottom: bottom + space.xl }]} accessibilityLiveRegion="polite">
      <Text style={styles.doneTitle}>{liked ? 'Your sound is taking shape' : 'No picks this time'}</Text>
      <Text style={styles.body}>
        {liked
          ? `${pickedLine(liked)} Each one counts like a like in Discover, and spills over to artists who sound alike.`
          : 'That’s fine: like sets in Discover or rate artists, and your sound will follow.'}
      </Text>
      {liked && mix.length ? (
        <View style={styles.mix}>
          <SoundSpectrum shares={mix} height={10} label="Your sound" />
          <Text style={styles.mixLine}>{mix.slice(0, 3).map((s) => `${SOUND_LABEL[s.tag]} ${s.percent}%`).join(' · ')}</Text>
        </View>
      ) : null}
      <Pressable onPress={onDone} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>{discover ? 'Start watching' : 'See My Sound'}</Text>
      </Pressable>
    </View>
  );
}

function NotEnough({ onPick }: { onPick: () => void }) {
  return (
    <View style={styles.done}>
      <Text style={styles.doneTitle}>Not enough sets yet</Text>
      <Text style={styles.body}>There aren’t enough live sets to compare right now. New ones arrive every night; for now, pick the artists you know.</Text>
      <Pressable onPress={onPick} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>Pick artists you know</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  skip: { ...type.label, color: color.moonDim, marginTop: space.sm },
  round: { paddingHorizontal: space.xl, gap: space.sm, alignSelf: 'center', width: '100%', maxWidth: 560 },
  or: { ...type.label, color: color.moonFaint, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 2 },
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  cardOn: { borderColor: 'rgba(169,124,255,0.6)' },
  player: { aspectRatio: 16 / 9, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  quiet: { ...type.caption, color: color.moonDim, textAlign: 'center' },
  listen: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,4,14,0.55)' },
  listenText: { ...type.headline, color: color.moon },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  name: { ...type.headline, color: color.moon },
  sound: { ...type.caption, marginTop: 1 },
  pick: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glow },
  pickText: { ...type.headline, color: color.night },
  answers: { flexDirection: 'row', gap: space.sm, justifyContent: 'center', marginTop: space.md },
  small: {
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  smallText: { ...type.label, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  done: { flex: 1, paddingHorizontal: space.xl, justifyContent: 'center', gap: space.md, alignSelf: 'center', width: '100%', maxWidth: 560 },
  doneTitle: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim },
  mix: { gap: space.sm, marginVertical: space.md },
  mixLine: { ...type.label, color: color.moon },
  primary: { alignSelf: 'flex-start', paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glow, marginTop: space.md },
  primaryText: { ...type.headline, color: color.night },
});
