import { t } from '../../i18n';

/**
 * The little moment after a video goes out (the user, 2026-10-18: "a cute
 * animation after video is sent… one that says something along the lines of
 * remember to take care of yourself"). Which look and which words, picked
 * from a number so each send can differ, and a tiny signal the overlay in the
 * root layout listens to. Pure apart from the signal.
 */
export type SentLook = 'rings' | 'sparks' | 'drop';
export type Sent = { look: SentLook; title: string; line: string };
export type SentTo = { discover: boolean; crew: boolean };

export function sentMoment(to: SentTo, pick: number): Sent {
  const title = to.discover && to.crew ? t('Sent to Discover and your crew') : to.crew ? t('Sent to your crew') : t('Shared to Discover');
  const care: { look: SentLook; line: string }[] = [
    { look: 'drop', line: t('Grab some water while you’re at it.') },
    { look: 'rings', line: t('Take a breather between sets. Look after yourself.') },
    { look: 'sparks', line: t('Check in with your crew now and then.') },
    { look: 'rings', line: t('Earplugs in near the speakers. Your ears will thank you.') },
    { look: 'drop', line: t('Remember to eat something and sit down for a bit.') },
  ];
  const i = Math.abs(Math.floor(pick)) % care.length;
  return { title, ...care[i] };
}

type Listener = (s: Sent) => void;
const listeners = new Set<Listener>();
let sends = 0;

/** Play the moment (the overlay in the root layout shows it over wherever you land). */
export function celebrateSent(to: SentTo) {
  if (!to.discover && !to.crew) return;
  const s = sentMoment(to, sends++ + Math.floor(Date.now() / 1000));
  for (const l of listeners) l(s);
}

export function onSent(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
