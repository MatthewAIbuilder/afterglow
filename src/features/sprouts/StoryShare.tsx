import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useId, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { CloseIcon } from '../../components/TabIcons';
import { WEB_URL } from '../../config/app';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { pictureName } from '../../lib/pictureName';
import { sharePicture } from '../../lib/sharePicture';
import { color, radius, space, type } from '../../theme/tokens';

/** The site's address as the picture shows it: "afterglowmusic.app". */
const SITE = WEB_URL.replace(/^https?:\/\//, '');

/** A few stars scattered the same way every time (x, y as 0..1, size). */
const STARS: readonly (readonly [number, number, number])[] = [
  [0.08, 0.06, 1.2], [0.22, 0.13, 0.8], [0.86, 0.09, 1.4], [0.7, 0.18, 0.7], [0.93, 0.27, 1], [0.05, 0.3, 0.9],
  [0.16, 0.42, 0.6], [0.9, 0.48, 0.8], [0.04, 0.62, 1.1], [0.95, 0.66, 0.7], [0.12, 0.8, 0.8], [0.84, 0.84, 1.2],
  [0.3, 0.93, 0.7], [0.62, 0.95, 0.9], [0.46, 0.04, 0.8], [0.58, 0.11, 0.6],
];

/**
 * A picture the size of a phone story (9:16): night in the thing's own
 * colours, a glow behind it, a sprinkle of stars, the thing itself, then a
 * line about it and where it's from. What goes out when you share a card as
 * a picture.
 */
export function StoryFrame({ width, tint, glow, headline, sub, children }: { width: number; tint: string; glow: string; headline: string; sub?: string; children: ReactNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const height = Math.round((width * 16) / 9);
  const k = width / 360;
  return (
    <View style={[styles.frame, { width, height, borderRadius: radius.lg }]}>
      <LinearGradient colors={[tint, '#0E0A1E', '#05040A']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={`${uid}g`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={glow} stopOpacity={0.55} />
            <Stop offset="0.5" stopColor={glow} stopOpacity={0.16} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={width / 2} cy={height * 0.45} r={width * 0.62} fill={`url(#${uid}g)`} />
        {STARS.map(([x, y, r], i) => (
          <Circle key={i} cx={x * width} cy={y * height} r={r * k * 1.3} fill="#FFFFFF" opacity={0.35 + (i % 3) * 0.2} />
        ))}
      </Svg>
      <Text style={[styles.brand, { fontSize: 12 * k, letterSpacing: 4 * k, marginTop: height * 0.05 }]}>✦ AFTERGLOW</Text>
      <View style={styles.middle}>{children}</View>
      <Text style={[styles.headline, { fontSize: 22 * k, lineHeight: 28 * k }]} numberOfLines={2}>
        {headline}
      </Text>
      {sub ? (
        <Text style={[styles.sub, { fontSize: 13 * k, lineHeight: 18 * k }]} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
      <Text style={[styles.site, { fontSize: 11 * k, marginBottom: height * 0.045 }]}>{SITE}</Text>
    </View>
  );
}

/**
 * The picture before it goes out: shown big over whatever opened it, with a
 * Share button under it and a close button at the top. Lays over its parent
 * (no second pop-up), so it works inside a sheet too.
 */
export function StoryPreview({ title, tint, glow, headline, sub, onClose, children }: { title: string; tint: string; glow: string; headline: string; sub?: string; onClose: () => void; children: (width: number) => ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width: ww, height: wh } = useWindowDimensions();
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  // As big as fits between the close button and the Share button.
  const width = Math.round(Math.min(360, ww - 2 * space.xl, ((wh - insets.top - insets.bottom - 150) * 9) / 16));
  return (
    <View style={[styles.preview, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}>
      <View style={[styles.close, { top: insets.top + space.md }]}>
        <GlassCircleButton label={t('Close')} onPress={onClose}>
          <CloseIcon color={color.moon} size={16} />
        </GlassCircleButton>
      </View>
      <View ref={ref} collapsable={false} style={styles.shot}>
        <StoryFrame width={width} tint={tint} glow={glow} headline={headline} sub={sub}>
          {children(width)}
        </StoryFrame>
      </View>
      <Pressable
        disabled={busy}
        onPress={async () => {
          haptic.tap();
          setBusy(true);
          await sharePicture(ref, { title, fileName: pictureName(title) });
          setBusy(false);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('Share this picture')}
        style={({ pressed }) => [styles.share, { width }, pressed && { opacity: 0.85 }]}
      >
        {busy ? <ActivityIndicator color={color.moon} /> : <Text style={styles.shareText}>{t('Share picture')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', alignItems: 'center', backgroundColor: '#05040A', paddingHorizontal: space.lg },
  brand: { color: 'rgba(232,220,255,0.85)', fontWeight: '700' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headline: { ...type.title, color: color.moon, textAlign: 'center' },
  sub: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.xs },
  site: { ...type.caption, color: 'rgba(232,220,255,0.6)', letterSpacing: 1, marginTop: space.lg },
  preview: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, elevation: 30, backgroundColor: 'rgba(5,4,10,0.94)', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  close: { position: 'absolute', right: space.lg, zIndex: 31, elevation: 31 },
  shot: { borderRadius: radius.lg, overflow: 'hidden' },
  share: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  shareText: { ...type.headline, color: color.moon },
});
