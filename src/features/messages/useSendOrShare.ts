import { router } from 'expo-router';
import { useCallback } from 'react';
import { shareMessage } from '../../lib/share';
import { useSocial } from '../../state/social';
import { shareParams, type ChatShare } from './shares';

/**
 * A share button's press: with a profile, "Send to" (friends' chats first,
 * other apps one tap away); without one, straight to the system share sheet
 * with the page's own words.
 */
export function useSendOrShare() {
  const social = useSocial();
  const canSend = !!social.user && !!social.profile;
  return useCallback(
    (share: ChatShare, text: string, title?: string) => {
      if (canSend) router.push({ pathname: '/send', params: shareParams(share) });
      else void shareMessage(text, title);
    },
    [canSend],
  );
}
