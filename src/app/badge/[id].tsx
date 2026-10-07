import { router, useLocalSearchParams } from 'expo-router';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { CloseIcon } from '../../components/TabIcons';
import { THROWBACK, earnedLine, pinAbout, pinLook, throwbackAbout, throwbackLine, throwbackLook, throwbackShareText } from '../../features/badges/badges';
import { useThrowbacks } from '../../features/badges/useThrowbacks';
import { pastLabel } from '../../features/memories/past';
import { shareMessage } from '../../lib/share';
import { WEB_URL } from '../../config/app';
import { EnamelPin } from '../../features/badges/EnamelPin';
import { useBadges } from '../../features/badges/useBadges';
import { whereWhen } from '../../features/festivals/format';
import { haptic } from '../../lib/haptics';
import { tapStep } from '../../features/secrets/secrets';
import { revealSecret } from '../../state/secrets';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { goBack } from '../../lib/nav';
import { t } from '../../i18n';

/** The shine on a big pin: follows the tilt where there's a motion sensor, else a slow sweep. */
/** Tapping a pin seven times in a row polishes it: a secret. */
function usePinTaps() {
  const taps = useRef<number[]>([]);
  return () => {
    haptic.select();
    const step = tapStep(taps.current, Date.now());
    taps.current = step.taps;
    if (step.done) revealSecret('pinspin');
  };
}

function usePinSheen() {
  const sheen = useSharedValue(-0.6);
  const reduce = useReducedMotion();
  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    let live = true;
    const sweep = () => {
      if (reduce) return;
      sheen.set(withRepeat(withSequence(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }), withTiming(1, { duration: 2600 }), withTiming(-1, { duration: 0 })), -1, false));
    };
    (async () => {
      try {
        if (Platform.OS !== 'web' && (await DeviceMotion.isAvailableAsync()) && (await DeviceMotion.getPermissionsAsync()).granted) {
          if (!live) return;
          DeviceMotion.setUpdateInterval(50);
          sub = DeviceMotion.addListener((m) => {
            const g = m.rotation?.gamma ?? 0;
            sheen.set(withTiming(Math.max(-1, Math.min(1, g * 1.6)), { duration: 90 }));
          });
          return;
        }
      } catch {
        // No sensor: sweep instead.
      }
      if (live) sweep();
    })();
    return () => {
      live = false;
      sub?.remove();
      cancelAnimation(sheen);
    };
  }, [reduce, sheen]);

  return sheen;
}

/**
 * One festival pin, big: the shine follows the phone as you tilt it (or
 * sweeps across now and then, where there's no motion sensor). Collected:
 * when, and the video that earned it. Not yet: how to collect it.
 */
export default function BadgeScreen() {
  const { id, uid: whose } = useLocalSearchParams<{ id: string; uid?: string }>();
  // A throwback (a past festival from the camera roll) has its own page.
  if (id?.startsWith(THROWBACK)) return <ThrowbackScreen pastKey={id.slice(THROWBACK.length)} whose={whose} />;
  return <FestivalBadge id={id} whose={whose} />;
}

