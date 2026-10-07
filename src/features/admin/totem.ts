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
  return { brand, subtitle, codes, everyMin, showSec };
}

/** How long each pop-up really stays up (seconds): half the gap at most, so the logo always gets its time too. */
export const showFor = (s: Pick<TotemSettings, 'everyMin' | 'showSec'>) => Math.min(s.showSec, s.everyMin * 30);

/** "Pop one now" pressed at `at`, the `skips`th time: it shows the next sticker early, and the turn moves on past it. */
export type TotemNudge = { at: number; skips: number };

/**
 * What's on screen `now` for a totem started at `start`: after each gap of
 * `everyMin`, the next sticker in turn for `showSec` (counting down `left`
 * seconds; `at` is when this pop-up began). `nudge` brings one up straight away (from "Pop one now").
 */
export function totemPopup(s: Pick<TotemSettings, 'codes' | 'everyMin' | 'showSec'>, start: number, now: number, nudge?: TotemNudge): { code: string; index: number; left: number; at: number } | undefined {
  if (!s.codes.length) return undefined;
  const show = showFor(s) * 1000;
  const every = s.everyMin * 60_000;
  const skips = nudge?.skips ?? 0;
  if (nudge && now >= nudge.at && now < nudge.at + show) {
    const index = (Math.max(0, Math.floor((nudge.at - start) / every)) + skips - 1) % s.codes.length;
    return { code: s.codes[index], index, left: Math.ceil((nudge.at + show - now) / 1000), at: nudge.at };
  }
  const k = Math.floor((now - start) / every);
  const into = now - start - k * every;
  if (k < 1 || into >= show) return undefined;
  const index = (k - 1 + skips) % s.codes.length;
  return { code: s.codes[index], index, left: Math.ceil((show - into) / 1000), at: start + k * every };
}

/** The next sticker to pop up and how long until it does (seconds), for the "Next one in" teaser. */
export function totemNext(s: Pick<TotemSettings, 'codes' | 'everyMin'>, start: number, now: number, nudge?: TotemNudge): { code: string; inSec: number } | undefined {
  if (!s.codes.length) return undefined;
  const every = s.everyMin * 60_000;
  const k = Math.max(0, Math.floor((now - start) / every));
  return { code: s.codes[(k + (nudge?.skips ?? 0)) % s.codes.length], inSec: Math.ceil((start + (k + 1) * every - now) / 1000) };
}

/** Seconds as the totem's countdown: "4:05". */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
