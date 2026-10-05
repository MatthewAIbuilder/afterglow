import type { Clip, Festival } from '../../data/models';
import { lineupClips } from '../festivals/links';
import { bySoonest, isOver } from '../festivals/shelves';

/**
 * The first-run welcome: shown once, to someone who has never used the app.
 * Pure. Anyone with any history (a reaction, a rating, a festival they're
 * going to, a clip they've watched) already knows their way around, so they
 * never see it, and are marked as welcomed so a later Start over doesn't
 * bring it back.
 */
export type History = {
  reactions: number;
  ratings: number;
  going: number;
  seen: number;
};

export const isNewcomer = (h: History) => h.reactions + h.ratings + h.going + h.seen === 0;

/**
 * The festival to carry on with after the welcome: the first one you said
 * you're going to (catalogue order), or none.
 */
export function welcomeFestival(festivals: Festival[], going: readonly string[]): Festival | undefined {
  return festivals.find((f) => going.includes(f.id));
}

/** Where "Start watching" should open Discover: that festival if it has clips, otherwise wherever Discover opens. */
export const watchFestival = (festival: Festival | undefined, clips: Clip[]) =>
  festival && lineupClips(festival, clips).length > 0 ? festival : undefined;

/**
 * "Where are you going?" with a handful of festivals: soonest first, without
 * the ones that are already over (unless you picked one before it ended), so
 * a newcomer is never asked about a festival they can no longer go to. The
 * order doesn't depend on what's picked, so rows never jump while you tap.
 */
export function welcomeChoices(festivals: readonly Festival[], going: readonly string[], today: Date): Festival[] {
  return bySoonest(
    festivals.filter((f) => going.includes(f.id) || !isOver(f, today)),
    today,
  );
}
