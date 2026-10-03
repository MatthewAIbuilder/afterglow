import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { PageTitle } from '../../components/PageTitle';
import { PersonAvatar } from '../../components/PersonAvatar';
import { ChevronIcon, PeopleIcon, PlusIcon, QrIcon, ScanIcon, SearchIcon } from '../../components/TabIcons';
import { useTabBarSpace } from '../../components/GlassTabBar';
import type { Festival } from '../../data/models';
import { CrewWhereCard } from '../crews/CrewWhereCard';
import { CheckInPanel } from '../crews/CheckInPanel';
import { CrewHelpAlerts } from '../crews/CrewHelpAlerts';
import { MeetSpotCard } from '../crews/MeetSpotCard';
import { FriendAddsList } from './FriendAddsList';
import { InviteCard } from './InviteCard';
import { SideQuestsCard } from '../quests/SideQuestsCard';
import { FriendsActivity } from './FriendsActivity';
import { accountsOff } from '../social/unavailable';
import { firstName } from '../../features/crews/together';
import { clock, updatePlace } from '../../features/crews/updates';
import { FOLLOWING } from '../../features/discover/focus';
import { groupFestivals } from '../../features/festivals/going';
import { isOver } from '../../features/festivals/shelves';
import { crewPeopleLine, followBack, goerSuggestions, type GoerSuggestion } from '../../features/social/friends';
import type { Profile } from '../../features/social/models';
import { PersonRow } from '../../features/social/PersonRow';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useCrews } from '../../state/crews';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useGoing } from '../../state/going';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { CrewInvitesCard } from '../crews/CrewInvitesCard';

/** How many of your festivals are asked who else is going. */
const GOER_FESTIVALS = 3;

/**
 * Friends: everything social in one place. Your crews (with where everyone
 * last was), starting a crew, inviting friends, people following you to
 * follow back, people going to your festivals, and the way into Discover's
 * Following. Signed out, it says what you get and how to start.
 */
