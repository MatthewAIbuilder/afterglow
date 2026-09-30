import type { CalendarEvent } from '../features/calendar/events';
import { icsFileName, icsFor } from '../features/calendar/events';

export type CalendarOutcome = 'added' | 'canceled' | 'downloaded' | 'failed';

/** In a browser: download the event as an .ics file, which any calendar app opens. */
export async function addToCalendar(event: CalendarEvent): Promise<CalendarOutcome> {
  try {
    const blob = new Blob([icsFor(event, new Date(), event.url.split('/').pop() ?? 'festival')], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = icsFileName(event.title);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
