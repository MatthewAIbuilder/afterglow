import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { MenuIcon, PeopleIcon, TilesIcon, BookmarkIcon, FestivalsIcon } from '../../components/TabIcons';
import { useCrewUpdates } from '../../state/crewUpdates';
import { Tabs } from '../../components/Tabs';
import { WEB_URL } from '../../config/app';
import { yourClipCount, yourClips } from '../../features/discover/saved';
import { groupFestivals } from '../../features/festivals/going';
import { countdown } from '../../features/festivals/when';
import { Highlights } from '../../features/profile/Highlights';
import { ProfileButton, ProfileHeader } from '../../features/profile/ProfileHeader';
import { FestivalsTab, SavedTab, VideosTab } from '../../features/profile/ProfileTabsContent';
import { type Highlight, profileHighlights, profileStats, videoGrid } from '../../features/profile/profileView';
import { useRecapFestivals, useYear } from '../../features/recap/useRecap';
import { tasteMix } from '../../features/taste/lean';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useClipPool } from '../../state/community';
import { useCrews } from '../../state/crews';
import { useFollowedArtists } from '../../state/followedArtists';
import { useGoing } from '../../state/going';
import { useMemories } from '../../state/memories';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { useSocial } from '../../state/social';
import { useTaste } from '../../state/taste';
import { useWeekends } from '../../state/weekends';
import { color, space, type } from '../../theme/tokens';

type Tab = 'videos' | 'festivals' | 'saved';

