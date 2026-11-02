import { SECRET_KEY, type SecretStore } from '../secrets';
import { MusicServiceError, type MusicService } from '../service';
import { libraryFromEmbeds, type LinkProblem, parseSpotifyLink, readSpotifyLink, resolveShortLink, sameLink, SPOTIFY_LINKS_MAX, type SpotifyLink, type TextFetch } from './links';
import { normalizeSpotify } from './normalize';

/**
 * Spotify by link: no sign-in (Spotify only lets a handful of people sign in
 * to an app like Afterglow). You add public playlists, albums or artists by
 * pasting their links; each sync reads their songs from Spotify's public
 * embed page (`links.ts`). The links live in the secure store under the one
 * Spotify key; disconnecting forgets them.
 *
 * Phones only: a browser isn't allowed to read Spotify's pages from another
 * website, so the website says to add playlists in the app.
 */
export type SpotifyLinks = { links: (SpotifyLink & { name?: string })[] };

const kindOf = (p: LinkProblem) => (p === 'network' ? 'network' : p);

export function spotifyService(opts: { secrets: SecretStore; fetchText: TextFetch; onPhone: boolean }): MusicService {
  const load = async (): Promise<SpotifyLinks> => {
    const raw = await opts.secrets.get(SECRET_KEY.spotify).catch(() => null);
    if (!raw) return { links: [] };
    try {
      const v = JSON.parse(raw) as Partial<SpotifyLinks>;
      return { links: Array.isArray(v.links) ? v.links.filter((l) => l && typeof l.id === 'string' && typeof l.kind === 'string') : [] };
    } catch {
      return { links: [] };
    }
  };
  const save = (v: SpotifyLinks) => opts.secrets.set(SECRET_KEY.spotify, JSON.stringify(v));

  return {
    provider: 'spotify',
    needsLink: true,
    availability() {
      return opts.onPhone ? { ok: true } : { ok: false, reason: 'not-on-this-device' };
    },
    async connect(input) {
      if (!opts.onPhone) return { ok: false, reason: 'unavailable' };
      const parsed = parseSpotifyLink(input ?? '');
      if (!parsed) return { ok: false, reason: 'bad-link' };
      const link = 'short' in parsed ? await resolveShortLink(opts.fetchText, parsed.short) : parsed;
      if (typeof link === 'string') return { ok: false, reason: kindOf(link) };
      // Read it now, so a private or empty playlist is said straight away.
      const reading = await readSpotifyLink(opts.fetchText, link);
      if (typeof reading === 'string') return { ok: false, reason: kindOf(reading) };
      const saved = await load();
      const rest = saved.links.filter((l) => !sameLink(l, link));
      await save({ links: [...rest, { ...link, ...(reading.name ? { name: reading.name.slice(0, 80) } : {}) }].slice(-SPOTIFY_LINKS_MAX) });
      return { ok: true };
    },
    async fetchLibrary(at) {
      const { links } = await load();
      if (!links.length) throw new MusicServiceError('expired', 'No Spotify links');
      const readings = [];
      let network = 0;
      for (const l of links) {
        const r = await readSpotifyLink(opts.fetchText, l);
        if (typeof r !== 'string') readings.push(r);
        else if (r === 'network') network++;
      }
      // Every link failed for want of signal: keep the last import rather than empty it.
      if (!readings.length && network) throw new MusicServiceError('network', 'Spotify embed: no answer');
      if (!readings.length) throw new MusicServiceError('not-public', 'No public Spotify links');
      return normalizeSpotify(libraryFromEmbeds(readings), at);
    },
    async links() {
      return (await load()).links.map((l) => ({ kind: l.kind, ...(l.name ? { name: l.name } : {}) }));
    },
    async disconnect() {
      await opts.secrets.remove(SECRET_KEY.spotify);
    },
  };
}
