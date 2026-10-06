import { SOCIALS, cleanSocials, readSocial, socialProblem, type SocialKey } from './socials';
import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';
import { COMMENT_MAX, CREW_NAME_MAX, type ProfileInput } from './models';
import { t } from '../../i18n';

/**
 * Checks on what people publish: handles, names and bios. Pure. Plain-words
 * problems for the edit screen; the database rules check the same limits
 * again, so the app is never the only guard.
 *
 * Offensive words are caught with `obscenity` (its English set, which copes
 * with spacing and look-alike characters without flagging words like
 * "Scunthorpe"). That filter, reporting and blocking are Afterglow's
 * moderation tools; the account owner reviews reports.
 */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const NAME_MAX = 40;
export const BIO_MAX = 160;

/** Handles that could be mistaken for Afterglow itself or its staff. */
const RESERVED = new Set(['afterglow', 'admin', 'administrator', 'support', 'help', 'official', 'staff', 'moderator', 'mod', 'team', 'root', 'system', 'me', 'you', 'null', 'undefined']);

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

/** Whether text contains an offensive word. */
export const isOffensive = (text: string) => !!text.trim() && matcher.hasMatch(text);

/** What someone types as a handle, tidied: no @, no spaces, lowercase. */
export const normalizeHandle = (raw: string) => raw.trim().replace(/^@+/, '').toLowerCase();

export function handleProblem(raw: string): string | undefined {
  const h = normalizeHandle(raw);
  if (h.length < HANDLE_MIN) return t('At least {n} characters.', { n: HANDLE_MIN });
  if (h.length > HANDLE_MAX) return t('At most {n} characters.', { n: HANDLE_MAX });
  if (!/^[a-z0-9._]+$/.test(h)) return t('Letters, numbers, dots and underscores only.');
  if (/^[._]|[._]$/.test(h)) return t('Start and end with a letter or number.');
  if (/[._]{2}/.test(h)) return t('No two dots or underscores in a row.');
  if (RESERVED.has(h) || h.startsWith('afterglow')) return t('That handle isn’t available.');
  if (isOffensive(h.replace(/[._]/g, ' '))) return t('That handle isn’t allowed.');
  return undefined;
}

export type ProfileProblems = Partial<Record<'handle' | 'displayName' | 'bio' | SocialKey, string>>;

export function profileProblems(input: ProfileInput): ProfileProblems {
  const out: ProfileProblems = {};
  const handle = handleProblem(input.handle);
  if (handle) out.handle = handle;
  const name = input.displayName.trim();
  if (!name) out.displayName = t('Add a name.');
  else if (name.length > NAME_MAX) out.displayName = t('At most {n} characters.', { n: NAME_MAX });
  else if (isOffensive(name)) out.displayName = t('That name isn’t allowed.');
  const bio = input.bio.trim();
  if (bio.length > BIO_MAX) out.bio = t('At most {n} characters.', { n: BIO_MAX });
  else if (isOffensive(bio)) out.bio = t('Please keep your bio friendly.');
  for (const spec of SOCIALS) {
    const name = input.socials?.[spec.key];
    const problem = name ? socialProblem(spec.key, readSocial(spec.key, name)) : undefined;
    if (problem) out[spec.key] = problem;
  }
  return out;
}

/** The input as it's saved: trimmed, handle normalised, bio on one line of at most a few breaks. */
export function cleanProfileInput(input: ProfileInput): ProfileInput {
  return {
    handle: normalizeHandle(input.handle),
    displayName: input.displayName.trim().replace(/\s+/g, ' '),
    bio: input.bio.trim().replace(/\n{3,}/g, '\n\n'),
    showFestivals: input.showFestivals,
    showSound: input.showSound,
    ...(input.socials ? { socials: cleanSocials(input.socials) } : {}),
    showArtists: input.showArtists !== false,
  };
}

/** A suggested handle from a name or email: "Maya Chen" → "mayachen". */
export function suggestHandle(from: string): string {
  const base = from.split('@')[0].toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
  const h = base.slice(0, HANDLE_MAX);
  return handleProblem(h) ? '' : h;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Firebase accepts 6; asking for 8 is kinder to accounts. */
export const PASSWORD_MIN = 8;

/** A crew name as it's saved: trimmed, one line, single spaces. */
export const cleanCrewName = (raw: string) => raw.trim().replace(/\s+/g, ' ');

/** What's wrong with a crew name, in plain words (checked on the cleaned name). */
export function crewNameProblem(raw: string): string | undefined {
  const name = cleanCrewName(raw);
  if (!name) return t('Give your crew a name.');
  if (name.length > CREW_NAME_MAX) return t('At most {n} characters.', { n: CREW_NAME_MAX });
  if (isOffensive(name)) return t('That name isn’t allowed.');
  return undefined;
}

/** A comment's words tidied: trimmed, runs of blank lines folded, at most COMMENT_MAX. */
export const cleanComment = (raw: string) => raw.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, COMMENT_MAX);

/** Why a comment can't be posted, in plain words, or undefined when it can. */
export function commentProblem(raw: string): string | undefined {
  const text = cleanComment(raw);
  if (!text) return t('Write something first.');
  if (raw.trim().length > COMMENT_MAX) return t('Keep it under {n} characters.', { n: COMMENT_MAX });
  if (isOffensive(text)) return t('That comment has words we don’t allow. Keep it kind.');
  return undefined;
}
