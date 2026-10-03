import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FilterChips } from '../../components/FilterChips';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useCommunity } from '../../state/community';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { crowdArtists, crowdByNight, crowdLine, crowdVideos } from '../community/crowd';
import type { SharedMemory } from '../social/models';

/** At most this many of a festival's videos are read. */
export const CROWD_MAX = 120;
const cache = new Map<string, { at: number; list: SharedMemory[] }>();
const FRESH_MS = 3 * 60_000;
/** For tests: forget what was read. */
export const forgetCrowd = () => cache.clear();

/**
 * What people on Afterglow filmed at this festival, organised night by night
 * (a filter for the artists filmed most), three across like a profile grid.
 * Each opens the video. Signed out, or with profiles not set up, it says how
 * to see them.
 */
export function CrowdVideos({ festival }: { festival: Festival }) {
  const social = useSocial();
  const { hidden } = useCommunity();
  const catalog = useCatalog();
  const { width } = useWindowDimensions();
  const signedIn = social.availability.ok && !!social.user;
  const [read, setRead] = useState<{ id: string; list: SharedMemory[] } | 'failed' | undefined>();
  useEffect(() => {
    if (!signedIn) return;
    const hit = cache.get(festival.id);
    if (hit && Date.now() - hit.at < FRESH_MS) return;
    let live = true;
    social.service
      .festivalMemories(festival.id, CROWD_MAX)
      .then((list) => {
        cache.set(festival.id, { at: Date.now(), list });
        if (live) setRead({ id: festival.id, list });
      })
      .catch(() => live && setRead('failed'));
    return () => {
      live = false;
    };
  }, [signedIn, festival.id, social.service]);

  const raw = read && read !== 'failed' && read.id === festival.id ? read.list : cache.get(festival.id)?.list;
  const videos = useMemo(() => (raw ? crowdVideos(raw, { blocked: [...social.blocked], hidden: [...hidden] }) : undefined), [raw, social.blocked, hidden]);
  const artists = useMemo(() => (videos ? crowdArtists(videos) : []), [videos]);
  const [artistId, setArtistId] = useState<string | undefined>();
  const picked = artists.some((a) => a.artistId === artistId) ? artistId : undefined;
  const nights = useMemo(() => (videos ? crowdByNight(videos, festival, picked) : []), [videos, festival, picked]);

  if (!social.availability.ok) return <Note title="Videos from the crowd" body="See what people filmed here in the Afterglow app." />;
  if (!social.user)
    return (
      <Note
        title="Videos from the crowd"
        body="Sign in to see what people on Afterglow filmed here."
        action={{ label: 'Sign in', onPress: () => router.push('/account') }}
      />
    );
  if (read === 'failed' && !videos) return <Note title="Couldn’t load the videos" body="Check your signal and try again in a moment." />;
  if (!videos) return <ActivityIndicator color={color.glow} style={{ marginTop: space.xl }} />;
  if (!videos.length)
    return (
      <Note
        title={`Nothing from ${festival.name} yet`}
        body="Film a set there and share it, tagged with the festival: it shows up here for everyone going, and earns you its badge."
        action={Platform.OS !== 'web' ? { label: 'Film a video', onPress: () => router.push('/camera') } : undefined}
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
            { key: undefined, label: 'Every artist', accessibilityLabel: 'Videos of every artist' },
            ...artists.map((a) => {
              const name = catalog.artist(a.artistId)?.name ?? 'Artist';
              return { key: a.artistId, label: name, count: a.count, accessibilityLabel: `${name}, ${a.count} videos` };
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
                  accessibilityLabel={`${artist ? `${artist.name}, ` : ''}filmed by @${m.handle}, ${n.night}`}
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
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', backgroundColor: 'rgba(10,9,24,0.45)' },
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
