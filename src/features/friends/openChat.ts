import { router } from 'expo-router';
import { showAlert } from '../../lib/dialog';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../social/service';

/**
 * Open the 1-to-1 chat with a friend: made the first time, and only between
 * two people who follow each other (it says so when they don't follow you back).
 */
export async function openChatWith(open: (uid: string) => Promise<string>, uid: string, name: string): Promise<void> {
  try {
    const id = await open(uid);
    router.push({ pathname: '/crew-chat/[id]', params: { id } });
  } catch (e) {
    const kind = socialErrorKind(e);
    showAlert(
      kind === 'network' ? 'No signal' : `You can’t message ${name} yet`,
      kind === 'network' ? SOCIAL_ERROR_COPY.network : `You can message friends who follow you back. Once ${name} follows you too, you can chat.`,
    );
  }
}
