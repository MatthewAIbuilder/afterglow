import type { Festival } from '../../data/models';
import { formatTime } from '../festivals/format';
import { REMINDER_PREFIX, type Reminder } from '../notifications/reminders';
import { t } from '../../i18n';

/**
 * Weather on festival days, and what it means for looking after yourself.
 * Pure: the request to Open-Meteo (free, no key; the user chose it on
 * 2026-10-30), reading its answer, the festival's days, and care lines
 * ("feels like 97°F at 3 PM: water every 20 minutes").
 */
export type TempUnit = 'F' | 'C';

export type WeatherDay = {
  /** "2026-11-06", the festival's local date. */
  date: string;
  max: number;
  min: number;
  /** Chance of rain, 0 to 100. */
  rain: number;
  uv: number;
  /** "18:42", local time. */
  sunset?: string;
};
export type WeatherHour = { time: string; temp: number; feels: number; rain: number; uv: number };
export type Forecast = { unit: TempUnit; days: WeatherDay[]; hours: WeatherHour[]; fetchedAt: number };

/** Open-Meteo forecasts this many days ahead. */
export const FORECAST_DAYS = 16;
/** A forecast older than this is fetched again. */
export const STALE_MS = 3 * 3600_000;

export function forecastUrl(place: { lat: number; lon: number }, unit: TempUnit): string {
  const q = [
    `latitude=${place.lat.toFixed(4)}`,
    `longitude=${place.lon.toFixed(4)}`,
    'daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunset',
    'hourly=temperature_2m,apparent_temperature,precipitation_probability,uv_index',
    'timezone=auto',
    `forecast_days=${FORECAST_DAYS}`,
    ...(unit === 'F' ? ['temperature_unit=fahrenheit'] : []),
  ];
  return `https://api.open-meteo.com/v1/forecast?${q.join('&')}`;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const arr = (o: Record<string, unknown> | undefined, k: string): unknown[] => (o && Array.isArray(o[k]) ? (o[k] as unknown[]) : []);

/** Open-Meteo's answer as a forecast, or undefined when it isn't one. */
export function parseForecast(raw: unknown, unit: TempUnit, fetchedAt: number): Forecast | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const daily = o.daily as Record<string, unknown> | undefined;
  const hourly = o.hourly as Record<string, unknown> | undefined;
  const dates = arr(daily, 'time');
  const days: WeatherDay[] = [];
  dates.forEach((d, i) => {
    const max = num(arr(daily, 'temperature_2m_max')[i]);
    const min = num(arr(daily, 'temperature_2m_min')[i]);
    if (typeof d !== 'string' || max === undefined || min === undefined) return;
    const sunset = arr(daily, 'sunset')[i];
    days.push({
      date: d,
      max,
      min,
      rain: num(arr(daily, 'precipitation_probability_max')[i]) ?? 0,
      uv: num(arr(daily, 'uv_index_max')[i]) ?? 0,
      ...(typeof sunset === 'string' && sunset.includes('T') ? { sunset: sunset.split('T')[1].slice(0, 5) } : {}),
    });
  });
  const hours: WeatherHour[] = [];
  arr(hourly, 'time').forEach((h, i) => {
    const temp = num(arr(hourly, 'temperature_2m')[i]);
    if (typeof h !== 'string' || temp === undefined) return;
    hours.push({ time: h, temp, feels: num(arr(hourly, 'apparent_temperature')[i]) ?? temp, rain: num(arr(hourly, 'precipitation_probability')[i]) ?? 0, uv: num(arr(hourly, 'uv_index')[i]) ?? 0 });
  });
  return days.length ? { unit, days, hours, fetchedAt } : undefined;
}

/** A stored forecast read back, or undefined. */
export function cleanForecast(raw: unknown): Forecast | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Partial<Forecast>;
  if ((o.unit !== 'F' && o.unit !== 'C') || !Array.isArray(o.days) || !Array.isArray(o.hours) || typeof o.fetchedAt !== 'number') return undefined;
  const days = o.days.filter((d): d is WeatherDay => !!d && typeof d.date === 'string' && typeof d.max === 'number' && typeof d.min === 'number');
  const hours = o.hours.filter((h): h is WeatherHour => !!h && typeof h.time === 'string' && typeof h.temp === 'number');
  return days.length ? { unit: o.unit, days, hours, fetchedAt: o.fetchedAt } : undefined;
}

const dayNum = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** The forecast for the festival's own dates (empty when they're past the forecast or undated). */
export function festivalDays(festival: Pick<Festival, 'startDate' | 'endDate'>, forecast: Forecast | undefined): WeatherDay[] {
  if (!forecast || !festival.startDate) return [];
  const from = dayNum(festival.startDate);
  const to = dayNum(festival.endDate ?? festival.startDate);
  return forecast.days.filter((d) => dayNum(d.date) >= from && dayNum(d.date) <= to);
}

/** Worth a forecast: dated, with a place, and starting within the forecast (or on now). */
export function wantsForecast(festival: Pick<Festival, 'startDate' | 'endDate' | 'place'>, today: Date): boolean {
  if (!festival.place || !festival.startDate) return false;
  const now = Math.round(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000);
  return dayNum(festival.startDate) - now < FORECAST_DAYS && dayNum(festival.endDate ?? festival.startDate) >= now;
}

