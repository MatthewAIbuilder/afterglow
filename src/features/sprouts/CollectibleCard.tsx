import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { t } from '../../i18n';
import { color, radius, space, type } from '../../theme/tokens';
import { type ArtistLook, foldName, SIGNATURE_NAMES } from './artistLook';
import { type Tier, TIER_LABEL } from './artistSprouts';
import { Collectible, TIER_COLOR } from './Collectible';

/** Card frames by level: a soft night edge, then bronze, silver and gold foil. */
const FRAME: Record<Tier, readonly [string, string, string]> = {
  0: ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.22)'],
  1: ['#F2B27A', '#8A4E22', '#E8A066'],
  2: ['#FFFFFF', '#8E98AC', '#E6ECF6'],
  3: ['#FFF1A8', '#B8860B', '#FFD24A'],
};
/** A shiny's frame: the whole spectrum. */
const SHINY_FRAME = ['#FF8AD8', '#8AB8FF', '#8AFFD0', '#FFE58A', '#FF8AD8'] as const;

/** A signature collectible's number in the set ("No. 7 of 58"), or undefined for one drawn from a sound. */
export function cardNumber(artistName: string): { n: number; of: number } | undefined {
  const i = SIGNATURE_NAMES.indexOf(foldName(artistName));
  return i < 0 ? undefined : { n: i + 1, of: SIGNATURE_NAMES.length };
}

/**
 * An artist collectible as a trading card: a foil frame for its level, the
 * creature in a window of its own colours, its name, the line about it, and
 * who it belongs to. A band of light sweeps across now and then (still with
 * reduced motion). Shown in the garden and on a shared card's page.
 */
export function CollectibleCard({
  look,
  artistName,
  tier = 0,
  shiny = false,
  owner,
  line,
  width = 280,
}: {
  look: ArtistLook;
  artistName: string;
  tier?: Tier;
  shiny?: boolean;
  /** "@maya", shown at the foot. */
  owner?: string;
  /** "Filmed 4 times", shown at the foot. */
  line?: string;
  width?: number;
}) {
  const height = Math.round(width * 1.4);
  const num = cardNumber(artistName);
  const reduce = useReducedMotion();
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    sweep.set(withRepeat(withDelay(1800, withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) })), -1, false));
    return () => cancelAnimation(sweep);
  }, [reduce, sweep]);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -width * 1.2 + sweep.get() * width * 2.4 }, { rotate: '20deg' }] }));
  const p = look.palette;
  const label = [
    num ? t('Card {n} of {of}', num) : undefined,
    look.name,
    artistName,
    shiny ? t('Shiny') : undefined,
    tier ? TIER_LABEL[tier] : undefined,
    owner,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <View style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <LinearGradient colors={shiny ? [...SHINY_FRAME] : [...FRAME[tier]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.frame, { borderRadius: width * 0.08 }]}>
        <View style={[styles.inner, { borderRadius: width * 0.07 }]}>
          <LinearGradient colors={[p.deep, color.night]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
          {/* Top line: the set number and the level. */}
          <View style={styles.top}>
            <Text style={[styles.num, { color: p.light }]}>{num ? `No. ${String(num.n).padStart(2, '0')}` : t('Sound series')}</Text>
            {shiny ? <Text style={[styles.badge, styles.shinyBadge]}>{t('Shiny')}</Text> : tier ? <Text style={[styles.badge, { color: TIER_COLOR[tier], borderColor: TIER_COLOR[tier] }]}>{TIER_LABEL[tier]}</Text> : null}
          </View>
          {/* The window: the creature in its own light. */}
          <View style={[styles.window, { borderColor: `${p.glow}55` }]}>
            <LinearGradient colors={[`${p.glow}40`, `${p.alt}22`, 'rgba(0,0,0,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
            {shiny ? <LinearGradient colors={['rgba(255,138,216,0.25)', 'rgba(138,184,255,0.18)', 'rgba(138,255,208,0.25)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
            <Collectible look={look} size={Math.round(width * 0.62)} tier={0} still={reduce} />
          </View>
          <Text style={[styles.name, { color: shiny ? '#FFFFFF' : look.accent }]} numberOfLines={1}>
            {look.name}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {artistName}
          </Text>
          <Text style={styles.flavour} numberOfLines={2}>
            {look.theme}.
          </Text>
          <View style={[styles.foot, { borderTopColor: `${p.glow}33` }]}>
            <Text style={styles.footText} numberOfLines={1}>
              {[owner, line].filter(Boolean).join(' · ') || 'Afterglow'}
            </Text>
            <Text style={[styles.mark, { color: p.glow }]}>✦</Text>
          </View>
          {/* A band of light sweeping across the foil. */}
          <Animated.View pointerEvents="none" style={[styles.sweep, { height: height * 1.6, top: -height * 0.3 }, sweepStyle]}>
            <LinearGradient colors={['rgba(255,255,255,0)', shiny ? 'rgba(255,230,255,0.28)' : 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, padding: 3 },
  inner: { flex: 1, overflow: 'hidden', padding: space.md, gap: 2, alignItems: 'center' },
  top: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  num: { ...type.caption, fontWeight: '700', letterSpacing: 1.2, fontVariant: ['tabular-nums'], opacity: 0.85 },
  badge: { ...type.caption, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: space.sm, paddingVertical: 1, borderRadius: radius.pill, borderWidth: 1, overflow: 'hidden' },
  shinyBadge: { color: '#1A1030', backgroundColor: '#FFE58A', borderColor: '#FFE58A' },
  window: { alignSelf: 'stretch', aspectRatio: 1.05, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginBottom: space.sm },
  name: { ...type.title, textAlign: 'center' },
  artist: { ...type.label, color: color.moon, letterSpacing: 1, textTransform: 'uppercase' },
  flavour: { ...type.caption, color: color.moonDim, textAlign: 'center', fontStyle: 'italic', marginTop: 2 },
  foot: { marginTop: 'auto', alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.xs },
  footText: { ...type.caption, color: color.moonDim, flex: 1 },
  mark: { ...type.caption },
  sweep: { position: 'absolute', left: 0, width: 90 },
});
