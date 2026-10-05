import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { PageTitle } from '../../components/PageTitle';
import { CloseIcon } from '../../components/TabIcons';
import { CARD_MAX_WIDTH, PosterCard, sharePoster } from '../../features/plan/PosterCard';
import { useYear } from '../../features/recap/useRecap';
import { yearText } from '../../features/recap/year';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { useToday } from '../../lib/useToday';
import { color, radius, space, type } from '../../theme/tokens';
import { goBack } from '../../lib/nav';

/**
 * Your year on Afterglow: your festivals, top artists, sound and the numbers,
 * as a picture or text to share. A modal from Profile (`/year/2026`).
 */
export default function YearScreen() {
  const params = useLocalSearchParams<{ year: string }>();
  const today = useToday();
  const asked = Number(params.year);
  const year = Number.isInteger(asked) && asked > 2000 && asked < 3000 ? asked : today.getFullYear();
  const card = useYear(year);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.root}>
      <PageTitle title={`Your ${year}`} />
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>Your year</Text>
        <GlassCircleButton label="Close" onPress={() => goBack()}>
          <CloseIcon color={color.moon} />
        </GlassCircleButton>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {card ? (
          <>
            <View ref={cardRef} collapsable={false} style={{ width: Math.min(width - space.xl * 2, CARD_MAX_WIDTH) }}>
              <PosterCard card={card} label={`${card.title} on Afterglow`} />
            </View>
            <Pressable
              onPress={async () => {
                if (busy) return;
                haptic.tap();
                setBusy(true);
                await sharePoster(cardRef, `My ${year} on Afterglow`);
                setBusy(false);
              }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Share your year as an image"
              style={({ pressed }) => [styles.button, styles.primary, (pressed || busy) && styles.pressed]}
            >
              <Text style={styles.buttonText}>{busy ? 'Getting it ready…' : 'Share image'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic.select();
                void shareMessage(yearText(card));
              }}
              accessibilityRole="button"
              accessibilityLabel="Share your year as text"
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>Share as text</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.empty}>
            Nothing here yet. Mark the festivals you’re going to, watch some sets and rate artists, and your year fills in.
          </Text>
        )}
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
