import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { CheckIcon } from '../components/TabIcons';
import { APP_NAME } from '../config/app';
import type { Festival } from '../data/types';
import { countdown } from '../features/festivals/when';
import { watchFestival, welcomeFestival } from '../features/welcome/firstRun';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { useWelcomed } from '../state/welcome';
import { color, radius, space, type } from '../theme/tokens';

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
  const { markWelcomed } = useWelcomed();
  const today = useToday();
  const [step, setStep] = useState<Step>('hello');

  const picked = welcomeFestival(catalog.festivals, going);

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
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Where are you going?</Text>
            <Text style={styles.sub}>Pick any you have tickets for, or are thinking about. You can change this later.</Text>
            <View style={styles.list}>
              {catalog.festivals.map((f) => {
                const on = isGoing(f.id);
                const soon = countdown(f, today);
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => {
                      if (on) haptic.select();
                      else haptic.tap();
                      toggle(f.id);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${f.name}, ${f.dates}, ${f.location}`}
                    style={({ pressed }) => [styles.festival, on && styles.festivalOn, pressed && { opacity: 0.8 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.festivalName}>{f.name}</Text>
                      <Text style={styles.festivalMeta}>
                        {f.dates}, {f.location}
                        {soon ? ` · ${soon}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on ? <CheckIcon color={color.moon} size={14} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : picked ? (
          <View style={styles.center}>
            <Text style={styles.title}>Tell us what you love</Text>
            <Text style={[styles.sub, styles.centerText]}>
              Go through the {picked.name} lineup one artist at a time: love their sound, not for me, or don’t know
              them. It takes a few minutes and shapes your whole plan.
            </Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.title}>Start with the sets</Text>
            <Text style={[styles.sub, styles.centerText]}>
              Like, save or skip clips and {APP_NAME} learns your sound. Double-tap a clip you love.
            </Text>
          </View>
        )}
      </Animated.View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space.xl }]}>
        {step === 'hello' ? (
          <Primary label="Get started" onPress={() => next('going')} />
        ) : step === 'going' ? (
          <Primary label={going.length ? 'Continue' : 'Not sure yet'} onPress={() => next('taste')} />
        ) : picked ? (
          <>
            <Primary label="Tune your lineup" onPress={() => tune(picked)} />
            <Secondary label="Start watching instead" onPress={startWatching} />
          </>
        ) : (
          <Primary label="Start watching" onPress={startWatching} />
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
  festivalOn: { backgroundColor: 'rgba(169,124,255,0.14)', borderColor: 'rgba(169,124,255,0.5)' },
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
    backgroundColor: 'rgba(169,124,255,0.28)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.6)',
  },
  primaryText: { ...type.headline, color: color.moon },
  secondary: { alignItems: 'center', paddingVertical: space.sm },
  secondaryText: { ...type.label, color: color.moonDim },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(243,240,255,0.2)' },
  dotOn: { backgroundColor: color.glow, width: 18 },
});