// ---------------------------------------------------------------------------
// Looking after yourself

/** In °C: the US weather service's heat index bands (caution 80°F, extreme caution 90°F, danger 103°F). */
const HEAT_C = { warm: 26.7, hot: 32.2, danger: 39.4 } as const;
export type Heat = 'ok' | 'warm' | 'hot' | 'danger';

const toC = (v: number, unit: TempUnit) => (unit === 'F' ? ((v - 32) * 5) / 9 : v);

export function heatOf(feels: number, unit: TempUnit): Heat {
  const c = toC(feels, unit);
  return c >= HEAT_C.danger ? 'danger' : c >= HEAT_C.hot ? 'hot' : c >= HEAT_C.warm ? 'warm' : 'ok';
}

/** The hottest hour of a day (by how it feels), when the forecast has hours. */
export function peakHour(forecast: Forecast, date: string): WeatherHour | undefined {
  return forecast.hours.filter((h) => h.time.startsWith(date)).reduce<WeatherHour | undefined>((a, b) => (!a || b.feels > a.feels ? b : a), undefined);
}

/** The first hour from late afternoon on that it's likely to rain. */
function rainFrom(forecast: Forecast, date: string): WeatherHour | undefined {
  return forecast.hours.find((h) => h.time.startsWith(date) && Number(h.time.slice(11, 13)) >= 12 && h.rain >= 50);
}

/** The coldest it gets that night (to 6 AM the next morning). */
function nightLow(forecast: Forecast, date: string): number | undefined {
  const [y, m, d] = date.split('-').map(Number);
  const after = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const temps = forecast.hours.filter((h) => (h.time.startsWith(date) && Number(h.time.slice(11, 13)) >= 20) || (h.time.startsWith(after) && Number(h.time.slice(11, 13)) <= 6)).map((h) => h.temp);
  return temps.length ? Math.min(...temps) : undefined;
}

const deg = (v: number, unit: TempUnit) => `${Math.round(v)}°${unit}`;
const hourText = (time: string) => formatTime(time.slice(11, 16));

/** What the day's weather means for you, most important first. */
export function careLines(forecast: Forecast, day: WeatherDay): string[] {
  const out: string[] = [];
  const peak = peakHour(forecast, day.date);
  const heat = peak ? heatOf(peak.feels, forecast.unit) : heatOf(day.max, forecast.unit);
  const v = { temp: deg(peak?.feels ?? day.max, forecast.unit), time: peak ? hourText(peak.time) : '' };
  if (heat === 'danger') out.push(peak ? t('Feels like {temp} around {time}. Dangerous heat: water every 15 minutes, shade between sets, and watch your crew.', v) : t('Feels like {temp}. Dangerous heat: water every 15 minutes, shade between sets, and watch your crew.', v));
  else if (heat === 'hot') out.push(peak ? t('Feels like {temp} around {time}. Water every 20 minutes and take shade between sets.', v) : t('Feels like {temp}. Water every 20 minutes and take shade between sets.', v));
  else if (heat === 'warm') out.push(t('Warm, up to {temp}. Keep sipping water through the day.', v));
  const rain = rainFrom(forecast, day.date);
  if (rain) out.push(t('Rain likely from {time}. Pack a poncho.', { time: hourText(rain.time) }));
  else if (day.rain >= 50) out.push(t('A {n}% chance of rain. Pack a poncho.', { n: Math.round(day.rain) }));
  const low = nightLow(forecast, day.date);
  if (low !== undefined && toC(low, forecast.unit) <= 12) out.push(t('Down to {temp} late at night. Bring a layer.', { temp: deg(low, forecast.unit) }));
  if (day.uv >= 8) out.push(t('Strong sun (UV {n}). Sunscreen and a hat.', { n: Math.round(day.uv) }));
  return out;
}

export const WEATHER_PREFIX = `${REMINDER_PREFIX}heat:`;
/** The heat alert comes this long before the hottest hour. */
export const HEAT_LEAD_H = 2;

/** On a hot festival day, a nudge before the hottest hour. Only hot or dangerous days, and only ahead of time. */
export function heatReminders(festival: Pick<Festival, 'id' | 'name' | 'startDate' | 'endDate'>, forecast: Forecast | undefined, now: Date): Reminder[] {
  if (!forecast) return [];
  const out: Reminder[] = [];
  for (const day of festivalDays(festival, forecast)) {
    const peak = peakHour(forecast, day.date);
    if (!peak) continue;
    const heat = heatOf(peak.feels, forecast.unit);
    if (heat !== 'hot' && heat !== 'danger') continue;
    const [y, m, d] = day.date.split('-').map(Number);
    const at = new Date(y, m - 1, d, Number(peak.time.slice(11, 13)) - HEAT_LEAD_H, 0, 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    const v = { festival: festival.name, temp: deg(peak.feels, forecast.unit), time: hourText(peak.time) };
    out.push({
      id: `${WEATHER_PREFIX}${festival.id}:${day.date}:${Math.round(peak.feels)}`,
      festivalId: festival.id,
      at,
      title: heat === 'danger' ? t('Dangerous heat at {festival} today', v) : t('Hot one at {festival} today', v),
      body: t('Feels like {temp} around {time}. Water, shade and a break between sets.', v),
      href: '/care',
    });
  }
  return out;
}
