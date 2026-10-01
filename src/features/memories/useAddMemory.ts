import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useMemories } from '../../state/memories';
import { pickVideo } from './device';
import { showActionSheet, showAlert } from '../../lib/dialog';

/**
 * Choosing a video you already have, then the tagging sheet. A declined
 * permission or a clip that's too long says so plainly. (Recording happens
 * on the camera page.)
 */
export function useMemoryPicker() {
  const { setDraft } = useMemories();

  const from = useCallback(
    /** `replace`: the tagging sheet takes this screen's place (from the camera, so you don't land back on it). */
    async (source: 'camera' | 'library', { replace = false }: { replace?: boolean } = {}) => {
      const r = await pickVideo(source);
      if (r.ok) {
        setDraft(r.video);
        if (replace) router.replace('/memory-tag');
        else router.push('/memory-tag');
        return;
      }
      if (r.reason === 'no-permission') {
        showAlert('Camera access is off', 'Allow Afterglow to use the camera in Settings to record memories.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings().catch(() => {}) },
        ]);
      } else if (r.reason === 'too-long') {
        showAlert('That video is too long', 'Choose a clip of a minute or less.');
      } else if (r.reason === 'app-only') {
        showAlert('Memories are in the iPhone app', 'Adding your own videos works in the Afterglow app on your phone for now.');
      } else if (r.reason === 'failed') {
        showAlert('Couldn’t open that video', 'Try another one.');
      }
    },
    [setDraft],
  );
  return from;
}

/**
 * Adding a memory: open the camera, or choose a video from your library.
 * One at a time.
 */
export function useAddMemory() {
  const from = useMemoryPicker();
  const busy = useRef(false);
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
    showActionSheet({ title: 'Add a memory', options: ['Record a video', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 }, (i) => {
      if (i === 0) {
        haptic.select();
        done();
        router.push('/camera');
      } else if (i === 1) {
        haptic.select();
        void from('library').finally(done);
      } else done();
    });
  }, [from]);
}
