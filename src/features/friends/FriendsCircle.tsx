import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useCrewChat } from '../../state/crewChat';
import { useSocial } from '../../state/social';
import { color, space, type } from '../../theme/tokens';
import { directRoom, type Profile } from '../social/models';
import { FriendsOrbit } from './FriendsOrbit';
import { openChatWith } from './openChat';
import { nextFestivalOf, splitOrbit } from './orbit';
import { SectionHeader } from './SectionHeader';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * "Your friends" at the top of the Friends tab: the orbit (close friends on
 * the inner ring, everyone else you follow round the outside), how many,
 * and See all. Before you've starred anyone, a line saying how to bring
 * people close. Nothing until you follow someone.
 */
export function FriendsCircle({ profiles, close }: { profiles: Profile[] | undefined; close: readonly string[] }) {
  const social = useSocial();
  const me = social.profile;
  const chat = useCrewChat();
  const { festival } = useCatalog();
  const today = useToday();
  if (!me || !profiles?.length) return null;
  const { inner } = splitOrbit(profiles, close);
  const total = social.following.size;
  const closeCount = inner.length;
  const line = closeCount
    ? `${closeCount} close ${closeCount === 1 ? 'friend' : 'friends'} · ${total} ${total === 1 ? 'friend' : 'friends'}`
    : `${total} ${total === 1 ? 'friend' : 'friends'}`;
  return (
    <View>
      <SectionHeader
        title="Your friends"
        action="See all"
        actionLabel={`See all ${total} people you follow`}
        onAction={() => router.push({ pathname: '/follows/[handle]', params: { handle: me.handle, list: 'following' } })}
      />
      <FriendsOrbit
        me={me}
        friends={profiles}
        close={close}
        unreadFrom={(uid) => chat.unreadFor(directRoom(me.uid, uid))}
        nextFestival={(p) => nextFestivalOf(p, festival, today)}
        onMessage={(p) => void openChatWith(chat.openDirect, p.uid, firstName(p.displayName))}
      />
      <Text style={styles.line}>{line}</Text>
      {closeCount ? null : <Text style={styles.hint}>Star your closest friends on their profile to bring them into your inner ring. Only you see who’s on it.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { ...type.caption, color: color.moonDim, textAlign: 'center', marginTop: space.xs },
  hint: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.xs, paddingHorizontal: space.xl },
});
