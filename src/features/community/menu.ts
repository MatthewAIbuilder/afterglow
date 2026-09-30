import type { CommunityClipSource } from '../../data/models';
import { showActionSheet } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { askBlock, askReport } from '../social/moderation';
import type { ReportReason } from '../social/models';
import type { ReportTarget } from '../social/service';

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
    askReport(target, async (t, r) => {
      await act.report(t, r);
      act.hide(source.sharedId);
    });
  const hide = () => {
    act.hide(source.sharedId);
    haptic.settle();
  };
  const block = () => askBlock(source.handle, false, (on) => act.block(source.uid, on));
  showActionSheet(
    { title: `Video from @${source.handle}`, options: ['Report this video', 'Hide this video', `Block @${source.handle}`, 'Cancel'], destructiveButtonIndex: 2, cancelButtonIndex: 3 },
    (i) => (i === 0 ? report() : i === 1 ? hide() : i === 2 ? block() : undefined),
  );
}
