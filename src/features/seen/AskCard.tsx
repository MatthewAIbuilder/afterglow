import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useSetsSeen } from '../../state/setsSeen';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import type { DayRoute } from '../plan/route';
import { askables, rateHref } from './ask';
import { setsToAsk } from './seen';
import { t } from '../../i18n';

/**
 * "How was {artist}?" in the app, for the latest set on your route that ended
 * in the last few hours and that you haven't answered. One tap opens the
 * question; "I wasn't there" stops it asking. Works on the website too, where
 * there are no notifications.
 */
export function AskCard({ festival, route }: { festival: Festival; route: DayRoute[] }) {
  const now = useNow(60_000);
  const { sets, waved, loaded, wave } = useSetsSeen();
  const { artist: artistOf } = useCatalog();
  const all = useMemo(() => askables(festival, route), [festival, route]);
  const ask = loaded ? setsToAsk(all, sets, new Set(waved), now.getTime())[0] : undefined;
  const artist = ask ? artistOf(ask.artistId) : undefined;
  if (!ask || !artist) return null;
  return (
    <View style={styles.card}>
      <ArtistAvatar artist={artist} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {t('How was {artist}?', { artist: artist.name })}
        </Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => {
              haptic.select();
              router.push(rateHref(ask));
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Rate the {artist} set', { artist: artist.name })}
            hitSlop={6}
            style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.pillText}>{t('Rate it')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.select();
              wave(ask.festivalId, ask.artistId, ask.day);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('I wasn’t at {artist}', { artist: artist.name })}
            hitSlop={6}
            style={({ pressed }) => [styles.quiet, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.quietText}>{t('I wasn’t there')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    marginBottom: space.md,
    borderRadius: radius.md,
    backgroundColor: glowA(0.1),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  title: { ...type.label, color: color.moon },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  pill: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: glowA(0.22) },
  pillText: { ...type.caption, color: color.moon },
  quiet: { paddingHorizontal: space.sm, paddingVertical: 5 },
  quietText: { ...type.caption, color: color.moonDim },
});
