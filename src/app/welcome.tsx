import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { SearchField } from '../components/SearchField';
import { CheckIcon } from '../components/TabIcons';
import { APP_NAME } from '../config/app';
import type { Festival } from '../data/types';
import { whereWhen } from '../features/festivals/format';
import { festivalShelf, isMany, pickerList } from '../features/festivals/shelves';
import { countdown } from '../features/festivals/when';
import { ROUNDS_MIN, thisOrThatPairs } from '../features/taste/thisOrThat';
import { watchFestival, welcomeFestival } from '../features/welcome/firstRun';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { useWeekends } from '../state/weekends';
import { FilterChips } from '../components/FilterChips';
import { runLabel } from '../features/festivals/weekend';
import { useLoves } from '../state/useLoves';
import { useWelcomed } from '../state/welcome';
import { color, radius, space, type, glowA } from '../theme/tokens';

type Step = 'hello' | 'going' | 'taste';
const STEPS: Step[] = ['hello', 'going', 'taste'];

/**
 * First run: what Afterglow is, which festivals you're going to, then
 * straight into rating that lineup (or just watching). Shown once; skippable
 * at every step.
 */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const catalog = useCatalog();
  const { going, isGoing, toggle } = useGoing();
  const { weekendOf, choose } = useWeekends();
  const { markWelcomed } = useWelcomed();
  const today = useToday();
  const [step, setStep] = useState<Step>('hello');

  const picked = welcomeFestival(catalog.festivals, going);
  // Many festivals: a search and a short list (your picks, then the soonest or best for you).
  const loves = useLoves();
  const many = isMany(catalog.festivals);
  const [query, setQuery] = useState('');
  const shelf = many ? festivalShelf(catalog.festivals, going, loves, today).festivals : [];
  const choices = many ? pickerList(catalog.festivals, going, query, shelf) : catalog.festivals;

  const next = (s: Step) => {
    haptic.select();
    setStep(s);
  };
  // Leave the welcome for good, landing in Discover (on your festival when it has clips).
  const startWatching = () => {
    haptic.tap();
    markWelcomed();
    const f = watchFestival(picked, catalog.clips);
    router.dismissTo(f ? { pathname: '/', params: { festival: f.id } } : '/');
  };
  // A grid of faces from the festivals you picked (or every festival), then Discover.
  const pickArtists = () => {
    haptic.tap();
    markWelcomed();
    router.replace({ pathname: '/pick-artists', params: { festivals: going.join(','), then: 'discover' } });
  };
  // This or that needs enough live sets to compare; until then picking artists leads.
  const canCompare = useMemo(
    () => thisOrThatPairs(catalog.clips, catalog.artist, { prefer: going }).length >= ROUNDS_MIN,
    [catalog, going],
  );
  const thisOrThat = () => {
    haptic.tap();
    markWelcomed();
    router.replace({ pathname: '/this-or-that', params: { then: 'discover' } });
  };
  const tune = (f: Festival) => {
    haptic.tap();
    markWelcomed();
    router.replace({ pathname: '/tune/[id]', params: { id: f.id, then: 'festival' } });
  };

  return (
    <View style={styles.root}>
      <NightSky />
      <View style={[styles.top, { paddingTop: insets.top + space.md }]}>
        <Pressable
          onPress={startWatching}
          accessibilityRole="button"
          accessibilityLabel="Skip the welcome"
          hitSlop={12}
        >
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <Animated.View key={step} entering={reduceMotion ? undefined : FadeIn.duration(360)} style={styles.body}>
        {step === 'hello' ? (
          <View style={styles.center}>
            <Text style={styles.brand}>{APP_NAME}</Text>
            <Text style={styles.lead}>
              Live sets from the festivals you’re going to, and a plan built from the sound you love.
            </Text>
          </View>
        ) : step === 'going' ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text style={styles.title}>Where are you going?</Text>
            <Text style={styles.sub}>Pick any you have tickets for, or are thinking about. You can change this later.</Text>
            {many && (
              <View style={styles.search}>
                <SearchField value={query} onChange={setQuery} placeholder="Find your festival" label="Find your festival" />
              </View>
            )}
            {many && query.trim() !== '' && choices.length === 0 ? (
              <Text style={styles.sub}>No festival matches “{query.trim()}” yet.</Text>
            ) : null}
            <View style={styles.list}>
              {choices.map((f) => {
                const on = isGoing(f.id);
                const soon = countdown(f, today);
                return (
                  <View key={f.id}>
                    <Pressable
                      onPress={() => {
                        if (on) haptic.select();
                        else haptic.tap();
                        toggle(f.id);
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${f.name}, ${whereWhen(f)}`}
                      style={({ pressed }) => [styles.festival, on && styles.festivalOn, pressed && { opacity: 0.8 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.festivalName}>{f.name}</Text>
                        <Text style={styles.festivalMeta}>
                          {whereWhen(f)}
                          {soon ? ` · ${soon}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.check, on && styles.checkOn]}>
                        {on ? <CheckIcon color={color.moon} size={14} /> : null}
                      </View>
                    </Pressable>
                    {/* Two weekends: which one, so the plan and reminders follow it from the start. */}
                    {on && f.weekends && f.weekends.length > 1 ? (
                      <View style={styles.weekend}>
                        <FilterChips
                          inset={0}
                          chips={[
                            { key: undefined, label: 'Every weekend', accessibilityLabel: `Every weekend of ${f.name}` },
                            ...f.weekends.map((r, i) => ({
                              key: String(i + 1),
                              label: `Weekend ${i + 1} · ${runLabel(r)}`,
                              accessibilityLabel: `Weekend ${i + 1} of ${f.name}, ${runLabel(r)}`,
                            })),
                          ]}
                          value={weekendOf(f.id) ? String(weekendOf(f.id)) : undefined}
                          onChange={(k) => choose(f.id, k ? Number(k) : undefined)}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : picked ? (
          <View style={styles.center}>
            <Text style={styles.title}>Tell us what you love</Text>
            <Text style={[styles.sub, styles.centerText]}>
              {canCompare
                ? 'Play this or that: two live sets at a time, tap the one you’d rather hear. A minute, and your sound takes shape. Or tap the artists you love.'
                : `Tap the artists you love from ${going.length > 1 ? 'your festivals' : picked.name}. It takes seconds and shapes your whole plan. Or go through the lineup one artist at a time.`}
            </Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.title}>Tell us what you love</Text>
            <Text style={[styles.sub, styles.centerText]}>
              {canCompare
                ? `Play this or that: two live sets at a time, tap the one you’d rather hear, and ${APP_NAME} learns your sound in a minute. Or tap the artists you love.`
                : `Tap the artists you love and ${APP_NAME} learns your sound. Or start with the sets: like, save or skip clips.`}
            </Text>
          </View>
        )}
      </Animated.View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space.xl }]}>
        {step === 'hello' ? (
          <Primary label="Get started" onPress={() => next('going')} />
        ) : step === 'going' ? (
          <Primary label={going.length ? 'Continue' : 'Not sure yet'} onPress={() => next('taste')} />
        ) : canCompare ? (
          <>
            <Primary label="Play this or that" onPress={thisOrThat} />
            <Secondary label="Pick artists you know" onPress={pickArtists} />
            {picked ? (
              <Secondary label="Rate the lineup one by one" onPress={() => tune(picked)} />
            ) : (
              <Secondary label="Start watching instead" onPress={startWatching} />
            )}
          </>
        ) : picked ? (
          <>
            <Primary label="Pick artists you know" onPress={pickArtists} />
            <Secondary label="Rate the lineup one by one" onPress={() => tune(picked)} />
          </>
        ) : (
          <>
            <Primary label="Pick artists you know" onPress={pickArtists} />
            <Secondary label="Start watching instead" onPress={startWatching} />
          </>
        )}
        <View style={styles.dots} accessibilityLabel={`Step ${STEPS.indexOf(step) + 1} of ${STEPS.length}`}>
          {STEPS.map((s) => (
            <View key={s} style={[styles.dot, s === step && styles.dotOn]} />
          ))}
        </View>
      </View>
    </View>
  );
}

function Primary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function Secondary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={10} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.6 }]}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.xl },
  skip: { ...type.label, color: color.moonDim },
  body: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.xxl },
  centerText: { textAlign: 'center' },
  brand: { ...type.largeTitle, fontSize: 44, lineHeight: 50, color: color.moon, letterSpacing: -1.2 },
  lead: { ...type.body, fontSize: 17, lineHeight: 24, color: color.moonDim, textAlign: 'center', marginTop: space.lg },
  scroll: { paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xl },
  title: { ...type.largeTitle, color: color.moon, textAlign: 'center' },
  sub: { ...type.body, color: color.moonDim, marginTop: space.sm, textAlign: 'center' },
  list: { marginTop: space.xl, gap: space.md },
  search: { marginTop: space.xl },
  festival: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  festivalOn: { backgroundColor: glowA(0.14), borderColor: glowA(0.5) },
  festivalName: { ...type.headline, color: color.moon },
  festivalMeta: { ...type.caption, color: color.moonDim, marginTop: 2 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: color.moonFaint,
  },
  checkOn: { backgroundColor: color.glowDeep, borderColor: color.glow },
  actions: { paddingHorizontal: space.xl, gap: space.md, alignItems: 'stretch' },
  primary: {
    alignItems: 'center',
    paddingVertical: space.lg,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.28),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.6),
  },
  primaryText: { ...type.headline, color: color.moon },
  secondary: { alignItems: 'center', paddingVertical: space.sm },
  secondaryText: { ...type.label, color: color.moonDim },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(243,240,255,0.2)' },
  dotOn: { backgroundColor: color.glow, width: 18 },
  weekend: { marginTop: space.sm, marginBottom: space.xs },
});
