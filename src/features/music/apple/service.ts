import { field, requestJson, type FetchLike } from '../http';
import { SECRET_KEY, type SecretStore } from '../secrets';
import { errorKind, MusicServiceError, type MusicService } from '../service';
import { appleMusicClient, readAppleMusicLibrary } from './api';
import { MusicKitError, type AppleMusicAuthorizer } from './musicKit';
import { normalizeAppleMusic } from './normalize';

/**
 * The Apple Music adapter. Apple-specific code stays in this folder.
 *
 * Two tokens: the developer token (from MusicKit itself, or fetched from
 * `tokenUrl`, a service you host that signs it with the MusicKit key, when
 * one is set; kept in memory only) and the person's Music User Token (from
 * MusicKit; kept in the secure store).
 */
export function appleMusicService(opts: {
  authorizer: AppleMusicAuthorizer;
  tokenUrl: string;
  secrets: SecretStore;
  fetch: FetchLike;
  /** Apple Music's permission prompt exists on iPhone only. */
  isIOS: boolean;
}): MusicService {
  let developerToken: string | undefined;

  async function getDeveloperToken(): Promise<string> {
    if (developerToken) return developerToken;
    const fromMusicKit = !opts.tokenUrl && opts.authorizer.developerToken;
    if (fromMusicKit) {
      // Why it couldn't (Apple Music not switched on for the app yet, most often) is what the screen explains.
      const token = await fromMusicKit().catch((e: unknown) => {
        const problem = e instanceof MusicKitError ? e.problem : 'not-ready';
        throw new MusicServiceError(problem === 'unknown' ? 'not-ready' : problem, 'MusicKit gave no developer token');
      });
      if (typeof token !== 'string' || !token) throw new MusicServiceError('not-ready', 'MusicKit gave no developer token');
      developerToken = token;
      return token;
    }
    if (!opts.tokenUrl.startsWith('https://')) throw new MusicServiceError('unavailable', 'No Apple Music token link');
    const token = field(await requestJson(opts.fetch, opts.tokenUrl, undefined, 'Apple Music developer token'), 'token');
    if (typeof token !== 'string' || !token) throw new MusicServiceError('unavailable', 'The developer token link gave no token');
    developerToken = token;
    return token;
  }

  return {
    provider: 'apple-music',
    availability() {
      if (!opts.isIOS) return { ok: false, reason: 'not-on-this-device' };
      if (!opts.authorizer.isSupported()) return { ok: false, reason: 'needs-full-app' };
      if (!opts.tokenUrl && !opts.authorizer.developerToken) return { ok: false, reason: 'not-set-up' };
      return { ok: true };
    },
    async connect() {
      if (!this.availability().ok) return { ok: false, reason: 'unavailable' };
      try {
        const r = await opts.authorizer.authorize(await getDeveloperToken());
        if (r.status === 'authorized') {
          await opts.secrets.set(SECRET_KEY['apple-music'], r.userToken);
          return { ok: true };
        }
        if (r.status === 'failed') return { ok: false, reason: r.problem };
        return { ok: false, reason: r.status === 'cancelled' ? 'cancelled' : 'denied' };
      } catch (e) {
        return { ok: false, reason: errorKind(e) };
      }
    },
    async fetchLibrary(at) {
      const userToken = await opts.secrets.get(SECRET_KEY['apple-music']);
      if (!userToken) throw new MusicServiceError('expired', 'Not connected to Apple Music');
      const get = appleMusicClient({ fetch: opts.fetch, developerToken: await getDeveloperToken(), userToken });
      try {
        return normalizeAppleMusic(await readAppleMusicLibrary(get), at);
      } catch (e) {
        if (errorKind(e) === 'expired') await opts.secrets.remove(SECRET_KEY['apple-music']);
        if (errorKind(e) === 'unavailable') developerToken = undefined;
        throw e;
      }
    },
    async disconnect() {
      // Apple has no call to revoke a Music User Token: it's forgotten here, and
      // access can be removed in Settings > Privacy & Security > Media & Apple Music.
      await opts.secrets.remove(SECRET_KEY['apple-music']);
    },
  };
}
