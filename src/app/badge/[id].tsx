import { router, useLocalSearchParams } from 'expo-router';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { CloseIcon } from '../../components/TabIcons';
import { earnedLine, pinAbout, pinLook } from '../../features/badges/badges';
import { EnamelPin } from '../../features/badges/EnamelPin';
import { useBadges } from '../../features/badges/useBadges';
import { whereWhen } from '../../features/festivals/format';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * One festival pin, big: the shine follows the phone as you tilt it (or
 * sweeps across now and then, where there's no motion sensor). Collected:
 * when, and the video that earned it. Not yet: how to collect it.
 */
export default function BadgeScreen() {
  const { id, uid: whose } = useLocalSearchParams<{ id: string; uid?: string }>();
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

  // The shine: follows the tilt where there's a motion sensor, else a slow sweep.
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

  const close = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  if (!festival) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.body}>That badge isn’t here any more.</Text>
        <Pressable onPress={close} accessibilityRole="button">
          <Text style={styles.link}>Close</Text>
        </Pressable>
      </View>
    );
  }
  const look = pinLook(festival);
  const collected = !!badge;
  return (
    <View style={styles.root}>
      <PageTitle title={`${festival.name} badge`} />
      <NightSky />
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={[styles.close, { top: insets.top + space.sm }]}>
        <CloseIcon color={color.moon} size={18} />
      </Pressable>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
        <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(14)} style={styles.pinWrap} accessible accessibilityLabel={`${festival.name} badge${collected ? '' : ', not collected yet'}`}>
          {collected ? <View style={[styles.glow, { backgroundColor: `${look.palette.ribbon}55`, shadowColor: look.palette.accent }]} /> : null}
          <EnamelPin look={look} size={260} locked={!collected} sheen={sheen} />
        </Animated.View>
        <Text style={styles.kicker}>{collected ? (mine ? 'In your collection' : owner ? `@${owner}’s badge` : 'Collected') : 'Not collected yet'}</Text>
        <Text style={styles.title}>{festival.name}</Text>
        <Text style={styles.meta}>{whereWhen(festival)}</Text>
        {badge ? <Text style={styles.earned}>{earnedLine(badge)}</Text> : null}
        {collected ? <Text style={styles.body}>{pinAbout(festival, true)}</Text> : null}
        {!collected && loaded ? (
          <Text style={styles.body}>
            {mine
              ? `Film a video at ${festival.name}, on its dates, and share it tagged with the festival. The badge is yours the moment it’s shared.`
              : 'Badges come from videos filmed at the festival, on its dates.'}
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
              accessibilityLabel={mine ? 'Share your badge' : 'Share this badge'}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>{mine ? 'Share your badge' : 'Share'}</Text>
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
              <Text style={styles.secondaryText}>Watch the video</Text>
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
            <Text style={styles.secondaryText}>Open {festival.name}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

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
  secondary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
