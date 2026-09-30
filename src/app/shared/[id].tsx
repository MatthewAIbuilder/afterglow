import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { CloseIcon } from '../../components/TabIcons';
import type { SharedMemory } from '../../features/social/models';
import { askReport } from '../../features/social/moderation';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../../features/social/service';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useMemories } from '../../state/memories';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';

/** A memory someone shared on their profile, full screen. Report it, or remove it if it's yours. */
export default function SharedMemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const catalog = useCatalog();
  const mem = useMemories();
  const [m, setM] = useState<SharedMemory | null | undefined>();

  useEffect(() => {
    social.service
      .sharedMemory(id)
      .then(setM)
      .catch(() => setM(null));
  }, [id, social.service]);

  const player = useVideoPlayer(m?.videoUrl ?? null, (p) => {
    p.loop = true;
    p.play();
  });

  const blocked = !!m && social.blocked.has(m.uid);
  const mine = !!m && m.uid === social.user?.uid;
  const artist = m?.artistId ? catalog.artist(m.artistId) : undefined;
  const festival = m?.festivalId ? catalog.festival(m.festivalId) : undefined;

  const remove = () => {
    if (!m) return;
    Alert.alert('Remove from your profile?', 'If it’s in your Memories, it stays there.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const local = mem.memories.find((x) => x.sharedId === m.id);
            if (local) await social.unshare(local);
            else await social.service.unshareMemory(m.id);
            haptic.settle();
            router.back();
          } catch (e) {
            Alert.alert('Couldn’t remove it', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      {m && !blocked ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} /> : null}
      {m === undefined ? <ActivityIndicator color={color.glow} style={styles.center} /> : null}
      {m === null || blocked ? <Text style={[styles.center, styles.gone]}>{blocked ? 'You blocked this person.' : 'This video isn’t available any more.'}</Text> : null}
      <LinearGradient colors={['rgba(3,2,10,0)', 'rgba(3,2,10,0.85)']} style={styles.scrim} pointerEvents="none" />
      <View style={[styles.close, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Close" onPress={() => router.back()}>
          <CloseIcon color={color.moon} size={16} />
        </GlassCircleButton>
      </View>
      {m && !blocked ? (
        <View style={[styles.info, { paddingBottom: insets.bottom + space.lg }]}>
          <Text style={styles.artist}>{artist?.name ?? 'Festival moment'}</Text>
          {[m.night, festival?.name].filter(Boolean).length ? <Text style={styles.where}>{[m.night, festival?.name].filter(Boolean).join(' · ')}</Text> : null}
          <Pressable onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: m.handle } })} accessibilityRole="button">
            <Text style={styles.by}>@{m.handle}</Text>
          </Pressable>
          <View style={styles.actions}>
            {mine ? (
              <Pressable onPress={remove} accessibilityRole="button" style={styles.action}>
                <Text style={styles.actionText}>Remove from profile</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => askReport({ kind: 'memory', id: m.id, ownerUid: m.uid }, social.report)} accessibilityRole="button" style={styles.action}>
                <Text style={styles.actionText}>Report</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { position: 'absolute', top: '45%', alignSelf: 'center' },
  gone: { ...type.body, color: color.moonDim },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%' },
  close: { position: 'absolute', left: space.lg },
  info: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, gap: 2 },
  artist: { ...type.largeTitle, color: color.moon },
  where: { ...type.headline, color: color.moonDim },
  by: { ...type.label, color: color.glow, marginTop: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  action: { paddingHorizontal: space.md + 2, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  actionText: { ...type.label, color: color.moon },
});
