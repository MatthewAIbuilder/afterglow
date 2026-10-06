import { Linking } from 'react-native';
import { APP_NAME, SUPPORT_EMAIL } from '../../config/app';
import type { Clip } from '../../data/models';
import { showActionSheet, showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { FLAG_REASONS, flagMailto, flagReport, type FlagReason } from './flags';
import { t } from '../../i18n';

/** The reasons as the menu shows them (the report itself keeps `FLAG_LABEL`, in English, for support). */
const REASON_SHOWN: Record<FlagReason, string> = {
  'wrong-artist': t('Wrong artist'),
  'not-a-set': t('Not a live set'),
  'wont-play': t('Doesn’t play'),
  other: t('Something else'),
};

/**
 * The ••• on a YouTube clip or a SoundCloud card: what's wrong with it?
 * Picking a reason hides the clip on this phone at once (for a SoundCloud
 * card, that artist's page, kept as a miss on this phone), then offers to
 * send a short report (by email, or the share sheet without a mail app) so
 * it's left out for everyone, or to undo.
 */
export function flagMenu(
  clip: Clip,
  artistName: string,
  link: string | undefined,
  act: { flag: (clipId: string, reason: FlagReason) => void; unflag: (clipId: string) => void },
) {
  haptic.select();
  const page = clip.source?.provider === 'soundcloud';
  // A SoundCloud page is never meant to be a live set.
  const reasons = page ? FLAG_REASONS.filter((r) => r !== 'not-a-set') : FLAG_REASONS;
  const options = [...reasons.map((r) => REASON_SHOWN[r]), t('Cancel')];
  showActionSheet(
    {
      title: page ? t('What’s wrong with this SoundCloud page?') : t('What’s wrong with this clip?'),
      message: t('It’s hidden for you straight away.'),
      options,
      cancelButtonIndex: options.length - 1,
    },
    (i) => {
      const reason = reasons[i];
      if (!reason) return;
      act.flag(clip.id, reason);
      haptic.settle();
      const source = clip.source?.provider === 'youtube' ? clip.source : undefined;
      const report = flagReport({ id: clip.id, title: clip.title, videoId: source?.videoId, link, channel: source?.channel }, artistName, reason, APP_NAME);
      showAlert(page ? t('Page hidden') : t('Clip hidden'), t('Send a quick report so we can take it out for everyone?'), [
        { text: t('Undo'), onPress: () => act.unflag(clip.id) },
        { text: t('Not now'), style: 'cancel' },
        { text: t('Send report'), onPress: () => void sendReport(report) },
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
