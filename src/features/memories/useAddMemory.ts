import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useMemories } from '../../state/memories';
import { MAX_CLIP_SECONDS, pickVideo } from './device';
import { showActionSheet, showAlert } from '../../lib/dialog';

/**
 * Adding a memory: record or choose a video, then the tagging sheet. One at a
 * time; a declined permission or a clip that's too long says so plainly.
 */
export function useAddMemory() {
  const { setDraft } = useMemories();
  const busy = useRef(false);

  const from = useCallback(
    async (source: 'camera' | 'library') => {
      const r = await pickVideo(source);
      if (r.ok) {
        setDraft(r.video);
        router.push('/memory-tag');
        return;
      }
      if (r.reason === 'no-permission') {
        showAlert('Camera access is off', 'Allow Afterglow to use the camera in Settings to record memories.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings().catch(() => {}) },
        ]);
      } else if (r.reason === 'too-long') {
        showAlert('That video is too long', `Choose a clip under ${MAX_CLIP_SECONDS / 60} minutes.`);
      } else if (r.reason === 'app-only') {
        showAlert('Memories are in the iPhone app', 'Adding your own videos works in the Afterglow app on your phone for now.');
      } else if (r.reason === 'failed') {
        showAlert('Couldn’t open that video', 'Try another one.');
      }
    },
    [setDraft],
  );

  return useCallback(() => {
    // In a browser there's nothing to choose between yet: say where it works.
    if (Platform.OS === 'web') {
      void from('library');
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const done = () => {
      busy.current = false;
    };
    const run = (source: 'camera' | 'library') => {
      haptic.select();
      void from(source).finally(done);
    };
    showActionSheet({ title: 'Add a memory', options: ['Record a video', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 }, (i) =>
      i === 0 ? run('camera') : i === 1 ? run('library') : done(),
    );
  }, [from]);
}
