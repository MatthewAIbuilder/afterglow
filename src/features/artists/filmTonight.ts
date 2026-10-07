import type { Show } from '../../data/models';

/**
 * "Film the set" on an artist's page: fans at the show film a minute from
 * the crowd and post it, so the artist's page and Discover fill with real
 * footage (the way to get sets YouTube won't let us play). Pure.
 *
 * The card shows on the night of one of their shows, or whenever the page
 * was opened from a printed code (`?film=1`, the link on stickers and
 * posters handed out at a show).
 */

export type FilmTonight = {
  /** Their show tonight on Afterglow, when there is one. */
  show?: Show;
};

/** What the card says and where it goes, or undefined when it shouldn't show. `shows` are theirs from today on. */
export function filmTonight(shows: readonly Show[], today: string, fromCode: boolean): FilmTonight | undefined {
  const show = shows.find((s) => s.date === today);
  if (show) return { show };
  return fromCode ? {} : undefined;
}

/** The camera's params for filming them (and tagging the show, when there is one). */
export function filmParams(artistId: string, card: FilmTonight): { artist: string; show?: string } {
  return card.show ? { artist: artistId, show: card.show.id } : { artist: artistId };
}
