import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { EdgeGlow } from '../../components/EdgeGlow';
import { showsGlow } from '../../features/standing/standing';
import { useStanding } from '../../features/standing/useStanding';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import type { SharedMemory } from '../../features/social/models';
import { askReport } from '../../features/social/moderation';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../../features/social/service';
import { haptic } from '../../lib/haptics';
import { communityClip, communityClipId } from '../../features/community/clips';
import { HeartIcon } from '../../features/discover/icons';
import { commentsLabel, likesLabel } from '../../features/social/copy';
import { CloseIcon, CommentIcon } from '../../components/TabIcons';
import { useCatalog } from '../../state/catalog';
import { useCommunity } from '../../state/community';
import { useReactions } from '../../state/reactions';
import { useSeen } from '../../state/seen';
import { useTaste } from '../../state/taste';
import { useMemories } from '../../state/memories';
import { useSocial } from '../../state/social';
import { OrgWatermark } from '../../features/organizers/OrgWatermark';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { whereLine } from '../../features/memories/where';
import { b2bLine } from '../../features/memories/b2b';
import { useClipLoop } from '../../features/memories/useClipLoop';
import { fitFor } from '../../features/memories/videoFit';
import { useVideoSize } from '../../features/memories/useVideoSize';
import { VideoTags } from '../../features/social/VideoTags';
import { showAlert } from '../../lib/dialog';
import { goBack } from '../../lib/nav';
import { pagerIds, VerticalPager } from '../../components/VerticalPager';
import { t } from '../../i18n';

/**
 * A memory someone shared on their profile, full screen. Like it (the same
 * like as in Discover: it shapes your taste, and the person who filmed it
 * sees it once you have a profile) or report it; on your own, see how many
 * people liked it and who, or remove it.
 */
export default function SharedMemoryScreen() {
  // `ids`: the videos to swipe through (a profile's moments, in the order shown), this one among them.
  const { id, ids } = useLocalSearchParams<{ id: string; ids?: string }>();
  const list = pagerIds(ids, id);
  if (list.length < 2) return <SharedMemoryPage id={id} active />;
  return <VerticalPager ids={list} start={id} renderPage={(page, active) => <SharedMemoryPage id={page} active={active} />} />;
}

