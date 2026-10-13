import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { color, GLASS, glowA, glowDeepA, raisedA, tintA } from '../theme/tokens';

/**
 * Liquid Glass: the material of everything that floats over the app (the tab
 * bar, the round buttons). On an iPhone with iOS 26 it is Apple's own glass,
 * which bends the light behind it; everywhere else
 * (older iPhones, Android, the website) a close copy: frosted blur, a lit
 * rim along the top, and the theme's glow gathering at the bottom edge.
 * With Reduce transparency on, a calm solid surface instead.
 *
 * Liquid Glass is a choice (a free switch on the App theme page), off unless
 * picked: then the plain frosted surface the app always had (a blur, a night
 * tint and a hairline edge).
 *
 * Drawn as the first child of its parent, filling it with the parent's
 * corner `radius`, so whatever the parent holds sits on top.
 */
/**
 * Over a live native picture (the camera, Apple's map), glass draws a plain
 * tinted surface: no blur and no Apple glass sampling the moving layer
 * underneath, which real builds can't always take.
 */
const OverLive = createContext(false);
export function OverLiveView({ children }: { children: ReactNode }) {
  return <OverLive.Provider value>{children}</OverLive.Provider>;
}

export function GlassFill({ radius, lit, tint = 0.4, hue, deep, frost = true }: {
  /** The parent's corner radius (the glass needs its own to bend at the edges). */
  radius: number;
  /** A toggle that's on: the glass takes the theme's glow. */
  lit?: boolean;
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
  const overLive = useContext(OverLive);
  const shape = { borderRadius: radius };
  const light = (alpha: number) => (hue ? tintA(hue, alpha) : glowA(alpha));
  if (overLive && !solid) {
    return (
      <View pointerEvents="none" testID="glass-over-live" style={[StyleSheet.absoluteFill, shape, styles.clip, styles.plainEdge, hue && { borderColor: tintA(hue, 0.45) }, lit && { borderColor: light(0.8) }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: lit ? light(deep ? 0.3 : 0.4) : raisedA(Math.max(tint, deep ? 0.7 : 0.55)) }]} />
      </View>
    );
  }
  if (solid) {
    return <View pointerEvents="none" testID="glass-solid" style={[StyleSheet.absoluteFill, shape, { backgroundColor: raisedA(0.96) }, lit && { backgroundColor: hue ? tintA(hue, 0.5) : glowDeepA(0.9) }]} />;
  }
  if (!GLASS) {
    return (
      <View pointerEvents="none" testID="glass-off" style={[StyleSheet.absoluteFill, shape, styles.clip, styles.plainEdge, hue && { borderColor: tintA(hue, 0.45) }, lit && { borderColor: light(0.8) }]}>
        {frost ? <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: lit ? light(deep ? 0.22 : 0.3) : raisedA(deep ? Math.max(tint, 0.6) : tint) }]} />
      </View>
    );
  }
  if (nativeGlass()) {
    return (
      <GlassView
        // Never in the touch's way: the press always reaches the button it belongs to, which answers with its own spring.
        pointerEvents="none"
        glassEffectStyle="regular"
        colorScheme="dark"
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
export const SHEET_BACKGROUND = GLASS && nativeGlass() ? raisedA(0.55) : color.nightRaised;

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
  plainEdge: { borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  rim: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderTopColor: 'rgba(255,255,255,0.28)' },
});
