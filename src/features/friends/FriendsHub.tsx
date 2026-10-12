import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { NoticeBell } from '../../components/NoticeBell';
import { PageTitle } from '../../components/PageTitle';
import { ChevronIcon, PeopleIcon, PlusIcon } from '../../components/TabIcons';
import { useTabBarSpace } from '../../components/GlassTabBar';
import type { Festival } from '../../data/models';
import { FriendAddsList } from './FriendAddsList';
import { InviteCard } from './InviteCard';
import { QuickActions } from './QuickActions';
import { FriendsCircle } from './FriendsCircle';
import { CrewOrb } from './CrewOrb';
import { SectionHeader } from './SectionHeader';
import { useFriendsCircle } from './useFriendsCircle';
import { LinearGradient } from 'expo-linear-gradient';
import { countdown } from '../festivals/when';
import { MessagesList } from './MessagesList';
import { FriendsActivity } from './FriendsActivity';
import { accountsOff } from '../social/unavailable';
import { firstName } from '../../features/crews/together';
import { clock, updatePlace } from '../../features/crews/updates';
import { FOLLOWING } from '../../features/discover/focus';
import { groupFestivals } from '../../features/festivals/going';
import { isOver } from '../../features/festivals/shelves';
import { crewPeopleLine, followBack, goerSuggestions, MAY_KNOW_SHOWN, peopleYouMayKnow, type GoerSuggestion } from '../../features/social/friends';
import type { Profile } from '../../features/social/models';
import { PersonRow } from '../../features/social/PersonRow';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useCrews } from '../../state/crews';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useCrewChat } from '../../state/crewChat';
import { chatPreview, unreadLine } from '../crews/chat';
import { useGoing } from '../../state/going';
import { useSocial } from '../../state/social';
import { color, radius, space, type, glowA, glowDeepA, accentEdge } from '../../theme/tokens';
import { CrewInvitesCard } from '../crews/CrewInvitesCard';
import { t } from '../../i18n';
import { useEventLookup } from '../festivalMode/useEvent';
import { FestivalFriends } from '../festivalMode/FestivalFriends';

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
  const eventOf = useEventLookup();
  const today = useToday();
  const { crews, crewsAt, confirmed: crewsConfirmed, keptAt: crewsKeptAt } = useCrews();
  const { stories, profileOf } = useCrewUpdates();
  const chat = useCrewChat();
  // At the festival: your crews there come first, with where everyone is.
  const here = festival && me ? crewsAt(festival.id) : [];
  const { going } = useGoing();
  const circle = useFriendsCircle();

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
  const [showAllMayKnow, setShowAllMayKnow] = useState(false);
  const suggestions: GoerSuggestion[] = useMemo(
    () => goerSuggestions(goers, { following: followedThen, blocked: social.blocked, me: meUid }),
    [goers, followedThen, social.blocked, meUid],
  );
  // One list: people who follow you, then people going to your festivals.
  const mayKnow = useMemo(() => peopleYouMayKnow(followers ?? [], suggestions), [followers, suggestions]);

  // Your crews: they're what you do with friends at a festival. Each card is the crew's chat (the crew's page,
  // with its settings, opens from the chat's header).
  const crewsSection = me ? (
    <Section title={t('Crews')}>
      {crews.map((c) => {
        const festival = eventOf(c.festivalId);
        const news = stories.find((s) => s.updates.some((u) => u.crewId === c.id));
        const who = news ? profileOf(news.uid) : undefined;
        const artist = news?.latest.artistId ? catalog.artist(news.latest.artistId)?.name : undefined;
        const place = news ? updatePlace(news.latest, artist) : '';
        const unread = chat.unreadFor(c.id);
        const latest = chat.latestFor(c.id);
        const said = chatPreview(latest, meUid, (u) => (profileOf(u) ? firstName(profileOf(u)!.displayName) : t('Someone')));
        const when = festival ? (isOver(festival, today) ? t('Over') : countdown(festival, today)) : undefined;
        const mates = c.members.filter((m) => m !== meUid);
        const faces = (mates.length ? mates.map((m) => profileOf(m)) : [me]).filter((p): p is Profile => !!p).map((p) => ({ name: p.displayName, url: p.avatarUrl }));
        return (
          <Pressable
            key={c.id}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/crew-chat/[id]', params: { id: c.id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${c.name}, ${festival?.name ?? t('a festival')}, ${crewPeopleLine(c.members.length)}${said ? `. ${said}` : news ? `. ${t('Latest: {who} at {time}', { who: who ? firstName(who.displayName) : t('a crewmate'), time: clock(news.latest.at) })}${place ? `, ${place}` : ''}` : ''}${unread ? `. ${unreadLine(unread)}` : ''}`}
            accessibilityHint={t('Opens the crew’s chat')}
            style={({ pressed }) => [styles.crewCard, pressed && styles.pressed]}
          >
            <LinearGradient colors={[glowDeepA(0.28), glowDeepA(0.04)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <CrewOrb name={c.name} people={faces} total={mates.length || 1} size={64} />
            <View style={styles.crewText}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.cardDetail} numberOfLines={1}>
                {festival?.name ?? t('Festival')} · {crewPeopleLine(c.members.length)}
              </Text>
              {said ? (
                <Text style={[styles.cardDetail, unread > 0 && styles.fresh]} numberOfLines={1}>
                  {said}
                </Text>
              ) : news ? (
                <Text style={[styles.cardDetail, news.fresh && styles.fresh]} numberOfLines={1}>
                  {who ? firstName(who.displayName) : t('Crewmate')} · {clock(news.latest.at)}
                  {place ? ` · ${place}` : ''}
                </Text>
              ) : null}
              <View style={styles.chips}>
                {when ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{when}</Text>
                  </View>
                ) : null}
                {unread ? (
                  <View style={[styles.chip, styles.chipNew]}>
                    <Text style={[styles.chipText, styles.chipNewText]}>{unreadLine(unread)}</Text>
                  </View>
                ) : null}
              </View>
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
        accessibilityLabel={t('Start a crew for a festival')}
        style={({ pressed }) => [styles.card, styles.startCard, pressed && styles.pressed]}
      >
        <View style={styles.plusCircle}>
          <PlusIcon color={color.night} size={16} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{t('Start a crew')}</Text>
          <Text style={styles.cardDetail}>
            {crews.length ? t('For another festival.') : t('Plan a festival with friends: shared picks, one route, and where everyone is on the day.')}
          </Text>
        </View>
      </Pressable>
    </Section>
  ) : null;

  return (
    <View style={styles.root}>
      <PageTitle title={t('Friends')} />
      <NightSky />
      {inTab ? null : <PageActions />}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (inTab ? space.lg : 64), paddingBottom: (inTab ? tabSpace : insets.bottom) + space.xxxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {t('Friends')}
          </Text>
          {/* New followers, likes, tags and crew invites: the same bell as Festivals. */}
          {inTab && social.availability.ok ? <NoticeBell /> : null}
        </View>
        {festival ? <Text style={styles.atFestival}>{t('At {festival}', { festival: festival.name })}</Text> : null}

        {!social.availability.ok ? (
          <>
            <Hero {...accountsOff(Platform.OS === 'web', 'Friends, crews and friend codes')} />
            <InviteCard festivals={upcoming} />
          </>
        ) : !me ? (
          <>
            <Hero
              title={t('Festivals are better together')}
              body={t('Make a profile to follow friends and watch their videos, start a crew for a festival, see which sets you all want, and see where everyone is on the day.')}
              action={social.user ? t('Finish your profile') : t('Create your profile')}
              onAction={() => router.push(social.user ? '/profile-edit' : '/account')}
              secondary={social.user ? undefined : t('I already have one: sign in')}
              onSecondary={() => router.push('/account')}
            />
            <InviteCard festivals={upcoming} />
          </>
        ) : (
          <>
            {festival ? (
              // At the festival or show: one page laid out for the night (features/festivalMode/FestivalFriends).
              <FestivalFriends
                festival={festival}
                crews={here}
                handle={me.handle}
                festivals={upcoming}
                crewsUnknown={!crewsConfirmed && crewsKeptAt === undefined && !!social.user}
                friends={circle.profiles}
                close={circle.close}
              />
            ) : (
              <>
                {/* Your people as an orbit: close friends on the inner ring (only you see who's on it). On the tab it starts tucked behind a bouncing button. */}
                <FriendsCircle profiles={circle.profiles} close={circle.close} folded={inTab} />
                <QuickActions handle={me.handle} festivals={upcoming} />
                {/* Someone asked you to join their crew: that's the first thing to answer. */}
                <CrewInvitesCard />
                {/* Crews, each one its chat; then 1-to-1 messages. */}
                {crewsSection}
                <MessagesList directOnly />
                <FriendAddsList />
                <FriendsActivity profiles={circle.profiles} memories={circle.memories} />

                {mayKnow.length ? (
                  <Section title={t('People you may know')}>
                    {(showAllMayKnow ? mayKnow : mayKnow.slice(0, MAY_KNOW_SHOWN)).map((m) => (
                      <View key={m.profile.uid}>
                        <PersonRow profile={m.profile} follow />
                        <Text style={styles.why}>{m.why}</Text>
                      </View>
                    ))}
                    {mayKnow.length > MAY_KNOW_SHOWN && !showAllMayKnow ? (
                      <Pressable onPress={() => setShowAllMayKnow(true)} accessibilityRole="button" hitSlop={8} style={styles.more}>
                        <Text style={styles.link}>{t('Show {n} more', { n: mayKnow.length - MAY_KNOW_SHOWN })}</Text>
                      </Pressable>
                    ) : null}
                  </Section>
                ) : upcoming.length === 0 ? (
                  <Text style={styles.quiet}>{t('Tap I’m going on a festival to see who else is going.')}</Text>
                ) : null}

                {social.following.size ? (
                  <Row label={t('Videos from people you follow')} detail={t('In Discover')} onPress={() => router.navigate({ pathname: '/', params: { festival: FOLLOWING } })} />
                ) : null}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
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

const styles = StyleSheet.create({
  more: { alignSelf: 'flex-start', paddingVertical: space.sm },
  atFestival: { ...type.label, color: color.glow, marginTop: -space.sm },
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.largeTitle, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  hero: { marginTop: space.xl, padding: space.xl, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim, alignItems: 'center', gap: space.md },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: glowA(0.16) },
  heroTitle: { ...type.title, color: color.moon, textAlign: 'center' },
  heroBody: { ...type.body, color: color.moonDim, textAlign: 'center' },
  primary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, ...accentEdge, marginTop: space.sm },
  primaryText: { ...type.headline, color: color.moon },
  link: { ...type.label, color: color.glow },
  section: { gap: space.sm },
  crewCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.28), overflow: 'hidden' },
  crewText: { flex: 1, gap: 1 },
  chips: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
  chip: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(243,240,255,0.08)' },
  chipText: { ...type.caption, color: color.moonDim },
  chipNew: { backgroundColor: glowA(0.22) },
  chipNewText: { color: color.moon },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  startCard: { borderStyle: 'dashed', borderColor: glowA(0.45) },
  plusCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glow },
  cardTitle: { ...type.headline, color: color.moon },
  cardDetail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  fresh: { color: color.glow },
  why: { ...type.caption, color: color.moonFaint, marginLeft: 44 + space.md, marginTop: -6, marginBottom: space.xs },
  quiet: { ...type.body, color: color.moonDim, marginTop: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  rowLabel: { ...type.body, color: color.moon, flex: 1 },
  rowDetail: { ...type.body, color: color.moonDim },
});
