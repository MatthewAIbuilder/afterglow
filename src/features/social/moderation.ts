import { haptic } from '../../lib/haptics';
import { REPORT_REASONS, type ReportReason } from './models';
import { SOCIAL_ERROR_COPY, socialErrorKind, type ReportTarget } from './service';
import { showActionSheet, showAlert } from '../../lib/dialog';
import { t } from '../../i18n';

/** A report reason as shown (the list in models.ts is written in English). */
function reasonLabel(key: ReportReason, english: string): string {
  const said: Record<ReportReason, string> = {
    offensive: t('Offensive or explicit'),
    harassment: t('Harassment or hate'),
    spam: t('Spam or misleading'),
    'not-theirs': t('Not their video'),
    other: t('Something else'),
  };
  return said[key] ?? english;
}

/**
 * Reporting and blocking, the same way everywhere: choose a reason, send it,
 * and hear that it'll be reviewed; blocking asks first and says what it does.
 */
export function askReport(target: ReportTarget, send: (t: ReportTarget, r: ReportReason) => Promise<void>) {
  const done = async (reason: ReportReason) => {
    try {
      await send(target, reason);
      haptic.settle();
      showAlert(t('Thanks for reporting'), t('It’ll be reviewed. You can also block this person so you don’t see them.'));
    } catch (e) {
      showAlert(t('Couldn’t send the report'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    }
  };
  const title = target.kind === 'profile' ? t('Report this profile') : target.kind === 'comment' ? t('Report this comment') : target.kind === 'chat' ? t('Report this message') : t('Report this video');
  const labels = REPORT_REASONS.map((r) => reasonLabel(r.key, r.label));
  showActionSheet({ title, message: t('Why are you reporting it?'), options: [...labels, t('Cancel')], cancelButtonIndex: labels.length }, (i) => {
    if (i < labels.length) void done(REPORT_REASONS[i].key);
  });
}

export function askBlock(handle: string, blocked: boolean, set: (on: boolean) => Promise<void>) {
  if (blocked) {
    void set(false).then(() => haptic.select());
    return;
  }
  showAlert(t('Block @{handle}?', { handle }), t('You won’t see their profile or videos, and they won’t show up when you search. They aren’t told.'), [
    { text: t('Cancel'), style: 'cancel' },
    {
      text: t('Block'),
      style: 'destructive',
      onPress: () =>
        void set(true)
          .then(() => haptic.settle())
          .catch((e) => showAlert(t('Couldn’t block'), SOCIAL_ERROR_COPY[socialErrorKind(e)])),
    },
  ]);
}
