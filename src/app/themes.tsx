import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { reloadApp } from '../lib/reload';
import { useSocial } from '../state/social';
import { useSprouts } from '../state/sprouts';
import { PALETTES, type ThemeId } from '../theme/palettes';
import { writeStoredGlass, writeStoredTheme } from '../theme/storedTheme';
import { color, GLASS, radius, space, THEME_ID, type } from '../theme/tokens';
import { BottomFade } from '../components/BottomFade';
import { PageFeedback } from '../components/PageFeedback';

/** How long the new theme's colours fill the screen before Afterglow starts again in them. */
const SWAP_MS = 650;

/**
 * App theme: a whole new look for Afterglow. A live little phone shows the
 * one you tap (its sky, accent, buttons and tab bar, with the profile
 * background that goes with it), then every theme as a swatch. Afterglow
 * and Aurora are free, the rest come with Plus (anyone can preview them),
 * and a theme made for you comes first. Putting one on can match your
 * profile background too, then Afterglow starts again in the new colours.
 * `?gift=1` opens it on a theme made for you; `?gift=<theme>` on a gift theme
 * that came with a sprout (`&wear=1` puts it on by itself: a brand-new account).
 */
export default function ThemesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const { gift, wear: wearParam } = useLocalSearchParams<{ gift?: string; wear?: string }>();
  const social = useSocial();
  const uid = social.user?.uid;
  const me = social.profile;
  const plus = !!useStanding(uid)?.plus;
  const given = useSprouts().giftThemes;
  const gifts = given.map((g) => g.theme);
  const choices = themeChoices(uid, gifts);
  const giftTheme = gift === '1' ? choices.find((x) => x.only) : gift ? choices.find((x) => x.gift && x.id === gift) : undefined;
  // Who gave it (a gift theme that came with a sprout).
  const givenBy = giftTheme?.gift ? given.find((g) => g.theme === giftTheme.id)?.handle : undefined;
  const [picked, setPicked] = useState<ThemeId>(giftTheme?.id ?? THEME_ID);
  const [match, setMatch] = useState(true);
  const [swapping, setSwapping] = useState<ThemeId>();

  const theme = themeOf(picked);
  const locked = !canUseTheme(theme, uid, plus, gifts);
  const changed = picked !== THEME_ID;
  const pairing = theme.backdrop ? backdropOf(theme.backdrop) : undefined;
  // Matching the profile only when there's a profile and its background is theirs to use.
  const canMatch = !!me && !!pairing && canUse(pairing, uid, plus, gifts) && me.backdrop !== pairing.id;

  const pageW = Math.min(width, 640);
  const inner = pageW - space.xl * 2;
  const previewW = Math.min(230, inner * 0.62);
  const cols = 3;
  const tileW = Math.floor((inner - space.md * (cols - 1)) / cols);
  const tileH = Math.round(tileW * 0.78);

  // Liquid Glass: free with every theme, off unless chosen; like a theme, it goes on as Afterglow starts again.
  const [glassOn, setGlassOn] = useState(GLASS);
  const switchGlass = (on: boolean) => {
    if (!writeStoredGlass(on)) {
      showAlert(t('Couldn’t change the look'), t('Try again in a moment.'));
      return;
    }
    haptic.settle();
    setGlassOn(on);
    setTimeout(() => void reloadApp(t('Liquid Glass')), reduce ? 50 : 400);
  };

  const pick = (id: ThemeId) => {
    haptic.select();
    setPicked(id);
  };

  const wear = async () => {
    if (!changed || swapping) return;
    if (locked) {
      showAlert(t('Part of Afterglow Plus'), t('{theme} comes with Afterglow Plus. Preview every theme here; Afterglow, Aurora and Pride are free.', { theme: theme.name }));
      return;
    }
    if (!writeStoredTheme(picked)) {
      showAlert(t('Couldn’t change the theme'), t('Try again in a moment.'));
      return;
    }
    haptic.settle();
    if (match && canMatch && pairing) await social.setBackdrop(pairing.id).catch(() => {});
    setSwapping(picked);
    setTimeout(() => void reloadApp(), reduce ? 50 : SWAP_MS);
  };

  // A brand-new account given a theme with its sprout: it goes on by itself, after a moment to see it.
  const autoWear = wearParam === '1' && !!giftTheme?.gift && giftTheme.id === picked && changed && !locked;
  const wearRef = useRef(wear);
  useEffect(() => {
    wearRef.current = wear;
  });
  useEffect(() => {
    if (!autoWear) return;
    const timer = setTimeout(() => void wearRef.current(), reduce ? 400 : 1800);
    return () => clearTimeout(timer);
  }, [autoWear, reduce]);

  const title = giftTheme?.gift ? (givenBy ? t('A gift from @{handle}', { handle: givenBy }) : t('A gift for you')) : giftTheme ? t('Made just for you') : t('App theme');
  return (
    <View style={styles.root}>
      <PageTitle title={t('App theme')} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 140, width: pageW }]}>
        {giftTheme ? <Text style={styles.kicker}>{t('A GIFT')}</Text> : null}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.body}>
          {giftTheme?.gift
            ? autoWear
              ? t('{theme} came with your sprout: a look for the whole app, and a profile background to match. Putting it on now.', { theme: giftTheme.name })
              : t('{theme} came with your sprout: a look for the whole app, and a profile background to match. Put it on, or keep looking.', { theme: giftTheme.name })
            : giftTheme
            ? t("{theme}: a look for your whole Afterglow, and nobody else's. Put it on, or keep looking.", { theme: giftTheme.name })
            : t('Change the colours of the whole app: the sky, the glow, buttons and the tab bar. Afterglow starts again in the new look.')}
        </Text>

        <View style={styles.previewRow}>
          <View accessible accessibilityLabel={t('Preview of {theme}: {about}', { theme: theme.name, about: theme.about })}>
            <ThemePreview key={picked} id={picked} width={previewW} />
          </View>
          <View style={styles.previewInfo}>
            <View style={[styles.glowDot, { backgroundColor: PALETTES[picked].glow, shadowColor: PALETTES[picked].glow }]} />
            <Text style={styles.name}>{theme.name}</Text>
            <Text style={styles.about}>{theme.about}</Text>
            {pairing ? <Text style={styles.pair}>{t('With the {backdrop} profile background', { backdrop: pairing.name })}</Text> : null}
            {tagOf(theme, uid, plus, gifts) ? <Text style={[styles.tagLine, theme.only || theme.gift ? styles.tagSpecial : styles.tagPlus]}>{tagOf(theme, uid, plus, gifts)}</Text> : null}
          </View>
        </View>

        <View style={[styles.grid, { gap: space.md }]}>
          {choices.map((th) => {
            const on = picked === th.id;
            const tag = tagOf(th, uid, plus, gifts);
            const kind = th.only ? t('Made for you') : th.gift ? t('Gift') : th.plus ? t('Plus') : t('Free');
            return (
              <Pressable
                key={th.id}
                onPress={() => pick(th.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={th.id === THEME_ID ? t('{theme}. {kind}. Your theme now', { theme: th.name, kind }) : t('{theme}. {kind}', { theme: th.name, kind })}
                style={({ pressed }) => [{ width: tileW }, pressed && styles.pressed]}
              >
                <View style={[styles.tile, { height: tileH }, on && { borderColor: PALETTES[th.id].glow }]}>
                  <ThemeSwatch id={th.id} width={tileW} height={tileH} />
                  {tag ? (
                    <View style={[styles.tag, th.only || th.gift ? styles.tagBgSpecial : styles.tagBgPlus]}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.tileLabel, on && styles.tileLabelOn]} numberOfLines={1}>
                  {th.name}
                </Text>
                <Text style={styles.tileDetail} numberOfLines={1}>
                  {th.id === THEME_ID ? t('Now') : kind}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.glassRow}>
          <View style={styles.glassText}>
            <Text style={styles.glassTitle}>{t('Liquid Glass')}</Text>
            <Text style={styles.glassAbout}>{t('Glassy buttons, bars and sheets that catch the light. Free with every theme. Afterglow starts again in the new look.')}</Text>
          </View>
          <Switch value={glassOn} onValueChange={switchGlass} accessibilityLabel={t('Liquid Glass')} trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }} />
        </View>

        <Pressable onPress={() => router.push('/backdrop')} accessibilityRole="button" style={styles.rowLink}>
          <Text style={styles.link}>{t('Just your profile background ›')}</Text>
        </Pressable>
        <PageFeedback />
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <BottomFade />
        {canMatch && changed && !locked ? (
          <View style={styles.matchRow}>
            <Text style={styles.matchText}>{t('Match my profile background')}</Text>
            <Switch value={match} onValueChange={setMatch} accessibilityLabel={t('Match my profile background')} trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }} />
          </View>
        ) : null}
        {locked && changed ? <Text style={styles.lockNote}>{t('Part of Afterglow Plus. Preview it as much as you like.')}</Text> : null}
        <Pressable
          onPress={() => void wear()}
          disabled={!changed || !!swapping}
          accessibilityRole="button"
          accessibilityState={{ disabled: !changed || !!swapping }}
          style={({ pressed }) => [styles.primary, { backgroundColor: locked ? 'rgba(255,214,107,0.25)' : PALETTES[picked].glowDeep }, !changed && styles.dim, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{!changed ? t('This is your theme') : locked ? t('Comes with Plus') : t('Put on {theme}', { theme: theme.name })}</Text>
        </Pressable>
      </View>

      {swapping ? (
        <Animated.View entering={reduce ? undefined : FadeIn.duration(SWAP_MS - 150)} style={[StyleSheet.absoluteFill, styles.swap, { backgroundColor: PALETTES[swapping].night }]} accessibilityLiveRegion="polite">
          <View style={[styles.swapGlow, { backgroundColor: PALETTES[swapping].glow, shadowColor: PALETTES[swapping].glow }]} />
          <Text style={styles.swapText}>{t('Putting on {theme}…', { theme: themeOf(swapping).name })}</Text>
          <ActivityIndicator color={PALETTES[swapping].glow} style={{ marginTop: space.lg }} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function tagOf(th: AppTheme, uid: string | undefined, plus: boolean, gifts: readonly string[]): string | undefined {
  if (th.only) return t('♥ Yours');
  if (th.gift) return canUseTheme(th, uid, plus, gifts) ? t('♥ Gift') : undefined;
  if (th.plus) return canUseTheme(th, uid, plus) ? 'PLUS' : 'PLUS 🔒';
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
  glassRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xl, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  glassText: { flex: 1, gap: 2 },
  glassTitle: { ...type.headline, color: color.moon },
  glassAbout: { ...type.caption, color: color.moonDim },
  link: { ...type.label, color: color.glow },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.md, alignItems: 'center' },
  matchRow: { alignSelf: 'stretch', maxWidth: 600, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  matchText: { ...type.body, color: color.moon },
  lockNote: { ...type.caption, color: '#FFD66B', marginBottom: space.sm },
  primary: { alignSelf: 'center', width: '100%', maxWidth: 600, height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...type.headline, color: color.moon },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  swap: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  swapGlow: { width: 44, height: 44, borderRadius: 22, shadowOpacity: 1, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, marginBottom: space.lg },
  swapText: { ...type.headline, color: color.moon },
});
