import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { closeDialog, subscribeDialogs, type WebDialog } from '../lib/dialog';
import { color, radius, space, type } from '../theme/tokens';
import { t } from '../i18n';

/**
 * Shows `showAlert` / `showActionSheet` in a browser, one at a time: a glass
 * card over a dimmed page, with its buttons (a list for a sheet). Tapping
 * outside, pressing Escape or Android's back button counts as cancel when
 * there is one. On phones it only shows long choice lists on Android; the
 * system shows everything else.
 */
export function DialogHost() {
  const [queue, setQueue] = useState<WebDialog[]>([]);
  useEffect(() => subscribeDialogs(setQueue), []);
  // Only filled in a browser, and by long choice lists on Android; phones otherwise use the system's.
  const d = queue[0];
  // Android's back button cancels, like a system dialog.
  useEffect(() => {
    if (!d) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (d.cancelable) closeDialog(d.id);
      return true;
    });
    return () => sub.remove();
  }, [d]);
  // Escape cancels, like a system dialog.
  useEffect(() => {
    if (!d || !d.cancelable || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDialog(d.id);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [d]);
  // In a browser, keyboard focus moves into the dialog, onto its first button.
  const first = useRef<View>(null);
  useEffect(() => {
    if (d && Platform.OS === 'web') (first.current as unknown as { focus?: () => void } | null)?.focus?.();
  }, [d]);
  if (!d) return null;
  const dismiss = () => d.cancelable && closeDialog(d.id);
  // Like the system's: two buttons side by side with Cancel on the left; otherwise a list with Cancel last.
  const cancels = d.buttons.filter((b) => b.style === 'cancel');
  const others = d.buttons.filter((b) => b.style !== 'cancel');
  const row = !d.sheet && d.buttons.length === 2;
  const buttons = row ? [...cancels, ...others] : [...others, ...cancels];

  return (
    // Over everything: it comes last in the root layout.
    <View style={styles.layer}>
      {/* The dimmed page behind: tapping it cancels. A sibling of the card, so the card's buttons aren't inside another button. */}
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityLabel={t('Close')}
 accessibilityRole="button" focusable={false} />
      <View style={styles.middle} pointerEvents="box-none">
        <View style={[styles.card, d.sheet && styles.sheet]} accessibilityRole="alert" accessibilityViewIsModal aria-modal>
          {d.title ? <Text style={styles.title}>{d.title}</Text> : null}
          {d.message ? <Text style={styles.message}>{d.message}</Text> : null}
          <View style={[styles.buttons, row && styles.row]}>
            {buttons.map((b, i) => (
              <Pressable
                key={`${b.text}-${i}`}
                ref={i === 0 ? first : undefined}
                onPress={() => closeDialog(d.id, b)}
                accessibilityRole="button"
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.button,
                  row && styles.half,
                  b.style === 'cancel' && styles.cancel,
                  (pressed || hovered) && styles.pressed,
                ]}
              >
                <Text style={[styles.buttonText, b.style === 'destructive' && styles.destructive, b.style === 'cancel' && styles.cancelText]}>{b.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  backdrop: { ...StyleSheet.absoluteFill as object, backgroundColor: 'rgba(3,2,10,0.62)' },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    width: '100%',
    maxWidth: 340,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.nightRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    gap: space.sm,
  },
  sheet: { maxWidth: 380 },
  title: { ...type.headline, color: color.moon, textAlign: 'center' },
  message: { ...type.body, color: color.moonDim, textAlign: 'center' },
  buttons: { gap: space.sm, marginTop: space.md },
  row: { flexDirection: 'row' },
  half: { flex: 1 },
  button: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  cancel: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.75 },
  buttonText: { ...type.headline, color: color.moon },
  destructive: { color: color.stage },
  cancelText: { color: color.moonDim, fontWeight: '500' },
});
