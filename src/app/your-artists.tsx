import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import type { Artist } from '../data/models';
import { artistsCount, followedShows, followSuggestions, moreLine, type FollowedShow } from '../features/artists/follow';
import { FollowArtistButton } from '../features/artists/FollowArtistButton';
import { distanceLabel, NEAR_KM } from '../features/festivals/near';
import { countdown } from '../features/festivals/when';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useCatalog } from '../state/catalog';
import { useFollowedArtists } from '../state/followedArtists';
import { useGoing } from '../state/going';
import { useNearby } from '../state/nearby';
import { useRatings } from '../state/ratings';
import { useTaste } from '../state/taste';
import { useLoves } from '../state/useLoves';
import { color, space, type } from '../theme/tokens';
import { t } from '../i18n';

/**
 * Your artists: everyone you follow, by where they play next (a festival
 * you're going to first, then the soonest), then those with nothing coming
 * up, and a few artists you'd love to follow.
 */
export default function YourArtistsScreen() {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const today = useToday();
  const { going } = useGoing();
  const { distanceTo, units } = useNearby();
  const { followed, hydrated } = useFollowedArtists();
  const { hydrated: rated } = useRatings();
  const { taste } = useTaste();
  const loves = useLoves();

  const { upcoming, later } = useMemo(
    () => followedShows(followed, { artist: catalog.artist, festivalsOf: catalog.festivalsOf, going, today, distanceTo, nearKm: NEAR_KM }),
    [followed, catalog, going, today, distanceTo],
  );
  // Worked out once what you follow and rate has loaded, then fixed while
  // you're here, so following one doesn't pull its row away.
  const suggestions = useMemo(
    () => (hydrated && rated ? followSuggestions(catalog.artists, { followed, loves, taste, plays: (id) => catalog.festivalsOf(id).length > 0 }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, hydrated, rated],
  );
  const count = followed.filter((id) => catalog.artist(id)).length;

  return (
    <View style={styles.root}>
      <PageTitle title={t('Your artists')} />
      <NightSky />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.title}>{t('Your artists')}</Text>
        <Text style={styles.sub}>
          {count ? t('{artists} · news when they’re added to a lineup', { artists: artistsCount(count) }) : t('Follow artists to hear when they’re added to a lineup.')}
        </Text>

        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Playing next')}</Text>
            {upcoming.map((s) => (
              <ShowRow key={s.artist.id} show={s} line={showLine(s, today, units)} />
            ))}
          </View>
        )}

        {later.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('No festival dates yet')}</Text>
            {later.map((a) => (
              <ArtistLine key={a.id} artist={a} line={t('We’ll tell you when they’re added to a lineup')} />
            ))}
          </View>
        )}

        {suggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{count ? t('You might follow') : t('Artists you’d love')}</Text>
            {suggestions.map((a) => (
              <ArtistLine key={a.id} artist={a} line={t('{pct}% match', { pct: Math.round((taste[a.id] ?? 0) * 100) })} />
            ))}
          </View>
        )}

        {!count && !suggestions.length ? (
          <Text style={styles.note}>{t('Open an artist and tap Follow. Rate a few artists or like some clips and we’ll suggest who to follow.')}</Text>
        ) : (
          <Text style={styles.note}>{t('Following stays on this phone and never changes your match.')}</Text>
        )}
      </ScrollView>
      <PageActions />
    </View>
  );
}

function showLine(s: FollowedShow, today: Date, units: Parameters<typeof distanceLabel>[1]): string {
  const { festival, going, km } = s.next;
  return [festival.name, going ? t('Going') : '', countdown(festival, today) ?? '', km !== undefined ? distanceLabel(km, units) : '', moreLine(s.more)]
    .filter(Boolean)
    .join(' · ');
}

function ShowRow({ show, line }: { show: FollowedShow; line: string }) {
  return <ArtistLine artist={show.artist} line={line} festivalId={show.next.festival.id} glow={show.next.going} />;
}

function ArtistLine({ artist, line, festivalId, glow }: { artist: Artist; line: string; festivalId?: string; glow?: boolean }) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          haptic.select();
          router.push({ pathname: '/artist/[id]', params: { id: artist.id, ...(festivalId ? { festival: festivalId } : {}) } });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${artist.name}, ${line}`}
        style={({ pressed }) => [styles.open, pressed && { opacity: 0.6 }]}
      >
        <ArtistAvatar artist={artist} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {artist.name}
          </Text>
          <Text style={[styles.line, glow && { color: color.glow }]} numberOfLines={2}>
            {line}
          </Text>
        </View>
      </Pressable>
      <FollowArtistButton artist={artist} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640 },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs },
  section: { marginTop: space.xl },
  sectionTitle: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { ...type.headline, color: color.moon },
  line: { ...type.caption, color: color.moonDim, marginTop: 2 },
  note: { ...type.caption, color: color.moonFaint, marginTop: space.xl },
});
