import { TracklistCard } from '../community/TracklistCard';
import { tracklists } from '../community/tracklist';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Artist } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useCommunity } from '../../state/community';
import { useSocial } from '../../state/social';
import { color, space, type, nightA } from '../../theme/tokens';
import { crowdVideos } from '../community/crowd';
import { pastShort } from '../memories/past';
import type { SharedMemory } from '../social/models';
import { t, tn } from '../../i18n';

/** At most this many of an artist's videos are read. */
export const ARTIST_CROWD_MAX = 30;
const FRESH_MS = 3 * 60_000;
const cache = new Map<string, { at: number; list: SharedMemory[] }>();
/** For tests: forget what was read. */
export const forgetArtistCrowd = () => cache.clear();

const TILE_W = 104;
const TILE_H = 170;

/**
 * Everyone's videos of an artist, newest first, as a row of tall tiles with
 * where they were filmed and who filmed them. Each opens the video. Nothing
 * when there are none, or when signed out.
 */
/** Everyone's videos of an artist (newest first, no blocked people or hidden videos), read once and shared. */
export function useArtistCrowd(artist: Artist): SharedMemory[] {
  const social = useSocial();
  const { hidden } = useCommunity();
  const signedIn = social.availability.ok && !!social.user;
  const [read, setRead] = useState<{ id: string; list: SharedMemory[] }>();
  useEffect(() => {
    if (!signedIn) return;
    const hit = cache.get(artist.id);
    if (hit && Date.now() - hit.at < FRESH_MS) return;
    let alive = true;
    social.service
      .artistMemories(artist.id, ARTIST_CROWD_MAX)
      .then((list) => {
        cache.set(artist.id, { at: Date.now(), list });
        if (alive) setRead({ id: artist.id, list });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [signedIn, artist.id, social.service]);
  const raw = read?.id === artist.id ? read.list : cache.get(artist.id)?.list;
  return useMemo(() => (signedIn && raw ? crowdVideos(raw, { blocked: [...social.blocked], hidden: [...hidden] }) : []), [signedIn, raw, social.blocked, hidden]);
}

export function ArtistCrowdRow({ artist, inset = space.xl }: { artist: Artist; inset?: number }) {
  const catalog = useCatalog();
  const videos = useArtistCrowd(artist);
  if (!videos.length) return null;
  const people = new Set(videos.map((v) => v.uid)).size;
  return (
    <View style={styles.wrap}>
      <View style={[styles.head, { paddingHorizontal: inset }]}>
        <Text style={styles.title}>{t('From the crowd')}</Text>
        <Text style={styles.count}>
          {people > 1 ? tn(videos.length, '{n} video from {people} people', '{n} videos from {people} people', { people }) : tn(videos.length, '{n} video', '{n} videos')}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: inset, gap: space.sm }}>
        {videos.map((m) => {
          const where = m.past ? `↺ ${pastShort(m.past)}` : m.festivalId ? catalog.festival(m.festivalId)?.name : undefined;
          return (
            <Pressable
              key={m.id}
              onPress={() => {
                haptic.select();
                router.push({ pathname: '/shared/[id]', params: { id: m.id } });
              }}
              accessibilityRole="button"
              accessibilityLabel={
                m.past
                  ? t('{artist} at a throwback, {where}, filmed by @{handle}', { artist: artist.name, where: pastShort(m.past), handle: m.handle })
                  : where
                    ? t('{artist} at {where}, filmed by @{handle}', { artist: artist.name, where, handle: m.handle })
                    : t('{artist}, filmed by @{handle}', { artist: artist.name, handle: m.handle })
              }
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
            >
              {m.thumbUrl ? <Image source={{ uri: m.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
              <View style={styles.shade} />
              <View style={styles.info}>
                {where ? (
                  <Text style={styles.where} numberOfLines={2}>
                    {where}
                  </Text>
                ) : null}
                <Text style={styles.handle} numberOfLines={1}>
                  @{m.handle}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginTop: space.xxl },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  title: { ...type.title, fontSize: 22, color: color.moon },
  count: { ...type.caption, color: color.moonFaint },
  tile: { width: TILE_W, height: TILE_H, borderRadius: 14, overflow: 'hidden', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', backgroundColor: nightA(0.55) },
  info: { position: 'absolute', left: 7, right: 7, bottom: 7, gap: 1 },
  where: { ...type.caption, fontWeight: '700', color: color.moon },
  handle: { ...type.caption, fontSize: 10, color: color.moonDim },
});

/** On an artist's page: what the crowd heard at their sets, festival by festival (the latest three). */
export function ArtistTracklists({ artist, inset = space.xl }: { artist: Artist; inset?: number }) {
  const catalog = useCatalog();
  const videos = useArtistCrowd(artist);
  const lists = useMemo(() => tracklists(videos).slice(0, 3), [videos]);
  if (!lists.length) return null;
  return (
    <View style={[styles.wrap, { paddingHorizontal: inset, gap: space.md }]}>
      <Text style={styles.title}>{t('What the crowd heard')}</Text>
      {lists.map((l) => (
        <TracklistCard key={`${l.festivalId}|${l.night ?? ''}`} list={l} title={[catalog.festival(l.festivalId)?.name ?? t('A festival'), l.night ? t(l.night) : undefined].filter(Boolean).join(' · ')} />
      ))}
    </View>
  );
}
