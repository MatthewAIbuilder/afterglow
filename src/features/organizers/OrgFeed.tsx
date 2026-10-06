import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import type { SharedMemory } from '../social/models';
import { OrgLogo } from './OrgMark';
import { eventFestivalIdOf, type Org } from './organizers';

/** How many videos are read per event. */
const PER_EVENT = 60;

/** Every festival id that's the organizer's on Afterglow: its published events and the imported festivals it claimed. */
export const orgFestivalIds = (org: Org) => [...new Set([...org.events.filter((e) => e.published).map((e) => eventFestivalIdOf(org, e)), ...org.claims])];

/**
 * Discover for an event organizer's account: no feed of everything, only
 * what's posted at its events (videos people filmed there) and by its own
 * accounts, newest first. Each opens the video. In English, like the studio.
 */
export function OrgFeed({ org }: { org: Org }) {
  const { service } = useSocial();
  const catalog = useCatalog();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { width } = useWindowDimensions();
  const [videos, setVideos] = useState<SharedMemory[] | undefined>();
  const [busy, setBusy] = useState(false);
  const ids = useMemo(() => orgFestivalIds(org), [org]);
  const uids = org.uids;

  const load = useCallback(async () => {
    setBusy(true);
    const lists = await Promise.all([...ids.map((id) => service.festivalMemories(id, PER_EVENT).catch(() => [])), ...uids.map((u) => service.memoriesOf(u).catch(() => []))]);
    const byId = new Map<string, SharedMemory>();
    for (const m of lists.flat()) byId.set(m.id, m);
    setVideos([...byId.values()].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)));
    setBusy(false);
  }, [service, ids, uids]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const gap = space.xs;
  const tile = (width - space.lg * 2 - gap * 2) / 3;
  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: tabSpace + space.xl }}
        refreshControl={<RefreshControl refreshing={busy && !!videos} onRefresh={() => void load()} tintColor={color.glow} />}
      >
        <View style={styles.head}>
          <OrgLogo org={org} width={170} />
          <Text style={styles.title}>From your events</Text>
          <Text style={styles.sub}>Videos people film at your events, and the ones you post. Everyone else sees these in Discover too.</Text>
        </View>
        {!videos ? (
          <ActivityIndicator color={color.glow} />
        ) : !videos.length ? (
          <Text style={styles.empty}>Nothing posted yet. When people film at your events and share it, it shows here. Post your own from the camera, tagged with your event.</Text>
        ) : (
          <View style={[styles.grid, { gap }]}>
            {videos.map((v) => {
              const artist = v.artistId ? catalog.artist(v.artistId)?.name : v.artistName;
              const where = v.festivalId ? catalog.festival(v.festivalId)?.name : undefined;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => {
                    haptic.select();
                    router.push({ pathname: '/shared/[id]', params: { id: v.id } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={[artist, where, `@${v.handle}`].filter(Boolean).join(', ')}
                  style={({ pressed }) => [styles.tile, { width: tile, height: tile * (4 / 3) }, pressed && { opacity: 0.85 }]}
                >
                  {v.thumbUrl ? <Image source={{ uri: v.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                  <View style={styles.shade} />
                  <View style={styles.caption}>
                    {artist ? (
                      <Text style={styles.artist} numberOfLines={1}>
                        {artist}
                      </Text>
                    ) : null}
                    <Text style={styles.handle} numberOfLines={1}>
                      @{v.handle}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  head: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, marginBottom: space.lg },
  title: { ...type.title, color: color.moon, marginTop: space.sm },
  sub: { ...type.body, color: color.moonDim, textAlign: 'center' },
  empty: { ...type.body, color: color.moonDim, textAlign: 'center', marginHorizontal: space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.lg },
  tile: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.glass, justifyContent: 'flex-end' },
  shade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  caption: { padding: space.xs },
  artist: { ...type.caption, color: color.moon, fontWeight: '700' },
  handle: { ...type.caption, color: color.moonDim, fontSize: 10 },
});
