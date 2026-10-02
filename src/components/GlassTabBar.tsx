import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraIcon } from '../features/camera/icons';
import { useFestivalMode } from '../state/festivalMode';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../lib/haptics';
import { color, radius, space, type } from '../theme/tokens';
import { DiscoverIcon, FestivalsIcon, LineupIcon, PeopleIcon, ProfileIcon, SoundIcon } from './TabIcons';

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
/** Which tabs show, in order: the full app, or festival mode (videos from here, tonight's plan, the camera, friends). */
export const FULL_TABS = ['index', 'lineup', 'sound', 'festivals', 'profile'];
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
  const order = active ? FESTIVAL_TABS : FULL_TABS;
  const current = state.routes[state.index]?.name;
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
      <View style={styles.pill}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.tint]} />
        {order.map((name) => {
          if (name === CAMERA) return <CameraTab key={CAMERA} />;
          const i = state.routes.findIndex((r) => r.name === name);
          const route = state.routes[i];
          if (!route) return null;
          const focused = state.index === i;
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
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
              {focused && <View style={styles.activeBg} />}
              <Icon color={focused ? color.glow : tint} />
              <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const openCare = () => {
  haptic.settle();
  router.push('/care');
};

/** Festival mode's middle button: straight to the camera; held, Look after yourself. */
function CameraTab() {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push('/camera');
      }}
      // Hold it for Look after yourself, from any tab.
      onLongPress={openCare}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel="Film a video"
      accessibilityHint="Hold to open Look after yourself"
      accessibilityActions={[{ name: 'longpress', label: 'Look after yourself' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && openCare()}
      style={styles.item}
    >
      {({ pressed }) => (
        <LinearGradient
          colors={CAMERA_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.camera, pressed && { transform: [{ scale: 0.92 }] }]}
        >
          <CameraIcon color={color.night} size={24} />
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  activeBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: 'rgba(169,124,255,0.14)' },
  label: { ...type.caption, fontSize: 11 },
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
  camera: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF7EB6', shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
});
