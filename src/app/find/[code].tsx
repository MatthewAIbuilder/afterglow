import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfettiBurst } from '../../components/ConfettiBurst';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { CloseIcon } from '../../components/TabIcons';
import { APP_STORE_URL } from '../../config/app';
import { findCardFrom, findLine, huntLine, lookOf, untilLine } from '../../features/finds/finds';
import { HuntRow } from '../../features/finds/HuntRow';
import { accountsOff } from '../../features/social/unavailable';
import { Collectible } from '../../features/sprouts/Collectible';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { goBack } from '../../lib/nav';
import { useFinds } from '../../state/finds';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * A sticker you found: what you see after scanning its code, in the app or
 * (with a phone's own camera) on the website. Opening it keeps it. It shows
 * as a grey figure until Afterglow confirms it's real, then lights up; with
 * no signal it's kept on the phone and checked once there is.
 */
export default function FindScreen() {
  const { code, c, n } = useLocalSearchParams<{ code: string; c?: string; n?: string }>();
  const card = useMemo(() => findCardFrom({ code, c, n }), [code, c, n]);
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const finds = useFinds();
  const reduce = useReducedMotion();
  const find = card ? finds.findOf(card.code) : undefined;

  // Opening the code keeps it (once).
  const kept = useRef(false);
  useEffect(() => {
    if (!card || !finds.hydrated || kept.current) return;
    kept.current = true;
    finds.scan(card);
  }, [card, finds]);

  // Its hunt as it is now (stickers join hunts over time).
  const huntId = find?.state === 'found' ? find.huntId : undefined;
  const { refreshHunt, online } = finds;
  useEffect(() => {
    if (huntId && online) refreshHunt(huntId);
  }, [huntId, online, refreshHunt]);

  // Lighting up: a pop and confetti the moment it's confirmed while you watch.
  const [celebrate, setCelebrate] = useState(0);
  const pop = useSharedValue(1);
  const was = useRef(find?.state);
  useEffect(() => {
    const state = find?.state;
    if (state === 'found' && was.current === 'checking') {
      haptic.celebrate();
      setCelebrate((x) => x + 1);
      if (!reduce) {
        pop.set(0.82);
        pop.set(withSpring(1, { damping: 9, stiffness: 160 }));
      }
    }
    was.current = state;
  }, [find?.state, reduce, pop]);
  const enter = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) enter.set(withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.4)) }));
  }, [reduce, enter]);
  const popStyle = useAnimatedStyle(() => ({ opacity: enter.get(), transform: [{ scale: (0.6 + enter.get() * 0.4) * pop.get() }] }));

  if (!card) {
    return (
      <Shell insets={insets}>
        <Text style={styles.title}>{t('That sticker code didn’t work')}</Text>
        <Text style={styles.body}>{t('Try scanning it again, a little closer.')}</Text>
      </Shell>
    );
  }

  const shown = find ?? { ...card, state: 'checking' as const, at: 0, sent: false, tries: 0 };
  const look = lookOf(shown.creature);
  const found = shown.state === 'found';
  const hunt = shown.huntId ? finds.huntOf(shown.huntId) : undefined;
  const progress = hunt ? finds.hunts.find((h) => h.hunt.id === hunt.id) : undefined;

  return (
    <Shell insets={insets}>
      <View style={styles.stage}>
        <Animated.View style={popStyle}>
          <Collectible look={look} size={200} locked={!found} />
        </Animated.View>
        {celebrate ? <ConfettiBurst key={celebrate} spread={160} /> : null}
      </View>
      <Text style={[styles.kicker, { color: found ? look.accent : color.moonFaint }]}>
        {found ? (progress?.done ? t('HUNT COMPLETE') : t('YOU FOUND')) : shown.state === 'checking' ? (finds.online ? t('CHECKING') : t('SAVED')) : t('NOT THIS TIME')}
      </Text>
      <Text style={styles.title} accessibilityRole="header">
        {shown.name}
      </Text>
      {found ? (
        <Text style={styles.body}>{look.theme}.</Text>
      ) : null}
      <Text style={[styles.status, shown.state === 'ended' || shown.state === 'gone' ? styles.amber : null]} accessibilityLiveRegion="polite">
        {findLine(shown)}
      </Text>

      {found && hunt && progress ? (
        <View style={styles.box}>
          <Text style={styles.boxTitle}>{hunt.name}</Text>
          <Text style={styles.hint}>{hunt.until ? t('{progress} · {until}', { progress: huntLine(progress), until: untilLine(hunt.until) }) : huntLine(progress)}</Text>
          <HuntRow hunt={hunt} found={progress.found} size={44} />
          <Pressable onPress={() => router.push({ pathname: '/hunt/[id]', params: { id: hunt.id } })} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>{progress.done ? t('Share your hunt') : t('See the hunt')}</Text>
          </Pressable>
        </View>
      ) : null}

      {found || shown.state === 'checking' ? (
        social.user ? (
          <Primary label={t('See your collection')} onPress={() => router.replace('/garden')} />
        ) : !social.availability.ok ? (
          <Text style={styles.hint}>{accountsOff(Platform.OS === 'web', 'Accounts').body}</Text>
        ) : (
          <>
            <Text style={styles.body}>
              {Platform.OS === 'web'
                ? t('It’s kept on this browser. Make a free Afterglow account to keep it everywhere and see your collection.')
                : t('It’s kept on this phone. Make a free Afterglow account to keep it everywhere and see your collection.')}
            </Text>
            <Primary label={t('Create a free account')} onPress={() => router.push('/account')} />
            {Platform.OS === 'web' ? (
              APP_STORE_URL ? (
                <Pressable onPress={() => void Linking.openURL(APP_STORE_URL).catch(() => {})} accessibilityRole="link" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                  <Text style={styles.secondaryText}>{t('Get the Afterglow app')}</Text>
                </Pressable>
              ) : (
                <Text style={styles.hint}>{t('Afterglow is coming to the App Store. Your stickers will be waiting in the app when you sign in.')}</Text>
              )
            ) : null}
          </>
        )
      ) : null}
    </Shell>
  );
}

function Shell({ children, insets }: { children: React.ReactNode; insets: { top: number; bottom: number } }) {
  return (
    <View style={styles.root}>
      <PageTitle title={t('A sticker you found')} />
      <NightSky />
      <Pressable onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={t('Close')} hitSlop={10} style={[styles.close, { top: insets.top + space.sm }]}>
        <CloseIcon color={color.moon} size={18} />
      </Pressable>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xl }]}>{children}</ScrollView>
    </View>
  );
}

function Primary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  close: { position: 'absolute', right: space.xl, zIndex: 20, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass },
  content: { paddingHorizontal: space.xl, gap: space.md, alignItems: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  stage: { width: 240, height: 220, alignItems: 'center', justifyContent: 'center' },
  kicker: { ...type.caption, letterSpacing: 2, fontWeight: '700' },
  title: { ...type.title, color: color.moon, textAlign: 'center' },
  body: { ...type.body, color: color.moonDim, textAlign: 'center' },
  hint: { ...type.caption, color: color.moonFaint, textAlign: 'center' },
  status: { ...type.label, color: color.moonDim, textAlign: 'center' },
  amber: { color: '#FFB86B' },
  box: { alignSelf: 'stretch', padding: space.lg, borderRadius: radius.md, backgroundColor: color.glass, gap: space.xs, alignItems: 'center' },
  boxTitle: { ...type.headline, color: color.moon, textAlign: 'center' },
  primary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, marginTop: space.sm },
  primaryText: { ...type.headline, color: color.moon },
  secondary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
