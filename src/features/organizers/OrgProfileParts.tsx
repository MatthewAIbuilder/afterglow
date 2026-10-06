import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { ChevronIcon } from '../../components/TabIcons';
import { SOUND_LABEL } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { color, radius, space, type } from '../../theme/tokens';
import { t, tn } from '../../i18n';
import { localDay } from '../artists/shows';
import { datesLine } from '../festivals/format';
import { OrgEventRows } from './OrgCards';
import { datesText, type Org, orgDjs, orgListings } from './organizers';

/** Lookups for an organizer's imported events, from the catalogue. */
function useLook() {
  const catalog = useCatalog();
  return useMemo(() => ({ catalog, look: { festival: catalog.festival, show: (id: string) => catalog.shows.find((x) => x.id === id) } }), [catalog]);
}

/**
 * The DJs an organizer books, on its profile instead of a sound: how many of
 * its events each plays, the next one, and their sound. Each opens the
 * artist.
 */
export function OrgDjs({ org, own }: { org: Org; own: boolean }) {
  const { catalog, look } = useLook();
  const today = localDay(useToday());
  const djs = useMemo(() => orgDjs(org, look, catalog.artists, today), [org, look, catalog.artists, today]);
  if (!djs.length) return <Text style={styles.empty}>{own ? t('The DJs on your events show here, with how often they play for you.') : t('No DJs announced yet.')}</Text>;
  return (
    <View style={styles.list}>
      {djs.slice(0, 30).map((d) => {
        const artist = catalog.artist(d.artistId);
        if (!artist) return null;
        const next = d.next ? datesLine({ dates: datesText({ date: d.next }), startDate: d.next, endDate: d.next }) : undefined;
        const line = [
          own ? tn(d.events, 'Plays {n} of your events', 'Plays {n} of your events', { n: d.events }) : tn(d.events, 'Plays {n} of their events', 'Plays {n} of their events', { n: d.events }),
          next ? t('next {date}', { date: next }) : undefined,
          d.sound ? SOUND_LABEL[d.sound] : undefined,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            key={d.artistId}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/artist/[id]', params: { id: d.artistId } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${d.name}. ${line}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <ArtistAvatar artist={artist} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {d.name}
              </Text>
              <Text style={styles.line} numberOfLines={1}>
                {line}
              </Text>
            </View>
            <ChevronIcon color={color.moonFaint} size={12} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** An organizer's events on its profile: coming up, then past. */
export function OrgEvents({ org, own }: { org: Org; own: boolean }) {
  const { look } = useLook();
  const today = localDay(useToday());
  const { upcoming, past } = useMemo(() => orgListings(org, look, today), [org, look, today]);
  if (!upcoming.length && !past.length) return <Text style={styles.empty}>{own ? t('Publish an event in your studio and it shows here.') : t('No events announced yet. Check back soon.')}</Text>;
  return (
    <View style={styles.list}>
      {upcoming.length ? (
        <>
          <Text style={styles.head}>{t('Coming up')}</Text>
          <OrgEventRows org={org} listings={upcoming} />
        </>
      ) : null}
      {past.length ? (
        <>
          <Text style={styles.head}>{t('Past events')}</Text>
          <OrgEventRows org={org} listings={past.slice(0, 12)} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginHorizontal: space.lg, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  name: { ...type.headline, color: color.moon },
  line: { ...type.caption, color: color.moonDim },
  head: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.sm },
  empty: { ...type.body, color: color.moonDim, marginHorizontal: space.xl, marginVertical: space.md },
  pressed: { opacity: 0.8 },
});
