import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { PageTitle } from '../components/PageTitle';
import { PersonAvatar } from '../components/PersonAvatar';
import { CloseIcon } from '../components/TabIcons';
import { APP_NAME, WEB_URL } from '../config/app';
import { clipShareText } from '../features/discover/share';
import { directRoomWith } from '../features/friends/openChat';
import { ShareCard } from '../features/messages/ShareCard';
import { orderRecipients, type Recipient } from '../features/messages/recipients';
import { shareFromParams, shareLink, shareMessageText, type ChatShare, type ShareParams } from '../features/messages/shares';
import { artistShareText, festivalShareText } from '../features/share/pages';
import { directRoom, type Profile } from '../features/social/models';
import type { Catalog } from '../data/catalog';
import { haptic } from '../lib/haptics';
import { goBack } from '../lib/nav';
import { shareMessage } from '../lib/share';
import { useCatalog } from '../state/catalog';
import { useCloseFriends } from '../state/closeFriends';
import { useCrewChat } from '../state/crewChat';
import { useCrews } from '../state/crews';
import { bumpQuestEvent } from '../state/dailyQuests';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';
import { t } from '../i18n';

const NOTE_MAX = 200;
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * "Send to": something from the app (a festival, your must-sees, an artist,
 * a live set, a profile) sent into a 1-to-1 chat or a crew chat, as a card,
 * with a line of your own if you like. Your recent chats first, then close
 * friends, then other friends. Other apps are one tap away. A modal.
 */
