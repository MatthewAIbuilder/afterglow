import { LinearGradient } from 'expo-linear-gradient';
import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { PALETTES, rgbaOf, type ThemeId } from '../../theme/palettes';
import { AnimatedBackdrop } from '../profile/AnimatedBackdrop';
import { themeOf } from './themes';
import { t } from '../../i18n';

const MOON = '#F3F0FF';
const MOON_DIM = 'rgba(243,240,255,0.62)';

/** A theme's sky: the night with its three lights, like `NightSky` but in any palette. */
export function ThemeSky({ id, width, height }: { id: ThemeId; width: number; height: number }) {
  const p = PALETTES[id];
  const g = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={`h${g}`} cx="78%" cy="8%" rx="85%" ry="55%">
          <Stop offset="0" stopColor={p.haze} stopOpacity="0.7" />
          <Stop offset="1" stopColor={p.haze} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`d${g}`} cx="5%" cy="92%" rx="80%" ry="50%">
          <Stop offset="0" stopColor={p.dusk} stopOpacity="0.55" />
          <Stop offset="1" stopColor={p.dusk} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`s${g}`} cx="95%" cy="100%" rx="45%" ry="30%">
          <Stop offset="0" stopColor={p.stage} stopOpacity="0.16" />
          <Stop offset="1" stopColor={p.stage} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={p.night} />
      <Rect width={width} height={height} fill={`url(#h${g})`} />
      <Rect width={width} height={height} fill={`url(#d${g})`} />
      <Rect width={width} height={height} fill={`url(#s${g})`} />
    </Svg>
  );
}

/**
 * A little phone showing what the whole app looks like in a theme: its sky,
 * the profile background that goes with it at the top, a profile, a match,
 * a button, a card and the tab bar, all in the theme's colours.
 */
export function ThemePreview({ id, width, still }: { id: ThemeId; width: number; still?: boolean }) {
  const p = PALETTES[id];
  const th = themeOf(id);
  const height = Math.round(width * 1.55);
  const band = Math.round(height * 0.3);
  const s = width / 220;
  return (
    <View style={[styles.phone, { width, height, borderRadius: 26 * s, borderColor: rgbaOf(p.glow, 0.35) }]}>
      <ThemeSky id={id} width={width} height={height} />
      {th.backdrop ? (
        <View style={[styles.band, { height: band }]}>
          <AnimatedBackdrop id={th.backdrop} width={width} height={band} still={still} />
          <LinearGradient colors={[rgbaOf(p.night, 0), rgbaOf(p.night, 1)]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
        </View>
      ) : null}
      <View style={{ alignItems: 'center', marginTop: band - 30 * s }}>
        <View style={[styles.avatar, { width: 56 * s, height: 56 * s, borderRadius: 28 * s, borderColor: p.glow, shadowColor: p.glow, backgroundColor: p.nightRaised }]}>
          <Text style={[styles.initial, { fontSize: 22 * s }]}>A</Text>
        </View>
        <View style={[styles.line, { width: 78 * s, height: 9 * s, marginTop: 8 * s, backgroundColor: MOON }]} />
        <View style={[styles.line, { width: 54 * s, height: 6 * s, marginTop: 5 * s, backgroundColor: MOON_DIM }]} />
        <View style={[styles.chip, { marginTop: 8 * s, paddingHorizontal: 8 * s, paddingVertical: 3 * s, backgroundColor: rgbaOf(p.glow, 0.16), borderColor: rgbaOf(p.glow, 0.4) }]}>
          <Text style={[styles.chipText, { color: p.glow, fontSize: 9 * s }]}>92% match</Text>
        </View>
      </View>
      <View style={[styles.card, { marginHorizontal: 14 * s, marginTop: 10 * s, padding: 10 * s, borderRadius: 14 * s, backgroundColor: rgbaOf(p.nightRaised, 0.85), borderColor: rgbaOf(p.glow, 0.18) }]}>
        <View style={styles.row}>
          <View style={[styles.dot, { width: 18 * s, height: 18 * s, borderRadius: 9 * s, backgroundColor: rgbaOf(p.glow, 0.3) }]} />
          <View style={{ flex: 1, marginLeft: 8 * s }}>
            <View style={[styles.line, { width: '70%', height: 6 * s, backgroundColor: MOON }]} />
            <View style={[styles.line, { width: '45%', height: 5 * s, marginTop: 4 * s, backgroundColor: MOON_DIM }]} />
          </View>
          <Text style={{ color: p.glow, fontSize: 10 * s, fontWeight: '700' }}>96%</Text>
        </View>
        <View style={[styles.track, { marginTop: 9 * s, height: 4 * s, borderRadius: 2 * s }]}>
          <View style={{ width: '64%', height: '100%', borderRadius: 2 * s, backgroundColor: p.glow }} />
        </View>
      </View>
      <View style={[styles.button, { marginHorizontal: 14 * s, marginTop: 10 * s, height: 26 * s, borderRadius: 13 * s, backgroundColor: p.glowDeep }]}>
        <Text style={[styles.buttonText, { fontSize: 10 * s }]}>{t('I’m going')}</Text>
      </View>
      <View style={[styles.tabs, { left: 12 * s, right: 12 * s, bottom: 10 * s, height: 30 * s, borderRadius: 15 * s, backgroundColor: rgbaOf(p.nightRaised, 0.9), borderColor: 'rgba(255,255,255,0.1)' }]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.tab, i === 0 && { backgroundColor: rgbaOf(p.glow, 0.18), borderRadius: 11 * s }]}>
            <View style={{ width: 8 * s, height: 8 * s, borderRadius: 4 * s, backgroundColor: i === 0 ? p.glow : MOON_DIM }} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** A small swatch for the list of themes: its sky, its glow and a button. */
export function ThemeSwatch({ id, width, height }: { id: ThemeId; width: number; height: number }) {
  const p = PALETTES[id];
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <ThemeSky id={id} width={width} height={height} />
      <View style={[styles.swatchGlow, { backgroundColor: p.glow, shadowColor: p.glow, top: height * 0.22, left: width * 0.14 }]} />
      <View style={[styles.swatchLine, { top: height * 0.24, left: width * 0.14 + 26, width: width * 0.4, backgroundColor: 'rgba(243,240,255,0.85)' }]} />
      <View style={[styles.swatchLine, { top: height * 0.24 + 9, left: width * 0.14 + 26, width: width * 0.26, backgroundColor: 'rgba(243,240,255,0.45)' }]} />
      <View style={[styles.swatchButton, { backgroundColor: p.glowDeep, bottom: height * 0.16, left: width * 0.14, right: width * 0.14 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  phone: { overflow: 'hidden', borderWidth: 1.5 },
  band: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  avatar: { borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  initial: { color: MOON, fontWeight: '700' },
  line: { borderRadius: 4, opacity: 0.9 },
  chip: { borderRadius: 999, borderWidth: 1 },
  chipText: { fontWeight: '700' },
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: {},
  track: { backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  button: { alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: MOON, fontWeight: '700' },
  tabs: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4, borderWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', margin: 3 },
  swatchGlow: { position: 'absolute', width: 18, height: 18, borderRadius: 9, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  swatchLine: { position: 'absolute', height: 5, borderRadius: 3 },
  swatchButton: { position: 'absolute', height: 12, borderRadius: 6 },
});
