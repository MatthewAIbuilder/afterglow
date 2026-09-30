import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { CloseIcon } from '../../components/TabIcons';
import { useFestivalPlan } from '../../features/plan/useFestivalPlan';
import { CARD_MAX_WIDTH, PosterCard, sharePoster } from '../../features/plan/PosterCard';
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
    await sharePoster(cardRef, `My ${festival.name}`);
    setBusy(false);
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
            <PosterCard card={card} />
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
});
