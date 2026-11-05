import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGUAGE, t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { useSocial } from '../../state/social';
import { accentEdge, color, radius, space, type } from '../../theme/tokens';
import { PUSH_REGISTERED_KEY, type PushRegistered } from './push';
import { browserSubscription, webPushPermission } from './webPush';

/**
 * "Turn on notifications" on the website, for a signed-in person whose browser
 * can show them and hasn't been asked yet (on an iPhone that means once
 * Afterglow is on the home screen). Draws nothing on the phone app, before
 * sign-in, or until web push is set up (docs/web-push.md).
 */
export function NotifyCard() {
  const { user, service } = useSocial();
  const [permission, setPermission] = useState(() => webPushPermission());
  const [busy, setBusy] = useState(false);
  const uid = user?.uid;

  if (!uid || permission !== 'default') return null;

  const turnOn = async () => {
    haptic.tap();
    setBusy(true);
    try {
      const sub = await browserSubscription(true);
      const token = sub ? await service.webPushSubscribe(sub) : undefined;
      if (token) {
        await service.registerPush(token, LANGUAGE);
        const mark: PushRegistered = { uid, token, lang: LANGUAGE, rooms: '', day: new Date().toDateString() };
        await AsyncStorage.setItem(PUSH_REGISTERED_KEY, JSON.stringify(mark)).catch(() => {});
        haptic.settle();
      }
    } catch {
      /* the browser or the signal said no; the card goes or stays by the browser's answer */
    } finally {
      setBusy(false);
      setPermission(webPushPermission());
    }
  };

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.title} accessibilityRole="header">
        {t('Turn on notifications')}
      </Text>
      <Text style={styles.body}>{t('Hear when your crew messages you, checks in or sets a meeting spot, even when Afterglow is closed.')}</Text>
      <View style={styles.row}>
        <Pressable onPress={() => void turnOn()} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.primary, accentEdge, (pressed || busy) && styles.pressed]}>
          <Text style={styles.primaryText}>{t('Turn on')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.xl,
    marginTop: space.lg,
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  title: { ...type.headline, color: color.moon },
  body: { ...type.body, color: color.moonDim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  primary: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.label, color: color.night },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
