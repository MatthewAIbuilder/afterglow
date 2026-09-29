import { stageName } from '../../data/festival';
import type { Festival } from '../../data/models';
import { formatTime } from '../festivals/format';
import type { Pick, Schedule, ScheduleItem, TimedPick } from './plan';

/**
 * Your festival plan as plain text, for sending to friends from the share
 * sheet. Pure. Must-sees and strong matches only (explore picks are
 * suggestions for you, not plans); a star marks the ones you starred.
 * Undefined when there's nothing worth sending yet.
 */
export function planText(festival: Festival, picks: Pick[], schedule: Schedule | null, appName: string): string | undefined {
  const planned = picks.filter((p) => p.tier !== 'explore');
  if (planned.length === 0) return undefined;
  const name = (p: Pick) => `${p.pinned ? '★ ' : ''}${p.artist.name}`;
  const head = [`My ${festival.name}`, [festival.dates, festival.location].filter(Boolean).join(', ')];
  const foot = `Made with ${appName}`;

  if (!schedule) {
    const group = (tier: Pick['tier'], label: string) => {
      const list = planned.filter((p) => p.tier === tier);
      return list.length ? [label, ...list.map(name)].join('\n') : undefined;
    };
    return [head.join('\n'), group('must-see', 'Must see'), group('strong', 'Strong match'), foot].filter(Boolean).join('\n\n');
  }

  const at = (p: TimedPick) => `${formatTime(p.set.start)}  ${name(p)}, ${stageName(festival, p.set.stageId)}`;
  const line = (item: ScheduleItem): string | undefined => {
    if (item.kind === 'set') return at(item.pick);
    if (item.kind === 'discover') return undefined;
    const v = item.verdict;
    if (v.kind === 'close') return `${at(v.a)}\n   or ${at(v.b)}`;
    return `${at(v.pick)}\n   (clashes with ${v.other.artist.name})`;
  };
  const days = schedule.days
    .map((d) => {
      const lines = d.items.map(line).filter(Boolean);
      return lines.length ? [d.day, ...lines].join('\n') : undefined;
    })
    .filter(Boolean);
  const later = schedule.unscheduled.filter((p) => p.tier !== 'explore');
  const rest = later.length ? ['Set time to come', ...later.map(name)].join('\n') : undefined;
  if (days.length === 0 && !rest) return undefined;
  return [head.join('\n'), ...days, rest, foot].filter(Boolean).join('\n\n');
}
