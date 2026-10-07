import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { PlusIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useSocial } from '../../state/social';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { CheckInPanel } from '../crews/CheckInPanel';
import { CrewChatCard } from '../crews/CrewChatCard';
import { CrewHelpAlerts } from '../crews/CrewHelpAlerts';
import { CrewInvitesCard } from '../crews/CrewInvitesCard';
import { CrewWhereCard } from '../crews/CrewWhereCard';
import { MeetSpotCard } from '../crews/MeetSpotCard';
import { firstName } from '../crews/together';
import { FriendAddsList } from '../friends/FriendAddsList';
import { FriendsCircle } from '../friends/FriendsCircle';
import { MessagesList } from '../friends/MessagesList';
import { QuickActions } from '../friends/QuickActions';
import { SectionHeader } from '../friends/SectionHeader';
import { LastUpdated } from '../offline/LastUpdated';
import { SideQuestsCard } from '../quests/SideQuestsCard';
import type { Crew, Profile } from '../social/models';
import { t, tn } from '../../i18n';

/** Faces shown in the strip under the title. */
const FACES = 5;

/**
 * The Friends tab at a festival or show, laid out for the night in one
 * order: who's here with you, anyone asking for help, checking in, your
 * crew (its chat, where everyone is, the meeting spot), your other chats,
 * then adding the people you meet, and side quests last. Each crew's chat
 * shows once (as its card), never again in Chats.
 */
export function FestivalFriends({
  festival,
  crews,
  handle,
  circle,
  crewsReady,
  crewsUnknown,
}: {
  festival: Festival;
  /** Your crews at this festival. */
  crews: readonly Crew[];
  handle: string;
  circle: { profiles: Profile[] | undefined; close: readonly string[] };
  /** Crew updates are ready (checking in works). */
  crewsReady: boolean;
  /** No signal and nothing kept yet: your crews couldn't be read. */
  crewsUnknown: boolean;
}) {
  const { profileOf } = useCrewUpdates();
  const nameOf = (u: string) => (profileOf(u) ? firstName(profileOf(u)!.displayName) : t('Someone'));
  const many = crews.length > 1;

  return (
    <View style={styles.wrap}>
      <HereStrip festival={festival} crews={crews} />

      {/* A crewmate asking for help, or an invite to a crew here: first, before anything else. */}
      <CrewHelpAlerts festivalId={festival.id} />
      <CrewInvitesCard />

      {crews.length ? (
        <>
          {crewsReady ? <CheckInPanel festivalId={festival.id} /> : null}
          <Group title={many ? t('Your crews') : crews[0].name}>
            {crews.map((c) => (
              <CrewChatCard key={`chat-${c.id}`} crew={c} title={many ? c.name : undefined} nameOf={nameOf} />
            ))}
            <CrewWhereCard festival={festival} crews={crews} />
            {crews.map((c) => (
              <MeetSpotCard key={`meet-${c.id}`} crew={c} compact={many} />
            ))}
          </Group>
        </>
      ) : crewsUnknown ? (
        <LastUpdated live={false} />
      ) : (
        <StartCrew festival={festival} />
      )}

      {/* Everyone else: 1-to-1 chats and crews for other nights. */}
      <MessagesList skipCrews={crews.map((c) => c.id)} />

      <Group title={t('Meet people here')}>
        <QuickActions handle={handle} atFestival />
        <FriendAddsList />
        <FriendsCircle profiles={circle.profiles} close={circle.close} folded />
      </Group>

      <Group title={t('Side quests')}>
        <SideQuestsCard max={2} />
      </Group>
    </View>
  );
}

/** Under the title: where you are, with your crew's faces. */
function HereStrip({ festival, crews }: { festival: Festival; crews: readonly Crew[] }) {
  const social = useSocial();
  const { profileOf } = useCrewUpdates();
  const me = social.user?.uid;
  const others = [...new Set(crews.flatMap((c) => c.members))].filter((u) => u !== me && !social.blocked.has(u));
  const shown = others.slice(0, FACES);
  const names = others.map((u) => (profileOf(u) ? firstName(profileOf(u)!.displayName) : undefined)).filter((n): n is string => !!n);
  const line = !others.length
    ? undefined
    : names.length >= 2 && others.length > 2
      ? tn(others.length - 2, 'With {a}, {b} and {n} more', 'With {a}, {b} and {n} more', { a: names[0], b: names[1] })
      : names.length === 2 && others.length === 2
        ? t('With {a} and {b}', { a: names[0], b: names[1] })
        : names.length === 1 && others.length === 1
          ? t('With {a}', { a: names[0] })
          : tn(others.length, 'With {n} crewmate', 'With {n} crewmates');
  return (
    <View style={styles.strip} accessible accessibilityLabel={[t('At {festival}', { festival: festival.name }), line].filter(Boolean).join('. ')}>
      <View style={styles.dot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.at} numberOfLines={1}>
          {t('At {festival}', { festival: festival.name })}
        </Text>
        {line ? (
          <Text style={styles.with} numberOfLines={1}>
            {line}
          </Text>
        ) : null}
      </View>
      {shown.length ? (
        <View style={styles.faces}>
          {shown.map((u, i) => (
            <View key={u} style={[styles.face, i > 0 && { marginLeft: -10 }]}>
              <PersonAvatar uid={u} name={profileOf(u)?.displayName} url={profileOf(u)?.avatarUrl} size={28} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StartCrew({ festival }: { festival: Festival }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push('/start-crew');
      }}
      accessibilityRole="button"
      accessibilityLabel={t('Start a crew for {festival}', { festival: festival.name })}
      style={({ pressed }) => [styles.start, pressed && styles.pressed]}
    >
      <View style={styles.plus}>
        <PlusIcon color={color.night} size={16} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.startTitle}>{t('Start a crew for {festival}', { festival: festival.name })}</Text>
        <Text style={styles.startBody}>{t('Check in with each other, see where everyone is, and pick a meeting spot.')}</Text>
      </View>
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl, marginTop: space.md },
  group: { gap: space.sm },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,126,182,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,126,182,0.35)',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF7EB6' },
  at: { ...type.headline, color: color.moon },
  with: { ...type.caption, color: color.moonDim, marginTop: 1 },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 16, borderWidth: 2, borderColor: color.night },
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: glowA(0.45),
  },
  plus: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glow },
  startTitle: { ...type.headline, color: color.moon },
  startBody: { ...type.caption, color: color.moonDim, marginTop: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
