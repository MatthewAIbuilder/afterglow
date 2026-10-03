import * as Haptics from 'expo-haptics';

/** One place for haptic vocabulary, so the same action always feels the same. */
export const haptic = {
  select: () => Haptics.selectionAsync().catch(() => {}),
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  soft: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {}),
  settle: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  /** A big moment landing: the bass drop. */
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  /** Something earned: a badge unlocked. */
  celebrate: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};
