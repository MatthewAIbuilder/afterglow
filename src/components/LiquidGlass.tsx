import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { glowA, glowDeepA, raisedA } from '../theme/tokens';

/**
 * Liquid Glass: the material of everything that floats over the app (the tab
 * bar, the round buttons). On an iPhone with iOS 26 it is Apple's own glass,
 * which bends the light behind it and answers a touch; everywhere else
 * (older iPhones, Android, the website) a close copy: frosted blur, a lit
 * rim along the top, and the theme's glow gathering at the bottom edge.
 * With Reduce transparency on, a calm solid surface instead.
 *
 * Drawn as the back layer of its parent (which clips it to its shape), so
 * whatever the parent holds sits on top.
 */
export function GlassFill({ radius, lit, interactive, tint = 0.4 }: {
  /** The parent's corner radius (the glass needs its own to bend at the edges). */
  radius: number;
  /** A toggle that's on: the glass takes the theme's glow. */
  lit?: boolean;
  /** Answers a touch (a button): the real glass shimmers and swells under the finger. */
  interactive?: boolean;
  /** How much night the copy's surface holds (0 to 1). */
  tint?: number;
}) {
  const solid = useReduceTransparency();
  const shape = { borderRadius: radius };
  if (solid) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, shape, { backgroundColor: raisedA(0.96) }, lit && { backgroundColor: glowDeepA(0.9) }]} />;
  }
  if (nativeGlass()) {
    return (
      <GlassView
        pointerEvents="none"
        glassEffectStyle="regular"
        colorScheme="dark"
        isInteractive={interactive}
        tintColor={lit ? glowA(0.42) : glowDeepA(0.12)}
        style={[StyleSheet.absoluteFill, shape]}
      />
    );
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, shape, styles.clip]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: lit ? glowA(0.32) : raisedA(tint) }]} />
      {/* Light caught in the glass: a sheen from the top, the theme's glow pooling at the bottom. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.02)', glowA(0), glowA(lit ? 0.2 : 0.09)]}
        locations={[0, 0.45, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* The rim: brightest where the light lands, tinted where it leaves. */}
      <View style={[StyleSheet.absoluteFill, shape, styles.rim, { borderBottomColor: glowA(lit ? 0.8 : 0.22) }, lit && { borderColor: glowA(0.8), borderTopColor: glowA(0.95) }]} />
    </View>
  );
}

/** Whether this phone draws Apple's Liquid Glass (an iPhone on iOS 26 or later; the module remembers its answer). */
export function nativeGlass(): boolean {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    // An app without the glass module: the copy.
    return false;
  }
}

// Reduce transparency (iPhone Settings → Accessibility → Display & Text Size), followed as it changes.
let reduce = false;
let watching = false;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!watching && Platform.OS === 'ios') {
    watching = true;
    const set = (on: boolean) => {
      if (on === reduce) return;
      reduce = on;
      listeners.forEach((l) => l());
    };
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then(set)
      .catch(() => {});
    AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', set);
  }
  return () => {
    listeners.delete(listener);
  };
}
const useReduceTransparency = () => useSyncExternalStore(subscribe, () => reduce);

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  rim: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderTopColor: 'rgba(255,255,255,0.28)' },
});
