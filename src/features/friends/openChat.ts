import { router } from 'expo-router';
import { showAlert } from '../../lib/dialog';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../social/service';
import { t } from '../../i18n';

/** You follow each other, but the database refused the chat: messages aren't switched on there yet. */
export class MessagesOffError extends Error {
  constructor() {
    super('messages-off');
  }
}

/**
 * The 1-to-1 chat with a friend, made the first time: only between two
 * people who follow each other. When it can't be had, says why (they don't
 * follow you back, or there's no signal) and resolves to nothing.
 */
export async function directRoomWith(open: (uid: string) => Promise<string>, uid: string, name: string): Promise<string | undefined> {
  try {
    return await open(uid);
  } catch (e) {
    if (e instanceof MessagesOffError) {
      showAlert(t('Messages aren’t ready yet'), t('You and {name} follow each other, but Afterglow can’t start chats just yet: its database needs an update first. Try again later.', { name }));
      return undefined;
    }
    const kind = socialErrorKind(e);
    showAlert(
      kind === 'network' ? t('No signal') : t('You can’t message {name} yet', { name }),
      kind === 'network' ? SOCIAL_ERROR_COPY.network : t('You can message people you follow who follow you back. Once {name} follows you too, you can chat.', { name }),
    );
    return undefined;
  }
}

/** Open the 1-to-1 chat with a friend (see `directRoomWith`). */
export async function openChatWith(open: (uid: string) => Promise<string>, uid: string, name: string): Promise<void> {
  const id = await directRoomWith(open, uid, name);
  if (id) router.push({ pathname: '/crew-chat/[id]', params: { id } });
}