export default function SendScreen() {
  const params = useLocalSearchParams<ShareParams>();
  const share = shareFromParams(params);
  const catalog = useCatalog();
  const social = useSocial();
  const me = social.user?.uid;
  const chat = useCrewChat();
  const { crews } = useCrews();
  const closeFriends = useCloseFriends(me);
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState<string | undefined>();

  // Friends are people you follow who follow you back.
  const [followers, setFollowers] = useState<{ uid: string; ids: string[] } | undefined>();
  useEffect(() => {
    if (!me) return;
    let live = true;
    social.service
      .followers(me, 500)
      .then((ids) => live && setFollowers({ uid: me, ids }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [me, social.service]);
  const friends = useMemo(() => (followers && followers.uid === me ? followers.ids.filter((id) => social.following.has(id)) : []), [followers, me, social.following]);

  const recipients = useMemo(
    () =>
      me
        ? orderRecipients({
            me,
            directChats: chat.directChats.map((d) => ({ id: d.id, latestAt: chat.latestFor(d.id)?.sentAt })),
            crews: crews.map((c) => ({ id: c.id, latestAt: chat.latestFor(c.id)?.sentAt })),
            closeFriends: closeFriends.ids.filter((id) => social.following.has(id)),
            friends,
            friendsKnown: !!followers && followers.uid === me,
            blocked: social.blocked,
          })
        : [],
    [me, chat, crews, closeFriends.ids, friends, followers, social.following, social.blocked],
  );

  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const people = recipients.flatMap((r) => (r.kind === 'person' ? [r.uid] : [])).join('|');
  useEffect(() => {
    let live = true;
    for (const uid of people ? people.split('|') : [])
      social.service
        .profileOf(uid)
        .then((p) => live && setProfiles((all) => ({ ...all, [uid]: p })))
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [people, social.service]);

  const closeSet = new Set(closeFriends.ids);
  const describe = (r: Recipient) => {
    if (r.kind === 'crew') {
      const c = crews.find((x) => x.id === r.crewId);
      return { name: c?.name ?? t('Your crew'), sub: catalog.festival(c?.festivalId ?? '')?.name ?? t('Crew'), avatar: <PersonAvatar name={c?.name} size={40} /> };
    }
    const p = profiles[r.uid];
    return {
      name: p?.displayName ?? ' ',
      sub: closeSet.has(r.uid) ? t('Close friend') : p ? `@${p.handle}` : ' ',
      avatar: <PersonAvatar name={p?.displayName} url={p?.avatarUrl} size={40} uid={r.uid} />,
      gone: p === null,
    };
  };

  const send = async (r: Recipient, name: string) => {
    if (!share || !me || sent[r.key] || busy) return;
    haptic.select();
    setBusy(r.key);
    const existing = r.kind === 'person' ? chat.directChats.find((d) => d.id === directRoom(me, r.uid))?.id : r.crewId;
    const room = existing ?? (r.kind === 'person' ? await directRoomWith(chat.openDirect, r.uid, firstName(name)) : undefined);
    setBusy(undefined);
    if (!room) return;
    if (chat.send(room, shareMessageText(share, note, WEB_URL))) {
      haptic.settle();
      bumpQuestEvent('share');
      setSent((s) => ({ ...s, [r.key]: true }));
    }
  };

  return (
    <View style={styles.root}>
      <PageTitle title={t('Send')} />
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>{t('Send to')}</Text>
        <GlassCircleButton label={Object.keys(sent).length ? t('Done') : t('Close')} onPress={() => goBack()}>
          <CloseIcon color={color.moon} />
        </GlassCircleButton>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        {!share ? (
          <Text style={styles.body}>{t('This can’t be sent.')}</Text>
        ) : (
          <>
            <View style={styles.preview}>
              <ShareCard share={share} />
            </View>
            {me && social.profile ? (
              <>
                <TextInput
                  value={note}
                  onChangeText={(text) => setNote(text.slice(0, NOTE_MAX))}
                  placeholder={t('Add a message')}
                  placeholderTextColor={color.moonFaint}
                  accessibilityLabel={t('Add a message')}
                  style={styles.input}
                  multiline
                  maxLength={NOTE_MAX}
                />
                {recipients.length ? (
                  <View style={styles.list}>
                    {recipients.map((r) => {
                      const d = describe(r);
                      if ('gone' in d && d.gone) return null;
                      const done = !!sent[r.key];
                      return (
                        <View key={r.key} style={styles.row}>
                          {d.avatar}
                          <View style={styles.words}>
                            <Text style={styles.name} numberOfLines={1}>
                              {d.name}
                            </Text>
                            <Text style={styles.sub} numberOfLines={1}>
                              {d.sub}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => void send(r, d.name)}
                            disabled={done || busy === r.key}
                            accessibilityRole="button"
                            accessibilityLabel={done ? t('Sent to {name}', { name: d.name }) : t('Send to {name}', { name: d.name })}
                            accessibilityState={{ disabled: done || busy === r.key }}
                            style={({ pressed }) => [styles.send, done && styles.sent, pressed && styles.pressed]}
                          >
                            <Text style={[styles.sendText, done && styles.sentText]}>{done ? t('Sent') : t('Send')}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.body}>{t('When you and a friend follow each other, or you’re in a crew, you can send things straight to their chat.')}</Text>
                )}
              </>
            ) : (
              <Text style={styles.body}>{t('Make a profile to send things to your friends’ chats.')}</Text>
            )}
            <Pressable
              onPress={() => {
                haptic.select();
                void shareMessage(...systemShare(share, catalog));
              }}
              accessibilityRole="button"
              accessibilityLabel={t('More ways to share')}
              style={({ pressed }) => [styles.more, pressed && styles.pressed]}
            >
              <Text style={styles.moreText}>{t('More ways to share')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** The same thing for other apps: the words each page already shares, with the link. */
function systemShare(share: ChatShare, catalog: Catalog): [string, string?] {
  const link = shareLink(share, WEB_URL);
  switch (share.kind) {
    case 'festival': {
      const f = catalog.festival(share.id);
      return f ? [festivalShareText(f, WEB_URL), f.name] : [link];
    }
    case 'artist': {
      const a = catalog.artist(share.id);
      return a ? [artistShareText(a, catalog.festivalsOf(a.id), WEB_URL), a.name] : [link];
    }
    case 'clip': {
      const c = catalog.clip(share.id);
      const a = c && catalog.artist(c.artistId);
      return c && a ? [clipShareText(a.name, c.title, link, catalog.festival(c.festivalId), APP_NAME)] : [link];
    }
    case 'profile':
      return [t('@{handle} on {app}: {link}', { handle: share.handle, app: APP_NAME, link })];
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.md },
  heading: { ...type.title, color: color.moon },
  content: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.lg },
  preview: { alignItems: 'center' },
  body: { ...type.body, color: color.moonDim },
  input: {
    minHeight: 44,
    maxHeight: 110,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
    color: color.moon,
    ...type.body,
  },
  list: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  words: { flex: 1 },
  name: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonFaint, marginTop: 1 },
  send: { minWidth: 72, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glowDeep, alignItems: 'center' },
  sent: { backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  sendText: { ...type.label, color: color.moon },
  sentText: { color: color.moonDim },
  more: {
    minHeight: 50,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  moreText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
