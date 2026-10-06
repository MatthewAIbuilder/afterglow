import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { isCold, isWarm, RATING_LABEL, type Rating } from '../../features/taste/ratings';
import { ratingA11y } from '../../features/taste/RateArtist';
import { haptic } from '../../lib/haptics';
import { AnswerPop, DoneBurst, MilestonePill, TUNE_MILESTONE } from '../../features/tune/TuneFeedback';
import { useCatalog } from '../../state/catalog';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { useWeekends } from '../../state/weekends';
import { FilterChips } from '../../components/FilterChips';
import { lineupDays, playsOn } from '../../features/festivals/days';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { goBack } from '../../lib/nav';
import { dayWord, t, tn } from '../../i18n';

type Answer = Rating | 'unsure';

/** The five answers: warm ones on top, OK in the middle, cold ones below. */
const ANSWER_ROWS: Rating[][] = [
  ['love', 'like'],
  ['ok'],
  ['meh', 'pass'],
];

/** "You love 2 and like 5 artists here." */
function favouritesLine(loved: number, liked: number): string {
  // Both together are always two or more.
  if (loved && liked) return t('You love {loved} and like {liked} artists here.', { loved, liked });
  return loved ? tn(loved, 'You love {n} artist here.', 'You love {n} artists here.') : tn(liked, 'You like {n} artist here.', 'You like {n} artists here.');
}
type Step = { id: string; answer: Answer };

/**
 * Tune your lineup: a festival's artists one at a time. Love their sound,
 * not for me, or don't know them. Every answer reshapes your match, your
 * festival plan and My Sound; "don't know" changes nothing.
 */
