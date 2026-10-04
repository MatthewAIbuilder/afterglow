/**
 * Reading a timetable photo happens on the website (HQ on a computer), where
 * the text recognition runs in the browser. In the app it says so instead.
 */
export const canReadPhotos = false;

export async function readPhotoText(_photo: unknown, _stages: readonly string[], _onProgress?: (share: number) => void): Promise<string> {
  throw new Error('Reading photos works in HQ on the website.');
}
