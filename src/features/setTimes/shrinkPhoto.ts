import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { TIP_PHOTO_MAX } from '../social/models';

/** Sizes to try, biggest first: a timetable stays readable at these widths. */
const TRIES: [number, number][] = [
  [1600, 0.6],
  [1200, 0.5],
  [900, 0.45],
];

/**
 * A timetable screenshot made small enough to send with the set times (a JPEG
 * data address under `TIP_PHOTO_MAX`), or undefined if it can't be.
 */
export async function shrinkPhoto(uri: string, width?: number): Promise<string | undefined> {
  for (const [w, compress] of TRIES) {
    try {
      const ctx = ImageManipulator.manipulate(uri);
      if (!width || width > w) ctx.resize({ width: w });
      const saved = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
      const data = saved.base64 ? `data:image/jpeg;base64,${saved.base64.replace(/\s+/g, '')}` : undefined;
      if (data && data.length <= TIP_PHOTO_MAX) return data;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
