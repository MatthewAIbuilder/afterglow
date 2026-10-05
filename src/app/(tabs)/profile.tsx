import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useProfileBackdrop } from '../../features/profile/useProfileBackdrop';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { MenuIcon, TilesIcon, BookmarkIcon, FestivalsIcon, PinIcon } from '../../components/TabIcons';
import { FestivalProfile } from '../../features/festivalMode/FestivalProfile';
import { useFestivalMode } from '../../state/festivalMode';
import { Tabs } from '../../components/Tabs';
import { ProfileCover } from '../../components/ProfileCover';
import { WEB_URL } from '../../config/app';
import { yourClipCount, yourClips } from '../../features/discover/saved';
import { groupFestivals } from '../../features/festivals/going';
import { countdown } from '../../features/festivals/when';
import { Highlights } from '../../features/profile/Highlights';
import { GardenShelf } from '../../features/sprouts/GardenShelf';
import { ProfileButton, ProfileHeader } from '../../features/profile/ProfileHeader';
import { useDailyQuests } from '../../features/quests/useDailyQuests';
import { CrewsList, SavedTab, VideosTab } from '../../features/profile/ProfileTabsContent';
import { currentlyFeeling, favouriteArtists, ORBIT_MAX } from '../../features/profile/identity';
import { BadgeCelebration } from '../../features/profile/BadgeCelebration';
import { BadgesPanel, ClaimBanner } from '../../features/profile/BadgesPanel';
import { useProfileBadges } from '../../features/profile/useProfileBadges';
import { useProfileShelves } from '../../state/profileShelves';
import { PassportTab } from '../../features/profile/PassportTab';
import { YourArtistsRow } from '../../features/profile/YourArtistsRow';
import { useNow } from '../../lib/useNow';
import { useLoves } from '../../state/useLoves';
import { useSeen } from '../../state/seen';
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
import { useMemoryPicker } from '../../features/memories/useAddMemory';
import { color, space, type } from '../../theme/tokens';

/** How far the cover photo reaches below the safe area. */
/** How far your profile background reaches: past the orbit and your name, fading out gently below them. */
const COVER_H = 420;

type Tab = 'videos' | 'badges' | 'festivals' | 'saved';
const TABS: Tab[] = ['videos', 'festivals', 'badges', 'saved'];

/**
 * Profile, laid out like Instagram and TikTok: your photo and counts, name,
 * bio and sound, Edit / Share, round shortcuts to your festivals, then tabs
 * for your videos, your festivals and what you've saved. Everything else
 * (music, settings, legal) is behind the menu at the top right.
 */
export default function ProfileScreen() {
  // In festival mode: just you, your code and what you filmed here.
  const { active } = useFestivalMode();
  return active ? <FestivalProfile festival={active.festival} /> : <FullProfile />;
}

