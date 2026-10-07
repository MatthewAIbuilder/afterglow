import { WEB_URL } from '../../config/app';
import type { Tier } from './artistSprouts';

/**
 * A collectible card someone shares: a link to its own page
 * (`/card/<artistId>?h=<handle>&t=<level>&v=<videos>&s=1`), showing the card
 * as they have it, and how to earn your own. It shows what they shared; it
 * gives nothing (only filming earns a collectible). Pure.
 */
export type SharedCard = { artistId: string; handle: string; tier: Tier; videos: number; shiny: boolean };

const ID = /^[a-z0-9-]{1,80}$/;
const HANDLE = /^[a-z0-9._]{1,30}$/;

export function cardLink(c: SharedCard, base = WEB_URL): string {
  const q = [`h=${encodeURIComponent(c.handle)}`, `t=${c.tier}`, `v=${Math.max(0, Math.min(999, Math.round(c.videos)))}`, ...(c.shiny ? ['s=1'] : [])].join('&');
  return `${base.replace(/\/+$/, '')}/card/${c.artistId}?${q}`;
}

/** A card from `/card/[id]`'s params, or undefined when the artist id isn't one. */
export function cardFrom(p: { id?: unknown; h?: unknown; t?: unknown; v?: unknown; s?: unknown }): SharedCard | undefined {
  const artistId = typeof p.id === 'string' ? p.id : '';
  if (!ID.test(artistId)) return undefined;
  const handle = typeof p.h === 'string' ? p.h.trim().toLowerCase().replace(/^@/, '') : '';
  const tier = Number(p.t);
  const videos = Number(p.v);
  return {
    artistId,
    handle: HANDLE.test(handle) ? handle : '',
    tier: (tier === 1 || tier === 2 || tier === 3 ? tier : 0) as Tier,
    videos: Number.isFinite(videos) && videos > 0 ? Math.min(999, Math.round(videos)) : 0,
    shiny: p.s === '1',
  };
}
