import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { SUPPORT_EMAIL } from '../config/app';
import { haptic } from '../lib/haptics';
import { color, radius, space, type } from '../theme/tokens';
import { NightSky } from './NightSky';

/** The mail that "Tell us" opens: what broke, nothing personal. */
export function crashMailto(error: Error, email = SUPPORT_EMAIL): string | undefined {
  if (!email) return undefined;
  const body = `Something went wrong in Afterglow.\n\nWhat I was doing:\n\n\n(Error: ${(error?.message ?? 'unknown').slice(0, 300)})`;
  return `mailto:${email}?subject=${encodeURIComponent('Afterglow crashed')}&body=${encodeURIComponent(body)}`;
}

/**
 * What shows when a screen breaks, instead of a white screen: a light that
 * flickered out, a plain sentence, Try again, and a way home. Your plans and
 * taste live on the phone, so nothing is lost.
 */
export function CrashScreen({ error, retry }: { error: Error; retry: () => Promise<void> | void }) {
  const reduced = useReducedMotion();
  const flicker = useSharedValue(1);
  useEffect(() => {
    haptic.soft();
    if (reduced) return;
    // A light that won't quite stay on.
    flicker.set(
      withRepeat(
        withSequence(withTiming(0.35, { duration: 90 }), withTiming(1, { duration: 120 }), withTiming(0.5, { duration: 70 }), withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) })),
        -1,
        false,
      ),
    );
  }, [flicker, reduced]);
  const light = useAnimatedStyle(() => ({ opacity: flicker.get() }));
  const mail = crashMailto(error);
  return (
    <View style={styles.root} testID="crash-screen">
      <NightSky />
      <Animated.View style={[styles.light, light]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={140} height={140}>
          <Defs>
            <RadialGradient id="crash-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color.glow} stopOpacity="0.55" />
              <Stop offset="1" stopColor={color.glow} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={70} cy={70} r={70} fill="url(#crash-glow)" />
          <Circle cx={70} cy={70} r={22} fill={color.glow} fillOpacity={0.85} />
        </Svg>
      </Animated.View>
      <Text style={styles.title} accessibilityRole="header">
        Something went wrong
      </Text>
      <Text style={styles.body}>This page tripped over a cable. Your plans, ratings and videos are safe on this phone.</Text>
      {__DEV__ ? (
        <Text style={styles.dev} numberOfLines={4}>
          {error?.message}
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          haptic.tap();
          void retry();
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.primaryText}>Try again</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          haptic.select();
          try {
            router.replace('/');
          } catch {
            void retry();
          }
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.secondaryText}>Go to Discover</Text>
      </Pressable>
      {mail ? (
        <Pressable onPress={() => void Linking.openURL(mail).catch(() => {})} accessibilityRole="link" hitSlop={8}>
          <Text style={styles.tell}>Tell us what happened</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: color.night },
  light: { marginBottom: space.lg },
  title: { ...type.title, color: color.moon, textAlign: 'center' },
  body: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.sm, maxWidth: 340 },
  dev: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.md, maxWidth: 340 },
  primary: { marginTop: space.xl, paddingVertical: space.md, paddingHorizontal: space.xxl, borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.headline, color: color.night },
  secondary: { marginTop: space.md, paddingVertical: space.sm, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: color.glass },
  secondaryText: { ...type.label, color: color.moon },
  tell: { ...type.caption, color: color.glow, marginTop: space.xl },
});
