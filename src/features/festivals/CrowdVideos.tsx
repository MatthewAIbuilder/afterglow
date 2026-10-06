import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FilterChips } from '../../components/FilterChips';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { color, radius, space, type, nightA } from '../../theme/tokens';
import { crowdArtists, crowdByNight, crowdLine } from '../community/crowd';
import { useFestivalCrowd } from './useFestivalCrowd';
import { t } from '../../i18n';

export { CROWD_MAX, forgetCrowd } from './useFestivalCrowd';

/**
 * What people on Afterglow filmed at this festival, organised night by night
 * (a filter for the artists filmed most), three across like a profile grid.
 * Each opens the video. Signed out, or with profiles not set up, it says how
 * to see them.
 */
export function CrowdVideos({ festival }: { festival: Festival }) {
  const social = useSocial();
  const catalog = useCatalog();
  const { width } = useWindowDimensions();
  const { videos, failed } = useFestivalCrowd(festival.id);
  const artists = useMemo(() => (videos ? crowdArtists(videos) : []), [videos]);
  const [artistId, setArtistId] = useState<string | undefined>();
  const picked = artists.some((a) => a.artistId === artistId) ? artistId : undefined;
  const nights = useMemo(() => (videos ? crowdByNight(videos, festival, picked) : []), [videos, festival, picked]);

  if (!social.availability.ok) return <Note title={t('Videos from the crowd')} body={t('See what people filmed here in the Afterglow app.')} />;
  if (!social.user)
    return (
      <Note
        title={t('Videos from the crowd')}
        body={t('Sign in to see what people on Afterglow filmed here.')}
        action={{ label: t('Sign in'), onPress: () => router.push('/account') }}
      />
    );
  if (failed && !videos) return <Note title={t('Couldn’t load the videos')} body={t('Check your signal and try again in a moment.')} />;
  if (!videos) return <ActivityIndicator color={color.glow} style={{ marginTop: space.xl }} />;
  if (!videos.length)
    return (
      <Note
        title={t('Nothing from {festival} yet', { festival: festival.name })}
        body={t('Film a set there and share it, tagged with the festival: it shows up here for everyone going, and earns you its badge.')}
        action={Platform.OS !== 'web' ? { label: t('Film a video'), onPress: () => router.push('/camera') } : undefined}
      />
    );

  const cols = 3;
  const gap = 3;
  const tile = Math.floor((width - space.lg * 2 - gap * (cols - 1)) / cols);
  return (
    <View style={styles.wrap}>
      <Text style={styles.line}>{crowdLine(videos)}</Text>
      {artists.length > 1 ? (
        <FilterChips
          chips={[
            { key: undefined, label: t('Every artist'), accessibilityLabel: t('Videos of every artist') },
            ...artists.map((a) => {
              const name = catalog.artist(a.artistId)?.name ?? t('Artist');
              return { key: a.artistId, label: name, count: a.count, accessibilityLabel: t('{artist}, {n} videos', { artist: name, n: a.count }) };
            }),
          ]}
          value={picked}
          onChange={setArtistId}
        />
      ) : null}
      {nights.map((n) => (
        <View key={n.night} style={styles.night}>
          <Text style={styles.nightTitle}>
            {n.night} <Text style={styles.nightCount}>{n.videos.length}</Text>
          </Text>
          <View style={[styles.grid, { gap }]}>
            {n.videos.map((m) => {
              const artist = m.artistId ? catalog.artist(m.artistId) : undefined;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    haptic.select();
                    router.push({ pathname: '/shared/[id]', params: { id: m.id } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={artist ? t('{artist}, filmed by @{handle}, {night}', { artist: artist.name, handle: m.handle, night: n.night }) : t('filmed by @{handle}, {night}', { handle: m.handle, night: n.night })}
                  style={({ pressed }) => [styles.tile, { width: tile, height: Math.round((tile * 4) / 3) }, pressed && styles.pressed]}
                >
                  {m.thumbUrl ? <Image source={{ uri: m.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                  <View style={styles.shade} />
                  <View style={styles.tileInfo}>
                    {artist ? (
                      <Text style={styles.tileArtist} numberOfLines={1}>
                        {artist.name}
                      </Text>
                    ) : null}
                    <Text style={styles.tileHandle} numberOfLines={1}>
                      @{m.handle}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function Note({ title, body, action }: { title: string; body: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteTitle}>{title}</Text>
      <Text style={styles.noteBody}>{body}</Text>
      {action ? (
        <Pressable
          onPress={() => {
            haptic.select();
            action.onPress();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.noteButton, pressed && styles.pressed]}
        >
          <Text style={styles.noteButtonText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: space.md, gap: space.sm },
  line: { ...type.label, color: color.moonDim, paddingHorizontal: space.xl },
  night: { marginTop: space.md, paddingHorizontal: space.lg },
  nightTitle: { ...type.headline, color: color.moon, marginBottom: space.sm, paddingHorizontal: space.xs },
  nightCount: { ...type.label, color: color.moonFaint },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { borderRadius: 6, overflow: 'hidden', backgroundColor: color.glass },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', backgroundColor: nightA(0.45) },
  tileInfo: { position: 'absolute', left: 6, right: 6, bottom: 6 },
  tileArtist: { ...type.caption, fontWeight: '700', color: color.moon },
  tileHandle: { ...type.caption, fontSize: 11, color: color.moonDim },
  note: { margin: space.lg, padding: space.xl, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  noteTitle: { ...type.headline, color: color.moon },
  noteBody: { ...type.body, color: color.moonDim },
  noteButton: { alignSelf: 'flex-start', marginTop: space.xs, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glow },
  noteButtonText: { ...type.label, color: color.night },
  pressed: { opacity: 0.85 },
});
