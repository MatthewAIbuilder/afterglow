import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { CloseIcon } from '../../components/TabIcons';
import { APP_NAME } from '../../config/app';
import { useFestivalPlan } from '../../features/plan/useFestivalPlan';
import type { PlanCard } from '../../features/plan/share';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useWeekends } from '../../state/weekends';
import { color, radius, space, type } from '../../theme/tokens';
import { shareMessage } from '../../lib/share';

/**
 * Share your plan: a poster-like card of it (the route once set times are
 * out, your picks before), as an image or as plain text. A modal over the
 * festival page.
 */
/** The card keeps a phone's proportions on a wide screen. */
const CARD_MAX_WIDTH = 420;

export default function PlanCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalog = useCatalog();
  const { forYou } = useWeekends();
  const whole = catalog.festival(id);
  if (!whole) return null;
  return <PlanCardView festival={forYou(whole)} />;
}

function PlanCardView({ festival }: { festival: Festival }) {
  const { card, text } = useFestivalPlan(festival);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const shareImage = async () => {
    if (busy) return;
    haptic.tap();
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: `My ${festival.name}` });
      } else {
        await Share.share({ url: uri });
      }
    } catch {
      // Cancelled or not possible here: nothing to do.
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>Share your plan</Text>
        <GlassCircleButton label="Close" onPress={() => router.back()}>
          <CloseIcon color={color.moon} />
        </GlassCircleButton>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {card ? (
          <View ref={cardRef} collapsable={false} style={{ width: Math.min(width - space.xl * 2, CARD_MAX_WIDTH) }}>
            <Card card={card} />
          </View>
        ) : (
          <Text style={styles.empty}>Like a few clips or rate some artists and your plan will be ready to share.</Text>
        )}
        {/* A picture needs the phone (the card is captured natively); the website shares the text. */}
        {card && Platform.OS !== 'web' ? (
          <Pressable
            onPress={shareImage}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Share your plan as an image"
            style={({ pressed }) => [styles.button, styles.primary, (pressed || busy) && styles.pressed]}
          >
            <Text style={styles.buttonText}>{busy ? 'Getting it ready…' : 'Share image'}</Text>
          </Pressable>
        ) : null}
        {text ? (
          <Pressable
            onPress={() => {
              haptic.select();
              void shareMessage(text);
            }}
            accessibilityRole="button"
            accessibilityLabel="Share your plan as text"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Share as text</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** The picture: night gradient, festival name, then each day (or tier) with its sets. */
function Card({ card }: { card: PlanCard }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`Your plan for ${card.title}`}>
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
  root: { flex: 1, backgroundColor: color.night },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.md },
  heading: { ...type.title, color: color.moon },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.md },
  empty: { ...type.body, color: color.moonDim },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  primary: { backgroundColor: color.glowDeep, borderColor: color.glowDeep, marginTop: space.md },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonText: { ...type.headline, color: color.moon },

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
