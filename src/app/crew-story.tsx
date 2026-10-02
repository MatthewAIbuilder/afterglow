import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTitle } from '../components/PageTitle';
import { PersonAvatar } from '../components/PersonAvatar';
import { CloseIcon } from '../components/TabIcons';
import { firstName } from '../features/crews/together';
import { ReplyBar } from '../features/crews/ReplyBar';
import { ago, answered, clock, isReply, lateLine, updateLine } from '../features/crews/updates';
import type { CrewUpdate } from '../features/social/models';
import { haptic } from '../lib/haptics';
import { useNow } from '../lib/useNow';
import { useCatalog } from '../state/catalog';
import { useCrewUpdates } from '../state/crewUpdates';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';

/**
 * A crewmate's story, full screen: their latest update first, then earlier
 * ones. Each says when it happened ("Updated 4:05 PM · Main Stage ·
 * SLANDER"), and, when the signal held it back, when it reached you. Tap the
 * right side for earlier, the left for later; past their last, the next
 * crewmate's story. Underneath, what the crew said back and a way to reply.
 */
export default function CrewStoryScreen() {
  const { uid } = useLocalSearchParams<{ uid?: string }>();
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const { stories, profileOf, markSeen, updatesFor } = useCrewUpdates();
  const social = useSocial();
  const me = social.user?.uid;
  const now = useNow().getTime();

  // The order is fixed when it opens, so watching (which stops a story glowing) never reshuffles it.
  const [order] = useState(() => stories.map((s) => s.uid));
  const [who, setWho] = useState(uid ?? order[0]);
  const [i, setI] = useState(0);
  const story = stories.find((s) => s.uid === who);
  useEffect(() => {
    if (story) markSeen(story);
  }, [story, markSeen]);

  if (!story) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.gone}>That update isn’t here any more.</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.closeText}>
          <Text style={styles.link}>Close</Text>
        </Pressable>
      </View>
    );
  }
  const u = story.updates[Math.min(i, story.updates.length - 1)];
  const profile = profileOf(story.uid);
  const name = profile ? firstName(profile.displayName) : 'Crewmate';
  const artist = u.artistId ? catalog.artist(u.artistId)?.name : undefined;
  const late = lateLine(u);
  // A reply to you: the thread is your update's, and writing back goes there.
  const yourUpdate = isReply(u) ? answered(updatesFor(u.crewId), u) : undefined;
  const target = isReply(u) ? yourUpdate : u;
  const nameOf = (id: string) => (id === me ? 'You' : profileOf(id) ? firstName(profileOf(id)!.displayName) : 'Crewmate');

  const step = (dir: 1 | -1) => {
    haptic.select();
    const next = i + dir;
    if (next >= 0 && next < story.updates.length) {
      setI(next);
      return;
    }
    // Past either end: the next (or previous) crewmate, else close.
    const at = order.indexOf(story.uid) + dir;
    const nextUid = order[at];
    if (nextUid && stories.some((s) => s.uid === nextUid)) {
      setWho(nextUid);
      setI(0);
    } else router.back();
  };

  return (
    <View style={styles.root}>
      <PageTitle title={`${name}’s update`} />
      {u.kind === 'video' && u.videoUrl ? (
        <StoryVideo key={u.id} url={u.videoUrl} />
      ) : (
        <CheckInCard key={u.id} update={u} artist={artist} replyingTo={isReply(u) ? (yourUpdate ? `Replying to your ${clock(yourUpdate.at)} update${yourUpdate.note ? `, “${yourUpdate.note}”` : ''}` : 'Replying to your update') : undefined} />
      )}

      <LinearGradient colors={['rgba(3,2,10,0.75)', 'rgba(3,2,10,0)']} style={[styles.topFade, { height: insets.top + 150 }]} pointerEvents="none" />

      {/* Tap zones: left for later, right for earlier. */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.zones}>
          <Pressable style={styles.zoneLeft} onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="Later update" />
          <Pressable style={styles.zoneRight} onPress={() => step(1)} accessibilityRole="button" accessibilityLabel="Earlier update" />
        </View>
      </View>

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <View style={styles.bars} pointerEvents="none">
          {story.updates.map((x, k) => (
            <View key={x.id} style={[styles.bar, k <= i && styles.barOn]} />
          ))}
        </View>
        <View style={styles.who} pointerEvents="box-none">
          <PersonAvatar name={profile?.displayName} url={profile?.avatarUrl} size={36} />
          <View style={{ flex: 1 }} accessible accessibilityLabel={`${name}. ${updateLine(u, artist)}. ${ago(u.at, now)}.${late ? ` ${late}.` : ''}`}>
            <Text style={styles.name} numberOfLines={1}>
              {name} <Text style={styles.ago}>· {ago(u.at, now)}</Text>
            </Text>
            <Text style={styles.line} numberOfLines={2}>
              {updateLine(u, artist)}
            </Text>
            {late ? (
              <Text style={styles.late} numberOfLines={1}>
                {late}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={styles.close}>
            <CloseIcon color={color.moon} size={18} />
          </Pressable>
        </View>
      </View>

      {u.kind === 'video' && u.note ? (
        <View style={[styles.caption, { top: insets.top + 110 }]} pointerEvents="none">
          <Text style={styles.captionText}>{u.note}</Text>
        </View>
      ) : null}

      {target ? <ReplyBar key={`replies-${target.id}`} target={target} nameOf={nameOf} me={me} bottom={insets.bottom} /> : null}
    </View>
  );
}

function StoryVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
}

