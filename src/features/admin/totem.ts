import { isStickerCode } from '../finds/finds';

/**
 * The totem, pure: HQ's festival tablet showing a logo and name full
 * screen, now and then popping up a sticker people scan to claim. Its
 * settings live on that device only.
 */
export type TotemSettings = {
  /** 'afterglow', or the organizer whose logo it shows. */
  brand: string;
  /** A line under the name: the festival, the stage. */
  subtitle: string;
  /** Sticker codes it pops up, in turn. */
  codes: string[];
  /** Minutes between pop-ups. */
  everyMin: number;
  /** Seconds each one stays up. */
  showSec: number;
};

export const TOTEM_EVERY = [1, 3, 5, 10, 15] as const;
export const TOTEM_SHOW = [30, 60, 90, 120] as const;
export const TOTEM_SUBTITLE_MAX = 60;
export const TOTEM_CODES_MAX = 24;

export const DEFAULT_TOTEM: TotemSettings = { brand: 'afterglow', subtitle: '', codes: [], everyMin: 5, showSec: 60 };


/** Settings read back: anything odd falls back to the default. */
export function cleanTotem(raw: unknown): TotemSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const brand = typeof o.brand === 'string' && /^[a-z0-9-]{1,60}$/.test(o.brand) ? o.brand : DEFAULT_TOTEM.brand;
  const subtitle = typeof o.subtitle === 'string' ? o.subtitle.replace(/\s+/g, ' ').trim().slice(0, TOTEM_SUBTITLE_MAX) : '';
  const codes = Array.isArray(o.codes) ? [...new Set(o.codes.filter(isStickerCode))].slice(0, TOTEM_CODES_MAX) : [];
  const everyMin = (TOTEM_EVERY as readonly number[]).includes(o.everyMin as number) ? (o.everyMin as number) : DEFAULT_TOTEM.everyMin;
  const showSec = (TOTEM_SHOW as readonly number[]).includes(o.showSec as number) ? (o.showSec as number) : DEFAULT_TOTEM.showSec;
  // A pop-up stays up for half the gap at most, so the logo always gets its time too.
  return { brand, subtitle, codes, everyMin, showSec: Math.min(showSec, everyMin * 30) };
}

/**
 * What's on screen `now` for a totem started at `start`: after each gap of
 * `everyMin`, the next sticker in turn for `showSec` (counting down `left`
 * seconds). `nudge` brings one up straight away (from "Pop one now").
 */
export function totemPopup(s: Pick<TotemSettings, 'codes' | 'everyMin' | 'showSec'>, start: number, now: number, nudge?: number): { code: string; index: number; left: number } | undefined {
  if (!s.codes.length) return undefined;
  const show = s.showSec * 1000;
  if (nudge !== undefined && now >= nudge && now < nudge + show) {
    const index = Math.floor((nudge - start) / (s.everyMin * 60_000)) % s.codes.length;
    return { code: s.codes[index], index, left: Math.ceil((nudge + show - now) / 1000) };
  }
  const every = s.everyMin * 60_000;
  const k = Math.floor((now - start) / every);
  const into = now - start - k * every;
  if (k < 1 || into >= show) return undefined;
  const index = (k - 1) % s.codes.length;
  return { code: s.codes[index], index, left: Math.ceil((show - into) / 1000) };
}
