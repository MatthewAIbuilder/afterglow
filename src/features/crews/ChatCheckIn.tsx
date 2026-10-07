import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { CloseIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { useCrewUpdates } from '../../state/crewUpdates';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { AMBER, GREEN, RED, useCareActions, useCheckInStatus } from './CheckInPanel';
import { t } from '../../i18n';

/** How long "Sent …" stays under the tray once it's really through. */
export const SENT_NOTE_MS = 6000;

/**
 * Checking in from a crew chat, in the one row above the message box.
 *
 * Open (as the chat opens): "I'm here" in one tap, how you are ("I'm OK",
 * "Can't find you", "Need help", the last two asked first, exactly as on the
 * Friends tab), and "More…" for a stage, a photo or your own words. Closed: a
 * small "Check in" pill leading the quick messages (`children`, which also
 * follow the check-ins when open), so it takes no extra room. Everything goes through the crew updates outbox like any
 * check-in, marked with the time you tapped, and says honestly whether it got
 * through.
 */
export function ChatCheckIn({ festivalId, open, onOpenChange, children }: { festivalId: string; open: boolean; onOpenChange: (open: boolean) => void; children?: ReactNode }) {
  const { checkIn } = useCrewUpdates();
  const reduce = useReducedMotion();
  const { done, status, tint, settled, clear } = useCheckInStatus();
  const sent = (id: string, what: string) => {
    done(id, what);
    onOpenChange(false);
  };
  const care = useCareActions(festivalId, sent);

  // "Sent …" fades away once it's through; waiting or refused stays said.
  useEffect(() => {
    if (!settled) return;
    const timer = setTimeout(clear, SENT_NOTE_MS);
    return () => clearTimeout(timer);
  }, [settled, clear]);

  const toggle = (next: boolean) => {
    haptic.select();
    onOpenChange(next);
  };

  return (
    <View style={styles.wrap}>
      {status ? (
        <Text style={[styles.status, tint ? { color: tint } : null]} accessibilityLiveRegion="polite" numberOfLines={2}>
          {status}
        </Text>
      ) : null}
      <Animated.View key={open ? 'open' : 'closed'} entering={reduce ? undefined : FadeIn.duration(220)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row}>
          {open ? (
            <>
              <Pressable
                onPress={() => toggle(false)}
                accessibilityRole="button"
                accessibilityLabel={t('Hide check-ins')}
                hitSlop={6}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              >
                <CloseIcon color={color.moonDim} size={12} />
              </Pressable>
              <Chip
                label={t('I’m here')}
                a11y={t('Send “{words}” to your crew', { words: t('I’m here') })}
                glow
                onPress={() => {
                  const id = checkIn(festivalId, { note: 'I’m here' });
                  if (id) sent(id, t('I’m here'));
                }}
              />
              <Chip label={care.asked ? t('I’m OK now') : t('I’m OK')} a11y={care.asked ? t('I’m OK now. Tell my crew') : t('I’m OK. Tell my crew')} tint={GREEN} onPress={care.ok} />
              <Chip label={t('Can’t find you')} a11y={t('Can’t find my crew. Tell them')} tint={AMBER} onPress={care.lost} />
              {care.asked ? null : <Chip label={t('Need help')} a11y={t('Not feeling great. Ask my crew to come find me')} tint={RED} onPress={care.help} />}
              <Chip label={t('More…')} a11y={t('Check in with a stage, a photo or your own words')} onPress={() => router.push('/check-in')} />
              {children ? <View style={styles.divider} /> : null}
              {children}
            </>
          ) : (
            <>
              <Pressable
                onPress={() => toggle(true)}
                accessibilityRole="button"
                accessibilityLabel={t('Check in with your crew')}
                accessibilityHint={t('Shows quick check-ins')}
                accessibilityState={{ expanded: false }}
                style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
              >
                <View style={styles.dot} />
                <Text style={styles.pillText}>{t('Check in')}</Text>
              </Pressable>
              {children}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function Chip({ label, a11y, tint, glow, onPress }: { label: string; a11y: string; tint?: string; glow?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.chip,
        glow ? styles.glowChip : null,
        tint ? { borderColor: `${tint}66`, backgroundColor: `${tint}14` } : null,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, tint ? { color: tint } : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  status: { ...type.caption, color: color.moonDim, paddingHorizontal: space.lg },
  row: { gap: space.sm, paddingHorizontal: space.lg, alignItems: 'center' },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  glowChip: { backgroundColor: glowA(0.22), borderColor: glowA(0.55), shadowColor: color.glow, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  chipText: { ...type.label, color: color.moon },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: glowA(0.14), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.45) },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.glow, shadowColor: color.glow, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  pillText: { ...type.label, color: color.moon },
  divider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: color.hairline },
  close: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
