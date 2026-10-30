import { Directory, File, Paths } from 'expo-file-system';

/** A fit check's photo, copied into the app's own folder so it stays when the picker's copy is cleared. */
export async function keepFitPhoto(uri: string, name: string): Promise<string> {
  try {
    const dir = new Directory(Paths.document, 'fit-checks');
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new File(dir, `${name}.jpg`);
    if (dest.exists) dest.delete();
    await new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

/** Remove a fit check's kept photo (only ours, never the person's own Photos). */
export function dropFitPhoto(uri: string) {
  if (!uri.includes('/fit-checks/')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}
