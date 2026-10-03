import { Image } from 'expo-image';
import { BadgesGrid } from '../../features/badges/BadgesGrid';
import { useBadges } from '../../features/badges/useBadges';
import { StandingAvatar, StandingCaption } from '../../features/standing/StandingAvatar';
import { PageTitle } from '../../components/PageTitle';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon, ShareIcon } from '../../components/TabIcons';
import { SOUND_LABEL } from '../../data/models';
import { clipLength } from '../../features/memories/organize';
import { followersLabel, followingLabel, goingLine } from '../../features/social/copy';
import { inCommon } from '../../features/social/common';
import { isOver } from '../../features/festivals/shelves';
import { tasteMix } from '../../features/taste/lean';
import { useToday } from '../../lib/useToday';
import { useGoing } from '../../state/going';
import { useTaste } from '../../state/taste';
import { useLoves } from '../../state/useLoves';
import { FollowButton } from '../../features/social/FollowButton';
import type { Profile, SharedMemory } from '../../features/social/models';
import { askBlock, askReport } from '../../features/social/moderation';
import { SOCIAL_ERROR_COPY, socialErrorKind, type FollowCounts } from '../../features/social/service';
import { WEB_URL } from '../../config/app';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { showActionSheet } from '../../lib/dialog';
import { shareMessage } from '../../lib/share';

/**
 * Someone's festival profile (or yours, as others see it): photo, name,
 * @handle and bio, followers and following, Follow, where they're going and
 * their sound if they show them, and the memories they've shared. Report and
 * Block from the menu.
 */
