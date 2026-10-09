import { Platform, type ViewStyle } from 'react-native';

/**
 * Screen-tall pages you swipe through (Discover, a profile's videos).
 *
 * On a phone the list's own `pagingEnabled` snaps a page at a time. In a
 * browser that becomes CSS scroll snapping on every child of the list, and
 * the list's children include the blank stand-ins for pages not drawn yet:
 * each is one snap point however many pages it covers, so a flick could land
 * on its edge, at the very top or the end. In a browser each page snaps
 * instead, and a flick stops at the next one.
 */
const web = Platform.OS === 'web';

/** Spread on the list: `pagingEnabled` on a phone only. */
export const PAGED = { pagingEnabled: !web };

/** The list's style in a browser. */
export const pagedListStyle = (web ? { scrollSnapType: 'y mandatory' } : undefined) as ViewStyle | undefined;

/** Each page's outermost view in a browser. */
export const pageSnapStyle = (web ? { scrollSnapAlign: 'start', scrollSnapStop: 'always' } : undefined) as ViewStyle | undefined;
