import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import Animated, { Easing, FadeIn, FadeOut, interpolate, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { HeartBurst, HeartFace, HeartHalo } from './HeartHold';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraIcon } from '../features/camera/icons';
import { useFestivalMode } from '../state/festivalMode';
import { useCrewUpdates } from '../state/crewUpdates';
import { markCareTipDone, useCareTip } from '../state/careTip';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../lib/haptics';
import { color, motion, radius, space, type } from '../theme/tokens';
import { DiscoverIcon, FestivalsIcon, LineupIcon, PeopleIcon, ProfileIcon, SoundIcon } from './TabIcons';
import { HiddenToe } from '../features/toes/Toe';

const ICONS: Record<string, typeof DiscoverIcon> = {
  index: DiscoverIcon,
  lineup: LineupIcon,
  sound: SoundIcon,
  festivals: FestivalsIcon,
  profile: ProfileIcon,
  together: PeopleIcon,
};

/** The middle of festival mode's bar: not a tab, the camera. */
const CAMERA = 'camera';
/**
 * Which tabs show, in order: the full app (your plan lives on Festivals, whose
 * top becomes your set-to-set route once set times are out), or festival
 * mode (videos from here, tonight's plan, the camera, friends).
 */
export const FULL_TABS = ['index', 'festivals', 'sound', 'together', 'profile'];
export const FESTIVAL_TABS = ['index', 'lineup', CAMERA, 'together', 'profile'];
/** The festival's colours for the camera button (the record button's). */
const CAMERA_COLORS = ['#A97CFF', '#FF7EB6', '#FFB86B'] as const;

export const TAB_BAR_HEIGHT = 64;

/** Height the floating bar takes from the bottom of the screen, including safe area. */
export const useTabBarSpace = () => {
  const insets = useSafeAreaInsets();
  // Testing festival mode, a banner sits on top of the bar.
  const testing = !!useFestivalMode().active?.preview;
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, space.md) + space.sm + (testing ? TEST_BANNER_H : 0);
};
/** The "Testing festival mode" banner's height, with its gap. */
const TEST_BANNER_H = 36;

