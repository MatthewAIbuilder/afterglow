import { haptic } from '../../lib/haptics';
import { REPORT_REASONS, type ReportReason } from './models';
import { SOCIAL_ERROR_COPY, socialErrorKind, type ReportTarget } from './service';
import { showActionSheet, showAlert } from '../../lib/dialog';

/**
 * Reporting and blocking, the same way everywhere: choose a reason, send it,
 * and hear that it'll be reviewed; blocking asks first and says what it does.
 */
export function askReport(target: ReportTarget, send: (t: ReportTarget, r: ReportReason) => Promise<void>) {
  const done = async (reason: ReportReason) => {
    try {
      await send(target, reason);
      haptic.settle();
      showAlert('Thanks for reporting', 'It’ll be reviewed. You can also block this person so you don’t see them.');
    } catch (e) {
      showAlert('Couldn’t send the report', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    }
  };
  const title = target.kind === 'profile' ? 'Report this profile' : target.kind === 'comment' || target.kind === 'clipComment' ? 'Report this comment' : target.kind === 'chat' ? 'Report this message' : 'Report this video';
  const labels = REPORT_REASONS.map((r) => r.label);
  showActionSheet({ title, message: 'Why are you reporting it?', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length }, (i) => {
    if (i < labels.length) void done(REPORT_REASONS[i].key);
  });
}

export function askBlock(handle: string, blocked: boolean, set: (on: boolean) => Promise<void>) {
  if (blocked) {
    void set(false).then(() => haptic.select());
    return;
  }
  showAlert(`Block @${handle}?`, 'You won’t see their profile or videos, and they won’t show up when you search. They aren’t told.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Block',
      style: 'destructive',
      onPress: () =>
        void set(true)
          .then(() => haptic.settle())
          .catch((e) => showAlert('Couldn’t block', SOCIAL_ERROR_COPY[socialErrorKind(e)])),
    },
  ]);
}
