import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useCloseFriends } from '../../state/closeFriends';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { isOver, whenRank } from '../festivals/shelves';
import type { Profile } from '../social/models';

const AVATAR = 58;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** The soonest festival still to come on someone's profile, if they show where they're going. */
export function nextFestivalOf(profile: Pick<Profile, 'festivals'>, festival: (id: string) => Festival | undefined, today: Date): Festival | undefined {
  return profile.festivals
    .map(festival)
    .filter((f): f is Festival => !!f && !isOver(f, today))
    .sort((a, b) => whenRank(a, today) - whenRank(b, today))[0];
}

/**
 * Your close friends, first on the Friends tab: their faces, and the next
 * festival each is going to (when they show it). Tap one for their profile.
 * Only people you still follow; only you see the list. Before you've starred
 * anyone, a one-line hint (only once you follow someone).
 */
export function CloseFriendsRow() {
  const social = useSocial();
  const me = social.user?.uid;
  const { ids, ready } = useCloseFriends(me);
  const { festival } = useCatalog();
  const today = useToday();
  const shown = useMemo(() => ids.filter((id) => social.following.has(id) && !social.blocked.has(id)), [ids, social.following, social.blocked]);
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const key = shown.join('|');
  useFocusEffect(
    useCallback(() => {
      let live = true;
      for (const id of key ? key.split('|') : [])
        social.service
          .profileOf(id)
          .then((p) => live && setProfiles((all) => ({ ...all, [id]: p })))
          .catch(() => {});
      return () => {
        live = false;
      };
    }, [key, social.service]),
  );

  if (!me || !ready || !social.following.size) return null;
  if (!shown.length)
    return <Text style={styles.hint}>Star your closest friends on their profile and they’ll be here first. Only you see who’s on your list.</Text>;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">
        Close friends
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {shown.map((id) => {
          const p = profiles[id];
          if (p === null) return null;
          const next = p ? nextFestivalOf(p, festival, today) : undefined;
          const name = p ? firstName(p.displayName) : '';
          return (
            <Pressable
              key={id}
              onPress={() => {
                if (!p) return;
                haptic.select();
                router.push({ pathname: '/u/[handle]', params: { handle: p.handle } });
              }}
              accessibilityRole="button"
              accessibilityLabel={p ? `${p.displayName}${next ? `, going to ${next.name}` : ''}` : 'Loading'}
              style={({ pressed }) => [styles.person, pressed && styles.pressed]}
            >
              <View style={styles.ring}>
                <PersonAvatar name={p?.displayName} url={p?.avatarUrl} size={AVATAR} />
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.next} numberOfLines={1}>
                {next ? next.name : ' '}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  title: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1 },
  row: { gap: space.md, paddingRight: space.lg },
  person: { width: AVATAR + 22, alignItems: 'center' },
  ring: { padding: 3, borderRadius: radius.pill, borderWidth: 2, borderColor: color.glow },
  name: { ...type.label, color: color.moon, marginTop: space.xs },
  next: { ...type.caption, color: color.moonFaint, fontSize: 11 },
  hint: { ...type.caption, color: color.moonFaint },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});
