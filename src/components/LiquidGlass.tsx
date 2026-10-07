import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { color, glowA, glowDeepA, raisedA, tintA } from '../theme/tokens';

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
export function GlassFill({ radius, lit, interactive, tint = 0.4, hue, deep, frost = true }: {
  /** The parent's corner radius (the glass needs its own to bend at the edges). */
  radius: number;
  /** A toggle that's on: the glass takes the theme's glow. */
  lit?: boolean;
  /** Answers a touch (a button): the real glass shimmers and swells under the finger. */
  interactive?: boolean;
  /** How much night the copy's surface holds (0 to 1). */
  tint?: number;
  /** A colour of its own instead of the theme's glow (the quests' gold), as hex. */
  hue?: string;
  /** Holds words (a sheet, a dialog, a toast): a darker glass, so they read over anything. */
  deep?: boolean;
  /** The copy blurs what's behind it; off for glass repeated down a scrolling feed (each blur costs), where the night behind is plain anyway. */
  frost?: boolean;
}) {
  const solid = useReduceTransparency();
  const shape = { borderRadius: radius };
  const light = (alpha: number) => (hue ? tintA(hue, alpha) : glowA(alpha));
  if (solid) {
    return <View pointerEvents="none" testID="glass-solid" style={[StyleSheet.absoluteFill, shape, { backgroundColor: raisedA(0.96) }, lit && { backgroundColor: hue ? tintA(hue, 0.5) : glowDeepA(0.9) }]} />;
  }
  if (nativeGlass()) {
    return (
      <GlassView
        // A button's glass takes the touch too (it shimmers under the finger); the press still reaches the button around it.
        pointerEvents={interactive ? 'auto' : 'none'}
        glassEffectStyle="regular"
        colorScheme="dark"
        isInteractive={interactive}
        tintColor={lit ? light(deep ? 0.24 : 0.42) : deep ? raisedA(0.6) : hue ? tintA(hue, 0.1) : glowDeepA(0.12)}
        style={[StyleSheet.absoluteFill, shape]}
      />
    );
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, shape, styles.clip]}>
      {frost ? <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: deep ? raisedA(Math.max(tint, 0.6)) : lit ? light(0.32) : raisedA(tint) }]} />
      {/* Lit glass that holds words: the glow over a darker night, so coloured words still stand out. */}
      {lit && deep ? <View style={[StyleSheet.absoluteFill, { backgroundColor: light(0.16) }]} /> : null}
      {/* Light caught in the glass: a sheen from the top, the theme's glow pooling at the bottom. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.02)', light(0), light(lit ? 0.2 : 0.09)]}
        locations={[0, 0.45, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* The rim: brightest where the light lands, tinted where it leaves. */}
      <View style={[StyleSheet.absoluteFill, shape, styles.rim, { borderBottomColor: light(lit ? 0.8 : 0.22) }, lit && { borderColor: light(0.8), borderTopColor: light(0.95) }]} />
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

/**
 * The background of a sheet that slides up part way (comments, check-in…).
 * On iOS 26 the system draws those sheets in Liquid Glass when the page lets
 * it show through: a half-clear night keeps the words easy to read on it.
 */
export const SHEET_BACKGROUND = nativeGlass() ? raisedA(0.55) : color.nightRaised;

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
