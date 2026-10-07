import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageTitle } from '../components/PageTitle';
import { WEB_URL } from '../config/app';
import { isSupportAccount } from '../features/admin/admin';
import { cleanTotem, DEFAULT_TOTEM, TOTEM_CODES_MAX, TOTEM_EVERY, TOTEM_SHOW, TOTEM_SUBTITLE_MAX, totemPopup, type TotemSettings } from '../features/admin/totem';
import { TotemOrb } from '../features/admin/TotemOrb';
import { findLink, lookOf, type Sticker } from '../features/finds/finds';
import { FriendQR } from '../features/friends/FriendQR';
import { OrgLogo } from '../features/organizers/OrgMark';
import { Collectible } from '../features/sprouts/Collectible';
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { goBack } from '../lib/nav';
import { useNow } from '../lib/useNow';
import { useOrgs } from '../state/orgs';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';

const STORAGE_KEY = 'totem.v1';
/** Controls show this long after a tap. */
const CONTROLS_MS = 6000;

/**
 * The totem (HQ only): a tablet at the festival, full screen. Afterglow's
 * mark (or an organizer's logo) and name, softly alive, and now and then a
 * sticker that pops up for anyone to scan and claim. Set up here (on this
 * device only), then Start. A tap shows its controls. The screen stays on.
 * The setup is in English, like the rest of HQ; what the crowd reads is
 * translated.
 */
export default function TotemScreen() {
  const social = useSocial();
  const [settings, setSettings] = useState<TotemSettings>(DEFAULT_TOTEM);
  const [stickers, setStickers] = useState<Sticker[]>();
  const [running, setRunning] = useState<number>();
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setSettings(cleanTotem(raw ? JSON.parse(raw) : undefined)))
      .catch(() => {});
  }, []);
  const { service } = social;
  const allowed = isSupportAccount(social.user);
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    service
      .stickers(200)
      .then((s) => live && setStickers(s))
      .catch(() => live && setStickers([]));
    return () => {
      live = false;
    };
  }, [allowed, service]);
  if (social.ready && !allowed) return <Redirect href="/" />;
  const save = (next: TotemSettings) => {
    const clean = cleanTotem(next);
    setSettings(clean);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clean)).catch(() => {});
  };
  return running !== undefined ? (
    <TotemShow settings={settings} stickers={stickers ?? []} start={running} onStop={() => setRunning(undefined)} />
  ) : (
    <TotemSetup settings={settings} stickers={stickers} onChange={save} onStart={(at) => setRunning(at)} />
  );
}