export function FriendsHub({ festival, inTab = false }: { festival?: Festival; inTab?: boolean }) {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const social = useSocial();
  const me = social.profile;
  const catalog = useCatalog();
  const today = useToday();
  const { crews, crewsAt } = useCrews();
  const { stories, profileOf, ready: updatesReady } = useCrewUpdates();
  // At the festival: your crews there come first, with where everyone is.
  const here = festival && me ? crewsAt(festival.id) : [];
  const { going } = useGoing();

  // Your festivals still to come, soonest first: for crews and for who else is going.
  const upcoming = useMemo(
    () => groupFestivals(catalog.festivals, going, today).going.filter((f) => !isOver(f, today)),
    [catalog.festivals, going, today],
  );

  // Read each time the screen comes into view: who follows you, and who's going to your festivals.
  const [followers, setFollowers] = useState<Profile[] | undefined>();
  const [goers, setGoers] = useState<{ festival: (typeof upcoming)[number]; profiles: Profile[] }[]>([]);
  // Who you followed when the lists were read: following someone from a list keeps them there
  // (showing Following, so it can be undone) until you come back.
  const [followedThen, setFollowedThen] = useState<ReadonlySet<string>>(() => new Set());
  const followingRef = useRef(social.following);
  useEffect(() => {
    followingRef.current = social.following;
  }, [social.following]);
  const meUid = me?.uid;
  const upcomingKey = upcoming.map((f) => f.id).join('|');
  useFocusEffect(
    useCallback(() => {
      if (!meUid) return;
      let live = true;
      const following = followingRef.current;
      setFollowedThen(following);
      social.service
        .followers(meUid, 50)
        .then((uids) => followBack(uids, { following, blocked: social.blocked, me: meUid }))
        .then((uids) => Promise.all(uids.map((u) => social.service.profileOf(u).catch(() => null))))
        .then((list) => live && setFollowers(list.filter((p): p is Profile => !!p)))
        .catch(() => live && setFollowers([]));
      Promise.all(
        upcoming.slice(0, GOER_FESTIVALS).map((festival) =>
          social.service
            .profilesGoingTo(festival.id, 50)
            .then((profiles) => ({ festival, profiles }))
            .catch(() => ({ festival, profiles: [] as Profile[] })),
        ),
      ).then((list) => live && setGoers(list));
      return () => {
        live = false;
      };
      // upcomingKey stands for `upcoming`.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meUid, social.service, social.blocked, upcomingKey]),
  );
  const suggestions: GoerSuggestion[] = useMemo(
    () => goerSuggestions(goers, { following: followedThen, blocked: social.blocked, me: meUid }),
    [goers, followedThen, social.blocked, meUid],
  );

  // Your crews: they're what you do with friends at a festival.
  const crewsSection = me ? (
    <Section title="Your crews">
      {crews.map((c) => {
        const festival = catalog.festival(c.festivalId);
        const news = stories.find((s) => s.updates.some((u) => u.crewId === c.id));
        const who = news ? profileOf(news.uid) : undefined;
        const artist = news?.latest.artistId ? catalog.artist(news.latest.artistId)?.name : undefined;
        const place = news ? updatePlace(news.latest, artist) : '';
        return (
          <Pressable
            key={c.id}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/crew/[id]', params: { id: c.id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${c.name}, ${festival?.name ?? 'a festival'}, ${crewPeopleLine(c.members.length)}${news ? `. Latest: ${who ? firstName(who.displayName) : 'a crewmate'} at ${clock(news.latest.at)}${place ? `, ${place}` : ''}` : ''}`}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Faces uids={c.members.filter((m) => m !== meUid)} profileOf={profileOf} me={me} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.cardDetail} numberOfLines={1}>
                {festival?.name ?? 'Festival'} · {crewPeopleLine(c.members.length)}
              </Text>
              {news ? (
                <Text style={[styles.cardDetail, news.fresh && styles.fresh]} numberOfLines={1}>
                  {who ? firstName(who.displayName) : 'Crewmate'} · {clock(news.latest.at)}
                  {place ? ` · ${place}` : ''}
                </Text>
              ) : null}
            </View>
            <ChevronIcon color={color.moonFaint} size={12} />
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => {
          haptic.select();
          router.push('/start-crew');
        }}
        accessibilityRole="button"
        accessibilityLabel="Start a crew for a festival"
        style={({ pressed }) => [styles.card, styles.startCard, pressed && styles.pressed]}
      >
        <View style={styles.plusCircle}>
          <PlusIcon color={color.night} size={16} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Start a crew</Text>
          <Text style={styles.cardDetail}>
            {crews.length ? 'For another festival.' : 'Plan a festival with friends: shared picks, one route, and where everyone is on the day.'}
          </Text>
        </View>
      </Pressable>
    </Section>
  ) : null;

  return (
    <View style={styles.root}>
      <PageTitle title="Friends" />
      <NightSky />
      {inTab ? null : <PageActions />}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (inTab ? space.lg : 64), paddingBottom: (inTab ? tabSpace : insets.bottom) + space.xxxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            Friends
          </Text>
          {me ? (
            <Pressable
              onPress={() => {
                haptic.select();
                router.push('/people');
              }}
              accessibilityRole="button"
              accessibilityLabel="Find people"
              hitSlop={8}
              style={({ pressed }) => [styles.round, pressed && styles.pressed]}
            >
              <SearchIcon color={color.moon} size={17} />
            </Pressable>
          ) : null}
        </View>
        {festival ? <Text style={styles.atFestival}>At {festival.name}</Text> : null}

        {!social.availability.ok ? (
          <>
            <Hero {...accountsOff(Platform.OS === 'web', 'Friends, crews and friend codes')} />
            <InviteCard festivals={upcoming} />
          </>
        ) : !me ? (
          <>
            <Hero
              title="Festivals are better together"
              body="Make a profile to follow friends and watch their videos, start a crew for a festival, see which sets you all want, and see where everyone is on the day."
              action={social.user ? 'Finish your profile' : 'Create your profile'}
              onAction={() => router.push(social.user ? '/profile-edit' : '/account')}
              secondary={social.user ? undefined : 'I already have one: sign in'}
              onSecondary={() => router.push('/account')}
            />
            <InviteCard festivals={upcoming} />
          </>
        ) : (
          <>
            {/* Someone asked you to join their crew: that's the first thing to answer. */}
            <CrewInvitesCard />
            {festival ? (
              <>
                {here.length ? (
                  <>
                    {/* A crewmate asking for help comes before anything else. */}
                    <CrewHelpAlerts festivalId={festival.id} />
                    {updatesReady ? <CheckInPanel festivalId={festival.id} /> : null}
                    <CrewWhereCard festival={festival} crews={here} />
                    {here.map((c) => (
                      <MeetSpotCard key={`meet-${c.id}`} crew={c} compact={here.length > 1} />
                    ))}
                  </>
                ) : (
                  <Pressable
                    onPress={() => {
                      haptic.select();
                      router.push('/start-crew');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Start a crew for ${festival.name}`}
                    style={({ pressed }) => [styles.card, styles.startCard, pressed && styles.pressed]}
                  >
                    <View style={styles.plusCircle}>
                      <PlusIcon color={color.night} size={16} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Start a crew for {festival.name}</Text>
                      <Text style={styles.cardDetail}>Check in with each other, see where everyone is, and pick a meeting spot.</Text>
                    </View>
                  </Pressable>
                )}

                <Section title="Side quests">
                  <SideQuestsCard max={3} />
                </Section>

                <Section title="Add friends">
                  {/* Adding friends face to face: show your code, or scan theirs. Works with no signal. */}
                  <View style={styles.addRow}>
                    <AddButton label="My code" a11y="Show my friend code" icon={<QrIcon color={color.moon} size={22} />} onPress={() => router.push('/my-code')} />
                    {Platform.OS !== 'web' ? (
                      <AddButton label="Scan a code" a11y="Scan a friend's code" icon={<ScanIcon color={color.night} size={22} />} onPress={() => router.push('/scan')} primary />
                    ) : null}
                  </View>
                  <FriendAddsList />
                </Section>

            {crewsSection}
              </>
            ) : (
              <>
                {/* Away from a festival, bringing friends in comes first. */}
                <InviteCard handle={me.handle} festivals={upcoming} />
            {/* Adding friends face to face: show your code, or scan theirs. Works with no signal. */}
            <View style={styles.addRow}>
              <AddButton label="My code" a11y="Show my friend code" icon={<QrIcon color={color.moon} size={22} />} onPress={() => router.push('/my-code')} />
              {Platform.OS !== 'web' ? (
                <AddButton label="Scan a code" a11y="Scan a friend's code" icon={<ScanIcon color={color.night} size={22} />} onPress={() => router.push('/scan')} primary />
              ) : null}
            </View>
            <FriendAddsList />
                <FriendsActivity />

            {crewsSection}

            {followers && followers.length ? (
              <Section title="Following you">
                {followers.map((p) => (
                  <PersonRow key={p.uid} profile={p} follow />
                ))}
              </Section>
            ) : null}

            {suggestions.length ? (
              <Section title="Going to your festivals">
                {suggestions.map((s) => (
                  <View key={s.profile.uid}>
                    <PersonRow profile={s.profile} follow />
                    <Text style={styles.why}>Going to {s.festival.name}</Text>
                  </View>
                ))}
              </Section>
            ) : upcoming.length === 0 ? (
              <Text style={styles.quiet}>Tap I’m going on a festival to see who else is going.</Text>
            ) : null}

            <Section title="People you follow">
              <Row
                label={social.following.size ? `${social.following.size} ${social.following.size === 1 ? 'person' : 'people'}` : 'No one yet'}
                detail={social.following.size ? 'See who' : 'Find people'}
                onPress={() =>
                  social.following.size ? router.push({ pathname: '/follows/[handle]', params: { handle: me.handle, list: 'following' } }) : router.push('/people')
                }
              />
              <Row label="Videos from people you follow" detail="In Discover" onPress={() => router.navigate({ pathname: '/', params: { festival: FOLLOWING } })} />
            </Section>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Hero({
  title,
  body,
  action,
  onAction,
  secondary,
  onSecondary,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroIcon}>
        <PeopleIcon color={color.glow} size={30} />
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroBody}>{body}</Text>
      {action && onAction ? (
        <Pressable
          onPress={() => {
            haptic.tap();
            onAction();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{action}</Text>
        </Pressable>
      ) : null}
      {secondary && onSecondary ? (
        <Pressable onPress={onSecondary} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>{secondary}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AddButton({ label, a11y, icon, onPress, primary }: { label: string; a11y: string; icon: React.ReactNode; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.addButton, primary && styles.addPrimary, pressed && styles.pressed]}
    >
      {icon}
      <Text style={[styles.addText, primary && styles.addTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, detail, onPress }: { label: string; detail?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

/** Up to three crewmates' faces, overlapping; you when it's just you. */
function Faces({ uids, profileOf, me }: { uids: string[]; profileOf: (uid: string) => Profile | undefined; me: Profile }) {
  const shown = uids.length ? uids.slice(0, 3).map((u) => profileOf(u)) : [me];
  return (
    <View style={styles.faces}>
      {shown.map((p, i) => (
        <View key={i} style={[styles.face, { marginLeft: i ? -14 : 0, zIndex: 3 - i }]}>
          <PersonAvatar name={p?.displayName} url={p?.avatarUrl} size={36} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  atFestival: { ...type.label, color: color.glow, marginTop: -space.sm },
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.largeTitle, color: color.moon },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  addRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.45)',
  },
  addPrimary: { backgroundColor: color.glow, borderColor: color.glow },
  addText: { ...type.headline, color: color.moon },
  addTextPrimary: { color: color.night },
  hero: { marginTop: space.xl, padding: space.xl, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, alignItems: 'center', gap: space.md },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(169,124,255,0.16)' },
  heroTitle: { ...type.title, color: color.moon, textAlign: 'center' },
  heroBody: { ...type.body, color: color.moonDim, textAlign: 'center' },
  primary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, marginTop: space.sm },
  primaryText: { ...type.headline, color: color.moon },
  link: { ...type.label, color: color.glow },
  section: { marginTop: space.xl, gap: space.sm },
  sectionTitle: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: space.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  startCard: { borderStyle: 'dashed', borderColor: 'rgba(169,124,255,0.45)' },
  plusCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glow },
  cardTitle: { ...type.headline, color: color.moon },
  cardDetail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  fresh: { color: color.glow },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 20, borderWidth: 2, borderColor: color.night },
  why: { ...type.caption, color: color.moonFaint, marginLeft: 44 + space.md, marginTop: -6, marginBottom: space.xs },
  quiet: { ...type.body, color: color.moonDim, marginTop: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  rowLabel: { ...type.body, color: color.moon, flex: 1 },
  rowDetail: { ...type.body, color: color.moonDim },
});
