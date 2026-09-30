import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { haptic } from '../../lib/haptics';
import { REPORT_REASONS, type ReportReason } from './models';
import { SOCIAL_ERROR_COPY, socialErrorKind, type ReportTarget } from './service';

/**
 * Reporting and blocking, the same way everywhere: choose a reason, send it,
 * and hear that it'll be reviewed; blocking asks first and says what it does.
 */
export function askReport(target: ReportTarget, send: (t: ReportTarget, r: ReportReason) => Promise<void>) {
  const done = async (reason: ReportReason) => {
    try {
      await send(target, reason);
      haptic.settle();
      Alert.alert('Thanks for reporting', 'It’ll be reviewed. You can also block this person so you don’t see them.');
    } catch (e) {
      Alert.alert('Couldn’t send the report', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    }
  };
  const title = target.kind === 'profile' ? 'Report this profile' : 'Report this video';
  const labels = REPORT_REASONS.map((r) => r.label);
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ title, options: [...labels, 'Cancel'], cancelButtonIndex: labels.length, userInterfaceStyle: 'dark' }, (i) => {
      if (i < labels.length) void done(REPORT_REASONS[i].key);
    });
  } else {
    Alert.alert(title, 'Why are you reporting it?', [
      ...REPORT_REASONS.slice(0, 2).map((r) => ({ text: r.label, onPress: () => void done(r.key) })),
      { text: 'Something else', onPress: () => void done('other') },
    ], { cancelable: true });
  }
}

export function askBlock(handle: string, blocked: boolean, set: (on: boolean) => Promise<void>) {
  if (blocked) {
    void set(false).then(() => haptic.select());
    return;
  }
  Alert.alert(`Block @${handle}?`, 'You won’t see their profile or videos, and they won’t show up when you search. They aren’t told.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Block',
      style: 'destructive',
      onPress: () =>
        void set(true)
          .then(() => haptic.settle())
          .catch((e) => Alert.alert('Couldn’t block', SOCIAL_ERROR_COPY[socialErrorKind(e)])),
    },
  ]);
}
