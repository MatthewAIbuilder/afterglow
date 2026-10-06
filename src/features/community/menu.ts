import type { CommunityClipSource } from '../../data/models';
import { showActionSheet } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { askBlock, askReport } from '../social/moderation';
import type { ReportReason } from '../social/models';
import type { ReportTarget } from '../social/service';
import { t } from '../../i18n';

/**
 * The ••• on a community clip: report it (it's hidden for you straight away),
 * hide it, or block the person who shared it. Blocking and reporting ask first.
 */
export function communityMenu(
  source: CommunityClipSource,
  act: {
    report: (target: ReportTarget, reason: ReportReason) => Promise<void>;
    hide: (sharedId: string) => void;
    block: (uid: string, on: boolean) => Promise<void>;
  },
) {
  haptic.select();
  const target: ReportTarget = { kind: 'memory', id: source.sharedId, ownerUid: source.uid };
  const report = () =>
    askReport(target, async (what, r) => {
      await act.report(what, r);
      act.hide(source.sharedId);
    });
  const hide = () => {
    act.hide(source.sharedId);
    haptic.settle();
  };
  const block = () => askBlock(source.handle, false, (on) => act.block(source.uid, on));
  showActionSheet(
    {
      title: t('Video from @{handle}', { handle: source.handle }),
      options: [t('Report this video'), t('Hide this video'), t('Block @{handle}', { handle: source.handle }), t('Cancel')],
      destructiveButtonIndex: 2,
      cancelButtonIndex: 3,
    },
    (i) => (i === 0 ? report() : i === 1 ? hide() : i === 2 ? block() : undefined),
  );
}
