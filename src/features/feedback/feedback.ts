import { SUPPORT_MAX } from '../social/models';

/**
 * "Spotted a problem, or got an idea?" from any page (the footer `PageFeedback`), pure.
 * The message goes to support like any other (HQ → Support), with the page it
 * was sent from on its last line, so HQ knows what it's about without asking.
 */
export type FeedbackKind = 'bug' | 'idea';

export const isFeedbackKind = (v: unknown): v is FeedbackKind => v === 'bug' || v === 'idea';

/** Only an app address ("/festival/edc-orlando-26"), never anything else a link could carry. */
export function cleanPage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const page = raw.split(/[?#]/)[0];
  return /^\/[A-Za-z0-9/_.()[\]-]{0,120}$/.test(page) ? page : undefined;
}

const footer = (page: string) => `\n\n— From ${page}`;

/** The message as sent: what they wrote, then the page, within the support limit (the words give way, never the page). */
export function feedbackMessage(text: string, page: string | undefined): string {
  const words = text.trim();
  if (!page) return words.slice(0, SUPPORT_MAX);
  const end = footer(page);
  return `${words.slice(0, Math.max(0, SUPPORT_MAX - end.length))}${end}`;
}

/** The email for someone signed out: the page in the subject. */
export function feedbackMail(to: string, kind: FeedbackKind, page: string | undefined): string {
  const subject = `Afterglow ${kind === 'bug' ? 'problem' : 'idea'}${page ? ` (${page})` : ''}`;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}`;
}
