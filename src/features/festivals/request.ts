/**
 * Asking for a festival that isn't in the app yet. Pure: the words and the
 * link; sending is the phone's (mail or the share sheet).
 */

export type FestivalRequest = { name: string; link?: string };

/** Trimmed, and at most a sensible length, so a paste can't flood the message. */
export const cleanRequest = (name: string, link?: string): FestivalRequest | undefined => {
  const n = name.trim().slice(0, 80);
  if (!n) return undefined;
  const l = link?.trim().slice(0, 300);
  return l ? { name: n, link: l } : { name: n };
};

export function requestText({ name, link }: FestivalRequest, appName: string) {
  return {
    subject: `Festival request: ${name}`,
    body: [`Please add ${name} to ${appName}.`, link ? `Lineup or website: ${link}` : undefined, `Sent from ${appName}`]
      .filter(Boolean)
      .join('\n\n'),
  };
}

/** A mailto link to `email`, with the subject and body filled in. */
export function requestMailto(email: string, request: FestivalRequest, appName: string) {
  const { subject, body } = requestText(request, appName);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Keep only well-formed requests (newest last), e.g. when reading them back from storage. */
export function cleanRequests(raw: unknown): { name: string; at: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is { name: string; at: number } => !!r && typeof r.name === 'string' && typeof r.at === 'number')
    .slice(-50);
}