export default function TuneScreen() {
  // Short phones (iPhone SE and the like): a smaller photo and name, so the card fits above the answers.
  const screenH = useWindowDimensions().height;
  const compact = screenH < 700;
  const tiny = screenH < 620;
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
    if (isWarm(a === 'unsure' ? undefined : a)) haptic.tap();
    else if (isCold(a === 'unsure' ? undefined : a)) haptic.soft();
    else haptic.select();
    if (a !== 'unsure') rate(artist.id, a);
    const finished = steps.length + 1 >= queue.length;
    then(a, () => setSteps((s) => [...s, { id: artist.id, answer: a }]));
    // Every tenth answer: a little celebration.
    const answered = steps.length + 1;
    if (answered % TUNE_MILESTONE === 0 && !finished) setTimeout(() => haptic.celebrate(), 200);
    if (finished) setTimeout(() => haptic.celebrate(), 250);
  };

  const undo = () => {
    const last = steps[steps.length - 1];
    if (!last || moving.current) return;
    haptic.select();
    if (last.answer !== 'unsure') rate(last.id, undefined);
    then('unsure', () => setSteps((s) => s.slice(0, -1)));
  };

  const loved = steps.filter((s) => s.answer === 'love').length;
  const liked = steps.filter((s) => s.answer === 'like').length;
  // Warm answers leave to the right, cold ones to the left, "They're OK" and "Don't know" fade.
  const exiting = reduceMotion
    ? undefined
    : lastAnswer === 'love' || lastAnswer === 'like'
      ? SlideOutRight.duration(260)
      : lastAnswer === 'pass' || lastAnswer === 'meh'
        ? SlideOutLeft.duration(260)
        : FadeOut.duration(160);
  const tags = artist ? (Object.entries(artist.sound) as [SoundTag, number][]).sort((a, b) => b[1] - a[1]) : [];
  const match = artist && informed[artist.id] ? t('{n}% match', { n: Math.round((taste[artist.id] ?? 0) * 100) }) : t('New to you');
  // A hint for artists you don't know: who they sound like among ones you love or strongly match (your answers here count too).
  const like = artist
    ? soundsLike(
        artist,
        catalog.artists,
        (a) => isWarm(ratings[a.id]) || (!isCold(ratings[a.id]) && !!informed[a.id] && (taste[a.id] ?? 0) >= TIER_AT.strong),
        similarity,
      )
    : [];
  // At most two.
  const likeLine = like.length
    ? like.length === 1
      ? t('Sounds like {artist}', { artist: like[0].name })
      : t('Sounds like {artist1} and {artist2}', { artist1: like[0].name, artist2: like[1].name })
    : undefined;

  return (
    <View style={styles.root}>
      <NightSky />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        {steps.length > 0 ? (
          <Pressable onPress={undo} accessibilityRole="button" accessibilityLabel={t('Undo the last answer')} hitSlop={12}>
            <Text style={styles.undo}>{t('Undo')}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <GlassCircleButton label={t('Close')} onPress={() => goBack()}>
          <CloseIcon color={color.moon} />
        </GlassCircleButton>
      </View>

      <View style={[styles.head, tiny && { marginTop: space.xs }]}>
        <Text style={[styles.title, tiny && styles.titleTiny]}>{t('Tune your lineup')}</Text>
        <Text style={styles.sub}>
          {festival.name}
          {day ? ` · ${t(day)}` : ''}
          {!done && queue.length > 0 ? ` · ${t('{n} of {total}', { n: steps.length + 1, total: queue.length })}` : ''}
        </Text>
        {days.length > 0 && steps.length === 0 && (
          <View style={styles.dayChips}>
            <FilterChips
              inset={0}
              chips={[
                { key: undefined, label: t('All days'), count: queueFor(undefined).length, accessibilityLabel: t('Tune every day') },
                ...days.map((d) => ({
                  key: d,
                  label: t(d),
                  count: queueFor(d).length,
                  accessibilityLabel: t('Tune only {day}, {n} to rate', { day: dayWord(d), n: queueFor(d).length }),
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
        {steps.length > 0 && steps.length % TUNE_MILESTONE === 0 && !done ? <MilestonePill key={`ms-${steps.length}`} count={steps.length} /> : null}
        {artist ? (
          <Animated.View
            key={artist.id}
            entering={reduceMotion ? undefined : FadeInDown.duration(280)}
            exiting={exiting}
            style={styles.card}
            accessible
            accessibilityLabel={`${t('{artist}. {sounds}. {match}.', { artist: artist.name, sounds: tags.map(([tag]) => SOUND_LABEL[tag]).join(', ') || t('Sound not known yet'), match })}${likeLine ? ` ${likeLine}.` : ''}`}
          >
            <ArtistAvatar artist={artist} size={tiny ? 60 : compact ? 92 : 148} />
            <Text style={[styles.name, compact && styles.nameCompact, tiny && styles.nameTiny]} numberOfLines={2}>
              {artist.name}
            </Text>
            <Text style={styles.match}>{match}</Text>
            {likeLine ? (
              <Text style={styles.like} numberOfLines={2}>
                {likeLine}
              </Text>
            ) : null}
            {tags.length > 0 && !tiny && (
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
            {queue.length > 0 ? <DoneBurst /> : null}
            <HeartIcon color={color.glow} filled size={56} />
            <Text style={styles.name}>{queue.length === 0 ? t('All rated') : t('That’s everyone')}</Text>
            <Text style={styles.doneText}>
              {queue.length === 0
                ? day
                  ? t('You’ve rated everyone playing {day} at {festival}.', { day: dayWord(day), festival: festival.name })
                  : t('You’ve rated everyone on the {festival} lineup.', { festival: festival.name })
                : loved + liked > 0
                  ? `${favouritesLine(loved, liked)} ${t('Your festival plan and My Sound have been updated.')}`
                  : t('Your festival plan and My Sound have been updated.')}
            </Text>
          </Animated.View>
        )}
        {steps.length > 0 ? <AnswerPop key={`pop-${steps.length}`} answer={steps[steps.length - 1].answer} /> : null}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space.xl }]}>
        {artist ? (
          <>
            <View style={styles.choices}>
              {ANSWER_ROWS.map((row) => (
                <View key={row.join()} style={styles.choiceRow}>
                  {row.map((r) => {
                    const warm = isWarm(r);
                    return (
                      <Pressable
                        key={r}
                        onPress={() => answer(r)}
                        accessibilityRole="button"
                        accessibilityLabel={ratingA11y(r, artist.name, false)}
                        style={({ pressed }) => [styles.choice, warm ? styles.love : styles.pass, r === 'love' && styles.loveStrong, pressed && styles.pressed]}
                      >
                        {r === 'love' ? <HeartIcon color={color.moon} filled size={16} /> : null}
                        <Text style={[styles.choiceText, warm && { color: color.moon }]} numberOfLines={1}>
                          {RATING_LABEL[r]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            <View style={[styles.lower, tiny && { marginTop: -space.sm }]}>
              <Pressable
                onPress={() => answer('unsure')}
                accessibilityRole="button"
                accessibilityLabel={t("I don't know {artist}. Skip without rating.", { artist: artist.name })}
                hitSlop={10}
                style={({ pressed }) => [styles.unsure, pressed && styles.pressed]}
              >
                <Text style={styles.unsureText}>{t('Don’t know them')}</Text>
              </Pressable>
              {/* Hear them first: opens YouTube, and this card is still here when you come back. */}
              <Pressable
                onPress={() => {
                  haptic.select();
                  const yt = listenLinks(artist.name)[0];
                  if (yt) Linking.openURL(yt.url).catch(() => {});
                }}
                accessibilityRole="link"
                accessibilityLabel={t('Listen to {artist} on YouTube', { artist: artist.name })}
                hitSlop={10}
                style={({ pressed }) => [styles.unsure, pressed && styles.pressed]}
              >
                <Text style={[styles.unsureText, styles.listen]}>{t('Listen on YouTube')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => (after === 'festival' ? router.replace(`/festival/${festival.id}`) : goBack())}
              accessibilityRole="button"
              style={({ pressed }) => [styles.choice, styles.love, styles.wide, pressed && styles.pressed]}
            >
              <Text style={[styles.choiceText, { color: color.moon }]}>{t('See your festival')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic.select();
                router.navigate({ pathname: '/sound', params: { festival: festival.id } });
              }}
              accessibilityRole="button"
              accessibilityLabel={t('See your sound at {festival} on My Sound', { festival: festival.name })}
              hitSlop={10}
              style={({ pressed }) => [styles.unsure, pressed && styles.pressed]}
            >
              <Text style={styles.unsureText}>{t('See it on My Sound')}</Text>
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
  titleTiny: { fontSize: 26, lineHeight: 31 },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs, fontVariant: ['tabular-nums'] },
  track: { height: 2, borderRadius: 1, marginTop: space.lg, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  fill: { height: 2, backgroundColor: color.glow },
  // The card never spills over the answers: on a short screen it shrinks, and anything left is clipped.
  stage: { flex: 1, minHeight: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  card: { alignItems: 'center', width: '100%' },
  name: { ...type.largeTitle, color: color.moon, marginTop: space.xl, textAlign: 'center' },
  nameCompact: { fontSize: 24, lineHeight: 28, marginTop: space.md },
  nameTiny: { fontSize: 21, lineHeight: 25, marginTop: space.sm },
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
  choices: { gap: space.sm, alignSelf: 'stretch' },
  choiceRow: { flexDirection: 'row', gap: space.sm },
  choice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 44,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pass: { backgroundColor: color.glass, borderColor: color.hairline },
  love: { backgroundColor: glowA(0.2), borderColor: glowA(0.45) },
  loveStrong: { backgroundColor: glowA(0.34), borderColor: glowA(0.6) },
  wide: { flex: 0, alignSelf: 'stretch' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  choiceText: { ...type.headline, color: color.moonDim },
  unsure: { marginTop: space.lg, paddingVertical: space.sm },
  unsureText: { ...type.label, color: color.moonFaint },
  lower: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
  listen: { color: color.moonDim },
  dayChips: { marginTop: space.md },
});
