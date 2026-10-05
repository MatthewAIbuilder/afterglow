import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Asset, requestPermissionsAsync as requestPhotosPermission } from 'expo-media-library';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';
import type { Moment } from './guess';

/**
 * The phone side of Memories: recording or choosing a video, reading when
 * and where it was filmed, and keeping files in Afterglow's own folder.
 * Everything here is best effort: a permission you decline or metadata a
 * video doesn't have just means a guess with less to go on, never an error.
 *
 * Only a city and region come out of `readMoment`; coordinates are turned
 * into a place name on the phone (the system geocoder) and dropped.
 */

/** Memories are clips: longer videos are trimmed (iPhone) or refused (Android). */
export const MAX_CLIP_SECONDS = 60;

export type PickedVideo = {
  uri: string;
  /** Just recorded (so it exists nowhere else yet), or chosen from the library. */
  source: 'camera' | 'library';
  durationSec?: number;
  width?: number;
  height?: number;
  moment: Moment;
};

export type PickResult = { ok: true; video: PickedVideo } | { ok: false; reason: 'cancelled' | 'no-permission' | 'too-long' | 'failed' | 'app-only' };

/** Record a new clip with the camera, or choose one from the library. */
export async function pickVideo(source: 'camera' | 'library'): Promise<PickResult> {
  try {
    if (source === 'camera') {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) return { ok: false, reason: 'no-permission' };
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_CLIP_SECONDS,
      // The iPhone's trimmer, so a long video becomes a clip instead of being refused.
      allowsEditing: Platform.OS === 'ios',
      quality: 1,
    };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.length) return { ok: false, reason: 'cancelled' };
    const a = result.assets[0];
    const durationSec = a.duration ? Math.round(a.duration / 1000) : undefined;
    if (durationSec && durationSec > MAX_CLIP_SECONDS + 1) return { ok: false, reason: 'too-long' };
    const moment = source === 'camera' ? await momentNow() : await momentOf(a.assetId ?? undefined);
    return { ok: true, video: { uri: a.uri, source, durationSec, width: a.width || undefined, height: a.height || undefined, moment } };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** A clip just filmed with Afterglow's own camera, ready for the tagging sheet: now, and where you are. */
export async function recordedVideo(uri: string, durationSec: number, size?: { width: number; height: number }): Promise<PickedVideo> {
  return { uri, source: 'camera', durationSec: Math.max(1, Math.round(durationSec)), width: size?.width, height: size?.height, moment: await momentNow() };
}

/** Finding where you are gives up after this long (deep in a crowd the phone may never get a fix): the video comes first. */
export const PLACE_TIMEOUT_MS = 6_000;

/** A promise's answer, or undefined once `ms` have passed. */
function within<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(undefined), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(undefined);
      },
    );
  });
}

/** Just recorded: now, and where you are (asking for location only while you use the app). */
async function momentNow(): Promise<Moment> {
  const when = new Date();
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { when };
    const place = await within(
      (async () => {
        const pos = (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        return placeOf(pos.coords.latitude, pos.coords.longitude);
      })(),
      PLACE_TIMEOUT_MS,
    );
    return { when, place };
  } catch {
    return { when };
  }
}

/** From the library: when and where the video itself says it was filmed. */
async function momentOf(assetId: string | undefined): Promise<Moment> {
  if (!assetId) return {};
  for (const id of Platform.OS === 'ios' && !assetId.startsWith('ph://') ? [assetId, `ph://${assetId}`] : [assetId]) {
    try {
      const asset = new Asset(id);
      const created = await asset.getCreationTime();
      const loc = await asset.getLocation().catch(() => null);
      return {
        when: created ? new Date(created) : undefined,
        place: loc ? await placeOf(loc.latitude, loc.longitude) : undefined,
      };
    } catch {
      // Try the other id form, or give up quietly.
    }
  }
  return {};
}

async function placeOf(latitude: number, longitude: number): Promise<Moment['place']> {
  try {
    const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!addr) return undefined;
    const city = addr.city ?? addr.subregion ?? undefined;
    const region = addr.region ?? undefined;
    return city || region ? { city: city ?? undefined, region } : undefined;
  } catch {
    return undefined;
  }
}

/** Where memory files live, by name. The folder is Afterglow's own, backed up with the app, never shown in Photos. */
export type MemoryFiles = {
  /** Copy a video into Memories and make its still; returns the still's name when one could be made. */
  keep(sourceUri: string, name: string): Promise<{ thumb?: string }>;
  remove(names: (string | undefined)[]): Promise<void>;
  uriOf(name: string): string;
  /** Names in the folder, to tidy up files no memory points to. */
  list(): string[];
  /** Save a copy to the phone's Photos. */
  saveToPhotos(name: string): Promise<boolean>;
};

const folder = () => {
  const dir = new Directory(Paths.document, 'memories');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return dir;
};

export const deviceMemoryFiles: MemoryFiles = {
  async keep(sourceUri, name) {
    const dest = new File(folder(), name);
    await new File(sourceUri).copy(dest);
    try {
      const shot = await VideoThumbnails.getThumbnailAsync(dest.uri, { time: 1000, quality: 0.7 });
      const thumb = name.replace(/\.[^.]+$/, '') + '.jpg';
      await new File(shot.uri).move(new File(folder(), thumb));
      return { thumb };
    } catch {
      return {};
    }
  },
  async remove(names) {
    for (const n of names) {
      if (!n) continue;
      try {
        const f = new File(folder(), n);
        if (f.exists) f.delete();
      } catch {
        // Already gone.
      }
    }
  },
  uriOf: (name) => new File(folder(), name).uri,
  list() {
    try {
      return folder()
        .list()
        .map((f) => decodeURIComponent(f.uri.replace(/\/$/, '').split('/').pop() ?? ''));
    } catch {
      return [];
    }
  },
  async saveToPhotos(name) {
    try {
      const { granted } = await requestPhotosPermission(true);
      if (!granted) return false;
      await Asset.create(new File(folder(), name).uri);
      return true;
    } catch {
      return false;
    }
  },
};
