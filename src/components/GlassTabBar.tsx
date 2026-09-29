import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../lib/haptics';
import { color, radius, space, type } from '../theme/tokens';
import { DiscoverIcon, FestivalsIcon, LineupIcon, ProfileIcon, SoundIcon } from './TabIcons';

const ICONS: Record<string, typeof DiscoverIcon> = {
  index: DiscoverIcon,
  lineup: LineupIcon,
  sound: SoundIcon,
  festivals: FestivalsIcon,
  profile: ProfileIcon,
};

export const TAB_BAR_HEIGHT = 64;

/** Height the floating bar takes from the bottom of the screen, including safe area. */
export const useTabBarSpace = () => {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, space.md) + space.sm;
};

/** A floating glass pill. Quiet until touched. */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, space.md) }]} pointerEvents="box-none">
      <View style={styles.pill}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.tint]} />
        {state.routes.map((route, i) => {
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

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignSelf: 'stretch',
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
});
