import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { color, space, type, nightA } from '../../theme/tokens';
import { ago } from '../crews/updates';
import { liveCrowd } from '../community/crowd';
import { useFestivalCrowd } from './useFestivalCrowd';

const TILE_W = 96;
const TILE_H = 160;

/**
 * While a festival is on: the videos people filmed there in the last few
 * hours, newest first, as a row of tall tiles with a live dot. Each opens
 * the video. Nothing when no one has filmed lately (or when signed out).
 */
export function LiveCrowdRow({ festival, inset = space.xl }: { festival: Festival; inset?: number }) {
  const { videos } = useFestivalCrowd(festival.id, true);
  const now = useNow().getTime();
  const catalog = useCatalog();
  const live = useMemo(() => (videos ? liveCrowd(videos, now) : []), [videos, now]);
  if (!live.length) return null;
  return (
    <View style={styles.wrap}>
      <View style={[styles.head, { paddingHorizontal: inset }]}>
        <View style={styles.dot} />
        <Text style={styles.title}>Live from the crowd</Text>
        <Text style={styles.count}>{live.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: inset, gap: space.sm }}>
        {live.map((m) => {
          const artist = m.artistId ? catalog.artist(m.artistId) : undefined;
          return (
            <Pressable
              key={m.id}
              onPress={() => {
                haptic.select();
                router.push({ pathname: '/shared/[id]', params: { id: m.id } });
              }}
              accessibilityRole="button"
              accessibilityLabel={`${artist ? `${artist.name}, ` : ''}filmed by @${m.handle}, ${ago(m.capturedAt, now)}`}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
            >
              {m.thumbUrl ? <Image source={{ uri: m.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
              <View style={styles.shade} />
              <Text style={styles.ago}>{ago(m.capturedAt, now)}</Text>
              <View style={styles.info}>
                {artist ? (
                  <Text style={styles.artist} numberOfLines={1}>
                    {artist.name}
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
  wrap: { gap: space.sm, marginVertical: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4D6D', shadowColor: '#FF4D6D', shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  title: { ...type.headline, color: color.moon },
  count: { ...type.label, color: color.moonFaint },
  tile: { width: TILE_W, height: TILE_H, borderRadius: 14, overflow: 'hidden', backgroundColor: color.glass, borderWidth: 1.5, borderColor: 'rgba(255,77,109,0.6)' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%', backgroundColor: nightA(0.5) },
  ago: { ...type.caption, fontSize: 10, color: color.moon, position: 'absolute', top: 6, left: 6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, overflow: 'hidden', backgroundColor: nightA(0.55) },
  info: { position: 'absolute', left: 6, right: 6, bottom: 6 },
  artist: { ...type.caption, fontWeight: '700', color: color.moon },
  handle: { ...type.caption, fontSize: 10, color: color.moonDim },
});
