import type { Festival } from "../../data/models";
import { STAY22_AID } from "../../config/partners";
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

const DAY = 86_400_000;
const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + DAY).toISOString().slice(0, 10);

/**
 * Where to stay for a festival: the catalogue's own link, or else one made
 * for Stay22 from the venue (its coordinates and/or the location words) and
 * the dates: check in the day it starts, check out the day after it ends.
 * Stay22 picks the booking site; `campaign` says which festival it was for.
 * Nothing without an affiliate id or anywhere to point at. Pure.
 */
export function stayLinkOf(
  festival: Pick<Festival, "id" | "location" | "place" | "startDate" | "endDate" | "links">,
  aid: string = STAY22_AID,
): string | undefined {
  if (festival.links?.stay) return festival.links.stay;
  const address = festival.location?.trim();
  if (!aid || (!address && !festival.place)) return undefined;
  const q = new URLSearchParams({ aid });
  if (festival.place) {
    q.set("lat", String(festival.place.lat));
    q.set("lng", String(festival.place.lon));
  }
  if (address) q.set("address", address);
  if (isDay(festival.startDate)) {
    const last = isDay(festival.endDate) && festival.endDate >= festival.startDate ? festival.endDate : festival.startDate;
    q.set("checkin", festival.startDate);
    q.set("checkout", nextDay(last));
  }
  q.set("campaign", festival.id.slice(0, 60));
  return `https://www.stay22.com/allez/roam?${q.toString()}`;
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
    ...(stayLinkOf(festival) ? { stay: stayLinkOf(festival) } : {}),
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
      (f) => !!(stayLinkOf(f) || (f.links?.tickets && f.links.ticketsPartner)),
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
