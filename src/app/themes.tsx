import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { backdropOf, canUse } from '../features/profile/backdrops';
import { useStanding } from '../features/standing/useStanding';
import { ThemePreview, ThemeSwatch } from '../features/themes/ThemePreview';
import { type AppTheme, canUseTheme, themeChoices, themeOf } from '../features/themes/themes';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { reloadApp } from '../lib/reload';
import { useSocial } from '../state/social';
import { PALETTES, type ThemeId } from '../theme/palettes';
import { writeStoredTheme } from '../theme/storedTheme';
import { color, glowA, nightA, radius, space, THEME_ID, type } from '../theme/tokens';

/** How long the new theme's colours fill the screen before Afterglow starts again in them. */
const SWAP_MS = 650;

/**
 * App theme: a whole new look for Afterglow. A live little phone shows the
 * one you tap (its sky, accent, buttons and tab bar, with the profile
 * background that goes with it), then every theme as a swatch. Afterglow
 * and Aurora are free, the rest come with Plus (anyone can preview them),
 * and a theme made for you comes first. Putting one on can match your
 * profile background too, then Afterglow starts again in the new colours.
 * `?gift=1` opens it on a theme made for you.
 */
export default function ThemesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const { gift } = useLocalSearchParams<{ gift?: string }>();
  const social = useSocial();
  const uid = social.user?.uid;
  const me = social.profile;
  const plus = !!useStanding(uid)?.plus;
  const choices = themeChoices(uid);
  const giftTheme = gift ? choices.find((t) => t.only) : undefined;
  const [picked, setPicked] = useState<ThemeId>(giftTheme?.id ?? THEME_ID);
  const [match, setMatch] = useState(true);
  const [swapping, setSwapping] = useState<ThemeId>();

  const theme = themeOf(picked);
  const locked = !canUseTheme(theme, uid, plus);
  const changed = picked !== THEME_ID;
  const pairing = theme.backdrop ? backdropOf(theme.backdrop) : undefined;
  // Matching the profile only when there's a profile and its background is theirs to use.
  const canMatch = !!me && !!pairing && canUse(pairing, uid, plus) && me.backdrop !== pairing.id;

  const pageW = Math.min(width, 640);
  const inner = pageW - space.xl * 2;
  const previewW = Math.min(230, inner * 0.62);
  const cols = 3;
  const tileW = Math.floor((inner - space.md * (cols - 1)) / cols);
  const tileH = Math.round(tileW * 0.78);

  const pick = (id: ThemeId) => {
    haptic.select();
    setPicked(id);
  };

  const wear = async () => {
    if (!changed || swapping) return;
    if (locked) {
      showAlert('Part of Afterglow Plus', `${theme.name} comes with Afterglow Plus. Preview every theme here; Afterglow and Aurora are free.`);
      return;
    }
    if (!writeStoredTheme(picked)) {
      showAlert('Couldn’t change the theme', 'Try again in a moment.');
      return;
    }
    haptic.settle();
    if (match && canMatch && pairing) await social.setBackdrop(pairing.id).catch(() => {});
    setSwapping(picked);
    setTimeout(() => void reloadApp(), reduce ? 50 : SWAP_MS);
  };

  const title = giftTheme ? 'Made just for you' : 'App theme';
  return (
    <View style={styles.root}>
      <PageTitle title="App theme" />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 140, width: pageW }]}>
        {giftTheme ? <Text style={styles.kicker}>A GIFT</Text> : null}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.body}>
          {giftTheme
            ? `${giftTheme.name}: a look for your whole Afterglow, and nobody else's. Put it on, or keep looking.`
            : 'Change the colours of the whole app: the sky, the glow, buttons and the tab bar. Afterglow starts again in the new look.'}
        </Text>

        <View style={styles.previewRow}>
          <View accessible accessibilityLabel={`Preview of ${theme.name}: ${theme.about}`}>
            <ThemePreview key={picked} id={picked} width={previewW} />
          </View>
          <View style={styles.previewInfo}>
            <View style={[styles.glowDot, { backgroundColor: PALETTES[picked].glow, shadowColor: PALETTES[picked].glow }]} />
            <Text style={styles.name}>{theme.name}</Text>
            <Text style={styles.about}>{theme.about}</Text>
            {pairing ? <Text style={styles.pair}>With the {pairing.name} profile background</Text> : null}
            {tagOf(theme, uid, plus) ? <Text style={[styles.tagLine, theme.only ? styles.tagSpecial : styles.tagPlus]}>{tagOf(theme, uid, plus)}</Text> : null}
          </View>
        </View>

        <View style={[styles.grid, { gap: space.md }]}>
          {choices.map((t) => {
            const on = picked === t.id;
            const tag = tagOf(t, uid, plus);
            return (
              <Pressable
                key={t.id}
                onPress={() => pick(t.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${t.name}. ${t.only ? 'Made for you' : t.plus ? 'Plus' : 'Free'}${t.id === THEME_ID ? '. Your theme now' : ''}`}
                style={({ pressed }) => [{ width: tileW }, pressed && styles.pressed]}
              >
                <View style={[styles.tile, { height: tileH }, on && { borderColor: PALETTES[t.id].glow }]}>
                  <ThemeSwatch id={t.id} width={tileW} height={tileH} />
                  {tag ? (
                    <View style={[styles.tag, t.only ? styles.tagBgSpecial : styles.tagBgPlus]}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.tileLabel, on && styles.tileLabelOn]} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={styles.tileDetail} numberOfLines={1}>
                  {t.id === THEME_ID ? 'Now' : t.only ? 'Made for you' : t.plus ? 'Plus' : 'Free'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => router.push('/backdrop')} accessibilityRole="button" style={styles.rowLink}>
          <Text style={styles.link}>Just your profile background ›</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        {canMatch && changed && !locked ? (
          <View style={styles.matchRow}>
            <Text style={styles.matchText}>Match my profile background</Text>
            <Switch value={match} onValueChange={setMatch} accessibilityLabel="Match my profile background" trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }} />
          </View>
        ) : null}
        {locked && changed ? <Text style={styles.lockNote}>Part of Afterglow Plus. Preview it as much as you like.</Text> : null}
        <Pressable
          onPress={() => void wear()}
          disabled={!changed || !!swapping}
          accessibilityRole="button"
          accessibilityState={{ disabled: !changed || !!swapping }}
          style={({ pressed }) => [styles.primary, { backgroundColor: locked ? 'rgba(255,214,107,0.25)' : PALETTES[picked].glowDeep }, !changed && styles.dim, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{!changed ? 'This is your theme' : locked ? 'Comes with Plus' : `Put on ${theme.name}`}</Text>
        </Pressable>
      </View>

      {swapping ? (
        <Animated.View entering={reduce ? undefined : FadeIn.duration(SWAP_MS - 150)} style={[StyleSheet.absoluteFill, styles.swap, { backgroundColor: PALETTES[swapping].night }]} accessibilityLiveRegion="polite">
          <View style={[styles.swapGlow, { backgroundColor: PALETTES[swapping].glow, shadowColor: PALETTES[swapping].glow }]} />
          <Text style={styles.swapText}>Putting on {themeOf(swapping).name}…</Text>
          <ActivityIndicator color={PALETTES[swapping].glow} style={{ marginTop: space.lg }} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function tagOf(t: AppTheme, uid: string | undefined, plus: boolean): string | undefined {
  if (t.only) return '♥ Yours';
  if (t.plus) return canUseTheme(t, uid, plus) ? 'PLUS' : 'PLUS 🔒';
  return undefined;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { alignSelf: 'center', paddingHorizontal: space.xl },
  kicker: { ...type.caption, color: color.glow, letterSpacing: 2, marginBottom: space.xs },
  title: { ...type.largeTitle, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.xs, marginBottom: space.xl },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  previewInfo: { flex: 1 },
  glowDot: { width: 14, height: 14, borderRadius: 7, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, marginBottom: space.sm },
  name: { ...type.title, color: color.moon },
  about: { ...type.body, color: color.moonDim, marginTop: space.xs },
  pair: { ...type.caption, color: color.moonFaint, marginTop: space.sm },
  tagLine: { ...type.label, marginTop: space.sm },
  tagPlus: { color: '#FFD66B' },
  tagSpecial: { color: '#FF9EC7' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.xl },
  tile: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: color.nightRaised },
  tag: { position: 'absolute', top: 5, right: 5, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  tagBgPlus: { backgroundColor: 'rgba(255,214,107,0.92)' },
  tagBgSpecial: { backgroundColor: 'rgba(255,158,199,0.95)' },
  tagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3, color: '#1B1230' },
  tileLabel: { ...type.label, color: color.moonDim, marginTop: space.sm },
  tileLabelOn: { color: color.moon },
  tileDetail: { ...type.caption, color: color.moonFaint, marginBottom: space.sm },
  rowLink: { marginTop: space.lg, paddingVertical: space.sm },
  link: { ...type.label, color: color.glow },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.md, backgroundColor: nightA(0.96), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: glowA(0.18), alignItems: 'center' },
  matchRow: { alignSelf: 'stretch', maxWidth: 600, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  matchText: { ...type.body, color: color.moon },
  lockNote: { ...type.caption, color: '#FFD66B', marginBottom: space.sm },
  primary: { alignSelf: 'stretch', maxWidth: 600, height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...type.headline, color: color.moon },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  swap: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  swapGlow: { width: 44, height: 44, borderRadius: 22, shadowOpacity: 1, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, marginBottom: space.lg },
  swapText: { ...type.headline, color: color.moon },
});