function FullProfile() {
  const quests = useDailyQuests();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { width } = useWindowDimensions();
  const catalog = useCatalog();
  const today = useToday();
  // `?tab=badges` (a side quest notification) opens on that tab.
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(() => (TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'videos'));
  const [seenParam, setSeenParam] = useState(params.tab);
  if (params.tab !== seenParam) {
    setSeenParam(params.tab);
    if (TABS.includes(params.tab as Tab)) setTab(params.tab as Tab);
  }
  const navigation = useNavigation();
  // Cleared once festival mode has loaded, so a festival-mode Profile that takes over still sees it.
  const { hydrated: modeLoaded } = useFestivalMode();
  useEffect(() => {
    if (params.tab && modeLoaded) navigation.setParams({ tab: undefined } as never);
  }, [params.tab, navigation, modeLoaded]);
  // Rows you've tucked away (Your artists, Your festivals).
  const shelves = useProfileShelves();

  const social = useSocial();
  const me = social.profile;
  const backdrop = useProfileBackdrop(me);
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
  // Pins, side quests and milestones, with what's waiting to be claimed.
  const b = useProfileBadges();
  // Add a festival you went to before: a video from your camera roll, tagged with it.
  const pickPast = useMemoryPicker();
  const { earned } = b;
  const mySet = b.passport;
  const recaps = useRecapFestivals();

  // Who drifts round your photo and fills Your artists: the artists you love, like and follow.
  const favourites = useMemo(
    () => favouriteArtists({ artists: catalog.artists, taste, informed, ratings, followed }),
    [catalog.artists, taste, informed, ratings, followed],
  );
  // The sound you've been feeling this week, from clips you enjoyed lately.
  const { seen } = useSeen();
  const now = useNow();
  const nowMs = now.getTime();
  const feeling = useMemo(
    () => currentlyFeeling({ seen, reactions, artistOfClip: (id) => catalog.artist(pool.find(id)?.artistId ?? ''), now: nowMs }),
    [seen, reactions, catalog, pool, nowMs],
  );

  const loves = useLoves();
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
    festivals: mySet.been.length + mySet.planning.length,
    followers: followers?.uid === me?.uid ? followers?.n : undefined,
    following: social.following.size,
    artists: Object.keys(ratings).length,
    moments: memories.length,
    badges: earned,
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
        <ProfileCover url={me?.coverUrl} backdrop={backdrop} height={insets.top + COVER_H} />
        <View style={styles.bar}>
          <Text style={styles.handle} numberOfLines={1} accessibilityRole="header">
            {me ? `@${me.handle}` : 'Profile'}
          </Text>
          <IconButton label="Settings and more" onPress={() => router.push('/settings')}>
            <MenuIcon color={color.moon} size={22} />
          </IconButton>
        </View>

        <ProfileHeader
            socials={me?.socials}
          name={me?.displayName ?? 'You'}
          initial={!!me}
          bio={me ? me.bio : 'Your festivals, your videos and your sound.'}
          avatarUrl={me?.avatarUrl}
          uid={me?.uid}
          stats={stats}
          onStat={(key) => {
            if (key === 'festivals') setTab('festivals');
            else if (key === 'moments') setTab('videos');
            else if (key === 'badges') setTab('badges');
            else if (key === 'artists') router.push('/your-artists');
            else if (me) router.push({ pathname: '/follows/[handle]', params: { handle: me.handle, list: key } });
          }}
          sounds={sounds}
          onSounds={() => router.push('/your-sound')}
          orbit={favourites.slice(0, ORBIT_MAX)}
          onOrbit={() => router.navigate({ pathname: '/sound', params: { view: 'map' } })}
          feeling={feeling?.tag}
          level={quests.ready ? quests.level : undefined}
          onLevel={() => router.push('/quests')}
        >
          {me ? (
            <>
              <ProfileButton label="Edit profile" onPress={() => router.push('/profile-edit')} />
              <ProfileButton label="Share profile" onPress={() => void shareMessage(`@${me.handle} on Afterglow: ${WEB_URL}/u/${me.handle}`)} />
            </>
          ) : social.availability.ok && social.ready ? (
            <ProfileButton label={social.user ? 'Finish your profile' : 'Create your profile'} onPress={signIn} glow />
          ) : null}
        </ProfileHeader>

        <ClaimBanner b={b} />

        <YourArtistsRow favourites={favourites} hidden={shelves.hidden.has('artists')} onToggle={() => shelves.toggle('artists')} />

        <Highlights
          items={highlights}
          onOpen={openHighlight}
          festivalOf={catalog.festival}
          hidden={shelves.hidden.has('festivals')}
          onToggle={() => shelves.toggle('festivals')}
        />

        <GardenShelf hidden={shelves.hidden.has('garden')} onToggle={() => shelves.toggle('garden')} />

        <View style={styles.tabs}>
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { key: 'videos', label: 'Moments', count: memories.length, icon: (c) => <TilesIcon color={c} size={16} /> },
              { key: 'festivals', label: 'Festivals', count: mySet.been.length + mySet.planning.length, icon: (c) => <FestivalsIcon color={c} size={17} /> },
              { key: 'badges', label: 'Badges', count: earned, icon: (c) => <PinIcon color={c} size={17} /> },
              { key: 'saved', label: 'Saved', count: kept, icon: (c) => <BookmarkIcon color={c} size={16} /> },
            ]}
          />
        </View>

        {tab === 'videos' ? (
          <VideosTab memories={videos} width={width} uriOf={uriOf} lookup={catalog} />
        ) : tab === 'badges' ? (
          <BadgesPanel b={b} uid={me?.uid} width={width} />
        ) : tab === 'festivals' ? (
          <PassportTab
            passport={mySet}
            artistOf={catalog.artist}
            loves={loves}
            recapIds={new Set(recaps.map((f) => f.id))}
            today={today}
            onFind={() => router.navigate('/festivals')}
            throwbacks={b.throwbacks}
            onAddPast={() => void pickPast('library')}
          >
            <CrewsList
              crews={social.user ? crews.map((c) => ({ id: c.id, name: c.name, festival: catalog.festival(c.festivalId)?.name, people: c.members.length })) : []}
            />
          </PassportTab>
        ) : (
          <SavedTab clips={[...mine.saved, ...mine.liked].slice(0, 12)} clipCount={kept} followedCount={followedCount} artistOf={catalog.artist} width={width} />
        )}
      </ScrollView>
      <BadgeCelebration unlock={b.unlock} onDone={b.finishUnlock} />
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
  tabs: { marginTop: space.xl },

});
