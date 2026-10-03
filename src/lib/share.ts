import { Platform, Share } from 'react-native';
import { bumpQuestEvent } from '../state/dailyQuests';
import { showAlert } from './dialog';

/**
 * Share some text: the system share sheet on a phone; in a browser, its own
 * share sheet where there is one, otherwise the text is copied and we say so.
 * Resolves to what happened, so a caller can tell a share from a cancel.
 */
export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

export async function shareMessage(message: string, title?: string): Promise<ShareOutcome> {
  const outcome = await shareOnce(message, title);
  // Sharing counts for the "Spread the glow" daily quest.
  if (outcome === 'shared' || outcome === 'copied') bumpQuestEvent('share');
  return outcome;
}

async function shareOnce(message: string, title?: string): Promise<ShareOutcome> {
  if (Platform.OS !== 'web') {
    try {
      const r = await Share.share(title ? { title, message } : { message });
      return r.action === Share.dismissedAction ? 'dismissed' : 'shared';
    } catch {
      return 'failed';
    }
  }
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  if (nav?.share) {
    try {
      await nav.share(title ? { title, text: message } : { text: message });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'dismissed';
    }
  }
  try {
    await nav?.clipboard?.writeText(message);
    showAlert('Copied', 'Paste it wherever you like.');
    return 'copied';
  } catch {
    return 'failed';
  }
}
