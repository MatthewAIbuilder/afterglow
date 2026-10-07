import { useMemo } from 'react';
import type { Festival } from '../../data/models';
import { usePlan } from '../../state/plan';
import { usePrepTicks } from '../../state/prep';
import { useRatings } from '../../state/ratings';
import { useSetReminders } from '../../state/setReminders';
import { canRemindSets } from '../notifications/setReminders';
import { Platform } from 'react-native';
import { AMAZON_APP_APPROVED, SHOP_LINKS } from '../../config/partners';
import { cleanShopLinks, shopLinksFor } from '../partners/partners';
import { prepChecklist, prepProgress } from './checklist';

// Amazon's links stay on the website until Amazon approves the app.
const SHOP = shopLinksFor(cleanShopLinks(SHOP_LINKS), { web: Platform.OS === 'web', amazonInApp: AMAZON_APP_APPROVED });

/** A festival's Get ready list, from what you've done in the app and what you've ticked. */
export function usePrep(festival: Festival) {
  const { ratings } = useRatings();
  const { mustSeesAt } = usePlan();
  const reminders = useSetReminders();
  const { tickedFor, toggle } = usePrepTicks();
  const ticked = tickedFor(festival.id);
  const sections = useMemo(
    () =>
      prepChecklist({
        festival,
        rated: festival.lineup.filter((a) => ratings[a]).length,
        lineup: festival.lineup.length,
        stars: mustSeesAt(festival.id).size,
        remindersPossible: canRemindSets(festival),
        remindersOn: reminders.on.has(festival.id),
        ticked,
        shop: SHOP,
      }),
    [festival, ratings, mustSeesAt, reminders.on, ticked],
  );
  return { sections, progress: prepProgress(sections), toggle: (item: string) => toggle(festival.id, item) };
}
