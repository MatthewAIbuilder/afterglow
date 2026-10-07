import { isTapFestivalId } from "./partners";

/** Festivals whose "Get tickets" was already counted while the app has been open (once each). */
const tapped = new Set<string>();

/**
 * Count a "Get tickets" tap for HQ, once per festival while the app is open,
 * and only when signed in (the count is a number per festival and day,
 * nothing about who). A failed count (no signal) may be tried again.
 */
export function countTicketTapOnce(
  service: { countTicketTap: (festivalId: string) => Promise<void> },
  festivalId: string,
  signedIn: boolean,
): void {
  if (!signedIn || tapped.has(festivalId) || !isTapFestivalId(festivalId)) return;
  tapped.add(festivalId);
  service.countTicketTap(festivalId).catch(() => tapped.delete(festivalId));
}

/** For tests: forget which festivals were counted. */
export function forgetTicketTaps(): void {
  tapped.clear();
}
