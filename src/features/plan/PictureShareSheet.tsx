import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { CloseIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { color, radius, space, type } from '../../theme/tokens';
import { CARD_MAX_WIDTH, PosterCard, sharePoster } from './PosterCard';
import type { PlanCard } from './share';
import { t } from '../../i18n';

/**
 * A plan-like card shown over the page so it goes out as a picture (with the
 * text as a quieter second choice), for shares that don't have a screen of
 * their own, like the crew's route.
 */
export function PictureShareSheet({
  visible,
  onClose,
  heading,
  card,
  text,
  shareTitle,
  label,
}: {
  visible: boolean;
  onClose: () => void;
  heading: string;
  card: PlanCard;
  text: string;
  shareTitle: string;
  /** What screen readers hear for the card and the buttons ("our route"). */
  label: string;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const shareImage = async () => {
    if (busy) return;
    haptic.tap();
    setBusy(true);
    await sharePoster(cardRef, shareTitle);
    setBusy(false);
  };

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.root}>
        <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
          <Text style={styles.heading} accessibilityRole="header">
            {heading}
          </Text>
          <GlassCircleButton label={t('Close')} onPress={onClose}>
            <CloseIcon color={color.moon} />
          </GlassCircleButton>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
          <View ref={cardRef} collapsable={false} style={{ width: Math.min(width - space.xl * 2, CARD_MAX_WIDTH) }}>
            <PosterCard card={card} label={label} />
          </View>
          <Pressable
            onPress={() => void shareImage()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('Share {label} as an image', { label })}
            style={({ pressed }) => [styles.button, styles.primary, (pressed || busy) && styles.pressed]}
          >
            <Text style={styles.buttonText}>{busy ? t('Getting it ready…') : t('Share image')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.select();
              void shareMessage(text, shareTitle);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Share {label} as text', { label })}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>{t('Share as text')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.sm },
  heading: { ...type.title, color: color.moon },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.md, alignItems: 'center' },
  button: {
    alignSelf: 'stretch',
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
