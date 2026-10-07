import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { t } from '../../i18n';
import { color, radius, space, type } from '../../theme/tokens';
import { type ArtistLook, foldName, shinyLook, SIGNATURE_NAMES } from './artistLook';
import { type Tier, TIER_LABEL } from './artistSprouts';
import { Collectible, TIER_COLOR } from './Collectible';
import { Sprout } from './Sprout';
import { kindOf, SPROUT_KINDS, type SproutKind } from './sprouts';

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
  still = false,
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
  /** Held still (no light sweeping, the creature not moving): for a picture. */
  still?: boolean;
}) {
  const height = Math.round(width * 1.4);
  const own = look;
  look = shiny ? shinyLook(own) : own;
  const num = cardNumber(artistName);
  // Type scales with the card, so a small one reads like a big one.
  const k = width / 280;
  // Small (a profile's showcase): the essentials only, in type that still reads.
  const mini = width < 170;
  const reduce = useReducedMotion() || still;
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
        <View style={[styles.inner, { borderRadius: width * 0.07 }, mini && styles.innerMini]}>
          <LinearGradient colors={[p.deep, color.night]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
          {/* Top line: the set number and the level. */}
          <View style={[styles.top, mini && styles.topMini]}>
            <Text style={[styles.num, { color: p.light }, mini && styles.numMini]} numberOfLines={1}>
              {num ? (mini ? `${num.n}` : `No. ${String(num.n).padStart(2, '0')}`) : mini ? '' : t('Sound series')}
            </Text>
            {shiny ? (
              <Text style={[styles.badge, styles.shinyBadge, mini && styles.badgeMini]}>{mini ? '✦' : t('Shiny')}</Text>
            ) : tier ? (
              <Text style={[styles.badge, { color: TIER_COLOR[tier], borderColor: TIER_COLOR[tier] }, mini && styles.badgeMini]}>{mini ? '●' : TIER_LABEL[tier]}</Text>
            ) : null}
          </View>
          {/* The window: the creature in its own light. */}
          <View style={[styles.window, { borderColor: `${p.glow}55` }, mini && styles.windowMini]}>
            <LinearGradient colors={[`${p.glow}40`, `${p.alt}22`, 'rgba(0,0,0,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
            {shiny ? <LinearGradient colors={['rgba(255,138,216,0.25)', 'rgba(138,184,255,0.18)', 'rgba(138,255,208,0.25)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
            <Collectible look={look} size={Math.round(width * 0.56)} tier={0} shiny={shiny} still={reduce} />
          </View>
          <Text style={[styles.name, { color: shiny ? '#FFFFFF' : look.accent, fontSize: mini ? 12 : 22 * k, lineHeight: mini ? 16 : 30 * k }]} numberOfLines={1} adjustsFontSizeToFit>
            {look.name}
          </Text>
          <Text style={[styles.artist, { fontSize: mini ? 8.5 : 12 * k, lineHeight: mini ? 12 : 16 * k }]} numberOfLines={1}>
            {artistName}
          </Text>
          {mini ? null : (
            <>
              <Text style={[styles.flavour, { fontSize: 12 * k, lineHeight: 16 * k }]} numberOfLines={2}>
                {look.theme}.
              </Text>
              <View style={[styles.foot, { borderTopColor: `${p.glow}33` }]}>
                <Text style={[styles.footText, { fontSize: 11 * k, lineHeight: 15 * k }]} numberOfLines={1}>
                  {[owner, line].filter(Boolean).join(' · ') || 'Afterglow'}
                </Text>
                <Text style={[styles.mark, { color: p.glow }]}>✦</Text>
              </View>
            </>
          )}
          {/* A band of light sweeping across the foil. */}
          {reduce ? null : <Animated.View pointerEvents="none" style={[styles.sweep, { height: height * 1.6, top: -height * 0.3 }, sweepStyle]}>
            <LinearGradient colors={['rgba(255,255,255,0)', shiny ? 'rgba(255,230,255,0.28)' : 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </Animated.View>}
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
  window: { alignSelf: 'stretch', aspectRatio: 1.18, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginBottom: space.sm },
  name: { ...type.title, textAlign: 'center' },
  artist: { ...type.label, color: color.moon, letterSpacing: 1, textTransform: 'uppercase' },
  flavour: { ...type.caption, color: color.moonDim, textAlign: 'center', fontStyle: 'italic', marginTop: 2 },
  foot: { marginTop: 'auto', alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.xs },
  footText: { ...type.caption, color: color.moonDim, flex: 1 },
  mark: { ...type.caption },
  how: { textTransform: 'none', letterSpacing: 0 },
  sweep: { position: 'absolute', left: 0, width: 90 },
  innerMini: { padding: 6, gap: 0 },
  topMini: { marginBottom: 4, minHeight: 14 },
  numMini: { fontSize: 9, lineHeight: 12, letterSpacing: 0.4 },
  badgeMini: { fontSize: 8, lineHeight: 12, paddingHorizontal: 4, paddingVertical: 0, borderWidth: 0 },
  windowMini: { marginBottom: 4 },
  back: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  backRing: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(185,156,255,0.55)' },
  backMark: { color: '#E8DCFF', textShadowColor: '#B99CFF', textShadowRadius: 18 },
  backWord: { position: 'absolute', bottom: '14%', color: 'rgba(232,220,255,0.7)', letterSpacing: 4, fontWeight: '700' },
});

/**
 * A card's back: night, a ring of light and Afterglow's spark, the same on
 * every card (what you see before it turns over).
 */
export function CardBack({ width = 280 }: { width?: number }) {
  const height = Math.round(width * 1.4);
  return (
    <LinearGradient colors={['#B99CFF', '#5A3EB0', '#FF8AD8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.frame, { width, height, borderRadius: width * 0.08 }]}>
      <LinearGradient colors={['#1A1240', '#0B0814']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[styles.back, { borderRadius: width * 0.07 }]}>
        <View style={[styles.backRing, { width: width * 0.5, height: width * 0.5, borderRadius: width * 0.25 }]} />
        <Text style={[styles.backMark, { fontSize: width * 0.16 }]}>✦</Text>
        <Text style={[styles.backWord, { fontSize: 12 * (width / 280) }]}>AFTERGLOW</Text>
      </LinearGradient>
    </LinearGradient>
  );
}

/**
 * Earning a collectible: its card arrives face down and turns over (a quick
 * squeeze and open, the same on every phone and in the browser). Straight
 * to the front with reduced motion.
 */
export function CardReveal(props: Parameters<typeof CollectibleCard>[0]) {
  const reduce = useReducedMotion();
  const turn = useSharedValue(reduce ? 1 : 0);
  const [front, setFront] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    turn.set(withDelay(650, withTiming(1, { duration: 520, easing: Easing.inOut(Easing.cubic) })));
    const timer = setTimeout(() => setFront(true), 650 + 260);
    return () => clearTimeout(timer);
  }, [reduce, turn]);
  // Squeeze to nothing at the halfway mark, then open on the other side.
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.02, Math.abs(1 - turn.get() * 2)) }] }));
  return <Animated.View style={style}>{front ? <CollectibleCard {...props} /> : <CardBack width={props.width} />}</Animated.View>;
}

/**
 * A sprout as a card, in its kind's colours: its number among the kinds, the
 * sprout in bloom, its name, who it's from and the line about it. Shown
 * for a sprout in bloom (one still growing shows how it's growing instead).
 */
export function SproutCard({ kind, from, line, width = 260, still }: { kind: SproutKind; from?: string; line?: string; width?: number; still?: boolean }) {
  const height = Math.round(width * 1.4);
  const k = width / 280;
  const spec = kindOf(kind);
  const n = SPROUT_KINDS.findIndex((x) => x.id === kind) + 1;
  const [light, deep] = spec.body;
  return (
    <View style={{ width, height }} accessible accessibilityRole="image" accessibilityLabel={[t('Card {n} of {of}', { n, of: SPROUT_KINDS.length }), spec.name, from].filter(Boolean).join(', ')}>
      <LinearGradient colors={[light, spec.accent, deep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.frame, { borderRadius: width * 0.08 }]}>
        <View style={[styles.inner, { borderRadius: width * 0.07 }]}>
          <LinearGradient colors={['#0F2A1E', color.night]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.top}>
            <Text style={[styles.num, { color: light }]}>{`No. ${String(n).padStart(2, '0')}`}</Text>
            <Text style={[styles.badge, { color: spec.accent, borderColor: spec.accent }]}>{t('Sprout')}</Text>
          </View>
          <View style={[styles.window, { borderColor: `${spec.accent}55` }]}>
            <LinearGradient colors={[`${spec.accent}40`, `${light}1F`, 'rgba(0,0,0,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
            <Sprout kind={kind} stage={3} size={Math.round(width * 0.56)} still={still} />
          </View>
          <Text style={[styles.name, { color: spec.accent, fontSize: 22 * k, lineHeight: 30 * k }]} numberOfLines={1} adjustsFontSizeToFit>
            {spec.name}
          </Text>
          <Text style={[styles.artist, styles.how, { fontSize: 12 * k, lineHeight: 18 * k }]} numberOfLines={1} adjustsFontSizeToFit>
            {spec.how}
          </Text>
          <Text style={[styles.flavour, { fontSize: 12 * k, lineHeight: 16 * k }]} numberOfLines={2}>
            {spec.about}
          </Text>
          <View style={[styles.foot, { borderTopColor: `${spec.accent}33` }]}>
            <Text style={[styles.footText, { fontSize: 11 * k, lineHeight: 15 * k }]} numberOfLines={1}>
              {[from, line].filter(Boolean).join(' · ') || 'Afterglow'}
            </Text>
            <Text style={[styles.mark, { color: spec.accent }]}>✿</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
