import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { accentEdge, color, radius, space, type } from '../../theme/tokens';
import { snoozed } from './installKind';
import { promptInstall, useInstallKind } from './webInstall';

/** When "Not now" was last pressed (ms), so the card stays away for two weeks (`install.snoozed.v1`). */
export const INSTALL_SNOOZE_KEY = 'install.snoozed.v1';

/**
 * "Add Afterglow to your home screen": on the website only, for anyone who
 * hasn't already. The App Store app isn't out yet, so this is the stand-in:
 * the website opens full screen from the home screen, like an app. Draws
 * nothing on the phone app, once it's on the home screen, or on a computer
 * with no install button (docs/install-web-app.md).
 */
export function InstallCard() {
  const kind = useInstallKind();
  const [asleep, setAsleep] = useState<boolean | undefined>(undefined);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(INSTALL_SNOOZE_KEY)
      .then((raw) => {
        if (live) setAsleep(snoozed(raw ? Number(raw) : undefined, Date.now()));
      })
      .catch(() => {
        if (live) setAsleep(false);
      });
    return () => {
      live = false;
    };
  }, []);

  if (kind === 'none' || kind === 'installed' || asleep !== false) return null;

  const notNow = () => {
    haptic.tap();
    setAsleep(true);
    void AsyncStorage.setItem(INSTALL_SNOOZE_KEY, String(Date.now())).catch(() => {});
  };

  const how =
    kind === 'ios-safari'
      ? [t('Tap the Share button at the bottom of your browser.'), t('Scroll down and tap Add to Home Screen.'), t('Tap Add. Afterglow is now on your home screen.')]
      : null;

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.title} accessibilityRole="header">
        {t('Add Afterglow to your home screen')}
      </Text>
      <Text style={styles.body}>{t('It opens full screen, like an app. The App Store app is coming soon.')}</Text>

      {kind === 'ios-other-app' ? <Text style={styles.body}>{t('This browser can’t add websites to your home screen. Open afterglowmusic.app in Safari first, then tap Share and Add to Home Screen.')}</Text> : null}
      {kind === 'menu' ? <Text style={styles.body}>{t('Open your browser’s menu and tap Add to Home screen.')}</Text> : null}
      {steps && how ? (
        <View style={styles.steps}>
          {how.map((line, i) => (
            <Text key={i} style={styles.step}>{`${i + 1}. ${line}`}</Text>
          ))}
        </View>
      ) : null}

      <View style={styles.row}>
        {kind === 'prompt' ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              void promptInstall();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, accentEdge, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{t('Add to home screen')}</Text>
          </Pressable>
        ) : null}
        {kind === 'ios-safari' && !steps ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              setSteps(true);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, accentEdge, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{t('Show me how')}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={notNow} accessibilityRole="button" accessibilityLabel={t('Hide this for now')} style={({ pressed }) => [styles.later, pressed && styles.pressed]}>
          <Text style={styles.laterText}>{t('Not now')}</Text>
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
  steps: { gap: space.xs, marginTop: space.xs },
  step: { ...type.body, color: color.moon },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  primary: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.label, color: color.night },
  later: { paddingHorizontal: space.md, paddingVertical: space.sm + 2 },
  laterText: { ...type.label, color: color.moonDim },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
