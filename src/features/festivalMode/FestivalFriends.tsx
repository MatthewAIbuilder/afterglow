import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon, PlusIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { CrewHelpAlerts } from '../crews/CrewHelpAlerts';
import { CrewInvitesCard } from '../crews/CrewInvitesCard';
import { FriendAddsList } from '../friends/FriendAddsList';
import { FriendsCircle } from '../friends/FriendsCircle';
import { MessagesList } from '../friends/MessagesList';
import { QuickActions } from '../friends/QuickActions';
import { SectionHeader } from '../friends/SectionHeader';
import { LastUpdated } from '../offline/LastUpdated';
import { SideQuestsCard } from '../quests/SideQuestsCard';
import type { Crew, Profile } from '../social/models';
import { t } from '../../i18n';
import { CrewNightCard } from './CrewNightCard';
import { isShowEvent } from './showEvent';

/**
 * The Friends tab at a festival or show, laid out for the night: the round
 * buttons first (find people, your code, scan, sprout, invite), the friends
 * you just scanned and your friend orbit (tucked away until tapped), then your
 * crew as one card each (its chat, where everyone is, checking in in one
 * tap, the meeting spot), then your other messages, and tonight's extras
 * last (side quests, badges to collect, looking after yourself, your plan).
 * Each crew's chat shows once (as its card), never again under Messages.
 */
export function FestivalFriends({
  festival,
  crews,
  handle,
  festivals,
  crewsUnknown,
  friends,
  close,
}: {
  festival: Festival;
  /** Your crews at this festival. */
  crews: readonly Crew[];
  handle: string;
  /** Your festivals still to come, for the Invite menu. */
  festivals: readonly Festival[];
  /** No signal and nothing kept yet: your crews couldn't be read. */
  crewsUnknown: boolean;
  /** The people you follow, for the orbit (undefined until read). */
  friends: Profile[] | undefined;
  /** Your close friends among them. */
  close: readonly string[];
}) {
  return (
    <View style={styles.wrap}>
      <View>
        <QuickActions handle={handle} festivals={festivals} />
        <FriendAddsList />
      </View>

      {/* Your friends, a tap away: the same orbit as the full Friends tab, folded. */}
      <FriendsCircle profiles={friends} close={close} folded />

      <Group title={crews.length > 1 ? t('Your crews') : t('Your crew')}>
        {/* A crewmate asking for help, or an invite to a crew: before anything else. */}
        <CrewHelpAlerts festivalId={festival.id} />
        <CrewInvitesCard />
        {crews.length ? (
          crews.map((c) => <CrewNightCard key={c.id} crew={c} festival={festival} />)
        ) : crewsUnknown ? (
          <LastUpdated live={false} />
        ) : (
          <StartCrew festival={festival} />
        )}
      </Group>

      {/* Everyone else: 1-to-1 chats and crews for other nights. */}
      <MessagesList skipCrews={crews.map((c) => c.id)} />

      <Group title={t('Tonight')}>
        <SideQuestsCard max={2} />
        <View style={styles.rows}>
          <LinkRow label={t('Badges to collect')} onPress={() => router.navigate({ pathname: '/profile', params: { tab: 'badges' } })} />
          <LinkRow label={t('Look after yourself')} onPress={() => router.push('/care')} />
          <LinkRow label={t('Find my way back')} onPress={() => router.push('/spots')} />
          <LinkRow label={isShowEvent(festival) ? t('The bill') : t('Your plan for tonight')} onPress={() => router.navigate('/lineup')} />
        </View>
      </Group>
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.rowText}>{label}</Text>
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
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
  wrap: { gap: space.xl },
  rows: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  rowText: { ...type.body, color: color.moon, flex: 1 },
  group: { gap: space.sm },
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
