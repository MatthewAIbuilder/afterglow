import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideOutLeft,
  SlideOutRight,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { CloseIcon } from '../../components/TabIcons';
import { SOUND_LABEL, type SoundTag } from '../../data/models';
import { HeartIcon } from '../../features/discover/icons';
import { soundsLike, tuneQueue } from '../../features/festivals/tune';
import { TIER_AT } from '../../features/plan/plan';
import { listenLinks } from '../../features/taste/listen';
import type { Rating } from '../../features/taste/ratings';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { useWeekends } from '../../state/weekends';
import { FilterChips } from '../../components/FilterChips';
import { lineupDays, playsOn } from '../../features/festivals/days';
import { color, radius, space, type } from '../../theme/tokens';

type Answer = Rating | 'unsure';
type Step = { id: string; answer: Answer };

/**
 * Tune your lineup: a festival's artists one at a time. Love their sound,
 * not for me, or don't know them. Every answer reshapes your match, your
 * festival plan and My Sound; "don't know" changes nothing.
 */
export default function TuneScreen() {
  // `then=festival`: opened from the welcome, so the festival page isn't underneath to go back to.
  const { id, then: after, day: dayParam } = useLocalSearchParams<{ id: string; then?: string; day?: string }>();
  const catalog = useCatalog();
  // Your weekend of a two-weekend festival: only the acts playing it.
  const { forYou } = useWeekends();
  const whole = catalog.festival(id);
  const festival = whole && forYou(whole);
  const { ratings, rate } = useRatings();
  const { taste, informed, similarity } = useTaste();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  // Worked out once, so the order doesn't shift as your answers reshape the matches. On a big lineup
  // with days, you can tune one day at a time (chosen before the first answer).
  const days = festival ? lineupDays(festival) : [];
  const queueFor = (d: string | undefined) =>
    festival ? tuneQueue(festival, ratings, (a) => !!catalog.artist(a)).filter((a) => playsOn(festival, a, d)) : [];
  const [day, setDay] = useState(() => (dayParam && days.includes(dayParam) ? dayParam : undefined));
  const [queue, setQueue] = useState(() => queueFor(day));
  const pickDay = (d: string | undefined) => {
    setDay(d);
    setQueue(queueFor(d));
  };
  const [steps, setSteps] = useState<Step[]>([]);
  const [lastAnswer, setLastAnswer] = useState<Answer>('unsure');
  // A card leaves with the animation it had on its last render, so the direction is set first and the next
  // card comes a frame later. Taps in between are ignored.
  const moving = useRef(false);
  const then = (direction: Answer, next: () => void) => {
    moving.current = true;
    setLastAnswer(direction);
    requestAnimationFrame(() => {
      next();
      moving.current = false;
    });
  };

  if (!festival) return null;
  const done = steps.length >= queue.length;
  const artist = done ? undefined : catalog.artist(queue[steps.length]);

  const answer = (a: Answer) => {
    if (!artist || moving.current) return;
    if (a === 'love') haptic.tap();
    else if (a === 'pass') haptic.soft();
    else haptic.select();
    if (a !== 'unsure') rate(artist.id, a);
    const finished = steps.length + 1 >= queue.length;
    then(a, () => setSteps((s) => [...s, { id: artist.id, answer: a }]));
    if (finished) setTimeout(() => haptic.settle(), 250);
  };

  const undo = () => {
    const last = steps[steps.length - 1];
    if (!last || moving.current) return;
    haptic.select();
    if (last.answer !== 'unsure') rate(last.id, undefined);
    then('unsure', () => setSteps((s) => s.slice(0, -1)));
  };

  const loved = steps.filter((s) => s.answer === 'love').length;
  const exiting = reduceMotion
    ? undefined
    : lastAnswer === 'love'
      ? SlideOutRight.duration(260)
      : lastAnswer === 'pass'
        ? SlideOutLeft.duration(260)
        : FadeOut.duration(160);
  const tags = artist ? (Object.entries(artist.sound) as [SoundTag, number][]).sort((a, b) => b[1] - a[1]) : [];
  const match = artist && informed[artist.id] ? `${Math.round((taste[artist.id] ?? 0) * 100)}% match` : 'New to you';
  // A hint for artists you don't know: who they sound like among ones you love or strongly match (your answers here count too).
  const like = artist
    ? soundsLike(
        artist,
        catalog.artists,
        (a) => ratings[a.id] === 'love' || (!!informed[a.id] && (taste[a.id] ?? 0) >= TIER_AT.strong),
        similarity,
      )
    : [];
  const likeLine = like.length ? `Sounds like ${like.map((a) => a.name).join(' and ')}` : undefined;

  return (
    <View style={styles.root}>
      <NightSky />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        {steps.length > 0 ? (
          <Pressable onPress={undo} accessibilityRole="button" accessibilityLabel="Undo the last answer" hitSlop={12}>
            <Text style={styles.undo}>Undo</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <GlassCircleButton label="Close" onPress={() => router.back()}>
          <CloseIcon color={color.moon} />
        </GlassCircleButton>
      </View>

      <View style={styles.head}>
        <Text style={styles.title}>Tune your lineup</Text>
        <Text style={styles.sub}>
          {festival.name}
          {day ? ` · ${day}` : ''}
          {!done && queue.length > 0 ? ` · ${steps.length + 1} of ${queue.length}` : ''}
        </Text>
        {days.length > 0 && steps.length === 0 && (
          <View style={styles.dayChips}>
            <FilterChips
              inset={0}
              chips={[
                { key: undefined, label: 'All days', count: queueFor(undefined).length, accessibilityLabel: 'Tune every day' },
                ...days.map((d) => ({
                  key: d,
                  label: d,
                  count: queueFor(d).length,
                  accessibilityLabel: `Tune only ${d}, ${queueFor(d).length} to rate`,
                })),
              ]}
              value={day}
              onChange={pickDay}
            />
          </View>
        )}
        <View style={styles.track} accessible={false}>
          <View style={[styles.fill, { width: `${queue.length ? (steps.length / queue.length) * 100 : 100}%` }]} />
        </View>
      </View>

      <View style={styles.stage}>
        {artist ? (
          <Animated.View
            key={artist.id}
            entering={reduceMotion ? undefined : FadeInDown.duration(280)}
            exiting={exiting}
            style={styles.card}
            accessible
            accessibilityLabel={`${artist.name}. ${tags.map(([t]) => SOUND_LABEL[t]).join(', ') || 'Sound not known yet'}. ${match}.${likeLine ? ` ${likeLine}.` : ''}`}
          >
            <ArtistAvatar artist={artist} size={148} />
            <Text style={styles.name} numberOfLines={2}>
              {artist.name}
            </Text>
            <Text style={styles.match}>{match}</Text>
            {likeLine ? (
              <Text style={styles.like} numberOfLines={2}>
                {likeLine}
              </Text>
            ) : null}
            {tags.length > 0 && (
              <View style={styles.tags}>
                {tags.map(([tag]) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{SOUND_LABEL[tag]}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(320)} style={styles.card}>
            <HeartIcon color={color.glow} filled size={56} />
            <Text style={styles.name}>{queue.length === 0 ? 'All rated' : 'That’s everyone'}</Text>
            <Text style={styles.doneText}>
              {queue.length === 0
                ? day
                  ? `You’ve rated everyone playing ${day} at ${festival.name}.`
                  : `You’ve rated everyone on the ${festival.name} lineup.`
                : loved > 0
                  ? `You love ${loved} ${loved === 1 ? 'artist' : 'artists'} here. Your festival plan and My Sound have been updated.`
                  : 'Your festival plan and My Sound have been updated.'}
            </Text>
          </Animated.View>
        )}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space.xl }]}>
        {artist ? (
          <>
            <View style={styles.choices}>
              <Pressable
                onPress={() => answer('pass')}
                accessibilityRole="button"
                accessibilityLabel={`${artist.name} is not for me`}
                style={({ pressed }) => [styles.choice, styles.pass, pressed && styles.pressed]}
              >
                <Text style={styles.choiceText}>Not for me</Text>
              </Pressable>
              <Pressable
                onPress={() => answer('love')}
                accessibilityRole="button"
                accessibilityLabel={`Love ${artist.name}'s sound`}
                style={({ pressed }) => [styles.choice, styles.love, pressed && styles.pressed]}
              >
                <HeartIcon color={color.moon} filled size={18} />
                <Text style={[styles.choiceText, { color: color.moon }]}>Love</Text>
              </Pressable>
            </View>
            <View style={styles.lower}>
              <Pressable
                onPress={() => answer('unsure')}
                accessibilityRole="button"
                accessibilityLabel={`I don't know ${artist.name}. Skip without rating.`}
                hitSlop={10}
                style={({ pressed }) => [styles.unsure, pressed && styles.pressed]}
              >
                <Text style={styles.unsureText}>Don’t know them</Text>
              </Pressable>
              {/* Hear them first: opens YouTube, and this card is still here when you come back. */}
              <Pressable
                onPress={() => {
                  haptic.select();
                  const yt = listenLinks(artist.name)[0];
                  if (yt) Linking.openURL(yt.url).catch(() => {});
                }}
                accessibilityRole="link"
                accessibilityLabel={`Listen to ${artist.name} on YouTube`}
                hitSlop={10}
                style={({ pressed }) => [styles.unsure, pressed && styles.pressed]}
              >
                <Text style={[styles.unsureText, styles.listen]}>Listen on YouTube</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => (after === 'festival' ? router.replace(`/festival/${festival.id}`) : router.back())}
              accessibilityRole="button"
              style={({ pressed }) => [styles.choice, styles.love, styles.wide, pressed && styles.pressed]}
            >
              <Text style={[styles.choiceText, { color: color.moon }]}>See your festival</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic.select();
                router.navigate({ pathname: '/sound', params: { festival: festival.id } });
              }}
              accessibilityRole="button"
              accessibilityLabel={`See your sound at ${festival.name} on My Sound`}
              hitSlop={10}
              style={({ pressed }) => [styles.unsure, pressed && styles.pressed]}
            >
              <Text style={styles.unsureText}>See it on My Sound</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg },
  undo: { ...type.label, color: color.moonDim },
  head: { paddingHorizontal: space.xl, marginTop: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs, fontVariant: ['tabular-nums'] },
  track: { height: 2, borderRadius: 1, marginTop: space.lg, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  fill: { height: 2, backgroundColor: color.glow },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  card: { alignItems: 'center', width: '100%' },
  name: { ...type.largeTitle, color: color.moon, marginTop: space.xl, textAlign: 'center' },
  match: { ...type.headline, color: color.glow, marginTop: space.xs, fontVariant: ['tabular-nums'] },
  like: { ...type.body, color: color.moonDim, marginTop: space.xs, textAlign: 'center' },
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
  doneText: { ...type.body, color: color.moonDim, marginTop: space.sm, textAlign: 'center' },
  actions: { paddingHorizontal: space.xl, alignItems: 'center' },
  choices: { flexDirection: 'row', gap: space.md, alignSelf: 'stretch' },
  choice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pass: { backgroundColor: color.glass, borderColor: color.hairline },
  love: { backgroundColor: 'rgba(169,124,255,0.32)', borderColor: 'rgba(169,124,255,0.55)' },
  wide: { flex: 0, alignSelf: 'stretch' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  choiceText: { ...type.headline, color: color.moonDim },
  unsure: { marginTop: space.lg, paddingVertical: space.sm },
  unsureText: { ...type.label, color: color.moonFaint },
  lower: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
  listen: { color: color.moonDim },
  dayChips: { marginTop: space.md },
});
