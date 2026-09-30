import * as Calendar from 'expo-calendar/legacy';
import type { CalendarEvent } from '../features/calendar/events';
import { localDay } from '../features/calendar/events';

export type CalendarOutcome = 'added' | 'canceled' | 'downloaded' | 'failed';

/**
 * Adds an event with the phone's own "New Event" screen, filled in: you see
 * it, can change it, and choose Add. No calendar permission is needed for
 * that screen. (The website downloads an .ics file instead: calendar.web.ts.)
 */
export async function addToCalendar(event: CalendarEvent): Promise<CalendarOutcome> {
  try {
    const result = await Calendar.createEventInCalendarAsync({
      title: event.title,
      startDate: localDay(event.startDay),
      endDate: localDay(event.endDay),
      allDay: true,
      location: event.location || undefined,
      notes: event.notes,
      url: event.url,
    });
    // 'done' means closed without saying (always on Android): nothing to confirm.
    return result.action === 'saved' ? 'added' : 'canceled';
  } catch {
    return 'failed';
  }
}
