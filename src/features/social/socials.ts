/**
 * Your Instagram, Snapchat and TikTok on your profile: just the username,
 * typed however you like ("maya", "@maya", or a pasted profile link). Only
 * the username is kept; the link is made from it, so a profile can never
 * point anywhere else. Pure.
 */
export type SocialKey = 'instagram' | 'snapchat' | 'tiktok';
export type Socials = Partial<Record<SocialKey, string>>;

type Spec = {
  key: SocialKey;
  label: string;
  /** A username the service would accept (lowercase). */
  valid: RegExp;
  /** Hosts a pasted link may come from, and where the username sits in its path. */
  hosts: readonly string[];
  url: (u: string) => string;
  /** What a good username looks like, when one isn't. */
  hint: string;
};

export const SOCIALS: readonly Spec[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    valid: /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/,
    hosts: ['instagram.com', 'www.instagram.com', 'instagr.am'],
    url: (u) => `https://instagram.com/${u}`,
    hint: 'Up to 30 letters, numbers, dots and underscores.',
  },
  {
    key: 'snapchat',
    label: 'Snapchat',
    valid: /^[a-z][a-z0-9._-]{2,14}$/,
    hosts: ['snapchat.com', 'www.snapchat.com'],
    url: (u) => `https://www.snapchat.com/add/${u}`,
    hint: '3 to 15 characters, starting with a letter.',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    valid: /^[a-z0-9._]{2,24}$/,
    hosts: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'],
    url: (u) => `https://www.tiktok.com/@${u}`,
    hint: '2 to 24 letters, numbers, dots and underscores.',
  },
];

export const socialSpec = (key: SocialKey) => SOCIALS.find((s) => s.key === key)!;

/**
 * The username from whatever was typed: "@Maya", "maya", or a profile link
 * ("instagram.com/maya", "https://www.tiktok.com/@maya?lang=en",
 * "snapchat.com/add/maya"). Lowercased. Empty when nothing was typed.
 */
export function readSocial(key: SocialKey, raw: string): string {
  let s = raw.trim();
  if (!s) return '';
  const spec = socialSpec(key);
  const link = s.match(/^(?:https?:\/\/)?([^/\s]+)\/(.*)$/i);
  if (link && spec.hosts.includes(link[1].toLowerCase())) {
    const parts = link[2].split(/[?#]/)[0].split('/').filter(Boolean);
    // snapchat.com/add/<name>; the others put the name first (TikTok with an @).
    s = (key === 'snapchat' && parts[0]?.toLowerCase() === 'add' ? parts[1] : parts[0]) ?? '';
  }
  return s.replace(/^@+/, '').trim().toLowerCase();
}

/** What's wrong with a username, if anything (empty is fine: it's left off). */
export function socialProblem(key: SocialKey, name: string): string | undefined {
  if (!name) return undefined;
  const spec = socialSpec(key);
  return spec.valid.test(name) ? undefined : `That doesn’t look like a ${spec.label} username. ${spec.hint}`;
}

/** The profile link for a username. */
export const socialUrl = (key: SocialKey, name: string) => socialSpec(key).url(name);

/** Only good usernames, in a fixed order; anything else is dropped. */
export function cleanSocials(raw: unknown): Socials {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: Socials = {};
  for (const spec of SOCIALS) {
    const v = typeof o[spec.key] === 'string' ? readSocial(spec.key, o[spec.key] as string) : '';
    if (v && spec.valid.test(v)) out[spec.key] = v;
  }
  return out;
}

/** "Maya on Instagram, @maya": for screen readers. */
export const socialA11y = (key: SocialKey, name: string, whose?: string) => `${whose ? `${whose} on ` : ''}${socialSpec(key).label}, @${name}. Opens ${socialSpec(key).label}.`;
