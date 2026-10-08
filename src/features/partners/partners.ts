import type { Festival, Show } from "../../data/models";
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
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** Somewhere people travel to (a festival, or a show as one night): where it is and when. */
export type StayTrip = {
  id: string;
  location?: string;
  place?: { lat: number; lon: number };
  startDate?: string;
  endDate?: string;
};

/** Extra nights around it: arriving the day before, leaving a day later. */
export type StayExtra = { early?: boolean; late?: boolean };

/** A show as a trip: one night at the venue. */
export const showTrip = (show: Pick<Show, "id" | "date" | "venue" | "location" | "place">): StayTrip => ({
  id: show.id,
  location: [show.venue, show.location].filter(Boolean).join(", "),
  ...(show.place ? { place: show.place } : {}),
  startDate: show.date,
  endDate: show.date,
});

/**
 * The nights to stay: check in the day it starts (or the day before),
 * check out the day after it ends (or a day later). Nothing when undated. Pure.
 */
export function stayDates(trip: StayTrip, extra: StayExtra = {}): { checkin: string; checkout: string; nights: number } | undefined {
  if (!isDay(trip.startDate)) return undefined;
  const last = isDay(trip.endDate) && trip.endDate >= trip.startDate ? trip.endDate : trip.startDate;
  const checkin = addDays(trip.startDate, extra.early ? -1 : 0);
  const checkout = addDays(last, extra.late ? 2 : 1);
  return { checkin, checkout, nights: Math.round((Date.parse(checkout) - Date.parse(checkin)) / DAY) };
}

/** Stay22's query for a trip: our id, the venue, the nights, the campaign (which festival or show). */
function stayQuery(trip: StayTrip, aid: string, extra: StayExtra): URLSearchParams | undefined {
  const address = trip.location?.trim();
  if (!aid || (!address && !trip.place)) return undefined;
  const q = new URLSearchParams({ aid });
  if (trip.place) {
    q.set("lat", String(trip.place.lat));
    q.set("lng", String(trip.place.lon));
  }
  if (address) q.set("address", address);
  const d = stayDates(trip, extra);
  if (d) {
    q.set("checkin", d.checkin);
    q.set("checkout", d.checkout);
  }
  q.set("campaign", trip.id.slice(0, 60));
  return q;
}

/**
 * Where to stay: the catalogue's own link, or else one made for Stay22 from
 * the venue (its coordinates and/or the location words) and the nights
 * (`stayDates`). Stay22 picks the booking site; `campaign` says which
 * festival or show it was for. Nothing without an affiliate id or anywhere
 * to point at. Pure.
 */
export function stayLinkOf(
  trip: StayTrip & { links?: Festival["links"] },
  aid: string = STAY22_AID,
  extra: StayExtra = {},
): string | undefined {
  if (trip.links?.stay && !extra.early && !extra.late) return trip.links.stay;
  const q = stayQuery(trip, aid, extra);
  return q ? `https://www.stay22.com/allez/roam?${q.toString()}` : undefined;
}

/**
 * Stay22's live map of places to stay around the venue for those nights,
 * with prices (an embed), as a list or a map, in Afterglow's colours. Pure.
 */
export function stayMapUrl(
  trip: StayTrip,
  opts: { aid?: string; extra?: StayExtra; view?: "listview" | "map"; accent?: string; language?: string } = {},
): string | undefined {
  const q = stayQuery(trip, opts.aid ?? STAY22_AID, opts.extra ?? {});
  if (!q) return undefined;
  q.set("mapstyle", "dark");
  q.set("viewmode", opts.view ?? "listview");
  if (opts.accent && /^#?[0-9a-f]{6}$/i.test(opts.accent)) q.set("maincolor", opts.accent.replace("#", ""));
  if (opts.language) q.set("lang", opts.language);
  return `https://www.stay22.com/embed/gm?${q.toString()}`;
}

/** Whether a link is Stay22's own page (the map stays in place; anything else opens in the browser). */
export function isStay22Page(url: string): boolean {
  const host = /^https:\/\/([^/?#:]+)/i.exec(url)?.[1]?.toLowerCase();
  return !!host && (host === "stay22.com" || host.endsWith(".stay22.com"));
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
