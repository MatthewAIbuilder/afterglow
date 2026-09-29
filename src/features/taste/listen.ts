/**
 * Where to hear an artist you don't know yet, before rating them: a search
 * on YouTube (live sets first) and on Spotify. Plain links to the services'
 * own search pages; nothing is fetched or copied into the app. Pure.
 */
export type ListenLink = { service: 'YouTube' | 'Spotify'; url: string };

export function listenLinks(artistName: string): ListenLink[] {
  const name = artistName.trim();
  if (!name) return [];
  return [
    { service: 'YouTube', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} live set`)}` },
    { service: 'Spotify', url: `https://open.spotify.com/search/${encodeURIComponent(name)}` },
  ];
}
