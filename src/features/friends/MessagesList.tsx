import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { haptic } from '../../lib/haptics';
import { useCrewChat } from '../../state/crewChat';
import { useCrews } from '../../state/crews';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useNow } from '../../lib/useNow';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { chatPreview, unreadLine } from '../crews/chat';
import { otherInRoom, type Crew, type Profile } from '../social/models';
import { CrewOrb } from './CrewOrb';
import { chatTime } from './orbit';
import { SectionHeader } from './SectionHeader';
import { t } from '../../i18n';
import { useEventLookup } from '../festivalMode/useEvent';

/** Chats shown before "Show all". */
const SHOWN = 5;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

type Row = { id: string; latestAt?: string } & ({ kind: 'direct'; other: string } | { kind: 'crew'; crew: Crew });

/**
 * All your chats on the Friends tab, in one place: 1-to-1 chats and your
 * crews' chats, the latest first, each with its last message and how many
 * are new, the way a messages app lists them: one glass card, a crew's
 * picture made of its people's faces, the time on the right. Crews you
 * haven't chatted in yet come after. Nobody you've blocked. `skipCrews`: crews already shown as cards (festival mode);
 * `directOnly`: only 1-to-1 chats, titled Messages (the Friends tab, where each crew's card opens its chat).
 */
export function MessagesList({ skipCrews = [], directOnly = false }: { skipCrews?: readonly string[]; directOnly?: boolean }) {
  const social = useSocial();
  const me = social.user?.uid;
  const chat = useCrewChat();
  const { crews } = useCrews();
  const festival = useEventLookup();
  const [all, setAll] = useState(false);
  const { profileOf: crewProfileOf } = useCrewUpdates();
  const now = useNow();
  const skip = skipCrews.join('|');
  const rows = useMemo((): Row[] => {
    if (!me) return [];
    const skipped = new Set(skip ? skip.split('|') : []);
    const direct: Row[] = chat.directChats
      .map((d) => ({ kind: 'direct' as const, id: d.id, other: otherInRoom(d.id, me), latestAt: chat.latestFor(d.id)?.sentAt }))
      .filter((r) => r.latestAt && !social.blocked.has(r.other));
    const group: Row[] = (directOnly ? [] : crews).filter((c) => !skipped.has(c.id)).map((c) => ({ kind: 'crew' as const, id: c.id, crew: c, latestAt: chat.latestFor(c.id)?.sentAt }));
    return [...direct, ...group].sort((a, b) => (b.latestAt ?? '').localeCompare(a.latestAt ?? ''));
  }, [me, chat, crews, skip, social.blocked, directOnly]);

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
    return p ? firstName(p.displayName) : t('Someone');
  };
  const shown = all ? rows : rows.slice(0, SHOWN);
  const nowMs = now.getTime();

  return (
    <View>
      <SectionHeader
        title={directOnly ? t('Messages') : t('Chats')}
        action={rows.length > SHOWN ? (all ? t('Show fewer') : t('Show all')) : undefined}
        actionLabel={
          all
            ? directOnly
              ? t('Show fewer messages')
              : t('Show fewer chats')
            : directOnly
              ? t('Show all {n} messages', { n: rows.length })
              : t('Show all {n} chats', { n: rows.length })
        }
        onAction={() => setAll((a) => !a)}
      />
      <View style={styles.list}>
        {shown.map((r, i) => {
          const unread = chat.unreadFor(r.id);
          const latest = chat.latestFor(r.id);
          const p = r.kind === 'direct' ? profiles[r.other] : undefined;
          // Someone whose account is gone: their chat goes too.
          if (r.kind === 'direct' && p === null) return null;
          const name = r.kind === 'direct' ? (p?.displayName ?? ' ') : r.crew.name;
          const fest = r.kind === 'crew' ? festival(r.crew.festivalId)?.name : undefined;
          const preview =
            (r.kind === 'direct' ? chatPreview(latest, me, () => (p ? firstName(p.displayName) : t('Someone'))) : chatPreview(latest, me, nameOf)) ??
            t('Say hi to your crew. Only people in it can see the chat.');
          const at = latest?.sentAt ? Date.parse(latest.sentAt) : NaN;
          const when = Number.isFinite(at) ? chatTime(at, nowMs) : undefined;
          const faces =
            r.kind === 'crew'
              ? r.crew.members
                  .filter((m) => m !== me)
                  .map((m) => crewProfileOf(m))
                  .filter((x): x is Profile => !!x)
                  .map((x) => ({ name: x.displayName, url: x.avatarUrl }))
              : [];
          return (
            <Pressable
              key={r.id}
              onPress={() => {
                haptic.select();
                router.push({ pathname: '/crew-chat/[id]', params: { id: r.id } });
              }}
              accessibilityRole="button"
              accessibilityLabel={`${r.kind === 'crew' ? t('{name} crew chat', { name }) : (p?.displayName ?? t('Someone'))}${unread ? `, ${unreadLine(unread)}` : ''}. ${preview}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              {i > 0 ? <View style={styles.divider} /> : null}
              {r.kind === 'direct' ? (
                <View style={[styles.personRing, unread ? styles.personRingNew : null]}>
                  <PersonAvatar name={p?.displayName} url={p?.avatarUrl} size={AVATAR - 6} uid={p?.uid} />
                </View>
              ) : (
                <CrewOrb name={r.crew.name} people={faces} total={Math.max(0, r.crew.members.length - 1)} size={AVATAR} />
              )}
              <View style={styles.text}>
                <View style={styles.top}>
                  <Text style={[styles.name, unread ? styles.nameNew : null]} numberOfLines={1}>
                    {name}
                  </Text>
                  {when ? <Text style={[styles.when, unread ? styles.whenNew : null]}>{when}</Text> : null}
                </View>
                {fest ? (
                  <Text style={styles.fest} numberOfLines={1}>
                    {fest}
                  </Text>
                ) : null}
                <View style={styles.bottom}>
                  <Text style={[styles.preview, unread ? styles.unread : null]} numberOfLines={1}>
                    {preview}
                  </Text>
                  {unread ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const AVATAR = 52;

const styles = StyleSheet.create({
  list: { borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md },
  divider: { position: 'absolute', top: 0, right: 0, left: AVATAR + space.md * 2, height: StyleSheet.hairlineWidth, backgroundColor: color.hairline },
  text: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { ...type.headline, color: color.moon, flex: 1 },
  nameNew: { fontWeight: '700' },
  when: { ...type.caption, color: color.moonFaint, fontVariant: ['tabular-nums'] },
  whenNew: { color: color.glow },
  fest: { ...type.caption, color: color.glow, opacity: 0.85 },
  preview: { ...type.body, color: color.moonDim, flex: 1 },
  unread: { color: color.moon },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: color.glow, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...type.caption, color: color.night, fontWeight: '700' },
  personRing: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(243,240,255,0.16)' },
  personRingNew: { borderColor: color.glow },
  pressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
});
