import type { Festival } from '../../data/models';
import type { Pick } from './plan';

/**
 * Your must-sees as a card to send friends: your top picks for a festival
 * (stars and must-sees first, then strong matches), each with why it's on
 * your list. Pure; the reasons come from reasons.ts.
 */
export const MUST_SEE_SHOWN = 5;

export type MustSeeLine = { artist: Pick['artist']; why: string; match?: number; star: boolean };
export type MustSeeCard = { festival: string; subtitle: string; lines: MustSeeLine[] };

/** Undefined when nothing on the lineup is for you yet. */
export function mustSeeCard(festival: Festival, picks: readonly Pick[], why: (p: Pick) => string, max = MUST_SEE_SHOWN): MustSeeCard | undefined {
  const rank = (p: Pick) => (p.pinned ? 0 : p.tier === 'must-see' ? 1 : p.tier === 'strong' ? 2 : 3);
  const top = picks
    .filter((p) => p.tier !== 'explore' || p.pinned)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .slice(0, max)
    .map(({ p }) => ({ artist: p.artist, why: why(p), ...(p.known ? { match: p.match } : {}), star: p.pinned }));
  if (!top.length) return undefined;
  return { festival: festival.name, subtitle: [festival.dates, festival.location].filter(Boolean).join(' · '), lines: top };
}

/** The same, as a message. */
export function mustSeeText(card: MustSeeCard, appName: string, webUrl: string): string {
  return [`My must-sees at ${card.festival}:`, ...card.lines.map((l, i) => `${i + 1}. ${l.star ? '★ ' : ''}${l.artist.name} · ${l.why}`), '', `Made with ${appName} · ${webUrl}`].join('\n');
}
