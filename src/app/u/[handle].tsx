import { Image } from 'expo-image';
import { BadgesGrid } from '../../features/badges/BadgesGrid';
import { useBadges } from '../../features/badges/useBadges';
import { ProfileButton, ProfileHeader } from '../../features/profile/ProfileHeader';
import { filmedOrbit } from '../../features/profile/identity';
import type { ProfileStat } from '../../features/profile/profileView';
import { ProfileCover } from '../../components/ProfileCover';
import { PageTitle } from '../../components/PageTitle';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon, ShareIcon } from '../../components/TabIcons';
import { clipLength } from '../../features/memories/organize';
import { followersLabel, followingLabel, goingLine } from '../../features/social/copy';
import { inCommon } from '../../features/social/common';
import { matchLine, tasteMatch } from '../../features/social/match';
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
import { goBack } from '../../lib/nav';

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
  const { badges, throwbacks } = useBadges(profile?.uid);
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
  const myMix = useMemo(() => tasteMix(catalog.artists, taste, informed), [catalog.artists, taste, informed]);
  const mySounds = useMemo(() => myMix.slice(0, 3).map((s) => s.tag), [myMix]);
  // How alike your taste is, from the sounds they show (and a festival you're both going to).
  const match = useMemo(
    () => (profile && !mine ? tasteMatch(myMix, profile.sounds, profile.festivals.filter((f) => myGoing.includes(f)).length) : undefined),
    [profile, mine, myMix, myGoing],
  );
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
  // The living header, as on your own profile: the artists they've filmed drift round their photo.
  const orbit = useMemo(() => filmedOrbit(memories.map((m) => m.artistId), catalog.artist), [memories, catalog]);
  const stats: ProfileStat[] = [
    ...(counts
      ? [
          { key: 'followers' as const, n: counts.followers, label: counts.followers === 1 ? 'Follower' : 'Followers', a11y: `${followersLabel(counts.followers)}. Opens the list.` },
          { key: 'following' as const, n: counts.following, label: 'Following', a11y: `${followingLabel(counts.following)}. Opens the list.` },
        ]
      : []),
    { key: 'festivals', n: going.length, label: going.length === 1 ? 'Festival' : 'Festivals', a11y: `${going.length} ${going.length === 1 ? 'festival' : 'festivals'}` },
    { key: 'moments', n: memories.length, label: memories.length === 1 ? 'Moment' : 'Moments', a11y: `${memories.length} shared ${memories.length === 1 ? 'moment' : 'moments'}` },
    {
      key: 'badges',
      n: badges.length + throwbacks.length,
      label: badges.length + throwbacks.length === 1 ? 'Badge' : 'Badges',
      a11y: `${badges.length + throwbacks.length} festival ${badges.length + throwbacks.length === 1 ? 'badge' : 'badges'}`,
    },
  ];

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
        <View style={styles.headWrap}>
          <ProfileHeader
            socials={profile.socials}
            name={profile.displayName}
            initial
            handle={profile.handle}
            whose={mine ? 'Your' : `${profile.displayName}’s`}
            uid={profile.uid}
            avatarUrl={profile.avatarUrl}
            bio={profile.bio || undefined}
            note={goingLine(going) || undefined}
            stats={stats}
            tappable={['followers', 'following']}
            onStat={(key) => {
              if (key !== 'followers' && key !== 'following') return;
              router.push({ pathname: '/follows/[handle]', params: { handle: profile.handle, list: key } });
            }}
            sounds={profile.sounds.map((tag) => ({ tag }))}
            orbit={orbit}
          >
            {mine ? (
              <ProfileButton label="Edit profile" onPress={() => router.push('/profile-edit')} />
            ) : (
              <View style={styles.follow}>
                <FollowButton
                  uid={profile.uid}
                  handle={profile.handle}
                  onChange={(on) => setCounts((c) => (c ? { ...c, followers: Math.max(0, c.followers + (on ? 1 : -1)) } : c))}
                />
              </View>
            )}
          </ProfileHeader>
        </View>
        {common.length > 0 || match !== undefined ? (
          <View
            style={styles.common}
            accessible
            accessibilityLabel={`${match !== undefined ? `${matchLine(match)}. ` : ''}In common. ${common.map((l) => l.text).join('. ')}.`}
          >
            <View style={styles.commonTop}>
              <Text style={styles.commonHead}>In common</Text>
              {match !== undefined ? (
                <Text style={styles.match}>
                  {match}%<Text style={styles.matchUnit}> taste match</Text>
                </Text>
              ) : null}
            </View>
            {common.map((l) => (
              <View key={l.kind} style={styles.commonRow}>
                <View style={styles.commonDot} />
                <Text style={styles.commonText}>{l.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {badges.length || throwbacks.length ? (
          <View style={styles.badges}>
            <BadgesGrid badges={badges} throwbacks={throwbacks} festivalOf={catalog.festival} uid={profile.uid} width={width - space.xl * 2 + space.lg * 2} />
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
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl }}>
        <View style={{ marginHorizontal: -space.xl, marginTop: -(insets.top + 64) }}>
          <ProfileCover url={profile && !blocked ? profile.coverUrl : undefined} height={insets.top + 64 + 150} />
        </View>
        {body}
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => goBack()}>
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
  headWrap: { marginHorizontal: -space.xl },
  follow: { flex: 1, alignItems: 'center' },
  badges: { marginHorizontal: -space.lg, marginTop: space.sm },
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
  commonTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  match: { ...type.headline, fontSize: 20, color: color.moon, fontVariant: ['tabular-nums'] },
  matchUnit: { ...type.caption, color: color.moonDim },
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
