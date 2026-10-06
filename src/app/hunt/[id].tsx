import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { PageTitle } from '../../components/PageTitle';
import { CloseIcon } from '../../components/TabIcons';
import { WEB_URL } from '../../config/app';
import { huntShareText, untilLine } from '../../features/finds/finds';
import { HuntCard } from '../../features/finds/HuntCard';
import { CARD_MAX_WIDTH, sharePoster } from '../../features/plan/PosterCard';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { goBack } from '../../lib/nav';
import { shareMessage } from '../../lib/share';
import { useFinds } from '../../state/finds';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * One sticker hunt you've started: every sticker in it (found ones in colour),
 * how far you got, and once it's finished, a card to share. Opened from the
 * garden and from a sticker's page. A modal.
 */
export default function HuntScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const finds = useFinds();
  const progress = finds.hunts.find((h) => h.hunt.id === id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const { refreshHunt } = finds;
  // Stickers join a hunt over time: read it again when it opens.
  useEffect(() => {
    if (id) refreshHunt(id);
  }, [id, refreshHunt]);
  const cardWidth = Math.min(width - space.xl * 2, CARD_MAX_WIDTH);

  return (
    <View style={styles.root}>
      <PageTitle title={progress ? progress.hunt.name : t('Sticker hunt')} />
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>{progress?.done ? t('Hunt complete') : t('Sticker hunt')}</Text>
        <GlassCircleButton label={t('Close')} onPress={() => goBack()}>
          <CloseIcon color={color.moon} />
        </GlassCircleButton>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        {progress ? (
          <>
            <View ref={cardRef} collapsable={false} style={{ width: cardWidth }}>
              <HuntCard progress={progress} width={cardWidth} />
            </View>
            {!progress.done ? (
              <Text style={styles.hint}>
                {progress.hunt.until
                  ? t('Find the rest by scanning their stickers with Friends → Scan, or your phone’s camera. {until}.', { until: untilLine(progress.hunt.until) })
                  : t('Find the rest by scanning their stickers with Friends → Scan, or your phone’s camera.')}
              </Text>
            ) : null}
            {Platform.OS !== 'web' ? (
              <Pressable
                onPress={async () => {
                  if (busy) return;
                  haptic.tap();
                  setBusy(true);
                  await sharePoster(cardRef, progress.hunt.name);
                  setBusy(false);
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t('Share your hunt as an image')}
                style={({ pressed }) => [styles.button, styles.primary, (pressed || busy) && styles.pressed]}
              >
                <Text style={styles.buttonText}>{busy ? t('Getting it ready…') : t('Share image')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                haptic.select();
                void shareMessage(huntShareText(progress, WEB_URL));
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Share your hunt as text')}
              style={({ pressed }) => [styles.button, Platform.OS === 'web' && styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>{Platform.OS === 'web' ? t('Share') : t('Share as text')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.empty}>{t('This hunt shows up here once you’ve found one of its stickers.')}</Text>
            <Pressable onPress={() => router.replace('/garden')} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>{t('See your collection')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.md },
  heading: { ...type.title, color: color.moon },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.md, alignItems: 'center' },
  empty: { ...type.body, color: color.moonDim, alignSelf: 'stretch' },
  hint: { ...type.caption, color: color.moonDim, textAlign: 'center', alignSelf: 'stretch' },
  button: {
    minHeight: 52,
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  primary: { backgroundColor: color.glowDeep, borderColor: color.glowDeep },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonText: { ...type.headline, color: color.moon },
});
