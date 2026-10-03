/**
 * What's new in an update, shown once to people who already use the app
 * (never to someone just finishing the welcome). Bump `key` for the next
 * update's list. Pure.
 */
export type WhatsNewItem = { id: string; title: string; body: string; href?: string };

export const WHATS_NEW: { key: string; items: WhatsNewItem[] } = {
  key: '2026-10-05',
  items: [
    { id: 'sprouts', title: 'Sprouts', body: 'Give people little sprouts at festivals: they scan your code, even without the app. Your sprouts grow as you go and bloom into new kinds you can give too.', href: '/garden' },
    { id: 'map', title: 'The festival map', body: 'Every festival glowing on a night-time world. Pinch around, find yourself, see your journey and every artist’s tour.', href: '/festival-map' },
    { id: 'quests', title: 'Daily quests', body: 'Three small quests a day, a weekly one, a streak and your glow level, with badges for keeping it up. The ring on Discover fills as you go.', href: '/quests' },
    { id: 'secrets', title: 'Secrets', body: 'Eleven hidden things to find around the app. Hint: Discover likes a little movement.', href: '/secrets' },
    { id: 'chat', title: 'Crew chat', body: 'Every crew has its own chat now, just for the people in it. Messages wait for signal and keep the time you wrote them. Crews are invite only.', href: '/together' },
    { id: 'week', title: 'Festival week', body: 'In the week before a festival you’re going to, a door opens each day with one small thing to get you ready.', href: '/festivals' },
    { id: 'throwbacks', title: 'Throwbacks', body: 'Add videos from festivals you went to before Afterglow, and collect a rose gold badge for each.', href: '/profile' },
    { id: 'calendar', title: 'Festival calendar', body: 'Flip through the months and see what’s on any day. Pull Festivals down to refresh.', href: '/festival-calendar' },
  ],
};

/** Shown when it's someone who already uses the app and hasn't seen this list. */
export const showWhatsNew = (seen: string | null, usedBefore: boolean) => usedBefore && seen !== WHATS_NEW.key;