function FestivalBadge({ id, whose }: { id: string; whose?: string }) {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const social = useSocial();
  const uid = whose ?? social.user?.uid;
  const mine = !!uid && uid === social.user?.uid;
  const festival = catalog.festival(id);
  const { badges, loaded } = useBadges(uid);
  const badge = badges.find((b) => b.festivalId === id);
  const [owner, setOwner] = useState<string | undefined>();
  useEffect(() => {
    if (!uid || mine || !social.availability.ok) return;
    social.service
      .profileOf(uid)
      .then((p) => setOwner(p?.handle))
      .catch(() => {});
  }, [uid, mine, social.service, social.availability.ok]);

  const sheen = usePinSheen();
  const pinTap = usePinTaps();
  const reduce = useReducedMotion();

  const close = () => (router.canGoBack() ? goBack() : router.replace('/profile'));
  if (!festival) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.body}>{t('That badge isn’t here any more.')}</Text>
        <Pressable onPress={close} accessibilityRole="button">
          <Text style={styles.link}>{t('Close')}</Text>
        </Pressable>
      </View>
    );
  }
  const look = pinLook(festival);
  const collected = !!badge;
  return (
    <View style={styles.root}>
      <PageTitle title={t('{festival} badge', { festival: festival.name })} />
      <NightSky />
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('Close')} hitSlop={10} style={[styles.close, { top: insets.top + space.sm }]}>
        <CloseIcon color={color.moon} size={18} />
      </Pressable>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
        <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(14)} style={styles.pinWrap} accessible accessibilityLabel={collected ? t('{festival} badge', { festival: festival.name }) : t('{festival} badge, not collected yet', { festival: festival.name })}>
          {collected ? <View style={[styles.glow, { backgroundColor: `${look.palette.ribbon}55`, shadowColor: look.palette.accent }]} /> : null}
          <Pressable onPress={pinTap} accessible={false} testID="badge-pin">
            <EnamelPin look={look} size={260} locked={!collected} sheen={sheen} />
          </Pressable>
        </Animated.View>
        <Text style={styles.kicker}>{collected ? (mine ? t('In your collection') : owner ? t('@{handle}’s badge', { handle: owner }) : t('Collected')) : t('Not collected yet')}</Text>
        <Text style={styles.title}>{festival.name}</Text>
        <Text style={styles.meta}>{whereWhen(festival)}</Text>
        {badge ? <Text style={styles.earned}>{earnedLine(badge)}</Text> : null}
        {collected ? <Text style={styles.body}>{pinAbout(festival, true)}</Text> : null}
        {!collected && loaded ? (
          <Text style={styles.body}>
            {mine
              ? t('Film a video at {festival}, on its dates, and share it tagged with the festival. The badge is yours the moment it’s shared.', { festival: festival.name })
              : t('Badges come from videos filmed at the festival, on its dates.')}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {badge ? (
            <Pressable
              onPress={() => {
                haptic.select();
                router.push({ pathname: '/badge-card/[id]', params: { id: festival.id, ...(whose ? { uid: whose } : {}) } });
              }}
              accessibilityRole="button"
              accessibilityLabel={mine ? t('Share your badge') : t('Share this badge')}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>{mine ? t('Share your badge') : t('Share')}</Text>
            </Pressable>
          ) : null}
          {badge ? (
            <Pressable
              onPress={() => {
                haptic.select();
                router.push({ pathname: '/shared/[id]', params: { id: badge.firstId } });
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>{t('Watch the video')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              haptic.select();
              router.push(`/festival/${festival.id}`);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{t('Open {festival}', { festival: festival.name })}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/** A throwback pin: a past festival added from the camera roll, in rose gold. */
function ThrowbackScreen({ pastKey, whose }: { pastKey: string; whose?: string }) {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const social = useSocial();
  const uid = whose ?? social.user?.uid;
  const mine = !whose || whose === social.user?.uid;
  const badge = useThrowbacks(uid).find((x) => x.key === pastKey);
  const sheen = usePinSheen();
  const pinTap = usePinTaps();
  const reduce = useReducedMotion();
  const [owner, setOwner] = useState<string | undefined>();
  useEffect(() => {
    if (!uid || mine || !social.availability.ok) return;
    social.service
      .profileOf(uid)
      .then((p) => setOwner(p?.handle))
      .catch(() => {});
  }, [uid, mine, social.service, social.availability.ok]);
  const close = () => (router.canGoBack() ? goBack() : router.replace('/profile'));
  if (!badge) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.body}>{t('That badge isn’t here any more.')}</Text>
        <Pressable onPress={close} accessibilityRole="button">
          <Text style={styles.link}>{t('Close')}</Text>
        </Pressable>
      </View>
    );
  }
  const { past } = badge;
  const look = throwbackLook(past);
  const series = past.seriesId ? catalog.festival(past.seriesId) : undefined;
  const handle = mine ? social.profile?.handle : owner;
  return (
    <View style={styles.root}>
      <PageTitle title={t('{festival} badge', { festival: pastLabel(past) })} />
      <NightSky />
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('Close')} hitSlop={10} style={[styles.close, { top: insets.top + space.sm }]}>
        <CloseIcon color={color.moon} size={18} />
      </Pressable>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
        <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(14)} style={styles.pinWrap} accessible accessibilityLabel={t('{festival} throwback badge', { festival: pastLabel(past) })}>
          <View style={[styles.glow, { backgroundColor: 'rgba(242,184,166,0.3)', shadowColor: ROSE }]} />
          <Pressable onPress={pinTap} accessible={false} testID="badge-pin">
            <EnamelPin look={look} size={260} sheen={sheen} />
          </Pressable>
        </Animated.View>
        <Text style={[styles.kicker, { color: ROSE }]}>{mine ? t('Throwback · in your collection') : handle ? t('Throwback · @{handle}’s badge', { handle }) : t('Throwback')}</Text>
        <Text style={styles.title}>{pastLabel(past)}</Text>
        {past.city ? <Text style={styles.meta}>{past.city}</Text> : null}
        <Text style={[styles.earned, { color: ROSE }]}>{throwbackLine(badge)}</Text>
        <Text style={styles.body}>{throwbackAbout(past)}</Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              haptic.select();
              void shareMessage(throwbackShareText(past, handle ? `${WEB_URL}/u/${handle}` : WEB_URL, mine, handle));
            }}
            accessibilityRole="button"
            accessibilityLabel={mine ? t('Share your throwback') : t('Share this throwback')}
            style={({ pressed }) => [styles.primary, { backgroundColor: ROSE }, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{mine ? t('Share your throwback') : t('Share')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.select();
              if (badge.shared) router.push({ pathname: '/shared/[id]', params: { id: badge.firstId } });
              else router.push({ pathname: '/memory/[id]', params: { id: badge.firstId } });
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{t('Watch the video')}</Text>
          </Pressable>
          {series ? (
            <Pressable
              onPress={() => {
                haptic.select();
                router.push(`/festival/${series.id}`);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>{t('See {festival}', { festival: series.name })}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const ROSE = '#F2B8A6';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md },
  close: { position: 'absolute', right: space.lg, zIndex: 2, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass },
  content: { alignItems: 'center', paddingHorizontal: space.xl, gap: space.xs },
  pinWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, shadowOpacity: 1, shadowRadius: 60, shadowOffset: { width: 0, height: 0 } },
  kicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { ...type.largeTitle, color: color.moon, textAlign: 'center' },
  meta: { ...type.body, color: color.moonDim, textAlign: 'center' },
  earned: { ...type.headline, color: '#FFE38A', marginTop: space.sm },
  body: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.sm },
  link: { ...type.headline, color: color.glow },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.xl },
  primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.headline, color: color.night },
  secondary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  secondaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
