import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfettiBurst } from '../../components/ConfettiBurst';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { CloseIcon } from '../../components/TabIcons';
import { APP_STORE_URL } from '../../config/app';
import { accountsOff } from '../../features/social/unavailable';
import { SPROUT_GREEN } from '../../features/sprouts/look';
import { claimLine } from '../../features/sprouts/outbox';
import { Sprout } from '../../features/sprouts/Sprout';
import { giftTitle, kindOf, sproutCardFrom, sproutName } from '../../features/sprouts/sprouts';
import { SproutOf } from '../../features/sprouts/SproutOf';
import { artistLook } from '../../features/sprouts/artistLook';
import { FollowGiver } from '../../features/sprouts/FollowGiver';
import { CardReveal } from '../../features/sprouts/CollectibleCard';
import { HoloTilt } from '../../features/sprouts/HoloTilt';
import { useCatalog } from '../../state/catalog';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { useSocial } from '../../state/social';
import { useSprouts } from '../../state/sprouts';
import { color, radius, space, type } from '../../theme/tokens';
import { goBack } from '../../lib/nav';

/** A gifted collectible's card, as wide as this. */
const CARD_W = 220;

/**
 * A sprout someone gave you: what you see after scanning its code, in the
 * app or (with a phone's own camera) on the website. It pops up out of the
 * ground; then it's yours with one tap, or kept on this phone until you sign
 * in. Works with no signal: it joins your garden once there is.
 */
export default function SproutScreen() {
  const params = useLocalSearchParams<{ id: string; u?: string; h?: string; k?: string; n?: string; a?: string; an?: string }>();
  const { id, u, h, k: kindParam, n, a, an } = params;
  const card = useMemo(() => sproutCardFrom({ id, u, h, k: kindParam, n, a, an }), [id, u, h, kindParam, n, a, an]);
  const catalog = useCatalog();
  const look = (a: { id: string; name: string }) => artistLook(catalog.artist(a.id) ?? a);
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const sprouts = useSprouts();
  const reduce = useReducedMotion();
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(0);

  const me = social.user?.uid;
  const mine = !!card && card.from === me;
  const inGarden = !!card && sprouts.garden.some((g) => g.id === card.id);
  const waiting = card ? sprouts.claims.find((c) => c.card.id === card.id) : undefined;
  const state = inGarden ? 'claimed' : waiting?.state;
  // Seen here, on screen (not left underneath while signing up): the pop-up for sprouts that arrived later
  // (SproutFollowKeeper) won't open it again.
  const { followAsked } = sprouts;
  const claimedId = card && state === 'claimed' ? card.id : undefined;
  useFocusEffect(
    useCallback(() => {
      if (claimedId) followAsked(claimedId);
    }, [claimedId, followAsked]),
  );

  // Its note, when there's signal and you're signed in (the code itself is kept small).
  const { service } = social;
  useEffect(() => {
    if (!card || !me) return;
    let live = true;
    service
      .sprout(card.id)
      .then((s) => live && s?.note && setNote(s.note))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [card, me, service]);

  // It pops up out of the ground.
  const rise = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    rise.set(withDelay(250, withSpring(1, { damping: 9, stiffness: 120, mass: 0.8 })));
    haptic.soft();
  }, [reduce, rise]);
  const sproutStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, rise.get() * 2), transform: [{ translateY: (1 - rise.get()) * 60 }, { scale: 0.4 + rise.get() * 0.6 }] }));
  const halo = useSharedValue(0);
  useEffect(() => {
    if (!reduce) halo.set(withDelay(500, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) })));
  }, [reduce, halo]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: (1 - halo.get()) * 0.7, transform: [{ scale: 0.6 + halo.get() * 1.4 }] }));

  if (!card) {
    return (
      <Shell insets={insets}>
        <Sprout kind="seedling" stage={0} size={120} locked />
        <Text style={styles.title}>{t('That sprout code didn’t work')}</Text>
        <Text style={styles.body}>{t('Ask whoever gave it to you to show it again.')}</Text>
      </Shell>
    );
  }

  const k = kindOf(card.kind);
  const keep = async () => {
    setBusy(true);
    const r = await sprouts.claim(card);
    setBusy(false);
    if (r === 'claimed') {
      haptic.celebrate();
      setCelebrate((n) => n + 1);
    } else if (r === 'signed-out') router.push('/account');
  };

  return (
    <Shell insets={insets}>
      {card.artist ? (
        // An artist's collectible arrives as its card, face down, and turns over.
        <View style={styles.cardStage}>
          <HoloTilt width={CARD_W} height={Math.round(CARD_W * 1.4)}>
            <CardReveal look={look(card.artist)} artistName={card.artist.name} owner={mine ? undefined : t('From @{handle}', { handle: card.handle })} width={CARD_W} />
          </HoloTilt>
          {celebrate ? <ConfettiBurst key={celebrate} spread={170} /> : null}
        </View>
      ) : (
        <View style={styles.stage}>
          <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
          <Animated.View style={sproutStyle}>
            <SproutOf kind={card.kind} artist={card.artist} stage={card.kind === 'seedling' ? 2 : 3} size={170} />
          </Animated.View>
          <View style={styles.ground} />
          {celebrate ? <ConfettiBurst key={celebrate} spread={150} /> : null}
        </View>
      )}
      <Text style={styles.kicker}>{card?.artist ? (mine ? t('YOUR COLLECTIBLE') : t('A COLLECTIBLE FOR YOU')) : mine ? t('YOUR SPROUT') : t('A SPROUT FOR YOU')}</Text>
      <Text style={styles.title} accessibilityRole="header">
        {mine ? t('Your {sprout}', { sprout: sproutName(card) }) : giftTitle(card)}
      </Text>
      <Text style={styles.from}>@{card.handle}</Text>
      {note ? <Text style={styles.note}>“{note}”</Text> : null}
      <Text style={styles.body}>
        {card.artist ? t('{name}: {theme}, earned by filming {artist} live.', { name: look(card.artist).name, theme: look(card.artist).theme.toLowerCase(), artist: card.artist.name }) : k.about}
      </Text>

      {mine ? (
        <Text style={styles.body}>{t('Show the code to someone so they can scan it.')}</Text>
      ) : !social.availability.ok ? (
        <View style={styles.box}>
          <Text style={styles.boxTitle}>{accountsOff(Platform.OS === 'web', 'Sprouts').title}</Text>
          <Text style={styles.body}>{accountsOff(Platform.OS === 'web', 'Sprouts').body}</Text>
        </View>
      ) : state === 'claimed' ? (
        <>
          <Text style={[styles.status, { color: SPROUT_GREEN }]} accessibilityLiveRegion="polite">
            {t('In your garden')}
          </Text>
          {/* The person who gave it: a friend from the start. */}
          <FollowGiver uid={card.from} handle={card.handle} name={card.name} />
          <Text style={styles.body}>{t('It grows as you go: festival days, sets you watch, videos you film and sprouts you give.')}</Text>
          <Primary label={t('See your garden')} onPress={() => router.replace('/garden')} />
        </>
      ) : state === 'taken' || state === 'gone' ? (
        <Text style={[styles.status, styles.amber]}>{claimLine(waiting!)}</Text>
      ) : waiting && me ? (
        <>
          <Text style={[styles.status, styles.amber]} accessibilityLiveRegion="polite">
            {claimLine(waiting)}
          </Text>
          <Primary label={t('Try again now')} onPress={() => void keep()} busy={busy} />
        </>
      ) : me ? (
        <Primary label={t('Add to my garden')} onPress={() => void keep()} busy={busy} />
      ) : (
        <>
          <Text style={styles.body}>{t('Keep it: make a free Afterglow account and it’ll be waiting in your garden.')}</Text>
          <Primary label={t('Create a free account')} onPress={() => void keep()} />
          <Pressable onPress={() => void sprouts.claim(card).then(() => router.push('/account'))} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>{t('I already have an account')}</Text>
          </Pressable>
          {Platform.OS === 'web' ? (
            APP_STORE_URL ? (
              <Pressable onPress={() => void Linking.openURL(APP_STORE_URL).catch(() => {})} accessibilityRole="link" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>{t('Get the Afterglow app')}</Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>{t('Afterglow is coming to the App Store. Create your free account here first: your sprout will be waiting in the app when you sign in.')}</Text>
            )
          ) : null}
        </>
      )}
    </Shell>
  );
}

