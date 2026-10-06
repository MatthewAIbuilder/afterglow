import { t } from '../../i18n';
import { pastLabel, type PastEvent } from './past';
import { showLabel, type ShowTag } from './show';

/** "Friday · EDC Orlando", "Throwback · EDC Orlando 2024" or "Echostage, Washington": where a video is from, or ''. */
export function whereLine(m: { night?: string; past?: PastEvent; show?: ShowTag }, festivalName: string | undefined): string {
  const place = festivalName ?? (m.past ? t('Throwback · {festival}', { festival: pastLabel(m.past) }) : m.show ? showLabel(m.show) : undefined);
  return [m.night ? t(m.night) : undefined, place].filter(Boolean).join(' · ');
}
