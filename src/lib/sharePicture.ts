import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { ShareOutcome } from './share';

/** What a shared picture is called and says, where the place it goes can carry words too. */
export type PictureInfo = { title: string; fileName: string; text?: string };

/**
 * Capture a card on screen as a PNG and open the share sheet with the picture
 * (phones). The website version (`sharePicture.web.ts`) shares or downloads it.
 */
export async function sharePicture(ref: RefObject<View | null>, info: PictureInfo): Promise<ShareOutcome> {
  try {
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: info.title,
      });
      return 'shared';
    }
    const r = await Share.share({ url: uri });
    return r.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}
