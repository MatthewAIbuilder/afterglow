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
import { communityClip, communityClipId } from '../../features/community/clips';
import { HeartIcon } from '../../features/discover/icons';
import { likesLabel } from '../../features/social/copy';
import { useCatalog } from '../../state/catalog';
import { useCommunity } from '../../state/community';
import { useReactions } from '../../state/reactions';
import { useMemories } from '../../state/memories';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * A memory someone shared on their profile, full screen. Like it (the same
 * like as in Discover: it shapes your taste, and the person who filmed it
 * sees it once you have a profile) or report it; on your own, see how many
 * people liked it and who, or remove it.
 */
export default function SharedMemoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const catalog = useCatalog();
  const mem = useMemories();
  const [m, setM] = useState<SharedMemory | null | undefined>();
  const [count, setCount] = useState<number | undefined>();
  const { get, setLiked } = useReactions();
  const community = useCommunity();
  const clipId = communityClipId(id);
  const liked = get(clipId).liked;
  // Whether your like was already counted when the number loaded, so liking here moves it by one.
  const [countedMine, setCountedMine] = useState(false);

  useEffect(() => {
    social.service
      .sharedMemory(id)
      .then(setM)
      .catch(() => setM(null));
  }, [id, social.service]);
  const me = social.user?.uid;
  useEffect(() => {
    if (!me) return;
    let live = true;
    social.service
      .likeCount(id)
      .then((n) => {
        if (!live) return;
        setCount(n);
        setCountedMine((community.sent[me] ?? []).includes(clipId));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // The count is read once per video; your own like is adjusted for below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, me, social.service]);

  const player = useVideoPlayer(m?.videoUrl ?? null, (p) => {
    p.loop = true;
    p.play();
  });

  const blocked = !!m && social.blocked.has(m.uid);
  const mine = !!m && m.uid === social.user?.uid;
  const artist = m?.artistId ? catalog.artist(m.artistId) : undefined;
  const festival = m?.festivalId ? catalog.festival(m.festivalId) : undefined;

  // Public once you have a profile: then your like is part of the count.
  const publicLike = liked && !!social.profile;
  const shown = count === undefined ? undefined : Math.max(0, count - (countedMine ? 1 : 0) + (publicLike ? 1 : 0));
  const toggleLike = () => {
    if (!m) return;
    const next = !liked;
    if (next) haptic.tap();
    else haptic.select();
    community.rememberOwner(clipId, m.uid);
    // A video of an artist on Afterglow also joins Your clips and counts for them, like one liked in Discover.
    const clip = communityClip(m, new Set(catalog.artists.map((a) => a.id)));
    if (clip) community.remember(clip, next);
    setLiked(clipId, next);
  };

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
            {!mine ? (
              <Pressable
                onPress={toggleLike}
                accessibilityRole="button"
                accessibilityState={{ selected: liked }}
                accessibilityLabel={`${liked ? 'Liked' : 'Like'}${shown !== undefined ? `, ${likesLabel(shown)}` : ''}`}
                style={[styles.action, styles.like, liked && styles.liked]}
              >
                <HeartIcon color={liked ? color.glow : color.moon} filled={liked} size={16} />
                <Text style={styles.actionText}>{shown ? String(shown) : 'Like'}</Text>
              </Pressable>
            ) : shown !== undefined ? (
              <Pressable
                onPress={() => router.push({ pathname: '/likes/[id]', params: { id: m.id } })}
                disabled={!shown}
                accessibilityRole="button"
                accessibilityLabel={shown ? `${likesLabel(shown)}. See who liked it.` : likesLabel(0)}
                style={[styles.action, styles.like]}
              >
                <HeartIcon color={color.moon} filled={!!shown} size={16} />
                <Text style={styles.actionText}>{likesLabel(shown)}</Text>
              </Pressable>
            ) : null}
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
          {liked && !mine && !social.profile ? <Text style={styles.note}>Only you see this like. Create a profile and @{m.handle} will see it too.</Text> : null}
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
  actionText: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liked: { backgroundColor: 'rgba(169,124,255,0.22)', borderColor: 'rgba(169,124,255,0.5)' },
  note: { ...type.caption, color: color.moonDim, marginTop: space.sm },
});
