import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useCrewChat } from '../../state/crewChat';
import { useCrews } from '../../state/crews';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { chatPreview, unreadLine } from '../crews/chat';
import { otherInRoom, type Crew, type Profile } from '../social/models';

/** Chats shown before "Show all". */
const SHOWN = 5;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

type Row = { id: string; latestAt?: string } & ({ kind: 'direct'; other: string } | { kind: 'crew'; crew: Crew });

/**
 * All your chats on the Friends tab, in one place: 1-to-1 chats and your
 * crews' chats, the latest first, each with its last message and how many
 * are new. Crews you haven't chatted in yet come after. Nobody you've
 * blocked. `skipCrews`: crews already shown as cards (festival mode).
 */
export function MessagesList({ skipCrews = [] }: { skipCrews?: readonly string[] }) {
  const social = useSocial();
  const me = social.user?.uid;
  const chat = useCrewChat();
  const { crews } = useCrews();
  const { festival } = useCatalog();
  const [all, setAll] = useState(false);
  const skip = skipCrews.join('|');
  const rows = useMemo((): Row[] => {
    if (!me) return [];
    const skipped = new Set(skip ? skip.split('|') : []);
    const direct: Row[] = chat.directChats
      .map((d) => ({ kind: 'direct' as const, id: d.id, other: otherInRoom(d.id, me), latestAt: chat.latestFor(d.id)?.sentAt }))
      .filter((r) => r.latestAt && !social.blocked.has(r.other));
    const group: Row[] = crews.filter((c) => !skipped.has(c.id)).map((c) => ({ kind: 'crew' as const, id: c.id, crew: c, latestAt: chat.latestFor(c.id)?.sentAt }));
    return [...direct, ...group].sort((a, b) => (b.latestAt ?? '').localeCompare(a.latestAt ?? ''));
  }, [me, chat, crews, skip, social.blocked]);

  // Faces and names: the other person in a 1-to-1, whoever wrote last in a crew.
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const key = [...new Set(rows.flatMap((r) => (r.kind === 'direct' ? [r.other] : [chat.latestFor(r.id)?.uid ?? '']).filter(Boolean)))].join('|');
  useFocusEffect(
    useCallback(() => {
      let live = true;
      for (const uid of key ? key.split('|') : [])
        social.service
          .profileOf(uid)
          .then((p) => live && setProfiles((got) => ({ ...got, [uid]: p })))
          .catch(() => {});
      return () => {
        live = false;
      };
    }, [key, social.service]),
  );
  if (!rows.length) return null;
  const nameOf = (uid: string) => {
    const p = profiles[uid];
    return p ? firstName(p.displayName) : 'Someone';
  };
  const shown = all ? rows : rows.slice(0, SHOWN);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">
        Chats
      </Text>
      {shown.map((r) => {
        const unread = chat.unreadFor(r.id);
        const latest = chat.latestFor(r.id);
        const p = r.kind === 'direct' ? profiles[r.other] : undefined;
        const name = r.kind === 'direct' ? (p?.displayName ?? ' ') : r.crew.name;
        const fest = r.kind === 'crew' ? festival(r.crew.festivalId)?.name : undefined;
        const preview =
          (r.kind === 'direct' ? chatPreview(latest, me, () => (p ? firstName(p.displayName) : 'Someone')) : chatPreview(latest, me, nameOf)) ??
          'Say hi to your crew. Only people in it can see the chat.';
        return (
          <Pressable
            key={r.id}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/crew-chat/[id]', params: { id: r.id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${r.kind === 'crew' ? `${name} crew chat` : (p?.displayName ?? 'Someone')}${unread ? `, ${unreadLine(unread)}` : ''}. ${preview}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            {r.kind === 'direct' ? <PersonAvatar name={p?.displayName} url={p?.avatarUrl} size={44} /> : <CrewBadge name={r.crew.name} />}
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
                {fest ? <Text style={styles.fest}>{`  ${fest}`}</Text> : null}
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
      {rows.length > SHOWN ? (
        <Pressable
          onPress={() => {
            haptic.select();
            setAll((a) => !a);
          }}
          accessibilityRole="button"
          accessibilityLabel={all ? 'Show fewer chats' : `Show all ${rows.length} chats`}
          hitSlop={8}
        >
          <Text style={styles.more}>{all ? 'Show fewer' : `Show all ${rows.length} chats`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A crew's chat: its first letter in the night glow. */
function CrewBadge({ name }: { name: string }) {
  return (
    <LinearGradient colors={[color.glowDeep, color.haze]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.crew}>
      <Text style={styles.crewLetter}>{name.trim().charAt(0).toUpperCase() || '·'}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  title: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  text: { flex: 1 },
  name: { ...type.headline, color: color.moon },
  fest: { ...type.caption, color: color.moonFaint },
  preview: { ...type.caption, color: color.moonDim, marginTop: 2 },
  unread: { color: color.moon },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: color.glow, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...type.caption, color: color.night, fontWeight: '700' },
  crew: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  crewLetter: { ...type.headline, color: color.moon },
  more: { ...type.label, color: color.glow, paddingVertical: space.xs },
  pressed: { opacity: 0.7 },
});
