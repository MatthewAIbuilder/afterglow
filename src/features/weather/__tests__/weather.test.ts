import { describe, expect, it } from '@jest/globals';
import { careLines, festivalDays, forecastUrl, heatOf, heatReminders, parseForecast, wantsForecast } from '../weather';

// Two days in Orlando, °F: a hot Friday with rain in the evening, a cool Saturday night.
const hours = (date: string, temps: number[], feels: number[], rain: number[]) => temps.map((_, h) => ({ t: `${date}T${String(h).padStart(2, '0')}:00`, temp: temps[h], feels: feels[h], rain: rain[h] }));
const fri = hours('2026-11-06', Array.from({ length: 24 }, (_, h) => (h >= 12 && h <= 17 ? 90 : 75)), Array.from({ length: 24 }, (_, h) => (h === 15 ? 98 : h >= 12 && h <= 17 ? 92 : 76)), Array.from({ length: 24 }, (_, h) => (h >= 20 ? 70 : 10)));
const sat = hours('2026-11-07', Array.from({ length: 24 }, (_, h) => (h <= 6 ? 49 : 68)), Array.from({ length: 24 }, (_, h) => (h <= 6 ? 47 : 68)), Array.from({ length: 24 }, () => 0));
const sun = hours('2026-11-08', Array.from({ length: 24 }, () => 46), Array.from({ length: 24 }, () => 44), Array.from({ length: 24 }, () => 0));
const all = [...fri, ...sat, ...sun];
const raw = {
  daily: { time: ['2026-11-06', '2026-11-07', '2026-11-08'], temperature_2m_max: [90, 70, 60], temperature_2m_min: [74, 49, 46], precipitation_probability_max: [70, 0, 0], uv_index_max: [9, 4, 3], sunset: ['2026-11-06T17:35', '2026-11-07T17:34', '2026-11-08T17:34'] },
  hourly: { time: all.map((h) => h.t), temperature_2m: all.map((h) => h.temp), apparent_temperature: all.map((h) => h.feels), precipitation_probability: all.map((h) => h.rain), uv_index: all.map(() => 5) },
};
const edc = { id: 'edc', name: 'EDC Orlando', startDate: '2026-11-06', endDate: '2026-11-07', place: { lat: 28.54, lon: -81.4 } };

describe('festival weather', () => {
  it('asks Open-Meteo for the festival’s place and reads the answer', () => {
    expect(forecastUrl(edc.place, 'F')).toContain('latitude=28.5400&longitude=-81.4000');
    expect(forecastUrl(edc.place, 'F')).toContain('temperature_unit=fahrenheit');
    expect(forecastUrl(edc.place, 'C')).not.toContain('fahrenheit');
    const f = parseForecast(raw, 'F', 1)!;
    expect(f.days[0]).toEqual({ date: '2026-11-06', max: 90, min: 74, rain: 70, uv: 9, sunset: '17:35' });
    expect(festivalDays(edc, f).map((d) => d.date)).toEqual(['2026-11-06', '2026-11-07']);
    expect(parseForecast({ daily: {} }, 'F', 1)).toBeUndefined();
  });

  it('only fetches for festivals starting within the forecast', () => {
    expect(wantsForecast(edc, new Date(2026, 9, 30))).toBe(true);
    expect(wantsForecast(edc, new Date(2026, 9, 1))).toBe(false);
    expect(wantsForecast(edc, new Date(2026, 10, 9))).toBe(false);
    expect(wantsForecast({ startDate: '2026-11-06' }, new Date(2026, 9, 30))).toBe(false);
  });

  it('says what the weather means for looking after yourself', () => {
    const f = parseForecast(raw, 'F', 1)!;
    expect(heatOf(98, 'F')).toBe('hot');
    expect(heatOf(104, 'F')).toBe('danger');
    expect(heatOf(30, 'C')).toBe('warm');
    expect(careLines(f, f.days[0])).toEqual([
      'Feels like 98°F around 3:00 PM. Water every 20 minutes and take shade between sets.',
      'Rain likely from 8:00 PM. Pack a poncho.',
      'Down to 49°F late at night. Bring a layer.',
      'Strong sun (UV 9). Sunscreen and a hat.',
    ]);
    expect(careLines(f, f.days[1])).toEqual(['Down to 46°F late at night. Bring a layer.']);
  });

  it('warns before the hottest hour on a hot festival day, ahead of time only', () => {
    const f = parseForecast(raw, 'F', 1)!;
    const list = heatReminders(edc, f, new Date(2026, 10, 6, 9));
    expect(list.map((r) => [r.title, r.at.getHours(), r.href])).toEqual([['Hot one at EDC Orlando today', 13, '/care']]);
    expect(heatReminders(edc, f, new Date(2026, 10, 6, 14))).toEqual([]);
  });
});