function Shell({ children, insets }: { children: React.ReactNode; insets: { top: number; bottom: number } }) {
  return (
    <View style={styles.root}>
      <PageTitle title={t('A sprout for you')} />
      <NightSky />
      <Pressable
        onPress={() => (router.canGoBack() ? goBack() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel={t('Close')}
        hitSlop={10}
        style={[styles.close, { top: insets.top + space.sm }]}
      >
        <CloseIcon color={color.moon} size={18} />
      </Pressable>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xl }]}>{children}</ScrollView>
    </View>
  );
}

function Primary({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [styles.primary, busy && { opacity: 0.6 }, pressed && styles.pressed]}
    >
      <Text style={styles.primaryText}>{busy ? t('One moment…') : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  close: { position: 'absolute', right: space.xl, zIndex: 2, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass },
  content: { paddingHorizontal: space.xl, gap: space.md, alignItems: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  stage: { width: 240, height: 210, alignItems: 'center', justifyContent: 'flex-end' },
  cardStage: { alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  halo: { position: 'absolute', bottom: 10, width: 180, height: 180, borderRadius: 90, borderWidth: 2, borderColor: SPROUT_GREEN },
  ground: { width: 124, height: 12, borderRadius: 62, marginTop: -14, backgroundColor: 'rgba(110,231,160,0.1)', transform: [{ scaleY: 0.8 }] },
  kicker: { ...type.caption, color: SPROUT_GREEN, letterSpacing: 2, fontWeight: '700' },
  title: { ...type.title, color: color.moon, textAlign: 'center' },
  from: { ...type.label, color: color.moonDim },
  note: { ...type.headline, color: color.moon, textAlign: 'center', fontStyle: 'italic' },
  body: { ...type.body, color: color.moonDim, textAlign: 'center' },
  hint: { ...type.caption, color: color.moonFaint, textAlign: 'center' },
  status: { ...type.headline, color: color.moon, textAlign: 'center' },
  amber: { ...type.body, color: '#FFB86B', textAlign: 'center' },
  box: { alignSelf: 'stretch', padding: space.lg, borderRadius: radius.md, backgroundColor: color.glass, gap: space.xs },
  boxTitle: { ...type.headline, color: color.moon, textAlign: 'center' },
  primary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: '#1E8F4A', marginTop: space.sm },
  primaryText: { ...type.headline, color: color.moon },
  secondary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  secondaryText: { ...type.headline, color: color.moon },
  link: { ...type.label, color: color.moonDim, textAlign: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
