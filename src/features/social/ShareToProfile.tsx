import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { haptic } from '../../lib/haptics';
import { useSocial } from '../../state/social';
import type { Memory } from '../memories/models';
import { throwbackShares } from '../memories/throwbackLimit';
import { useStanding } from '../standing/useStanding';
import { SOCIAL_ERROR_COPY, socialErrorKind } from './service';
import { showAlert } from '../../lib/dialog';

/**
 * The "Share to profile" action for one memory, drawn by the caller. Says
 * what happens before anything leaves the phone, shows progress, and offers
 * to remove it again. Renders nothing when profiles aren't set up.
 */
export function ShareToProfile({ memory, render }: { memory: Memory; render: (label: string, onPress: () => void) => ReactNode }) {
  const social = useSocial();
  const standing = useStanding(social.user?.uid);
  if (!social.availability.ok) return null;
  const progress = social.sharing[memory.id];
  const mine = !!memory.sharedId && memory.sharedBy === social.user?.uid;

  if (progress !== undefined) return render(`Sharing… ${Math.round(progress * 100)}%`, () => {});
  // No signal: it's kept on the phone and goes by itself.
  if (social.waiting.has(memory.id)) return render('Waiting for signal', () => {});

  if (mine) {
    return render('On your profile', () => {
      haptic.select();
      showAlert('Remove from your profile?', 'It stays in your Memories on this phone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void social.unshare(memory).catch((e) => showAlert('Couldn’t remove it', SOCIAL_ERROR_COPY[socialErrorKind(e)])),
        },
      ]);
    });
  }

  return render('Share to profile', () => {
    haptic.select();
    if (!social.user) {
      router.push('/account');
      return;
    }
    if (!social.profile) {
      router.push('/profile-edit');
      return;
    }
    void confirm(social.profile.handle);
  });

  async function confirm(handle: string) {
    // A throwback past the free plan's few: say so now, before anything uploads. Not knowing (no signal)
    // doesn't stand in the way; the share itself is checked again.
    if (!memory.festivalId && memory.past && !standing?.plus) {
      const used = await social.service.throwbackUsage().catch(() => undefined);
      if (used !== undefined && !throwbackShares({ plus: false, used }).canShare) {
        showAlert('Couldn’t share it', SOCIAL_ERROR_COPY['throwback-limit']);
        return;
      }
    }
    showAlert(
      'Share to your profile?',
      `Anyone on Afterglow can watch it on @${handle}, with who was playing and the festival. Afterglow doesn’t add where you filmed it, but some videos carry their location inside the file. Only share videos you filmed yourself.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share',
          onPress: () =>
            void social
              .share(memory)
              .then((r) => {
                if (r === 'shared') haptic.settle();
              })
              .catch((e) => showAlert('Couldn’t share it', SOCIAL_ERROR_COPY[socialErrorKind(e)])),
        },
      ],
    );
  }
}