function TotemSetup({ settings, stickers, onChange, onStart }: { settings: TotemSettings; stickers?: Sticker[]; onChange: (s: TotemSettings) => void; onStart: (at: number) => void }) {
  const insets = useSafeAreaInsets();
  const orgs = useOrgs();
  const now = useNow();
  const chosen = new Set(settings.codes);
  const brands = [{ id: 'afterglow', name: 'Afterglow' }, ...orgs.map((o) => ({ id: o.id, name: o.name }))];
  return (
    <View style={styles.root}>
      <PageTitle title="Totem" />
      <NightSky />
      <ScrollView contentContainerStyle={[styles.setup, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxxl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.setupHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Afterglow HQ</Text>
            <Text style={styles.title}>Totem</Text>
          </View>
          <Pressable onPress={() => goBack()} accessibilityRole="button" style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
            <Text style={styles.pillText}>Back to HQ</Text>
          </Pressable>
        </View>
        <Text style={styles.body}>
          Turn this tablet into a totem for the festival: the logo and name full screen, and now and then a sticker pops up with a big code for anyone to scan and keep. It stays awake while it runs. These settings stay on this device.
        </Text>

        <Text style={styles.label}>Whose logo</Text>
        <View style={styles.chips}>
          {brands.map((b) => (
            <Pressable key={b.id} onPress={() => onChange({ ...settings, brand: b.id })} accessibilityRole="radio" accessibilityState={{ selected: settings.brand === b.id }} style={[styles.chip, settings.brand === b.id && styles.chipOn]}>
              <Text style={styles.chipText}>{b.name}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>A line under the name</Text>
        <TextInput
          value={settings.subtitle}
          onChangeText={(v) => onChange({ ...settings, subtitle: v.slice(0, TOTEM_SUBTITLE_MAX) })}
          placeholder="Lost Lands · Stage 3"
          placeholderTextColor={color.moonFaint}
          style={styles.input}
          accessibilityLabel="A line under the name"
          maxLength={TOTEM_SUBTITLE_MAX}
        />

        <Text style={styles.label}>Stickers it pops up ({settings.codes.length} chosen, in this order)</Text>
        {stickers === undefined ? (
          <Text style={styles.body}>Loading your stickers…</Text>
        ) : !stickers.length ? (
          <Text style={styles.body}>Make some stickers in HQ → Stickers first (the Portal potty is a good one).</Text>
        ) : (
          <View style={styles.stickerGrid}>
            {stickers.map((st) => {
              const on = chosen.has(st.code);
              const ended = st.until !== undefined && now.getTime() > st.until;
              return (
                <Pressable
                  key={st.code}
                  disabled={ended}
                  onPress={() => {
                    haptic.select();
                    const codes = on ? settings.codes.filter((c) => c !== st.code) : [...settings.codes, st.code].slice(0, TOTEM_CODES_MAX);
                    onChange({ ...settings, codes });
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: ended }}
                  accessibilityLabel={st.name}
                  style={[styles.stickerTile, on && styles.stickerOn, ended && { opacity: 0.4 }]}
                >
                  <Collectible look={lookOf(st.creature)} size={56} still />
                  <Text style={styles.stickerName} numberOfLines={2}>
                    {st.name}
                  </Text>
                  {on ? <Text style={styles.order}>{settings.codes.indexOf(st.code) + 1}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Pop one up every</Text>
        <View style={styles.chips}>
          {TOTEM_EVERY.map((m) => (
            <Pressable key={m} onPress={() => onChange({ ...settings, everyMin: m })} accessibilityRole="radio" accessibilityState={{ selected: settings.everyMin === m }} style={[styles.chip, settings.everyMin === m && styles.chipOn]}>
              <Text style={styles.chipText}>{m === 1 ? '1 minute' : `${m} minutes`}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>For</Text>
        <View style={styles.chips}>
          {TOTEM_SHOW.map((sec) => (
            <Pressable key={sec} onPress={() => onChange({ ...settings, showSec: sec })} accessibilityRole="radio" accessibilityState={{ selected: settings.showSec === sec }} style={[styles.chip, settings.showSec === sec && styles.chipOn]}>
              <Text style={styles.chipText}>{sec < 60 ? `${sec} seconds` : sec === 60 ? '1 minute' : `${sec / 60} minutes`}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => {
            haptic.celebrate();
            onStart(Date.now());
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.start, pressed && styles.pressed]}
        >
          <Text style={styles.startText}>Start the totem</Text>
        </Pressable>
        <Text style={styles.hint}>Tip: turn the tablet’s brightness up and auto-lock off. On the website, tap the screen once it’s running for Full screen. Tap it any time for its controls.</Text>
      </ScrollView>
    </View>
  );
}

/** Keeps the screen on while it's shown. */
function KeepOn() {
  useKeepAwake('afterglow-totem');
  return null;
}

function TotemShow({ settings, stickers, start, onStop }: { settings: TotemSettings; stickers: Sticker[]; start: number; onStop: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const now = useNow(1000).getTime();
  const orgs = useOrgs();
  const org = orgs.find((o) => o.id === settings.brand);
  const [controls, setControls] = useState<number>();
  const [nudge, setNudge] = useState<number>();
  const known = useMemo(() => new Map(stickers.map((s) => [s.code, s])), [stickers]);
  // Only stickers it still knows about (one HQ took down drops out).
  const live = useMemo(() => ({ ...settings, codes: settings.codes.filter((c) => known.has(c)) }), [settings, known]);
  const popup = totemPopup(live, start, now, nudge);
  const sticker = popup ? known.get(popup.code) : undefined;
  useEffect(() => {
    if (controls === undefined) return;
    const timer = setTimeout(() => setControls(undefined), CONTROLS_MS);
    return () => clearTimeout(timer);
  }, [controls]);
  const landscape = width > height;
  const short = Math.min(width, height);
  const mark = Math.round(short * (landscape ? 0.5 : 0.62));
  const name = org ? org.name : 'Afterglow';
  return (
    <View style={styles.show}>
      <KeepOn />
      <PageTitle title={name} />
      <NightSky />
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setControls(Date.now())} accessibilityRole="button" accessibilityLabel={t('Show the controls')}>
        <View style={[styles.stage, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
          {org ? <OrgLogo org={org} width={Math.round(short * 0.7)} /> : <TotemOrb size={mark} />}
          <Text style={[styles.word, { fontSize: Math.round(short * 0.085), letterSpacing: short * 0.02 }]} numberOfLines={1} adjustsFontSizeToFit>
            {name.toUpperCase()}
          </Text>
          {settings.subtitle ? <Text style={[styles.subtitle, { fontSize: Math.round(short * 0.034) }]}>{settings.subtitle}</Text> : null}
          <Text style={[styles.tagline, { fontSize: Math.round(short * 0.026) }]}>
            {live.codes.length ? t('Stay close: something to claim pops up here every few minutes.') : t('Find Afterglow stickers around the festival. Scan one to collect it.')}
          </Text>
          <Text style={[styles.site, { fontSize: Math.round(short * 0.022) }]}>{WEB_URL.replace(/^https?:\/\//, '')}</Text>
        </View>
      </Pressable>

      {popup && sticker ? (
        <Animated.View key={`${popup.code}${popup.index}`} entering={reduce ? undefined : FadeIn.duration(500)} exiting={reduce ? undefined : FadeOut.duration(400)} style={styles.popScrim} pointerEvents="box-none">
          <Animated.View entering={reduce ? undefined : SlideInDown.springify().damping(16)} exiting={reduce ? undefined : SlideOutDown.duration(400)} style={[styles.popCard, landscape ? styles.popRow : null, { width: Math.min(width - 2 * space.xl, landscape ? 900 : 560) }]}>
            <View style={styles.popSide}>
              <Text style={styles.popKicker}>{t('FREE COLLECTIBLE · SCAN TO CLAIM')}</Text>
              <Collectible look={lookOf(sticker.creature)} size={Math.round(short * (landscape ? 0.34 : 0.4))} />
              <Text style={[styles.popName, { fontSize: Math.round(short * 0.05) }]} numberOfLines={2}>
                {sticker.name}
              </Text>
              <Text style={styles.popTheme}>{lookOf(sticker.creature).theme}.</Text>
            </View>
            <View style={styles.popSide}>
              <FriendQR value={findLink(sticker)} size={Math.round(short * (landscape ? 0.42 : 0.5))} theme="glow" centre={(sz) => <Collectible look={lookOf(sticker.creature)} size={sz} still />} />
              <Text style={styles.popScan}>{t('Point your phone’s camera here')}</Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.max(0, Math.min(1, popup.left / live.showSec)) * 100}%` }]} />
              </View>
              <Text style={styles.popLeft}>{t('{n}s left', { n: popup.left })}</Text>
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}

      {controls !== undefined ? (
        <View style={[styles.controls, { top: insets.top + space.md }]}>
          {live.codes.length ? (
            <Pressable
              onPress={() => {
                haptic.tap();
                setNudge(Date.now());
                setControls(undefined);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
            >
              <Text style={styles.pillText}>Pop one now</Text>
            </Pressable>
          ) : null}
          {Platform.OS === 'web' ? (
            <Pressable
              onPress={() => {
                const doc = typeof document === 'undefined' ? undefined : document;
                void (doc?.fullscreenElement ? doc.exitFullscreen?.() : doc?.documentElement.requestFullscreen?.())?.catch(() => {});
                setControls(undefined);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
            >
              <Text style={styles.pillText}>Full screen</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              haptic.select();
              onStop();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.pill, styles.stop, pressed && styles.pressed]}
          >
            <Text style={styles.pillText}>Stop the totem</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/admin')} accessibilityRole="button" style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
            <Text style={styles.pillText}>HQ</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const GOLD = '#FFE58A';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  setup: { paddingHorizontal: space.xl, gap: space.sm, maxWidth: 760, width: '100%', alignSelf: 'center' },
  setupHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  kicker: { ...type.label, color: color.glow, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { ...type.largeTitle, color: color.moon },
  body: { ...type.body, color: color.moonDim },
  label: { ...type.headline, color: color.moon, marginTop: space.lg },
  hint: { ...type.caption, color: color.moonFaint, marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: color.hairline },
  chipOn: { borderColor: color.glow, backgroundColor: 'rgba(169,124,255,0.18)' },
  chipText: { ...type.label, color: color.moon },
  input: { ...type.body, color: color.moon, borderWidth: 1, borderColor: color.hairline, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stickerTile: { width: 96, alignItems: 'center', gap: 2, padding: space.xs, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
  stickerOn: { borderColor: GOLD, backgroundColor: 'rgba(255,229,138,0.08)' },
  stickerName: { ...type.caption, color: color.moonDim, textAlign: 'center' },
  order: { position: 'absolute', top: 2, right: 4, ...type.caption, fontWeight: '700', color: color.night, backgroundColor: GOLD, borderRadius: radius.pill, paddingHorizontal: 6, overflow: 'hidden' },
  start: { marginTop: space.xl, alignItems: 'center', paddingVertical: space.lg, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  startText: { ...type.title, color: color.moon },
  pill: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: 'rgba(20,16,36,0.85)', borderWidth: 1, borderColor: color.hairline },
  pillText: { ...type.label, color: color.moon },
  stop: { borderColor: '#FF7E8A' },
  pressed: { opacity: 0.8 },
  show: { flex: 1, backgroundColor: '#05040A' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xl },
  word: { color: color.moon, fontWeight: '800', textAlign: 'center', textShadowColor: '#A97CFF', textShadowRadius: 24 },
  subtitle: { color: GOLD, fontWeight: '600', textAlign: 'center', letterSpacing: 1 },
  tagline: { color: color.moonDim, textAlign: 'center', marginTop: space.lg, maxWidth: 900 },
  site: { color: color.moonFaint, letterSpacing: 2, textAlign: 'center' },
  popScrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(5,4,10,0.72)', alignItems: 'center', justifyContent: 'center' },
  popCard: { borderRadius: radius.lg * 1.5, padding: space.xl, gap: space.lg, alignItems: 'center', backgroundColor: 'rgba(24,18,44,0.96)', borderWidth: 2, borderColor: GOLD, shadowColor: GOLD, shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } },
  popRow: { flexDirection: 'row', justifyContent: 'space-around' },
  popSide: { alignItems: 'center', gap: space.sm, flexShrink: 1 },
  popKicker: { ...type.label, color: GOLD, letterSpacing: 2, textAlign: 'center' },
  popName: { color: color.moon, fontWeight: '800', textAlign: 'center' },
  popTheme: { ...type.body, color: color.moonDim, textAlign: 'center', maxWidth: 360 },
  popScan: { ...type.headline, color: color.moon, textAlign: 'center' },
  bar: { width: 240, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: GOLD },
  popLeft: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  controls: { position: 'absolute', right: space.lg, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'flex-end', zIndex: 20 },
});
