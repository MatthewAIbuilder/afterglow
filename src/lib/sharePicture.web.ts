import type { RefObject } from 'react';
import type { View } from 'react-native';
import { toBlob } from 'html-to-image';
import { showAlert } from './dialog';
import type { ShareOutcome } from './share';
import type { PictureInfo } from './sharePicture';

export type { PictureInfo } from './sharePicture';

/**
 * The website: draw the card into a PNG, then the browser's own share sheet
 * with the picture (phones' browsers), or download it where a browser can't
 * share files (most computers), and say where it went.
 */
export async function sharePicture(ref: RefObject<View | null>, info: PictureInfo): Promise<ShareOutcome> {
  let blob: Blob | null;
  try {
    // On the website the card is a page element: draw it as the browser shows it, sharp on any screen.
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) throw new Error('No card');
    const ratio = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
    blob = await toBlob(node, { pixelRatio: ratio, cacheBust: true, imagePlaceholder: TRANSPARENT });
    if (!blob) throw new Error('No picture');
  } catch {
    showAlert('Couldn’t make the picture', 'Try again, or share it as text.');
    return 'failed';
  }
  const name = `${info.fileName}.png`;
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const file = typeof File === 'undefined' ? undefined : new File([blob], name, { type: 'image/png' });
  const data: ShareData | undefined = file ? { files: [file], title: info.title, ...(info.text ? { text: info.text } : {}) } : undefined;
  if (data && nav?.share && nav.canShare?.(data)) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (e) {
      const kind = (e as { name?: string })?.name;
      if (kind === 'AbortError') return 'dismissed';
      if (kind === 'NotAllowedError') {
        // Drawing took longer than the browser lets a tap count (Safari): one more tap shares it.
        showAlert('Your picture is ready', undefined, [
          { text: 'Not now', style: 'cancel' },
          { text: 'Share', onPress: () => void nav.share(data).catch((err: { name?: string }) => err?.name !== 'AbortError' && download(blob, name)) },
        ]);
        return 'shared';
      }
      // Some browsers refuse files after saying yes: download it instead.
    }
  }
  return download(blob, name);
}

/** Save the picture to the computer's downloads and say so. */
function download(blob: Blob, name: string): ShareOutcome {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    showAlert('Picture saved', 'It’s in your downloads, ready to post or send.');
    return 'shared';
  } catch {
    return 'failed';
  }
}

/** Stands in for a picture another site won't let us copy (a profile photo), so the card still comes out. */
const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
