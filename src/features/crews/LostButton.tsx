import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNetworkState } from 'expo-network';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useCrewUpdates } from '../../state/crewUpdates';
import { color, radius, space, type } from '../../theme/tokens';
import { isOffline } from '../offline/status';
import { t } from '../../i18n';

/**
 * "Can't find my crew": one tap tells every crew you're in at this festival,
 * pointing at your meeting spot when there is one. It waits for signal like
 * any check-in and keeps the time you tapped, and says honestly whether it
 * got through.
 */
export function LostButton({ festivalId }: { festivalId: string }) {
  const { callLost, outbox, dropped } = useCrewUpdates();
  const offline = isOffline(useNetworkState());
  const [sent, setSent] = useState<string | undefined>();

  const send = () =>
    showAlert(t('Tell your crew you can’t find them?'), t('They’ll see it with the time you sent it, and your meeting spot if you have one.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Send'),
        onPress: () => {
          const id = callLost(festivalId);
          if (!id) return;
          haptic.settle();
          setSent(id);
        },
      },
    ]);

  const waiting = sent ? outbox.some((o) => o.id === sent) : false;
  const status = !sent
    ? undefined
    : dropped.includes(sent)
      ? t('Couldn’t reach your crew. Try again, or head to your meeting spot.')
      : waiting
        ? offline
          ? t('Saved for when there’s signal. It sends itself, still marked when you tapped.')
          : t('Sending…')
        : t('Sent. Your crew can see it.');

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={send}
        accessibilityRole="button"
        accessibilityLabel={t('Can’t find my crew. Tell them')}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.text}>{t('Can’t find my crew')}</Text>
      </Pressable>
      {status ? (
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {status}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  button: {
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,184,107,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,184,107,0.6)',
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  text: { ...type.headline, color: '#FFB86B' },
  status: { ...type.caption, color: color.moonDim, textAlign: 'center' },
});
