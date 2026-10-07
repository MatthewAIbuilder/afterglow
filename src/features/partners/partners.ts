import type { Festival } from "../../data/models";
import { t } from "../../i18n";

/**
 * Partner (affiliate) links: where Afterglow may earn a commission, and the
 * plain notices that must sit beside them. Nothing here shows unless a real
 * link was added (in the catalogue or `config/partners.ts`). Pure.
 */

/** Shown beside ticket and stay links that earn a commission. */
export const PARTNER_NOTE = t("Afterglow may earn a commission if you buy through these links. It doesn’t change your price.");

/** Amazon requires this exact statement wherever its links appear. */
export const AMAZON_NOTE =
  "As an Amazon Associate, Afterglow earns from qualifying purchases.";

/** Shown beside shop links that aren't Amazon's. */
export const SHOP_NOTE = t(
  "Afterglow may earn a commission from shop links. It doesn’t change your price.",
);

const httpsOnly = (url: unknown): url is string =>
  typeof url === "string" &&
  url.length <= 2000 &&
  /^https:\/\/[^\s]+$/i.test(url);

/** Whether a link goes to Amazon (amazon.com, amazon.co.uk…, or the amzn.to short links). */
export function isAmazonLink(url: string): boolean {
  const host = /^https:\/\/([^/?#:]+)/i.exec(url)?.[1]?.toLowerCase();
  if (!host) return false;
  return host === "amzn.to" || /(^|\.)amazon\.[a-z.]+$/.test(host);
}

/** The festival's links that earn a commission, while it isn't over. */
export function partnerLinks(
  festival: Festival,
  over: boolean,
): { tickets?: string; stay?: string } {
  if (over) return {};
  const l = festival.links;
  return {
    ...(l?.tickets && l.ticketsPartner ? { tickets: l.tickets } : {}),
    ...(l?.stay ? { stay: l.stay } : {}),
  };
}

/** Whether the festival page or checklist should show the commission notice. */
export function earnsFrom(festival: Festival, over: boolean): boolean {
  const p = partnerLinks(festival, over);
  return !!(p.tickets || p.stay);
}

/** Only the shop links that are real https links. */
export function cleanShopLinks(
  links: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(links)) if (httpsOnly(v)) out[k] = v;
  return out;
}

/** The notices for the shop links shown: Amazon's own wording and/or the general one. */
export function shopNotes(urls: readonly string[]): string[] {
  const notes: string[] = [];
  if (urls.some(isAmazonLink)) notes.push(AMAZON_NOTE);
  if (urls.some((u) => !isAmazonLink(u))) notes.push(SHOP_NOTE);
  return notes;
}

/** Whether the app has any partner link at all (the Terms and Privacy Policy then say so). */
export function hasPartnerLinks(
  festivals: readonly Festival[],
  shop: Readonly<Record<string, unknown>>,
): boolean {
  return (
    Object.keys(cleanShopLinks(shop)).length > 0 ||
    festivals.some(
      (f) => !!(f.links?.stay || (f.links?.tickets && f.links.ticketsPartner)),
    )
  );
}

/**
 * Shop links as this platform may show them. Amazon only allows its links
 * inside a phone app once it has approved the app (`AMAZON_APP_APPROVED` in
 * `config/partners.ts`), so until then they show on the website only.
 */
export function shopLinksFor(
  links: Readonly<Record<string, string>>,
  where: { web: boolean; amazonInApp: boolean },
): Record<string, string> {
  if (where.web || where.amazonInApp) return { ...links };
  return Object.fromEntries(Object.entries(links).filter(([, url]) => !isAmazonLink(url)));
}

/** A festival id that can name a ticket-tap count (`ticketTaps/<festival>_<day>`). */
export const isTapFestivalId = (id: unknown): id is string =>
  typeof id === "string" && /^[A-Za-z0-9_.-]{1,120}$/.test(id);