export default function PublicProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const social = useSocial();
  const catalog = useCatalog();
  const [profile, setProfile] = useState<Profile | null | undefined>();
  const { badges } = useBadges(profile?.uid);
  const [memories, setMemories] = useState<SharedMemory[]>([]);
  const [problem, setProblem] = useState<string | undefined>();
  const [memoriesFailed, setMemoriesFailed] = useState(false);
  const [counts, setCounts] = useState<FollowCounts | undefined>();

  const signedIn = !!social.user;
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    (async () => {
      let p: Profile | null;
      try {
        p = await social.service.profileByHandle(handle ?? '');
      } catch (e) {
        if (!live) return;
        setProblem(SOCIAL_ERROR_COPY[socialErrorKind(e)]);
        setProfile(null);
        return;
      }
      if (!live) return;
      setProfile(p);
      if (!p) return;
      // Counts and memories load on their own: if they can't, the profile still shows.
      social.service
        .followCounts(p.uid)
        .then((c) => live && setCounts(c))
        .catch(() => {});
      try {
        const ms = await social.service.memoriesOf(p.uid);
        if (live) setMemories(ms);
      } catch {
        if (live) setMemoriesFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [handle, signedIn, social.service]);

  const mine = !!profile && profile.uid === social.user?.uid;
  const blocked = !!profile && social.blocked.has(profile.uid);

  // What you have in common: from what they show and what your phone knows (nothing of yours is sent).
  const { going: myGoing } = useGoing();
  const { taste, informed } = useTaste();
  const loves = useLoves();
  const today = useToday();
  const mySounds = useMemo(() => tasteMix(catalog.artists, taste, informed).slice(0, 3).map((s) => s.tag), [catalog.artists, taste, informed]);
  const common = useMemo(
    () =>
      profile && !mine
        ? inCommon({
            theirs: { festivals: profile.festivals, sounds: profile.sounds, filmed: memories.flatMap((m) => (m.artistId ? [m.artistId] : [])) },
            mine: { going: myGoing, sounds: mySounds, loves },
            festivalName: (id) => {
              const f = catalog.festival(id);
              return f && !isOver(f, today) ? f.name : undefined;
            },
            artistName: (id) => catalog.artist(id)?.name,
          })
        : [],
    [profile, mine, memories, myGoing, mySounds, loves, catalog, today],
  );

  const menu = () => {
    if (!profile) return;
    haptic.select();
    const report = () => askReport({ kind: 'profile', id: profile.uid, ownerUid: profile.uid }, social.report);
    const block = () => askBlock(profile.handle, blocked, (on) => social.setBlocked(profile.uid, on));
    showActionSheet({ title: `@${profile.handle}`, options: ['Report', blocked ? 'Unblock' : 'Block', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 }, (i) =>
      i === 0 ? report() : i === 1 ? block() : undefined,
    );
  };
  const share = () => {
    if (!profile) return;
    haptic.select();
    void shareMessage(`@${profile.handle} on Afterglow: ${WEB_URL}/u/${profile.handle}`);
  };

  const cols = 3;
  const gap = space.xs;
  const tileW = Math.floor((width - space.xl * 2 - gap * (cols - 1)) / cols);
  const going = profile?.festivals.map((id) => catalog.festival(id)?.name).filter((n): n is string => !!n) ?? [];

  let body: React.ReactNode;
  if (!social.availability.ok || !social.user) {
    body = <Text style={styles.body}>{social.availability.ok ? 'Sign in to see profiles.' : SOCIAL_ERROR_COPY.unavailable}</Text>;
  } else if (profile === undefined) {
    body = <ActivityIndicator color={color.glow} style={{ marginTop: space.xxl }} />;
  } else if (!profile) {
    body = <Text style={styles.body}>{problem ?? `No one is called @${handle} on Afterglow.`}</Text>;
  } else if (blocked) {
    body = (
      <View style={styles.center}>
        <Text style={styles.body}>You blocked @{profile.handle}.</Text>
        <Pressable onPress={() => askBlock(profile.handle, true, (on) => social.setBlocked(profile.uid, on))} accessibilityRole="button">
          <Text style={styles.link}>Unblock</Text>
        </Pressable>
      </View>
    );
  } else {
    body = (
      <>
        <View style={styles.head}>
          <View style={styles.avatarWrap}>
            <StandingAvatar uid={profile.uid} name={profile.displayName} url={profile.avatarUrl} size={96} />
          </View>
          <Text style={styles.name}>{profile.displayName}</Text>
          <Text style={styles.handle}>@{profile.handle}</Text>
          <StandingCaption uid={profile.uid} align="center" />
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          {goingLine(going) ? <Text style={styles.meta}>{goingLine(going)}</Text> : null}
          {profile.sounds.length ? (
            <View style={styles.chips}>
              {profile.sounds.map((s) => (
                <View key={s} style={styles.chip}>
                  <Text style={styles.chipText}>{SOUND_LABEL[s]}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {counts ? (
            <View style={styles.counts}>
              {(['followers', 'following'] as const).map((list) => (
                <Pressable
                  key={list}
                  onPress={() => {
                    haptic.select();
                    router.push({ pathname: '/follows/[handle]', params: { handle: profile.handle, list } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${list === 'followers' ? followersLabel(counts.followers) : followingLabel(counts.following)}. Opens the list.`}
                  hitSlop={6}
                >
                  <Text style={styles.count}>{list === 'followers' ? followersLabel(counts.followers) : followingLabel(counts.following)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {mine ? (
            <Pressable onPress={() => router.push('/profile-edit')} accessibilityRole="button" style={styles.edit}>
              <Text style={styles.link}>Edit profile</Text>
            </Pressable>
          ) : (
            <View style={styles.edit}>
              <FollowButton
                uid={profile.uid}
                handle={profile.handle}
                onChange={(on) => setCounts((c) => (c ? { ...c, followers: Math.max(0, c.followers + (on ? 1 : -1)) } : c))}
              />
            </View>
          )}
        </View>
        {common.length > 0 && (
          <View style={styles.common} accessible accessibilityLabel={`In common. ${common.map((l) => l.text).join('. ')}.`}>
            <Text style={styles.commonHead}>In common</Text>
            {common.map((l) => (
              <View key={l.kind} style={styles.commonRow}>
                <View style={styles.commonDot} />
                <Text style={styles.commonText}>{l.text}</Text>
              </View>
            ))}
          </View>
        )}
        {badges.length ? (
          <View style={styles.badges}>
            <BadgesGrid badges={badges} festivalOf={catalog.festival} uid={profile.uid} width={width - space.xl * 2 + space.lg * 2} />
          </View>
        ) : null}
        <Text style={styles.section}>{memories.length ? `Memories · ${memories.length}` : 'Memories'}</Text>
        {memories.length ? (
          <View style={[styles.grid, { gap }]}>
            {memories.map((m) => {
              const artist = m.artistId ? catalog.artist(m.artistId) : undefined;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => router.push({ pathname: '/shared/[id]', params: { id: m.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Video${artist ? ` of ${artist.name}` : ''}`}
                  style={({ pressed }) => [styles.tile, { width: tileW, height: Math.round((tileW * 16) / 9) }, pressed && styles.pressed]}
                >
                  {m.thumbUrl ? <Image source={{ uri: m.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
                  <View style={styles.tileInfo}>
                    {artist ? (
                      <Text style={styles.tileName} numberOfLines={1}>
                        {artist.name}
                      </Text>
                    ) : null}
                    {clipLength(m.durationSec) ? <Text style={styles.tileLen}>{clipLength(m.durationSec)}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.body}>
            {memoriesFailed ? 'Couldn’t load memories just now.' : mine ? 'Share a memory from Memories and it shows up here.' : 'Nothing shared yet.'}
          </Text>
        )}
      </>
    );
  }

  return (
    <View style={styles.root}>
      <PageTitle title={handle ? `@${handle}` : undefined} />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl }}>{body}</ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => router.back()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
      {profile ? (
        <View style={[styles.actions, { top: insets.top + space.sm }]}>
          <GlassCircleButton label="Share profile" onPress={share}>
            <ShareIcon color={color.moon} size={16} />
          </GlassCircleButton>
          {!mine ? (
            <GlassCircleButton label="More: report or block" onPress={menu}>
              <Text style={styles.more}>•••</Text>
            </GlassCircleButton>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  back: { position: 'absolute', left: space.lg },
  actions: { position: 'absolute', right: space.lg, flexDirection: 'row', gap: space.sm },
  more: { ...type.caption, color: color.moon, letterSpacing: 1 },
  head: { alignItems: 'center', gap: space.xs },
  avatarWrap: { marginBottom: space.sm },
  badges: { marginHorizontal: -space.lg, marginTop: space.sm },
  name: { ...type.title, color: color.moon, textAlign: 'center' },
  handle: { ...type.body, color: color.moonDim },
  bio: { ...type.body, color: color.moon, textAlign: 'center', marginTop: space.sm },
  meta: { ...type.caption, color: color.moonDim, marginTop: space.xs, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: space.xs, marginTop: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(169,124,255,0.16)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(169,124,255,0.4)' },
  chipText: { ...type.caption, color: color.moon },
  edit: { marginTop: space.md },
  counts: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  count: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.xxl, marginBottom: space.md },
  common: {
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.35)',
    gap: space.sm,
  },
  commonHead: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1 },
  commonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  commonDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.glow, marginTop: 8 },
  commonText: { ...type.body, color: color.moon, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { borderRadius: radius.sm, overflow: 'hidden', backgroundColor: color.nightRaised },
  tileInfo: { position: 'absolute', left: space.xs, right: space.xs, bottom: space.xs },
  tileName: { ...type.caption, color: color.moon, fontWeight: '700' },
  tileLen: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  body: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.lg },
  center: { alignItems: 'center', gap: space.md },
  link: { ...type.label, color: color.glow },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
