import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import type { RefObject } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { APP_NAME } from '../../config/app';
import { color, radius, space, type } from '../../theme/tokens';
import type { PlanCard } from './share';

/**
 * The poster-like card that goes out as a picture: your plan (plan-card) or
 * your recap (recap). Night gradient, a soft corner glow, the festival, then
 * each section's lines.
 */
/** The card keeps a phone's proportions on a wide screen. */
export const CARD_MAX_WIDTH = 420;

/** Capture the card and open the share sheet with the picture. Phones only (the website shares text). */
export async function sharePoster(ref: RefObject<View | null>, title: string): Promise<void> {
  try {
    const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
    } else {
      await Share.share({ url: uri });
    }
  } catch {
    // Cancelled or not possible here: nothing to do.
  }
}

/** The picture: night gradient, festival name, then each day (or tier) with its sets. */
export function PosterCard({ card, label }: { card: PlanCard; label?: string }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={label ?? `Your plan for ${card.title}`}>
      <LinearGradient colors={['#2A1A5E', '#140F33', color.night]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <Svg width={GLOW} height={GLOW} style={styles.glow} pointerEvents="none">
        <Defs>
          <RadialGradient id="card-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color.glow} stopOpacity={0.4} />
            <Stop offset="1" stopColor={color.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#card-glow)" />
      </Svg>
      <Text style={styles.brand}>{APP_NAME.toUpperCase()}</Text>
      <Text style={styles.title}>{card.title}</Text>
      {card.subtitle ? <Text style={styles.subtitle}>{card.subtitle}</Text> : null}
      {card.sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text style={styles.sectionHead}>{s.heading}</Text>
          {s.lines.map((l, i) => (
            <View key={`${l.name}-${i}`} style={styles.line}>
              {l.time ? <Text style={styles.time}>{l.time}</Text> : null}
              <Text style={styles.name} numberOfLines={1}>
                {l.star ? <Text style={styles.star}>★ </Text> : null}
                {l.name}
              </Text>
              {l.where ? (
                <Text style={styles.where} numberOfLines={1}>
                  {l.where}
                </Text>
              ) : null}
            </View>
          ))}
          {s.more > 0 ? <Text style={styles.more}>and {s.more} more</Text> : null}
        </View>
      ))}
      <Text style={styles.foot}>Made with {APP_NAME}</Text>
    </View>
  );
}

/** Size of the soft light in the card's corner. */
const GLOW = 320;

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', padding: space.xl, backgroundColor: color.night },
  glow: { position: 'absolute', top: -GLOW / 2.5, right: -GLOW / 3 },
  brand: { ...type.caption, color: color.glow, letterSpacing: 2 },
  title: { ...type.largeTitle, color: color.moon, marginTop: space.sm },
  subtitle: { ...type.label, color: color.moonDim, marginTop: space.xs },
  section: { marginTop: space.xl },
  sectionHead: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1, marginBottom: space.xs },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, paddingVertical: 3 },
  time: { ...type.caption, color: color.moonDim, width: 62, fontVariant: ['tabular-nums'] },
  name: { ...type.headline, fontSize: 15, color: color.moon, flexShrink: 1 },
  star: { color: color.glow },
  where: { ...type.caption, color: color.moonFaint, flex: 1, textAlign: 'right' },
  more: { ...type.caption, color: color.moonFaint, marginTop: 2 },
  foot: { ...type.caption, color: color.moonFaint, marginTop: space.xl },
});
