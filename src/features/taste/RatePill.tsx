import { Pressable, StyleSheet, Text } from 'react-native';
import type { Artist } from '../../data/models';
import { showActionSheet } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useRatings } from '../../state/ratings';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { HeartIcon } from '../discover/icons';
import { t } from '../../i18n';
import { isWarm, RATING_LABEL, RATINGS } from './ratings';

/**
 * One button for your take on an artist: "Rate", or your answer once you've
 * given one ("Love them"). Tapping opens the five choices (and Clear), so
 * the page isn't a wall of buttons. Feeds the taste engine like RateArtist.
 */
export function RatePill({ artist }: { artist: Artist }) {
  const { ratings, rate } = useRatings();
  const current = ratings[artist.id];
  const open = () => {
    haptic.select();
    const options = [...RATINGS.map((r) => (r === current ? `${RATING_LABEL[r]} ✓` : RATING_LABEL[r])), ...(current ? [t('Clear my rating')] : []), t('Cancel')];
    showActionSheet(
      { title: t('How do you feel about {artist}?', { artist: artist.name }), options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: current ? RATINGS.length : undefined },
      (i) => {
        if (i < RATINGS.length) {
          const r = RATINGS[i];
          if (isWarm(r)) haptic.tap();
          rate(artist.id, r);
        } else if (current && i === RATINGS.length) rate(artist.id, undefined);
      },
    );
  };
  const warm = current ? isWarm(current) : false;
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={current ? t('Your rating of {artist}: {rating}. Change it', { artist: artist.name, rating: RATING_LABEL[current] }) : t('Rate {artist}', { artist: artist.name })}
      style={({ pressed }) => [styles.pill, current && (warm ? styles.warm : styles.cold), pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
    >
      <HeartIcon color={warm ? color.glow : color.moon} filled={current === 'love'} size={15} />
      <Text style={styles.text}>{current ? RATING_LABEL[current] : t('Rate')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  warm: { backgroundColor: glowA(0.18), borderColor: glowA(0.45) },
  cold: { borderColor: 'rgba(255,255,255,0.22)' },
  text: { ...type.label, color: color.moon },
});