/** A floating glass pill. Quiet until touched. */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { active, leave, hydrated } = useFestivalMode();
  // The camera button turning into a heart when held (festival mode).
  const hold = useSharedValue(0);
  const burst = useSharedValue(0);
  const order = active ? FESTIVAL_TABS : FULL_TABS;
  // Something new from your crew: a glow dot on Friends.
  const freshCrew = useCrewUpdates().stories.some((s) => s.fresh);
  const current = state.routes[state.index]?.name;
  const [pillW, setPillW] = useState(0);
  const slot = current ? order.indexOf(current) : -1;
  // Switching modes while on a tab the other mode doesn't have: back to Discover.
  const hidden = hydrated && !!current && !order.includes(current);
  useEffect(() => {
    if (hidden) navigation.navigate('index');
  }, [hidden, navigation]);
  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, space.md) }]} pointerEvents="box-none">
      {/* Testing festival mode on an ordinary day: say so, with a way out. */}
      {active?.preview ? (
        <Pressable
          onPress={() => {
            haptic.select();
            leave();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Testing festival mode with ${active.festival.name}. End the test`}
          style={styles.test}
        >
          <View style={styles.testDot} />
          <Text style={styles.testText} numberOfLines={1}>
            Testing festival mode
          </Text>
          <Text style={styles.testEnd}>End</Text>
        </Pressable>
      ) : null}
      {active ? <CareTip /> : null}
      {active ? <HeartHalo hold={hold} bottom={TAB_BAR_HEIGHT / 2} /> : null}
      {/* A toe peeking over the top of the bar (one person's app only). */}
      <HiddenToe size={13} opacity={0.4} turn={-14} style={styles.peek} />
      <View style={styles.pill} onLayout={(e) => setPillW(e.nativeEvent.layout.width)}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.tint]} />
        {/* One highlight that glides to the tab you pick. */}
        {pillW > 0 && slot >= 0 ? <Glider index={slot} width={(pillW - 12) / order.length} /> : null}
        {order.map((name) => {
          if (name === CAMERA) return <CameraTab key={CAMERA} hold={hold} burst={burst} />;
          const i = state.routes.findIndex((r) => r.name === name);
          const route = state.routes[i];
          if (!route) return null;
          const focused = state.index === i;
          const { options } = descriptors[route.key];
          const title = options.title ?? route.name;
          const news = route.name === 'together' && freshCrew;
          const label = news ? `${title}, new from your crew` : title;
          const Icon = ICONS[route.name] ?? DiscoverIcon;
          const tint = focused ? color.moon : color.moonFaint;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  haptic.select();
                  navigation.navigate(route.name);
                }
              }}
              style={styles.item}
            >
              <Bounce on={focused}>
                <Icon color={focused ? color.glow : tint} size={24} />
                {news ? <View style={styles.newsDot} /> : null}
              </Bounce>
              <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
                {title}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {active ? <HeartBurst burst={burst} bottom={TAB_BAR_HEIGHT / 2} /> : null}
    </View>
  );
}

/** The highlight behind the chosen tab, gliding from one to the next. */
function Glider({ index, width }: { index: number; width: number }) {
  const reduce = useReducedMotion();
  const x = useSharedValue(index * width);
  useEffect(() => {
    x.set(reduce ? index * width : withSpring(index * width, motion.snappy));
  }, [index, width, x, reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return <Animated.View pointerEvents="none" style={[styles.glider, { width }, style]} />;
}

/** The chosen tab's icon gives a little hop. */
function Bounce({ on, children }: { on: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (on && !reduce) s.set(withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, motion.bloom)));
  }, [on, s, reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Look after yourself, opened from the held camera button: the heart blooms, then the page opens over it. */
function openCare(hold: SharedValue<number>, burst: SharedValue<number>, still: boolean) {
  haptic.settle();
  markCareTipDone();
  if (still) {
    router.push('/care');
    return;
  }
  hold.set(1);
  burst.set(0);
  burst.set(withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }));
  setTimeout(() => router.push({ pathname: '/care', params: { from: 'heart' } }), 320);
  // Back to a camera for when you return.
  setTimeout(() => {
    hold.set(0);
    burst.set(0);
  }, 950);
}

/** Above festival mode's camera button until you've held it once: what holding it does. */
function CareTip() {
  const show = useCareTip();
  const reduce = useReducedMotion();
  if (!show) return null;
  return (
    <Animated.View
      entering={reduce ? undefined : FadeIn.delay(800).duration(400)}
      exiting={reduce ? undefined : FadeOut.duration(200)}
      style={styles.tip}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.tipBubble}>
        <Text style={styles.tipText}>Hold for Look after yourself</Text>
      </View>
      <View style={styles.tipArrow} />
    </Animated.View>
  );
}

/** Festival mode's middle button: straight to the camera; held, it turns into a heart and opens Look after yourself. */
function CameraTab({ hold, burst }: { hold: SharedValue<number>; burst: SharedValue<number> }) {
  const reduce = useReducedMotion();
  const fired = useRef(false);
  const button = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.16 * hold.get() }] }));
  const camera = useAnimatedStyle(() => ({ opacity: interpolate(hold.get(), [0, 0.5], [1, 0], 'clamp') }));
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push('/camera');
      }}
      onPressIn={() => {
        fired.current = false;
        // A short wait, so a quick tap stays a camera; then the heart grows until the hold completes.
        if (!reduce) hold.set(withDelay(120, withTiming(1, { duration: 330, easing: Easing.out(Easing.quad) })));
      }}
      onPressOut={() => {
        if (!fired.current) hold.set(withTiming(0, { duration: 180 }));
      }}
      // Hold it for Look after yourself, from any tab.
      onLongPress={() => {
        fired.current = true;
        openCare(hold, burst, !!reduce);
      }}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel="Film a video"
      accessibilityHint="Hold to open Look after yourself"
      accessibilityActions={[{ name: 'longpress', label: 'Look after yourself' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && openCare(hold, burst, true)}
      style={styles.item}
    >
      <Animated.View style={[styles.camera, button]}>
        <LinearGradient colors={CAMERA_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.cameraFill]} />
        <Animated.View style={camera}>
          <CameraIcon color={color.night} size={24} />
        </Animated.View>
        <HeartFace hold={hold} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  peek: { bottom: TAB_BAR_HEIGHT - 5, right: '23%' },
  wrap: { position: 'absolute', left: space.md, right: space.md, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    // Full width on a phone; centred, at most 480, on a wide screen.
    width: '100%',
    maxWidth: 480,
    height: TAB_BAR_HEIGHT,
    padding: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  tint: { backgroundColor: 'rgba(18,16,38,0.45)' },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    gap: 2,
  },
  glider: { position: 'absolute', top: 6, bottom: 6, left: 6, borderRadius: radius.pill, backgroundColor: 'rgba(169,124,255,0.14)' },
  label: { ...type.caption, fontSize: 11 },
  newsDot: { position: 'absolute', top: -1, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: color.glow, borderWidth: 1.5, borderColor: color.night },
  test: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(18,16,38,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,126,182,0.6)',
  },
  testDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF7EB6' },
  testText: { ...type.caption, color: color.moon },
  testEnd: { ...type.caption, color: '#FF7EB6', fontWeight: '700' },
  tip: { alignItems: 'center', marginBottom: 4 },
  tipBubble: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(18,16,38,0.92)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,126,182,0.6)' },
  tipText: { ...type.caption, color: color.moon },
  tipArrow: { width: 10, height: 10, marginTop: -5, transform: [{ rotate: '45deg' }], backgroundColor: 'rgba(18,16,38,0.92)', borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,126,182,0.6)' },
  cameraFill: { borderRadius: 25 },
  camera: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF7EB6', shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
});
