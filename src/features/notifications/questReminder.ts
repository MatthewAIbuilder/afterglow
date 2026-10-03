import { REMINDER_PREFIX, type Reminder } from './reminders';

/** The evening nudge comes at 8 PM, local time. */
export const QUEST_REMINDER_HOUR = 20;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The evening nudge for daily quests, when you've switched it on: tonight at
 * 8 PM while today's aren't all done, else tomorrow at 8 PM (opening the app
 * tomorrow moves it again, so it only arrives on a day you haven't finished).
 * Pure.
 */
export function questReminder(on: boolean, now: Date, left: number, streak: number): Reminder | undefined {
  if (!on) return undefined;
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), QUEST_REMINDER_HOUR);
  const tonight = left > 0 && now < at;
  if (!tonight) at.setDate(at.getDate() + 1);
  const n = tonight ? left : 3;
  return {
    id: `${REMINDER_PREFIX}quests:${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}:${n}`,
    festivalId: '',
    at,
    title: 'Your quests are waiting',
    body:
      streak > 0
        ? `${n === 1 ? '1 quest' : `${n} quests`} left today. Keep your ${streak}-day streak glowing.`
        : `${n === 1 ? '1 small quest' : `${n} small quests`} left today, a little glow each.`,
    href: '/quests',
  };
}
