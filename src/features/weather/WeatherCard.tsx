import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { Festival } from '../../data/types';
import { useToday } from '../../lib/useToday';
import { useFestivalWeather } from '../../state/weather';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { formatTime } from '../festivals/format';
import { careLines, festivalDays, type Heat, heatOf, peakHour, type WeatherDay } from './weather';
import { t, weekdays } from '../../i18n';

/**
 * The weather for a festival's days, from about two weeks out: highs and
 * lows, rain and sunset, and what it means for looking after yourself.
 * `only` shows one day (festival mode shows tonight). Kept on the phone, so
 * it shows with no signal.
 */
export function WeatherCard({ festival, only }: { festival: Festival; only?: string }) {
  const today = useToday();
  const forecast = useFestivalWeather(festival, today);
  const days = festivalDays(festival, forecast).filter((d) => !only || d.date === only);
  if (!forecast || !days.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{only ? t('Weather today') : t('Weather')}</Text>
      {days.map((d) => (
        <Day key={d.date} day={d} lines={careLines(forecast, d)} unit={forecast.unit} hot={isHot(heatOf(peakHour(forecast, d.date)?.feels ?? d.max, forecast.unit))} />
      ))}
      <Text style={styles.credit}>{t('Weather by Open-Meteo')}</Text>
    </View>
  );
}

const isHot = (h: Heat) => h === 'hot' || h === 'danger';

function Day({ day, lines, unit, hot }: { day: WeatherDay; lines: string[]; unit: 'F' | 'C'; hot: boolean }) {
  const [y, m, d] = day.date.split('-').map(Number);
  const name = weekdays()[new Date(y, m - 1, d).getDay()];
  const temps = `${Math.round(day.max)}° / ${Math.round(day.min)}°${unit}`;
  const extras = [day.rain >= 20 ? t('{n}% rain', { n: Math.round(day.rain) }) : undefined, day.sunset ? t('Sunset {time}', { time: formatTime(day.sunset) }) : undefined].filter(Boolean);
  return (
    <View style={styles.day} accessible accessibilityLabel={[`${name}: ${temps}`, ...extras, ...lines].join('. ')}>
      <View style={styles.dayRow}>
        <Glyph rain={day.rain >= 50} hot={hot} />
        <Text style={styles.dayName}>{name}</Text>
        <Text style={styles.temps}>{temps}</Text>
      </View>
      {extras.length ? <Text style={styles.extras}>{extras.join(' · ')}</Text> : null}
      {lines.map((l) => (
        <Text key={l} style={[styles.line, hot && styles.lineHot]}>
          {l}
        </Text>
      ))}
    </View>
  );
}

/** A small sun, or a cloud with rain. */
function Glyph({ rain, hot }: { rain: boolean; hot: boolean }) {
  const c = hot ? color.glow : color.moonDim;
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      {rain ? (
        <>
          <Path d="M6 12h8a3 3 0 0 0 0-6 4 4 0 0 0-7.6 1A2.5 2.5 0 0 0 6 12z" fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round" />
          <Path d="M7 15l-1 2M11 15l-1 2M15 15l-1 2" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx={10} cy={10} r={3.6} fill={c} />
          <Path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" stroke={c} strokeWidth={1.4} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.md,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  title: { ...type.label, color: color.moonDim },
  day: { gap: 4 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dayName: { ...type.headline, color: color.moon, flex: 1 },
  temps: { ...type.headline, color: color.moon, fontVariant: ['tabular-nums'] },
  extras: { ...type.caption, color: color.moonDim, marginLeft: 28 },
  line: { ...type.caption, color: color.moonDim, marginLeft: 28 },
  lineHot: { color: color.moon, backgroundColor: glowA(0.1), borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 3, overflow: 'hidden' },
  credit: { ...type.caption, fontSize: 11, color: color.moonFaint },
});
