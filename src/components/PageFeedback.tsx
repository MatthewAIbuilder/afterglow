import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedbackKind } from '../features/feedback/feedback';
import { haptic } from '../lib/haptics';
import { color, radius, space, type } from '../theme/tokens';
import { t } from '../i18n';

/**
 * At the end of a page: "Spotted a problem, or got an idea?" with two small buttons ("Report a problem", "Share an idea")
 * that open the feedback sheet (`/feedback`) knowing which page it's about.
 * Quiet on purpose: it waits at the bottom and never competes with the page.
 * The user asked on 2026-10-29 for "a way to report issues or suggestions on
 * basically any page", so anyone can help shape Afterglow.
 */
export function PageFeedback({ style }: { style?: object }) {
  const page = usePathname();
  const open = (kind: FeedbackKind) => {
    haptic.select();
    router.push({ pathname: '/feedback', params: { kind, page } });
  };
  return (
    <View style={[styles.root, style]}>
      <View style={styles.rule} />
      <Text style={styles.line}>{t('Spotted a problem, or got an idea?')}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => open('bug')}
          accessibilityRole="button"
          accessibilityLabel={t('Report a problem on this page')}
          hitSlop={6}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Text style={styles.chipText}>{t('Report a problem')}</Text>
        </Pressable>
        <Pressable
          onPress={() => open('idea')}
          accessibilityRole="button"
          accessibilityLabel={t('Share an idea for this page')}
          hitSlop={6}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Text style={styles.chipText}>{t('Share an idea')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.lg },
  rule: { width: 32, height: StyleSheet.hairlineWidth, backgroundColor: color.hairline, marginBottom: space.xs },
  line: { ...type.caption, color: color.moonFaint, textAlign: 'center' },
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  chipText: { ...type.caption, color: color.moonDim },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});
