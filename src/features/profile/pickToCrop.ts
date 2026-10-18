import * as ImagePicker from 'expo-image-picker';
import { Image as RNImage } from 'react-native';
import type { CropSource } from './PhotoCropper';

/** Choose a photo from the library, ready for the cropper (undefined when you back out). */
export async function pickToCrop(): Promise<CropSource | undefined> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
  const a = r.canceled ? undefined : r.assets?.[0];
  if (!a) return undefined;
  if (a.width > 0 && a.height > 0) return { uri: a.uri, width: a.width, height: a.height };
  // Some browsers don't say how big the photo is: measure it.
  return new Promise((resolve) =>
    RNImage.getSize(
      a.uri,
      (width, height) => resolve({ uri: a.uri, width, height }),
      () => resolve(undefined),
    ),
  );
}
