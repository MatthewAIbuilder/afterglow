import { Directory, File, Paths } from 'expo-file-system';

/**
 * A photo waiting to go to your crew is copied into the app's own folder
 * first, so it's still there if the signal holds it back for hours (a
 * picker's copy can be cleared at any time). Removed once it's sent.
 */
const folder = () => {
  const dir = new Directory(Paths.document, 'crew-photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

/** Keep a picked photo for sending; its new location (or the original, if copying fails). */
export async function keepCrewPhoto(uri: string, id: string): Promise<string> {
  try {
    const dest = new File(folder(), `${id}.jpg`);
    if (dest.exists) dest.delete();
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

/** Remove a sent photo's kept copy (only ours, never the person's own Photos). */
export function forgetCrewPhoto(uri: string | undefined) {
  if (!uri || !uri.includes('/crew-photos/')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}
