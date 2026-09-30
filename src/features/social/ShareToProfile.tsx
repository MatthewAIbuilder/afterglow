import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useSocial } from '../../state/social';
import type { Memory } from '../memories/models';
import { SOCIAL_ERROR_COPY, socialErrorKind } from './service';

/**
 * The "Share to profile" action for one memory, drawn by the caller. Says
 * what happens before anything leaves the phone, shows progress, and offers
 * to remove it again. Renders nothing when profiles aren't set up.
 */
export function ShareToProfile({ memory, render }: { memory: Memory; render: (label: string, onPress: () => void) => ReactNode }) {
  const social = useSocial();
  if (!social.availability.ok) return null;
  const progress = social.sharing[memory.id];
  const mine = !!memory.sharedId && memory.sharedBy === social.user?.uid;

  if (progress !== undefined) return render(`Sharing… ${Math.round(progress * 100)}%`, () => {});

  if (mine) {
    return render('On your profile', () => {
      haptic.select();
      Alert.alert('Remove from your profile?', 'It stays in your Memories on this phone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void social.unshare(memory).catch((e) => Alert.alert('Couldn’t remove it', SOCIAL_ERROR_COPY[socialErrorKind(e)])),
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
    Alert.alert(
      'Share to your profile?',
      `Anyone on Afterglow can watch it on @${social.profile.handle}, with who was playing and the festival. Afterglow doesn’t add where you filmed it, but some videos carry their location inside the file. Only share videos you filmed yourself.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share',
          onPress: () =>
            void social
              .share(memory)
              .then(() => haptic.settle())
              .catch((e) => Alert.alert('Couldn’t share it', SOCIAL_ERROR_COPY[socialErrorKind(e)])),
        },
      ],
    );
  });
}
