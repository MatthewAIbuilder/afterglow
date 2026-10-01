/**
 * Flagging a clip that's wrong: the nightly YouTube search picks sets on its
 * own, so now and then one is the wrong artist, not really a set, or won't
 * play. Flagging hides it on this phone straight away and can send a short
 * report, so it can be added to the catalogue's "blockedVideos" and left out
 * for everyone. Pure: the reasons, the stored list and the report's words.
 */
export type FlagReason = 'wrong-artist' | 'not-a-set' | 'wont-play' | 'other';

export const FLAG_REASONS: readonly FlagReason[] = ['wrong-artist', 'not-a-set', 'wont-play', 'other'];

export const FLAG_LABEL: Record<FlagReason, string> = {
  'wrong-artist': 'Wrong artist',
  'not-a-set': 'Not a live set',
  'wont-play': 'Doesn’t play',
  other: 'Something else',
};

export type ClipFlag = { reason: FlagReason; at: number };
export type ClipFlags = Record<string, ClipFlag>;

/** At most this many flags are kept on the phone. */
export const FLAGS_MAX = 500;

const isReason = (v: unknown): v is FlagReason => typeof v === 'string' && (FLAG_REASONS as readonly string[]).includes(v);

/** Flags with this one added (or its reason changed), oldest dropped past FLAGS_MAX. */
export function withFlag(flags: ClipFlags, clipId: string, reason: FlagReason, at: number): ClipFlags {
  const next = { ...flags, [clipId]: { reason, at } };
  const ids = Object.keys(next);
  if (ids.length <= FLAGS_MAX) return next;
  const keep = new Set(ids.sort((a, b) => next[b].at - next[a].at).slice(0, FLAGS_MAX));
  return Object.fromEntries(Object.entries(next).filter(([id]) => keep.has(id)));
}

/** Flags read back from storage: anything malformed is dropped. */
export function cleanFlags(raw: unknown): ClipFlags {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ClipFlags = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const f = v as { reason?: unknown; at?: unknown } | null;
    if (id && f && isReason(f.reason) && typeof f.at === 'number' && Number.isFinite(f.at)) out[id] = { reason: f.reason, at: f.at };
  }
  return out;
}

export type FlagReport = { subject: string; body: string };

/** The report's words: what was wrong, and enough to find the video. */
export function flagReport(
  clip: { id: string; title: string; videoId?: string; link?: string; channel?: string },
  artistName: string,
  reason: FlagReason,
  appName: string,
): FlagReport {
  return {
    subject: `Wrong clip: ${artistName} (${FLAG_LABEL[reason].toLowerCase()})`,
    body: [
      `${FLAG_LABEL[reason]}: the clip shown for ${artistName} in Discover.`,
      `Clip: ${clip.title}${clip.channel ? ` (from ${clip.channel})` : ''}`,
      clip.link ? `Video: ${clip.link}` : undefined,
      `Video id: ${clip.videoId ?? clip.id}`,
      `Sent from ${appName}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

/** A mailto link to `email` with the report filled in. */
export const flagMailto = (email: string, r: FlagReport) => `mailto:${email}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body)}`;
