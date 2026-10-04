import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { PageTitle } from '../../components/PageTitle';
import { CloseIcon } from '../../components/TabIcons';
import { CARD_MAX_WIDTH, PosterCard, sharePoster } from '../../features/plan/PosterCard';
import { recapText } from '../../features/recap/recap';
import { useRecap } from '../../features/recap/useRecap';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { useCatalog } from '../../state/catalog';
import { color, radius, space, type } from '../../theme/tokens';
import { goBack } from '../../lib/nav';

/**
 * Your recap of a festival that's over: your artists there, your nights, your
 * sound and the numbers, as a picture or text to share. A modal from the
 * festival page and Profile.
 */
export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const festival = useCatalog().festival(id);
  const card = useRecap(festival);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.root}>
      <PageTitle title={festival ? `Your ${festival.name}` : 'Your recap'} />
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>Your recap</Text>
        <GlassCircleButton label="Close" onPress={() => goBack()}>
          <CloseIcon color={color.moon} />
        </GlassCircleButton>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {card ? (
          <>
            <View ref={cardRef} collapsable={false} style={{ width: Math.min(width - space.xl * 2, CARD_MAX_WIDTH) }}>
              <PosterCard card={card} label={`Your recap of ${card.title}`} />
            </View>
            {Platform.OS !== 'web' ? (
              <Pressable
                onPress={async () => {
                  if (busy) return;
                  haptic.tap();
                  setBusy(true);
                  await sharePoster(cardRef, `My ${card.title}`);
                  setBusy(false);
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Share your recap as an image"
                style={({ pressed }) => [styles.button, styles.primary, (pressed || busy) && styles.pressed]}
              >
                <Text style={styles.buttonText}>{busy ? 'Getting it ready…' : 'Share image'}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                haptic.select();
                void shareMessage(recapText(card));
              }}
              accessibilityRole="button"
              accessibilityLabel="Share your recap as text"
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>Share as text</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.empty}>
            Your recap is ready once the festival is over, if you were going, filmed something there or starred sets.
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
