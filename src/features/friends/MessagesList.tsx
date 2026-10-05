import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { haptic } from '../../lib/haptics';
import { useCrewChat } from '../../state/crewChat';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { chatPreview, unreadLine } from '../crews/chat';
import { otherInRoom, type Profile } from '../social/models';

/** At most this many conversations on the Friends tab. */
const SHOWN = 6;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Your 1-to-1 chats on the Friends tab, the latest first: who, their last
 * message and how many are new. Hidden until you've started one; nobody
 * you've blocked.
 */
export function MessagesList() {
  const social = useSocial();
  const me = social.user?.uid;
  const chat = useCrewChat();
  const rooms = useMemo(
    () =>
      me
        ? chat.directChats
            .map((d) => ({ id: d.id, other: otherInRoom(d.id, me), latest: chat.latestFor(d.id) }))
            .filter((r) => !social.blocked.has(r.other) && r.latest)
            .sort((a, b) => (b.latest?.sentAt ?? '').localeCompare(a.latest?.sentAt ?? ''))
            .slice(0, SHOWN)
        : [],
    [me, chat, social.blocked],
  );
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const key = rooms.map((r) => r.other).join('|');
  useFocusEffect(
    useCallback(() => {
      let live = true;
      for (const uid of key ? key.split('|') : [])
        social.service
          .profileOf(uid)
          .then((p) => live && setProfiles((all) => ({ ...all, [uid]: p })))
          .catch(() => {});
      return () => {
        live = false;
      };
    }, [key, social.service]),
  );
  if (!rooms.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">
        Messages
      </Text>
      {rooms.map((r) => {
        const p = profiles[r.other];
        const unread = chat.unreadFor(r.id);
        const name = p ? firstName(p.displayName) : 'Someone';
        const preview = chatPreview(r.latest, me, () => name);
        return (
          <Pressable
            key={r.id}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/crew-chat/[id]', params: { id: r.id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${p?.displayName ?? 'Someone'}${unread ? `, ${unreadLine(unread)}` : ''}. ${preview ?? ''}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <PersonAvatar name={p?.displayName} url={p?.avatarUrl} size={44} />
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {p?.displayName ?? ' '}
              </Text>
              <Text style={[styles.preview, unread ? styles.unread : null]} numberOfLines={1}>
                {preview}
              </Text>
            </View>
            {unread ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  title: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  text: { flex: 1 },
  name: { ...type.headline, color: color.moon },
  preview: { ...type.caption, color: color.moonDim, marginTop: 2 },
  unread: { color: color.moon },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: color.glow, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...type.caption, color: color.night, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
