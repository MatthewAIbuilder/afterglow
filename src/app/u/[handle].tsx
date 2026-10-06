import { Image } from 'expo-image';
import { BadgesGrid } from '../../features/badges/BadgesGrid';
import { useBadges } from '../../features/badges/useBadges';
import { ProfileButton, ProfileHeader } from '../../features/profile/ProfileHeader';
import { publicOrbit } from '../../features/profile/identity';
import { useProfileBackdrop } from '../../features/profile/useProfileBackdrop';
import type { ProfileStat } from '../../features/profile/profileView';
import { ProfileCover } from '../../components/ProfileCover';
import { PageTitle } from '../../components/PageTitle';
import { router, useLocalSearchParams } from 'expo-router';
import type { PublicResident } from '../../features/sprouts/publicGarden';
import { Sprout } from '../../features/sprouts/Sprout';
import { artistLook } from '../../features/sprouts/artistLook';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { GoingShowsList } from '../../features/festivals/GoingShowsList';
import { goingShowOf } from '../../features/festivals/goingShows';
import { useTaste } from '../../state/taste';
import { useLoves } from '../../state/useLoves';
import { FollowButton } from '../../features/social/FollowButton';
import { CloseFriendToggle } from '../../features/friends/CloseFriendToggle';
import { openChatWith } from '../../features/friends/openChat';
import { useCrewChat } from '../../state/crewChat';
import type { Profile, SharedMemory } from '../../features/social/models';
import { askBlock, askReport } from '../../features/social/moderation';
import { SOCIAL_ERROR_COPY, socialErrorKind, type FollowCounts } from '../../features/social/service';
import { WEB_URL } from '../../config/app';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { useSprouts } from '../../state/sprouts';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { showActionSheet } from '../../lib/dialog';
import { useSendOrShare } from '../../features/messages/useSendOrShare';
import { goBack } from '../../lib/nav';
import { t, tn } from '../../i18n';

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
  const sprouts = useSprouts();
  const sendOrShare = useSendOrShare();
  const chat = useCrewChat();
  const catalog = useCatalog();
  const [profile, setProfile] = useState<Profile | null | undefined>();
  const backdrop = useProfileBackdrop(profile);
  const { badges, throwbacks } = useBadges(profile?.uid);
  const [memories, setMemories] = useState<SharedMemory[]>([]);
  const [tagged, setTagged] = useState<SharedMemory[]>([]);
  // Their garden, as they show it: undefined while it loads (or couldn't), null when they don't show one.
  const [garden, setGarden] = useState<PublicResident[] | null | undefined>(undefined);
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
      social.service
        .gardenOf(p.uid)
        .then((g) => live && setGarden(g?.residents ?? null))
        .catch(() => {});
      // Videos they're tagged in and said yes to (a separate read: if it fails, their own still show).
      social.service
        .taggedMemoriesOf(p.uid)
        .then((ms) => live && setTagged(ms))
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
    showActionSheet({ title: `@${profile.handle}`, options: [t('Report'), blocked ? t('Unblock') : t('Block'), t('Cancel')], destructiveButtonIndex: 1, cancelButtonIndex: 2 }, (i) =>
      i === 0 ? report() : i === 1 ? block() : undefined,
    );
  };
  const share = () => {
    if (!profile) return;
    haptic.select();
    sendOrShare({ kind: 'profile', handle: profile.handle }, t('@{handle} on Afterglow: {url}', { handle: profile.handle, url: `${WEB_URL}/u/${profile.handle}` }));
  };

  const cols = 3;
  const gap = space.xs;
  const tileW = Math.floor((width - space.xl * 2 - gap * (cols - 1)) / cols);
  const taggedShown = tagged.filter((m) => !social.blocked.has(m.uid));
  // A tile opens the video to swipe through the rest of its grid, like Discover.
  const tile = (list: readonly SharedMemory[]) => (m: SharedMemory) => tileOf(m, list);
  const tileOf = (m: SharedMemory, list: readonly SharedMemory[]) => {
    const artist = m.artistId ? catalog.artist(m.artistId) : undefined;
    return (
      <Pressable
        key={m.id}
        onPress={() => router.push({ pathname: '/shared/[id]', params: { id: m.id, ids: list.map((x) => x.id).join(',') } })}
        accessibilityRole="button"
        accessibilityLabel={artist ? t('Video of {artist}', { artist: artist.name }) : t('Video')}
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
  };
  const going = profile?.festivals.map((id) => catalog.festival(id)?.name).filter((n): n is string => !!n) ?? [];
  // The living header, as on your own profile: their favourite artists drift round their photo (unless they
  // switched that off), then the artists they've filmed.
  const orbit = useMemo(
    () => publicOrbit(profile?.showArtists ? profile.artists : [], memories.map((m) => m.artistId), catalog.artist),
    [profile, memories, catalog],
  );
  const theirShows = useMemo(
    () => (profile?.shows ?? []).map((id) => catalog.shows.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x).map(goingShowOf).sort((a, b) => a.date.localeCompare(b.date)),
    [profile, catalog.shows],
  );
  const scroller = useRef<ScrollView>(null);
  const sectionY = useRef({ badges: 0, moments: 0 });
  const stats: ProfileStat[] = [
    ...(counts
      ? [
          { key: 'followers' as const, n: counts.followers, label: counts.followers === 1 ? t('Follower') : t('Followers'), a11y: `${followersLabel(counts.followers)}. ${t('Opens the list.')}` },
          { key: 'following' as const, n: counts.following, label: t('Following'), a11y: `${followingLabel(counts.following)}. ${t('Opens the list.')}` },
        ]
      : []),
    // Where they're going, and festivals they've been to before Afterglow (throwbacks); one-night shows aren't festivals.
    { key: 'festivals', n: going.length + throwbacks.length, label: going.length + throwbacks.length === 1 ? t('Festival') : t('Festivals'), a11y: tn(going.length + throwbacks.length, '{n} festival', '{n} festivals') },
    { key: 'moments', n: memories.length, label: memories.length === 1 ? t('Moment') : t('Moments'), a11y: tn(memories.length, '{n} shared moment', '{n} shared moments') },
    {
      key: 'badges',
      n: badges.length + throwbacks.length,
      label: badges.length + throwbacks.length === 1 ? t('Badge') : t('Badges'),
      a11y: tn(badges.length + throwbacks.length, '{n} festival badge', '{n} festival badges'),
    },
  ];

  let body: React.ReactNode;
  if (!social.availability.ok) {
    body = <Text style={styles.body}>{SOCIAL_ERROR_COPY.unavailable}</Text>;
  } else if (!social.ready) {
    // A link opened cold: wait for sign-in to be read back before asking for it.
    body = <ActivityIndicator color={color.glow} style={{ marginTop: space.xxl }} />;
  } else if (!social.user) {
    // Most often someone opening a friend's invite: say whose it is and how to see it.
    body = (
      <View style={styles.invite}>
        <Text style={styles.inviteTitle} accessibilityRole="header">
          {handle ? t('@{handle} is on Afterglow', { handle }) : t('Profiles on Afterglow')}
        </Text>
        <Text style={styles.inviteBody}>
          {handle ? t('Sign in or make a profile to see @{handle}’s festivals and videos, and follow each other.', { handle }) : t('Sign in to see profiles.')}
        </Text>
        <Pressable onPress={() => router.push('/account')} accessibilityRole="button" style={({ pressed }) => [styles.invitePrimary, pressed && { opacity: 0.8 }]}>
          <Text style={styles.invitePrimaryText}>{t('Sign in or join')}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>{t('Look around first')}</Text>
        </Pressable>
      </View>
    );
  } else if (profile === undefined) {
    body = <ActivityIndicator color={color.glow} style={{ marginTop: space.xxl }} />;
  } else if (!profile) {
    body = <Text style={styles.body}>{problem ?? t('No one is called @{handle} on Afterglow.', { handle: handle ?? '' })}</Text>;
  } else if (blocked) {
    body = (
      <View style={styles.center}>
        <Text style={styles.body}>{t('You blocked @{handle}.', { handle: profile.handle })}</Text>
        <Pressable onPress={() => askBlock(profile.handle, true, (on) => social.setBlocked(profile.uid, on))} accessibilityRole="button">
          <Text style={styles.link}>{t('Unblock')}</Text>
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
            whose={mine ? undefined : profile.displayName}
            uid={profile.uid}
            avatarUrl={profile.avatarUrl}
            bio={profile.bio || undefined}
            note={goingLine(going) || undefined}
            stats={stats}
            tappable={['followers', 'following', 'festivals', 'moments', 'badges']}
            onStat={(key) => {
              // Festivals and badges scroll to their pins, moments to their videos.
              if (key === 'festivals' || key === 'badges') scroller.current?.scrollTo({ y: Math.max(0, sectionY.current.badges - space.md), animated: true });
              else if (key === 'moments') scroller.current?.scrollTo({ y: Math.max(0, sectionY.current.moments - space.md), animated: true });
              else if (key === 'followers' || key === 'following') router.push({ pathname: '/follows/[handle]', params: { handle: profile.handle, list: key } });
            }}
            sounds={profile.sounds.map((tag) => ({ tag }))}
            orbit={orbit}
          >
            {mine ? (
              <ProfileButton label={t('Edit profile')} onPress={() => router.push('/profile-edit')} />
            ) : (
              <View style={styles.follow}>
                <FollowButton
                  uid={profile.uid}
                  handle={profile.handle}
                  onChange={(on) => setCounts((c) => (c ? { ...c, followers: Math.max(0, c.followers + (on ? 1 : -1)) } : c))}
                />
                {/* Message a friend (made the first time; only friends both ways). */}
                {social.following.has(profile.uid) ? (
                  <Pressable
                    onPress={() => {
                      haptic.tap();
                      void openChatWith(chat.openDirect, profile.uid, (profile.displayName.trim().split(/\s+/)[0] || profile.displayName));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Message {name}', { name: profile.displayName })}
                    style={({ pressed }) => [styles.message, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={styles.messageText}>{t('Message')}</Text>
                  </Pressable>
                ) : null}
                {/* A close friend comes first on your Friends tab. Only you see it. */}
                <CloseFriendToggle uid={profile.uid} name={profile.displayName} />
              </View>
            )}
          </ProfileHeader>
        </View>
        {common.length > 0 || match !== undefined ? (
          <View
            style={styles.common}
            accessible
            accessibilityLabel={`${match !== undefined ? `${matchLine(match)}. ` : ''}${t('In common.')} ${common.map((l) => l.text).join('. ')}.`}
          >
            <View style={styles.commonTop}>
              <Text style={styles.commonHead}>{t('In common')}</Text>
              {match !== undefined ? (
                <Text style={styles.match}>
                  {match}%<Text style={styles.matchUnit}>{` ${t('taste match')}`}</Text>
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
        {/* Their garden: a peek, and the way in. */}
        {garden?.length ? (
          <Pressable
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/garden-visit', params: { uid: profile.uid, handle: profile.handle } });
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Visit {name}’s garden: {n} living there', { name: profile.displayName, n: garden.length })}
            style={({ pressed }) => [styles.garden, pressed && { opacity: 0.8 }]}
            testID="visit-garden"
          >
            <View style={styles.gardenPeek}>
              {garden.slice(0, 5).map((r, i) =>
                r.k === 's' ? (
                  <Sprout key={i} kind={r.kind} stage={r.stage} size={40} still />
                ) : (
                  <Sprout key={i} artist={artistLook(catalog.artist(r.artistId) ?? { id: r.artistId, name: r.name, sound: {} })} tier={r.tier} size={40} still />
                ),
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.gardenTitle}>{mine ? t('Your garden') : t('{name}’s garden', { name: profile.displayName.split(' ')[0] })}</Text>
              <Text style={styles.gardenSub}>{t('{n} living there · Visit', { n: garden.length })}</Text>
            </View>
          </Pressable>
        ) : garden !== undefined ? (
          // Nothing on their profile yet: say why, rather than leaving no sign of it.
          <Pressable
            disabled={!mine}
            onPress={() => {
              haptic.select();
              router.push('/garden');
            }}
            accessibilityRole={mine ? 'button' : 'text'}
            style={({ pressed }) => [styles.garden, styles.gardenEmpty, pressed && { opacity: 0.8 }]}
            testID="garden-not-shared"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.gardenTitle}>{mine ? t('Your garden') : t('{name}’s garden', { name: profile.displayName.split(' ')[0] })}</Text>
              <Text style={styles.gardenSub}>
                {mine
                  ? sprouts.gardenShown
                    ? t('It shows here once something is growing in it.')
                    : t('Hidden from your profile. Open your garden to show it.')
                  : t('Not shared yet. It shows here once {name} opens the latest Afterglow with something growing.', { name: profile.displayName.split(' ')[0] })}
              </Text>
            </View>
          </Pressable>
        ) : null}
        {!mine && social.profile ? (
          <Pressable
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/kandi-make', params: { uid: profile.uid, name: profile.displayName, handle: profile.handle } });
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.makeKandi, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.makeKandiText}>{t('Make kandi for {name}', { name: profile.displayName.split(' ')[0] })}</Text>
          </Pressable>
        ) : null}
        {badges.length || throwbacks.length ? (
          <View style={styles.badges} onLayout={(e) => (sectionY.current.badges = e.nativeEvent.layout.y)}>
            <BadgesGrid badges={badges} throwbacks={throwbacks} festivalOf={catalog.festival} uid={profile.uid} width={width - space.xl * 2 + space.lg * 2} />
          </View>
        ) : null}
        {/* One-night shows they're going to (when they show their festivals), from the shows on Afterglow. */}
        <GoingShowsList title={t('Shows')} shows={theirShows} />
        <Text style={styles.section} onLayout={(e) => (sectionY.current.moments = e.nativeEvent.layout.y)}>
          {memories.length ? t('Memories · {n}', { n: memories.length }) : t('Memories')}
        </Text>
        {memories.length ? (
          <View style={[styles.grid, { gap }]}>
            {memories.map(tile(memories))}
          </View>
        ) : (
          <Text style={styles.body}>
            {memoriesFailed ? t('Couldn’t load memories just now.') : mine ? t('Share a memory from Memories and it shows up here.') : t('Nothing shared yet.')}
          </Text>
        )}
        {taggedShown.length ? (
          <>
            <Text style={styles.section}>{t('Tagged · {n}', { n: taggedShown.length })}</Text>
            <View style={[styles.grid, { gap }]}>{taggedShown.map(tile(taggedShown))}</View>
          </>
        ) : null}
      </>
    );
  }

  return (
    <View style={styles.root}>
      <PageTitle title={handle ? `@${handle}` : undefined} />
      <NightSky />
      <ScrollView ref={scroller} contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl }}>
        <View style={{ marginHorizontal: -space.xl, marginTop: -(insets.top + 64) }}>
          <ProfileCover url={profile && !blocked ? profile.coverUrl : undefined} backdrop={blocked ? undefined : backdrop} height={insets.top + 64 + 236} fadeFrom={(insets.top + 64 + 100) / (insets.top + 64 + 236)} />
        </View>
        {body}
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label={t('Back')} onPress={() => goBack()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
      {profile ? (
        <View style={[styles.actions, { top: insets.top + space.sm }]}>
          <GlassCircleButton label={t('Share profile')} onPress={share}>
            <ShareIcon color={color.moon} size={16} />
          </GlassCircleButton>
          {!mine ? (
            <GlassCircleButton label={t('More: report or block')} onPress={menu}>
              <Text style={styles.more}>•••</Text>
            </GlassCircleButton>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  makeKandi: { marginHorizontal: space.xl, marginTop: space.sm, alignItems: 'center', paddingVertical: space.sm + 2, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: glowA(0.5) },
  makeKandiText: { ...type.label, color: color.glow },
  garden: { marginHorizontal: space.xl, marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: 'rgba(110,231,160,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(110,231,160,0.35)' },
  gardenPeek: { flexDirection: 'row', marginRight: space.xs },
  gardenTitle: { ...type.headline, color: color.moon },
  gardenSub: { ...type.caption, color: color.moonDim },
  gardenEmpty: { backgroundColor: color.glass, borderColor: color.hairline },
  root: { flex: 1, backgroundColor: color.night },
  back: { position: 'absolute', left: space.lg },
  actions: { position: 'absolute', right: space.lg, flexDirection: 'row', gap: space.sm },
  more: { ...type.caption, color: color.moon, letterSpacing: 1 },
  headWrap: { marginHorizontal: -space.xl },
  follow: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm },
  message: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  messageText: { ...type.headline, color: color.moon },
  badges: { marginHorizontal: -space.lg, marginTop: space.sm },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.xxl, marginBottom: space.md },
  common: {
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.35),
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
  invite: { alignItems: 'center', gap: space.md, marginTop: space.xxl, alignSelf: 'center', width: '100%', maxWidth: 520 },
  inviteTitle: { ...type.title, color: color.moon, textAlign: 'center' },
  inviteBody: { ...type.body, color: color.moonDim, textAlign: 'center' },
  invitePrimary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, marginTop: space.sm },
  invitePrimaryText: { ...type.headline, color: color.moon },
  link: { ...type.label, color: color.glow },
  signIn: { paddingTop: space.xxxl * 2 },
  signInTitle: { ...type.title, color: color.moon, textAlign: 'center' },
  signInButton: { marginTop: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glow },
  signInText: { ...type.headline, color: color.night },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