/**
 * Profile, laid out like Instagram and TikTok: your photo and counts, name,
 * bio and sound, Edit / Share, round shortcuts to your festivals, then tabs
 * for your videos, your festivals and what you've saved. Everything else
 * (music, settings, legal) is behind the menu at the top right.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { width } = useWindowDimensions();
  const catalog = useCatalog();
  const today = useToday();
  const [tab, setTab] = useState<Tab>('videos');

  const social = useSocial();
  const me = social.profile;
  const { going } = useGoing();
  const { ratings } = useRatings();
  const { reactions } = useReactions();
  const pool = useClipPool();
  const mine = useMemo(() => yourClips(pool.clips, reactions), [pool.clips, reactions]);
  const kept = yourClipCount(mine);
  const { memories, uriOf } = useMemories();
  const videos = useMemo(() => videoGrid(memories), [memories]);
  const { followed } = useFollowedArtists();
  const followedCount = followed.filter((id) => catalog.artist(id)).length;
  const { crews } = useCrews();
  const freshCrew = useCrewUpdates().stories.some((s) => s.fresh);

  // Your sound as chips, from the live taste.
  const { taste, informed } = useTaste();
  const sounds = useMemo(() => tasteMix(catalog.artists, taste, informed).slice(0, 3), [catalog.artists, taste, informed]);

  // Your festivals, as they are for you (your weekend), soonest first.
  const { forYou, weekendOf } = useWeekends();
  const festivals = useMemo(
    () =>
      groupFestivals(catalog.festivals.map(forYou), going, today).going.map((f) => {
        const w = weekendOf(f.id);
        const when = countdown(f, today);
        return { festival: f, over: when === 'Over', detail: `${w ? `Weekend ${w} · ` : ''}${when ?? f.dates}` };
      }),
    [catalog.festivals, forYou, going, today, weekendOf],
  );
  const recaps = useRecapFestivals();
  const year = today.getFullYear();
  const yearCard = useYear(year);
  const highlights = profileHighlights({
    going: festivals.filter((g) => !g.over).map((g) => ({ festival: g.festival, when: g.detail })),
    year: yearCard ? { year, soFar: yearCard.subtitle.endsWith('so far') } : undefined,
    recaps,
  });

  // Your followers, fetched each time the tab comes into view; who you follow is known on the phone.
  const [followers, setFollowers] = useState<{ uid: string; n: number } | undefined>();
  const meUid = me?.uid;
  useFocusEffect(
    useCallback(() => {
      if (!meUid) return;
      let live = true;
      social.service
        .followCounts(meUid)
        .then((c) => live && setFollowers({ uid: meUid, n: c.followers }))
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [meUid, social.service]),
  );

  const stats = profileStats({
    social: !!me,
    festivals: festivals.length,
    followers: followers?.uid === me?.uid ? followers?.n : undefined,
    following: social.following.size,
    rated: Object.keys(ratings).length,
    kept,
  });

  const openHighlight = (h: Highlight) => {
    if (h.kind === 'festival') router.push(`/festival/${h.id}`);
    else if (h.kind === 'year') router.push({ pathname: '/year/[year]', params: { year: String(h.year) } });
    else router.push({ pathname: '/recap/[id]', params: { id: h.id } });
  };
  const signIn = () => (social.user ? router.push('/profile-edit') : router.push('/account'));

  return (
    <View style={styles.root}>
      <PageTitle title="Profile" />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: tabSpace + space.xl }} showsVerticalScrollIndicator={false}>
        <View style={styles.bar}>
          <Text style={styles.handle} numberOfLines={1} accessibilityRole="header">
            {me ? `@${me.handle}` : 'Profile'}
          </Text>
          {/* Friends: crews, people to follow, invites. Signed out it explains what you get. */}
          <IconButton label={freshCrew ? 'Friends, new from your crew' : 'Friends'} onPress={() => router.push('/friends')}>
            <PeopleIcon color={color.moon} size={22} />
            {freshCrew ? <View style={styles.dot} /> : null}
          </IconButton>
          <IconButton label="Settings and more" onPress={() => router.push('/settings')}>
            <MenuIcon color={color.moon} size={22} />
          </IconButton>
        </View>

        <ProfileHeader
          name={me?.displayName ?? 'You'}
          initial={!!me}
          bio={me ? me.bio : 'Your festivals, your videos and your sound.'}
          avatarUrl={me?.avatarUrl}
          stats={stats}
          onStat={(key) => {
            if (key === 'festivals') setTab('festivals');
            else if (me) router.push({ pathname: '/follows/[handle]', params: { handle: me.handle, list: key } });
          }}
          sounds={sounds}
          onSounds={() => router.push('/your-sound')}
        >
          {me ? (
            <>
              <ProfileButton label="Edit profile" onPress={() => router.push('/profile-edit')} />
              <ProfileButton label="Share profile" onPress={() => void shareMessage(`@${me.handle} on Afterglow: ${WEB_URL}/u/${me.handle}`)} />
              <ProfileButton label="Friends" onPress={() => router.push('/friends')} />
            </>
          ) : social.availability.ok && social.ready ? (
            <ProfileButton label={social.user ? 'Finish your profile' : 'Create your profile'} onPress={signIn} glow />
          ) : null}
        </ProfileHeader>

        <Highlights items={highlights} onOpen={openHighlight} />

        <View style={styles.tabs}>
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { key: 'videos', label: 'Videos', count: memories.length, icon: (c) => <TilesIcon color={c} size={16} /> },
              { key: 'festivals', label: 'Festivals', count: festivals.length, icon: (c) => <FestivalsIcon color={c} size={17} /> },
              { key: 'saved', label: 'Saved', count: kept, icon: (c) => <BookmarkIcon color={c} size={16} /> },
            ]}
          />
        </View>

        {tab === 'videos' ? (
          <VideosTab memories={videos} width={width} uriOf={uriOf} lookup={catalog} />
        ) : tab === 'festivals' ? (
          <FestivalsTab
            going={festivals}
            recapIds={new Set(recaps.map((f) => f.id))}
            crews={social.user ? crews.map((c) => ({ id: c.id, name: c.name, festival: catalog.festival(c.festivalId)?.name, people: c.members.length })) : []}
            onFind={() => router.navigate('/festivals')}
          />
        ) : (
          <SavedTab clips={[...mine.saved, ...mine.liked].slice(0, 12)} clipCount={kept} followedCount={followedCount} artistOf={catalog.artist} width={width} />
        )}
      </ScrollView>
    </View>
  );
}

function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.icon, pressed && { opacity: 0.6 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: space.xl, paddingRight: space.md, marginBottom: space.lg },
  handle: { ...type.title, fontSize: 22, color: color.moon, flex: 1 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: color.glow, borderWidth: 1.5, borderColor: color.night },
  tabs: { marginTop: space.xl },
});
