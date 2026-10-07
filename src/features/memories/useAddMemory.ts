import { router } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useMemories } from '../../state/memories';
import { pickVideo } from './device';
import { showActionSheet, showAlert } from '../../lib/dialog';
import { t } from '../../i18n';

/**
 * Choosing a video you already have, then the tagging sheet. A declined
 * permission or a clip that's too long says so plainly. (Recording happens
 * on the camera page.)
 */
export function useMemoryPicker() {
  const { setDraft } = useMemories();

  const from = useCallback(
    /**
     * `replace`: the tagging sheet takes this screen's place (from the camera, so you don't land back on it).
     * `params`: passed on to the tagging sheet (who you're filming, from their page).
     */
    async (source: 'camera' | 'library', { replace = false, params }: { replace?: boolean; params?: Record<string, string> } = {}) => {
      const r = await pickVideo(source);
      if (r.ok) {
        setDraft(r.video);
        const to = params ? { pathname: '/memory-tag' as const, params } : '/memory-tag';
        if (replace) router.replace(to);
        else router.push(to);
        return;
      }
      if (r.reason === 'no-permission') {
        showAlert(t('Camera access is off'), t('Allow Afterglow to use the camera in Settings to record memories.'), [
          { text: t('Not now'), style: 'cancel' },
          { text: t('Open Settings'), onPress: () => void Linking.openSettings().catch(() => {}) },
        ]);
      } else if (r.reason === 'too-long') {
        // The website takes longer videos and trims them on the tagging sheet; the phone's picker trims them itself.
        showAlert(t('That video is too long'), Platform.OS === 'web' ? t('Choose one of ten minutes or less. You can trim it to the best part next.') : t('Choose a clip of a minute or less.'));
      } else if (r.reason === 'too-large') {
        showAlert(t('That video is too big'), t('Choose one under 150 MB. A shorter clip usually is.'));
      } else if (r.reason === 'wrong-type') {
        showAlert(t('That isn’t a video Afterglow can share'), t('Choose a video from your Photos or Files (MP4 or MOV).'));
      } else if (r.reason === 'app-only') {
        showAlert(t('Memories are in the iPhone app'), t('Adding your own videos works in the Afterglow app on your phone for now.'));
      } else if (r.reason === 'failed') {
        showAlert(t('Couldn’t open that video'), t('Try another one.'));
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
    // In a browser: the page for choosing a video (the browser's chooser must open from a tap there, and
    // a hold on Discover isn't one).
    if (Platform.OS === 'web') {
      router.push('/camera');
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const done = () => {
      busy.current = false;
    };
    showActionSheet({ title: t('Add a memory'), options: [t('Record a video'), t('Choose from library'), t('Cancel')], cancelButtonIndex: 2 }, (i) => {
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
