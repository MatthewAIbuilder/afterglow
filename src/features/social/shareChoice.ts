import { t } from '../../i18n';

/**
 * The "Share to Discover" row on the tagging sheet, pure: whether it shows,
 * what it needs first, and what it says. A tagged video (who was playing,
 * and the festival or show when there was one) can be shared as you save it, so it reaches other people's
 * Discover for that lineup; it's on by default once you could share, and
 * always your choice.
 */
export type ShareOffer = 'hidden' | 'needs-account' | 'needs-profile' | 'needs-tags' | 'ready';

export function shareOffer(o: { available: boolean; signedIn: boolean; hasProfile: boolean; tagged: boolean; alreadyShared: boolean }): ShareOffer {
  if (!o.available || o.alreadyShared) return 'hidden';
  if (!o.signedIn) return 'needs-account';
  if (!o.hasProfile) return 'needs-profile';
  return o.tagged ? 'ready' : 'needs-tags';
}

/** The line under the switch. */
export function shareDetail(offer: ShareOffer, o: { handle?: string; festival?: string; on: boolean }): string {
  if (offer === 'needs-account') return t('Sign in to share your videos to Discover.');
  if (offer === 'needs-profile') return t('Make a profile to share your videos to Discover.');
  if (offer === 'needs-tags') return t('Pick who was playing to share it to Discover.');
  if (!o.on) return t('Only in your Memories, on this phone.');
  const rest = { handle: String(o.handle) };
  return o.festival
    ? t('People discovering {festival} can watch it, credited to @{handle}. Afterglow doesn’t add where you filmed it, but some videos carry their location inside the file. Only share videos you filmed yourself.', { ...rest, festival: o.festival })
    : t('People discovering the lineup can watch it, credited to @{handle}. Afterglow doesn’t add where you filmed it, but some videos carry their location inside the file. Only share videos you filmed yourself.', rest);
}
