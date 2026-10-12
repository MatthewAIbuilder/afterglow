/**
 * The browser tab's title is website-only (PageTitle.web.tsx). Phones draw
 * nothing: on iOS, expo-router's Head also publishes Handoff activities and,
 * without a configured origin, alerts in release builds.
 */
export function PageTitle(_props: { title?: string }) {
  return null;
}
