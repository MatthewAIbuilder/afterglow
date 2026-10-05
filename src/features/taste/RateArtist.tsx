import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Artist } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useRatings } from '../../state/ratings';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { HeartIcon } from '../discover/icons';
import { RATING_LABEL, type Rating } from './ratings';

/** How each answer is announced, and how taking it back is. */
export function ratingA11y(r: Rating, name: string, on: boolean): string {
  if (on) {
    const said = { love: `You love ${name}'s sound`, like: `You like ${name}`, ok: `You think ${name} is OK`, meh: `${name} is not really for you`, pass: `${name} is not for you` }[r];
    return `${said}. Tap to undo.`;
  }
  return { love: `Love ${name}'s sound`, like: `Like ${name}`, ok: `${name} is OK`, meh: `${name} is not really for me`, pass: `${name} is not for me` }[r];
}

const ROWS: Rating[][] = [
  ['love', 'like'],
  ['ok'],
  ['meh', 'pass'],
];

/**
 * Tell Afterglow about an artist directly, without a clip, from Love them to
 * Not for me. Tap your answer again to take it back. Feeds the taste engine.
 */
export function RateArtist({ artist, compact }: { artist: Artist; compact?: boolean }) {
  const { ratings, rate } = useRatings();
  const current = ratings[artist.id];
  if (compact) return <RateScale artist={artist} current={current} rate={rate} />;

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={`How do you feel about ${artist.name}?`}>
      {ROWS.map((row) => (
        <View key={row.join()} style={styles.row}>
          {row.map((r) => {
            const on = current === r;
            const warm = r === 'love' || r === 'like';
            return (
              <Pressable
                key={r}
                onPress={() => {
                  if (on || !warm) haptic.select();
                  else haptic.tap();
                  rate(artist.id, on ? undefined : r);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, checked: on }}
                accessibilityLabel={ratingA11y(r, artist.name, on)}
                style={({ pressed }) => [styles.pill, on && (warm ? styles.on : styles.coldOn), pressed && styles.pressed]}
              >
                {r === 'love' ? <HeartIcon color={on ? color.glow : color.moonDim} filled={on} size={15} /> : null}
                <Text style={[styles.text, on && styles.textOn]}>{RATING_LABEL[r]}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** The five answers, short enough to sit in one row: warm on the left, cold on the right. */
const SHORT: Record<Rating, string> = { love: 'Love', like: 'Like', ok: 'OK', meh: 'Not really', pass: 'Not for me' };
const SCALE: Rating[] = ['love', 'like', 'ok', 'meh', 'pass'];

/** The compact form, for the map's sheet: one row, "How do you feel about them?" above it. */
function RateScale({ artist, current, rate }: { artist: Artist; current: Rating | undefined; rate: (id: string, r: Rating | undefined) => void }) {
  return (
    <View style={styles.scaleWrap}>
      <Text style={styles.scaleTitle}>{current ? `You said: ${RATING_LABEL[current].toLowerCase()}` : 'How do you feel about them?'}</Text>
      <View style={styles.scale} accessibilityRole="radiogroup" accessibilityLabel={`How do you feel about ${artist.name}?`}>
        {SCALE.map((r) => {
          const on = current === r;
          const warm = r === 'love' || r === 'like';
          return (
            <Pressable
              key={r}
              onPress={() => {
                if (on || !warm) haptic.select();
                else haptic.tap();
                rate(artist.id, on ? undefined : r);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, checked: on }}
              accessibilityLabel={ratingA11y(r, artist.name, on)}
              style={({ pressed }) => [styles.step, on && (warm ? styles.on : styles.coldOn), pressed && styles.pressed]}
            >
              {r === 'love' ? <HeartIcon color={on ? color.glow : color.moonDim} filled={on} size={13} /> : null}
              <Text style={[styles.stepText, on && styles.textOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {SHORT[r]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scaleWrap: { marginTop: space.lg, gap: space.sm },
  scaleTitle: { ...type.caption, color: color.moonDim },
  scale: { flexDirection: 'row', gap: 6 },
  step: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 38,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  stepText: { ...type.caption, color: color.moonDim, fontWeight: '600' },
  wrap: { gap: space.sm, marginTop: space.lg, alignItems: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  on: { backgroundColor: glowA(0.18), borderColor: glowA(0.4) },
  coldOn: { backgroundColor: color.glass, borderColor: 'rgba(255,255,255,0.22)' },
  pressed: { opacity: 0.7 },
  text: { ...type.label, color: color.moonDim },
  textOn: { color: color.moon },
});
