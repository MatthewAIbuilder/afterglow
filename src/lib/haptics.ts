import * as Haptics from 'expo-haptics';

/** One place for haptic vocabulary, so the same action always feels the same. */
export const haptic = {
  select: () => Haptics.selectionAsync().catch(() => {}),
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  soft: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {}),
  settle: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
};
