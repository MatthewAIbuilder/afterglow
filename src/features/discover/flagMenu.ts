import { Linking } from 'react-native';
import { APP_NAME, SUPPORT_EMAIL } from '../../config/app';
import type { Clip } from '../../data/models';
import { showActionSheet, showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { FLAG_LABEL, FLAG_REASONS, flagMailto, flagReport, type FlagReason } from './flags';

/**
 * The ••• on a YouTube clip: what's wrong with it? Picking a reason hides the
 * clip on this phone at once, then offers to send a short report (by email,
 * or the share sheet without a mail app) so it's left out for everyone, or
 * to undo.
 */
export function flagMenu(
  clip: Clip,
  artistName: string,
  link: string | undefined,
  act: { flag: (clipId: string, reason: FlagReason) => void; unflag: (clipId: string) => void },
) {
  haptic.select();
  const options = [...FLAG_REASONS.map((r) => FLAG_LABEL[r]), 'Cancel'];
  showActionSheet(
    { title: 'What’s wrong with this clip?', message: 'It’s hidden for you straight away.', options, cancelButtonIndex: options.length - 1 },
    (i) => {
      const reason = FLAG_REASONS[i];
      if (!reason) return;
      act.flag(clip.id, reason);
      haptic.settle();
      const source = clip.source?.provider === 'youtube' ? clip.source : undefined;
      const report = flagReport({ id: clip.id, title: clip.title, videoId: source?.videoId, link, channel: source?.channel }, artistName, reason, APP_NAME);
      showAlert('Clip hidden', 'Send a quick report so we can take it out for everyone?', [
        { text: 'Undo', onPress: () => act.unflag(clip.id) },
        { text: 'Not now', style: 'cancel' },
        { text: 'Send report', onPress: () => void sendReport(report) },
      ]);
    },
  );
}

async function sendReport(report: { subject: string; body: string }) {
  if (SUPPORT_EMAIL) {
    try {
      await Linking.openURL(flagMailto(SUPPORT_EMAIL, report));
      return;
    } catch {}
  }
  await shareMessage(report.body, report.subject).catch(() => undefined);
}
