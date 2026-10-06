/**
 * Where to hear an artist you don't know yet, before rating them: a search
 * on YouTube (live sets first) and on Spotify, and their own SoundCloud page
 * when Afterglow knows it (first: it's theirs, not a search). Plain links to
 * the services' own pages; nothing is fetched or copied into the app. Pure.
 */
export type ListenLink = { service: 'SoundCloud' | 'YouTube' | 'Spotify'; url: string };

export function listenLinks(artistName: string, soundcloud?: string): ListenLink[] {
  const name = artistName.trim();
  if (!name) return [];
  return [
    ...(soundcloud ? [{ service: 'SoundCloud' as const, url: soundcloud }] : []),
    { service: 'YouTube', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} live set`)}` },
    { service: 'Spotify', url: `https://open.spotify.com/search/${encodeURIComponent(name)}` },
  ];
}