function SharedMemoryPage({ id, active }: { id: string; active: boolean }) {
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const catalog = useCatalog();
  const mem = useMemories();
  const [m, setM] = useState<SharedMemory | null | undefined>();
  // Couldn't ask (no signal): not the same as removed, and worth another try.
  const [failed, setFailed] = useState(false);
  const [readTry, setReadTry] = useState(0);
  const screen = useWindowDimensions();
  const filmer = useStanding(m?.uid);
  const [count, setCount] = useState<number | undefined>();
  const [comments, setComments] = useState<number | undefined>();
  const { get, setLiked } = useReactions();
  const community = useCommunity();
  const clipId = communityClipId(id);
  const liked = get(clipId).liked;
  // Whether your like was already counted when the number loaded, so liking here moves it by one.
  const [countedMine, setCountedMine] = useState(false);

  const me = social.user?.uid;
  // Videos are for people with an account: signed out, it asks you to sign in rather than calling it gone.
  const signedOut = social.ready && !me;
  useEffect(() => {
    if (!me) return;
    let live = true;
    social.service
      .sharedMemory(id)
      .then((v) => {
        if (!live) return;
        setFailed(false);
        setM(v);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id, me, social.service, readTry]);
  // Someone else's video, watched here, counts as seen (each video once), like one in Discover:
  // that's what the "In the crowd" daily quest counts.
  const { markSeen } = useSeen();
  const othersVideo = active && m && me && m.uid !== me ? m.id : undefined;
  useEffect(() => {
    if (othersVideo) markSeen(communityClipId(othersVideo));
  }, [othersVideo, markSeen]);
  // Coming back (from editing its tags, say): read it again.
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) setReadTry((n) => n + 1);
      focusedBefore.current = true;
    }, [setReadTry]),
  );
  // How many comments, read each time you come back from them.
  useFocusEffect(
    useCallback(() => {
      if (!me) return;
      let live = true;
      social.service
        .commentCount(id)
        .then((n) => live && setComments(n))
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [id, me, social.service]),
  );
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

  // Browsers only start a video by itself when it's muted: there it starts quiet, and a tap brings the sound.
  const [quiet, setQuiet] = useState(Platform.OS === 'web');
  const player = useVideoPlayer(m?.videoUrl ?? null, (p) => {
    p.loop = true;
    p.muted = Platform.OS === 'web';
  });
  useClipLoop(player, m?.clip);
  // Its real shape: fills the screen only when that crops very little, else shows whole.
  const videoSize = useVideoSize(player, m?.videoUrl, m ?? undefined);
  // Only the video in view plays (swiping through a profile's moments).
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  const tapVideo = () => {
    haptic.select();
    if (quiet) {
      soundOn(player);
      setQuiet(false);
      player.play();
    } else if (player.playing) player.pause();
    else player.play();
  };

  const blocked = !!m && social.blocked.has(m.uid);
  const mine = !!m && m.uid === social.user?.uid;
  const artist = m?.artistId ? catalog.artist(m.artistId) : undefined;
  // How much you'd love them (as on Discover): every artist in a b2b counts, the one you'd love most shows.
  const { taste } = useTaste();
  const players = artist ? [artist.id, ...(m?.withArtistIds ?? [])].filter((id) => catalog.artist(id)) : [];
  const pct = players.length ? Math.round(Math.max(...players.map((id) => taste[id] ?? 0)) * 100) : undefined;
  const festival = m?.festivalId ? catalog.festival(m.festivalId) : undefined;
  const where = m ? whereLine(m, festival?.name) : '';

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
    showAlert(t('Remove from your profile?'), t('If it’s in your Memories, it stays there.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            const local = mem.memories.find((x) => x.sharedId === m.id);
            if (local) await social.unshare(local);
            else await social.service.unshareMemory(m.id);
            haptic.settle();
            goBack();
          } catch (e) {
            showAlert(t('Couldn’t remove it'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      {m && !blocked ? <VideoView player={player} style={styles.video} contentFit={fitFor(videoSize, screen)} nativeControls={false} playsInline /> : null}
      {m && !blocked ? (
        <Pressable onPress={tapVideo} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={quiet ? t('Turn the sound on') : t('Play or pause')}>
          {quiet ? <Text style={[styles.center, styles.sound]}>{t('Tap for sound')}</Text> : null}
        </Pressable>
      ) : null}
      {m && !blocked && showsGlow(filmer) ? <EdgeGlow width={screen.width} height={screen.height} radius={44} inset={4} label /> : null}
      {/* An event organizer's own video carries its logo, faintly. */}
      {m && !blocked ? <OrgWatermark uid={m.uid} style={{ top: insets.top + 64, right: space.lg }} /> : null}
      {signedOut ? (
        <View style={[styles.center, styles.signIn]}>
          <Text style={styles.gone}>{t('Sign in to watch videos from the crowd.')}</Text>
          <Pressable onPress={() => router.push('/account')} accessibilityRole="button" style={styles.action}>
            <Text style={styles.actionText}>{t('Sign in or create a free account')}</Text>
          </Pressable>
        </View>
      ) : m === undefined && failed ? (
        <View style={[styles.center, styles.signIn]}>
          <Text style={styles.gone}>{t('Couldn’t load this video. Check your signal and try again.')}</Text>
          <Pressable
            onPress={() => {
              haptic.select();
              setFailed(false);
              setReadTry((n) => n + 1);
            }}
            accessibilityRole="button"
            style={styles.action}
          >
            <Text style={styles.actionText}>{t('Try again')}</Text>
          </Pressable>
        </View>
      ) : m === undefined ? (
        <ActivityIndicator color={color.glow} style={styles.center} />
      ) : null}
      {m === null || blocked ? <Text style={[styles.center, styles.gone]}>{blocked ? t('You blocked this person.') : t('This video isn’t available any more.')}</Text> : null}
      <LinearGradient colors={['rgba(3,2,10,0)', 'rgba(3,2,10,0.85)']} style={styles.scrim} pointerEvents="none" />
      <View style={[styles.close, { top: insets.top + space.sm }]}>
        <GlassCircleButton label={t('Close')} onPress={() => goBack()}>
          <CloseIcon color={color.moon} size={16} />
        </GlassCircleButton>
      </View>
      {m && !blocked ? (
        <View style={[styles.info, { paddingBottom: insets.bottom + space.lg }]}>
          <Text style={styles.artist}>{artist ? b2bLine([artist.name, ...(m.withArtistIds ?? []).map((id) => catalog.artist(id)?.name ?? '')]) : t('Festival moment')}</Text>
          {pct !== undefined && artist ? (
            <Pressable
              onPress={() => router.push({ pathname: '/artist/[id]', params: { id: artist.id } })}
              accessibilityRole="button"
              accessibilityLabel={t('Open {artist}, {pct} percent match', { artist: artist.name, pct })}
              hitSlop={6}
              style={({ pressed }) => pressed && { opacity: 0.7 }}
              testID="shared-match"
            >
              <Text style={styles.match}>{t('{pct}% match', { pct })}</Text>
            </Pressable>
          ) : null}
          {where ? <Text style={styles.where}>{where}</Text> : null}
          <Pressable onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: m.handle } })} accessibilityRole="button">
            <Text style={styles.by}>@{m.handle}</Text>
          </Pressable>
          <VideoTags memoryId={m.id} owner={m.uid} ownerHandle={m.handle} refresh={readTry} />
          <View style={styles.actions}>
            {!mine ? (
              <Pressable
                onPress={toggleLike}
                accessibilityRole="button"
                accessibilityState={{ selected: liked }}
                accessibilityLabel={shown !== undefined ? (liked ? t('Liked, {likes}', { likes: likesLabel(shown) }) : t('Like, {likes}', { likes: likesLabel(shown) })) : liked ? t('Liked') : t('Like')}
                style={[styles.action, styles.like, liked && styles.liked]}
              >
                <HeartIcon color={liked ? color.glow : color.moon} filled={liked} size={16} />
                <Text style={styles.actionText}>{shown ? String(shown) : t('Like')}</Text>
              </Pressable>
            ) : shown !== undefined ? (
              <Pressable
                onPress={() => router.push({ pathname: '/likes/[id]', params: { id: m.id } })}
                disabled={!shown}
                accessibilityRole="button"
                accessibilityLabel={shown ? t('{likes}. See who liked it.', { likes: likesLabel(shown) }) : likesLabel(0)}
                style={[styles.action, styles.like]}
              >
                <HeartIcon color={color.moon} filled={!!shown} size={16} />
                <Text style={styles.actionText}>{likesLabel(shown)}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push({ pathname: '/comments/[id]', params: { id: m.id } })}
              accessibilityRole="button"
              accessibilityLabel={comments !== undefined ? t('{comments}. Read and write comments.', { comments: commentsLabel(comments) }) : t('Comments')}
              style={[styles.action, styles.like]}
            >
              <CommentIcon color={color.moon} size={16} />
              <Text style={styles.actionText}>{comments ? String(comments) : t('Comment')}</Text>
            </Pressable>
            {mine ? (
              <>
                <Pressable
                  onPress={() => router.push({ pathname: '/memory-tag', params: { shared: m.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={t('Edit where it’s from and who was playing')}
                  style={styles.action}
                >
                  <Text style={styles.actionText}>{t('Edit')}</Text>
                </Pressable>
                <Pressable onPress={remove} accessibilityRole="button" style={styles.action}>
                  <Text style={styles.actionText}>{t('Remove from profile')}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => askReport({ kind: 'memory', id: m.id, ownerUid: m.uid }, social.report)} accessibilityRole="button" style={styles.action}>
                <Text style={styles.actionText}>{t('Report')}</Text>
              </Pressable>
            )}
          </View>
          {liked && !mine && !social.profile ? <Text style={styles.note}>{t('Only you see this like. Create a profile and @{handle} will see it too.', { handle: m.handle })}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const soundOn = (p: VideoPlayer) => {
  p.muted = false;
};

const styles = StyleSheet.create({
  // A video tag doesn't stretch to fill on the website without a size of its own.
  video: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  root: { flex: 1, backgroundColor: '#000' },
  center: { position: 'absolute', top: '45%', alignSelf: 'center' },
  gone: { ...type.body, color: color.moonDim, textAlign: 'center' },
  signIn: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xl },
  sound: { ...type.label, color: color.moon, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: 'rgba(3,2,10,0.55)', overflow: 'hidden' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%' },
  close: { position: 'absolute', left: space.lg },
  info: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, gap: 2 },
  artist: { ...type.largeTitle, color: color.moon },
  match: { ...type.label, color: color.glow, marginBottom: 2 },
  where: { ...type.headline, color: color.moonDim },
  by: { ...type.label, color: color.glow, marginTop: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  action: { paddingHorizontal: space.md + 2, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  actionText: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liked: { backgroundColor: glowA(0.22), borderColor: glowA(0.5) },
  note: { ...type.caption, color: color.moonDim, marginTop: space.sm },
});