/** A check-in, as a card of its own: their words big, where and when beneath. */
function CheckInCard({ update: u, artist, replyingTo }: { update: CrewUpdate; artist?: string; replyingTo?: string }) {
  return (
    <LinearGradient colors={['#2A1C5C', '#120E2A', '#0A0918']} style={[StyleSheet.absoluteFill, styles.center]}>
      <View style={styles.card}>
        {replyingTo ? <Text style={styles.cardReplying}>{replyingTo}</Text> : null}
        {u.lost ? <Text style={styles.cardLost}>Can’t find the crew</Text> : null}
        <Text style={styles.cardWords}>{u.note ?? 'Checked in'}</Text>
        {u.stage || artist ? <Text style={styles.cardPlace}>{[u.stage, artist].filter(Boolean).join(' · ')}</Text> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  gone: { ...type.body, color: color.moonDim },
  closeText: { marginTop: space.lg },
  link: { ...type.headline, color: color.glow },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0 },
  zones: { flex: 1, flexDirection: 'row' },
  zoneLeft: { flex: 1 },
  zoneRight: { flex: 2 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.md },
  bars: { flexDirection: 'row', gap: 4, marginBottom: space.md },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  barOn: { backgroundColor: 'rgba(255,255,255,0.9)' },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { ...type.headline, color: color.moon },
  ago: { ...type.caption, color: color.moonDim, fontWeight: '400' },
  line: { ...type.label, color: color.moon, marginTop: 1 },
  late: { ...type.caption, color: '#FFB86B', marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  card: { paddingHorizontal: space.xxl, alignItems: 'center', gap: space.md },
  cardWords: { fontSize: 34, lineHeight: 40, fontWeight: '700', color: color.moon, textAlign: 'center', letterSpacing: -0.6 },
  cardPlace: { ...type.headline, color: color.glow, textAlign: 'center' },
  cardLost: { ...type.label, color: '#FFB86B', textTransform: 'uppercase', letterSpacing: 1.4, textAlign: 'center' },
  cardReplying: { ...type.label, color: color.moonDim, textAlign: 'center' },
  caption: { position: 'absolute', left: space.xl, right: space.xl, alignItems: 'center' },
  captionText: { ...type.headline, color: color.moon, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, overflow: 'hidden' },
});
