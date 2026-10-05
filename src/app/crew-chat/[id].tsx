import { useNetworkState } from 'expo-network';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { PersonAvatar } from '../../components/PersonAvatar';
import { ChevronIcon, MoreIcon } from '../../components/TabIcons';
import { CHAT_RULES, DM_RULES, QUICK_MESSAGES, arrivedLate, arrivedLateLine, chatRows, deliveryLine, justArrivedLate, lateNote, seenBy, seenLine, waitingLine, type ChatLine } from '../../features/crews/chat';
import { firstName } from '../../features/crews/together';
import { clock } from '../../features/crews/updates';
import { useCrewPage } from '../../features/crews/useCrewPage';
import { askBlock, askReport } from '../../features/social/moderation';
import { CHAT_MAX, isDirectRoom, otherInRoom, type Profile } from '../../features/social/models';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../../features/social/service';
import { showActionSheet, showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useCrewChat } from '../../state/crewChat';
import { searchSecret } from '../../features/secrets/secrets';
import { revealSecret } from '../../state/secrets';
import { useSocial } from '../../state/social';
import { color, radius, space, type, glowA, nightA } from '../../theme/tokens';
import { goBack } from '../../lib/nav';
import { WEB_URL } from '../../config/app';
import { ShareCard } from '../../features/messages/ShareCard';
import { LastUpdated } from '../../features/offline/LastUpdated';
import { CrewOrb } from '../../features/friends/CrewOrb';
import { useCrewUpdates } from '../../state/crewUpdates';
import { isOffline } from '../../features/offline/status';
import { parseShare, shareNoun } from '../../features/messages/shares';

const AMBER = '#FFB86B';

/**
 * A crew's chat: everyone in the crew, nobody else (crews are invite only,
 * and joining means agreeing to the chat rules, shown at the top). Messages
 * show in the order they were written; yours wait for signal and say so. Hold
 * a message to delete it (yours, or anyone's in a crew you started), or to
 * report or block whoever wrote it.
 *
 * A 1-to-1 chat with a friend (`dm_…` ids) is the same screen: the two of
 * you, their name up top (to their profile), and its own short rules.
 */
export default function CrewChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const me = social.user?.uid;
  const { profileOf: crewProfileOf } = useCrewUpdates();
  const chat = useCrewChat();
  const offline = isOffline(useNetworkState());
  const { page } = useCrewPage(id);
  const catalog = useCatalog();
  const now = useNow().getTime();
  const [text, setText] = useState('');
  const scroller = useRef<ScrollView>(null);

  // A 1-to-1 chat: the two of you; their profile is read for the name and photo.
  const direct = isDirectRoom(id);
  const other = direct && me ? otherInRoom(id, me) : undefined;
  const [otherProfile, setOtherProfile] = useState<Profile | null | undefined>();
  useEffect(() => {
    if (!other) return;
    let live = true;
    social.service
      .profileOf(other)
      .then((p) => live && setOtherProfile(p))
      .catch(() => live && setOtherProfile(null));
    return () => {
      live = false;
    };
  }, [other, social.service]);
  const crew = !direct && page.status === 'ready' ? page.crew : undefined;
  const member = direct ? !!me && id.includes(me) : page.status === 'ready' && page.member;
  const members = direct ? (other && me ? [me, other] : []) : (crew?.members ?? []);
  const profiles = useMemo<Record<string, Profile>>(
    () => (direct ? (other && otherProfile ? { [other]: otherProfile } : {}) : page.status === 'ready' ? page.profiles : {}),
    [direct, other, otherProfile, page],
  );
  const otherName = other && otherProfile ? firstName(otherProfile.displayName) : 'your friend';
  const festival = crew ? catalog.festival(crew.festivalId) : undefined;
  const lines = chat.linesFor(id);
  const rows = useMemo(() => chatRows(lines, me, now), [lines, me, now]);
  // "Seen by" goes under your latest message that reached the crew.
  const lastMine = [...lines].reverse().find((l) => l.uid === me && l.status === 'sent');
  const readsHere = chat.readsFor(id);
  const nameOf = (uid: string) => (uid === me ? 'You' : profiles[uid] ? firstName(profiles[uid].displayName) : 'Someone');

  // Reading the chat: now, and whenever something new arrives while it's open.
  const unread = chat.unreadFor(id);
  const { markRead, setOpenChat } = chat;
  useFocusEffect(
    useCallback(() => {
      markRead(id);
      setOpenChat(id);
      return () => setOpenChat(undefined);
    }, [markRead, setOpenChat, id]),
  );
  // Delays, said plainly: yours waiting, yours that got through late, and theirs that just got through late.
  const waiting = waitingLine(chat.waitingFor(id).filter((o) => lines.some((l) => l.id === o.id && l.status === 'waiting')));
  const delivery = chat.deliveryFor(id);
  const lateIn = useMemo(
    () => justArrivedLate(lines.filter((l) => l.status === 'sent'), me, [...social.blocked], now),
    [lines, me, social.blocked, now],
  );
  useEffect(() => {
    if (unread) markRead(id);
  }, [unread, markRead, id]);

  const send = (words: string) => {
    if (!chat.send(id, words)) return;
    haptic.tap();
    setText('');
    // A little secret: PLUR sets off the heart rain here too.
    const secret = searchSecret(words);
    if (secret) revealSecret(secret);
  };

  const more = (line: ChatLine) => {
    const mine = line.uid === me;
    const owner = crew?.owner === me;
    const handle = profiles[line.uid]?.handle;
    if (line.status === 'failed') {
      showActionSheet({ title: 'Not sent', options: ['Try again', 'Delete', 'Cancel'], cancelButtonIndex: 2, destructiveButtonIndex: 1 }, (i) => {
        if (i === 0) chat.retry(line.id);
        if (i === 1) void chat.remove(id, line);
      });
      return;
    }
    const options = [...(mine || owner ? ['Delete message'] : []), ...(mine ? [] : ['Report message', ...(handle ? [`Block @${handle}`] : [])])];
    if (!options.length) return;
    showActionSheet({ title: mine ? 'Your message' : nameOf(line.uid), options: [...options, 'Cancel'], cancelButtonIndex: options.length, destructiveButtonIndex: 0 }, (i) => {
      const choice = options[i];
      if (!choice) return;
      if (choice === 'Delete message')
        chat
          .remove(id, line)
          .then(() => haptic.select())
          .catch((e) => showAlert('Couldn’t delete it', SOCIAL_ERROR_COPY[socialErrorKind(e)]));
      else if (choice === 'Report message') askReport({ kind: 'chat', id: `${id}/${line.id}`, ownerUid: line.uid }, social.report);
      else if (handle) askBlock(handle, false, (on) => social.setBlocked(line.uid, on));
    });
  };

  const body = (() => {
    if (!social.user) return <Text style={styles.quiet}>{direct ? 'Sign in to see your messages.' : 'Sign in to see your crew’s chat.'}</Text>;
    if (direct && !member) return <Text style={styles.quiet}>Only the two people in this chat can read it.</Text>;
    if (direct) return renderChat();
    if (page.status === 'loading') return <ActivityIndicator color={color.glow} style={{ marginTop: space.xxl }} />;
    if (page.status === 'missing') return <Text style={styles.quiet}>This crew has ended.</Text>;
    if (page.status === 'failed') return <Text style={styles.quiet}>{SOCIAL_ERROR_COPY.network}</Text>;
    if (!member)
      return (
        <View style={{ gap: space.md }}>
          <Text style={styles.quiet}>Only people in this crew can read its chat.</Text>
          <Pressable onPress={() => router.replace({ pathname: '/crew/[id]', params: { id } })} accessibilityRole="button" style={styles.chip}>
            <Text style={styles.chipText}>See the crew</Text>
          </Pressable>
        </View>
      );
    return renderChat();
  })();

  function renderChat() {
    const rules = direct ? DM_RULES : CHAT_RULES;
    return (
      <>
        <View style={styles.rules} accessible accessibilityLabel={`${direct ? 'Chat' : 'Crew chat'} rules. ${rules.join(' ')}`}>
          <Text style={styles.rulesTitle}>{direct ? `Only you and ${otherName} can see this chat` : 'Only people in this crew can see this chat'}</Text>
          {rules.map((r) => (
            <Text key={r} style={styles.rule}>
              · {r}
            </Text>
          ))}
          <Pressable onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'guidelines' } })} accessibilityRole="link" hitSlop={8}>
            <Text style={styles.rulesLink}>Community guidelines</Text>
          </Pressable>
        </View>
        {/* No signal: the chat as this phone last read it, said plainly (yours still send by themselves). */}
        {offline ? <LastUpdated at={chat.readFor(id).at} live={false} /> : null}
        {!chat.loaded(id) && !lines.length ? <ActivityIndicator color={color.glow} /> : null}
        {chat.loaded(id) && !lines.length && !offline ? <Text style={[styles.quiet, styles.center]}>{direct ? `No messages yet. Say hi to ${otherName}.` : 'No messages yet. Say hi to your crew.'}</Text> : null}
        {rows.map((row) => {
          if (row.kind === 'day')
            return (
              <Text key={row.key} style={styles.day} accessibilityRole="header">
                {row.label}
              </Text>
            );
          const { line, mine, first, last } = row;
          const p = profiles[line.uid];
          const late = line.status === 'sent' && arrivedLate(line);
          const state = line.status === 'waiting' ? 'Waiting for signal' : line.status === 'failed' ? 'Not sent. Tap to try again' : undefined;
          // Something sent from the app shows as a card, with any words above it.
          const shared = parseShare(line.text, WEB_URL);
          const said = shared ? [shared.caption, `Sent ${shareNoun(shared.share)}`].filter(Boolean).join('. ') : line.text;
          return (
            <View key={row.key} style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, first && styles.runStart]}>
              {!mine ? <View style={styles.avatarSlot}>{last ? <PersonAvatar name={p?.displayName} url={p?.avatarUrl} size={28} /> : null}</View> : null}
              <View style={[styles.bubbleCol, mine && { alignItems: 'flex-end' }]}>
                {first && !mine ? <Text style={styles.name}>{nameOf(line.uid)}</Text> : null}
                <Pressable
                  onPress={line.status === 'failed' ? () => more(line) : undefined}
                  onLongPress={() => more(line)}
                  delayLongPress={350}
                  accessibilityRole="text"
                  accessibilityLabel={`${mine ? 'You' : nameOf(line.uid)}, ${clock(line.at)}: ${said}${state ? `. ${state}` : ''}${late ? `. Reached the crew ${clock(line.sentAt)}` : ''}`}
                  accessibilityActions={[{ name: 'more', label: mine ? 'Delete' : crew?.owner === me ? 'Delete, report or block' : 'Report or block' }]}
                  onAccessibilityAction={() => more(line)}
                  style={[styles.bubble, mine ? styles.mine : styles.theirs, shared && styles.sharedBubble, line.status !== 'sent' && styles.waiting, line.status === 'failed' && styles.failed]}
                >
                  {shared ? (
                    <>
                      {shared.caption ? <Text style={[styles.text, styles.caption]}>{shared.caption}</Text> : null}
                      <ShareCard share={shared.share} />
                    </>
                  ) : (
                    <Text style={styles.text}>{line.text}</Text>
                  )}
                </Pressable>
                {mine && lastMine?.id === line.id && members.length ? (
                  <Text style={styles.meta} accessibilityLiveRegion="polite">
                    {clock(line.at)} · {direct ? (seenBy(line, readsHere, members, me).length ? 'Seen' : 'Delivered') : seenLine(seenBy(line, readsHere, members, me), members.length - 1, nameOf)}
                  </Text>
                ) : late ? (
                  <Text style={[styles.meta, { color: AMBER }]} accessibilityLabel={`Held up by signal. ${lateNote(line)}`}>
                    {lateNote(line)}
                  </Text>
                ) : last || state ? (
                  <Text style={[styles.meta, state ? { color: AMBER } : null]}>
                    {clock(line.at)}
                    {state ? ` · ${state}` : ''}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </>
    );
  }

  return (
    <View style={styles.root}>
      <PageTitle title={direct ? 'Messages' : 'Crew chat'} />
      <NightSky />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.head, { paddingTop: insets.top + space.sm }]}>
          <GlassCircleButton label="Back" onPress={() => (router.canGoBack() ? goBack() : crew ? router.replace({ pathname: '/crew/[id]', params: { id } }) : router.replace('/'))}>
            <ChevronIcon color={color.moon} direction="left" size={18} />
          </GlassCircleButton>
          {direct ? (
            <Pressable
              style={styles.dmHead}
              onPress={() => otherProfile && router.push({ pathname: '/u/[handle]', params: { handle: otherProfile.handle } })}
              accessibilityRole="button"
              accessibilityLabel={otherProfile ? `${otherProfile.displayName}. Open their profile.` : 'Messages'}
            >
              <PersonAvatar name={otherProfile?.displayName} url={otherProfile?.avatarUrl} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {otherProfile?.displayName ?? 'Messages'}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {otherProfile ? `@${otherProfile.handle} · just the two of you` : ' '}
                </Text>
              </View>
            </Pressable>
          ) : (
          <Pressable
            style={styles.dmHead}
            onPress={() => crew && router.push({ pathname: '/crew/[id]', params: { id } })}
            accessibilityRole="button"
            accessibilityLabel={crew ? `${crew.name}. Open the crew.` : 'Crew chat'}
          >
            {crew ? (
              <CrewOrb
                name={crew.name}
                people={crew.members
                  .filter((m) => m !== me)
                  .map((m) => crewProfileOf(m))
                  .filter((x): x is Profile => !!x)
                  .map((x) => ({ name: x.displayName, url: x.avatarUrl }))}
                total={Math.max(0, crew.members.length - 1)}
                size={38}
              />
            ) : null}
            <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {crew?.name ?? 'Crew chat'}
            </Text>
            {crew ? (
              <Text style={styles.sub} numberOfLines={1}>
                {crew.members.length === 1 ? 'Just you so far' : `${crew.members.length} people`}
                {festival ? ` · ${festival.name}` : ''}
              </Text>
            ) : null}
            </View>
          </Pressable>
          )}
          {!direct && crew ? (
            <GlassCircleButton label="Crew settings" onPress={() => router.push({ pathname: '/crew/[id]', params: { id } })}>
              <MoreIcon color={color.moon} size={18} />
            </GlassCircleButton>
          ) : null}
        </View>
        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, gap: 2 }}
        >
          {body}
        </ScrollView>
        {member && (waiting || delivery || lateIn.length) ? (
          <View style={styles.notices}>
            {lateIn.map((m) => (
              <Text key={`late-${m.id}`} style={styles.noticeLate} accessibilityLiveRegion="polite">
                {arrivedLateLine(m, nameOf(m.uid))} It’s up the chat at {clock(m.at)}.
              </Text>
            ))}
            {delivery ? (
              <Pressable onPress={() => chat.dismissDelivery(id)} accessibilityRole="button" accessibilityHint="Dismisses this note" style={styles.noticeSent}>
                <Text style={styles.noticeSentText} accessibilityLiveRegion="polite">
                  {direct
                    ? `${deliveryLine(delivery.count, delivery.heldMs).replace('reached the crew', 'got through')} ${otherName} sees the time you wrote ${delivery.count === 1 ? 'it' : 'them'}.`
                    : `${deliveryLine(delivery.count, delivery.heldMs)} The crew sees the time you wrote ${delivery.count === 1 ? 'it' : 'them'}.`}
                </Text>
                <Text style={styles.noticeClose}>×</Text>
              </Pressable>
            ) : null}
            {waiting ? (
              <View style={styles.noticeWaiting} accessible accessibilityLiveRegion="polite" accessibilityLabel={waiting}>
                <Text style={styles.noticeWaitingText}>{waiting}</Text>
                <Pressable onPress={() => chat.sendNow()} accessibilityRole="button" accessibilityLabel="Try sending now" hitSlop={8}>
                  <Text style={styles.tryNow}>Try now</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
        {member ? (
          <View style={[styles.compose, { paddingBottom: insets.bottom + space.sm }]}>
            {!text ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.quickRow}>
                {QUICK_MESSAGES.map((q) => (
                  <Pressable key={q} onPress={() => send(q)} accessibilityRole="button" accessibilityLabel={`Send “${q}”`} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                    <Text style={styles.chipText}>{q}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.inputRow}>
              <TextInput
                value={text}
                onChangeText={(t) => setText(t.slice(0, CHAT_MAX))}
                placeholder={direct ? `Message ${otherName}` : 'Message your crew'}
                placeholderTextColor={color.moonFaint}
                style={styles.input}
                multiline
                accessibilityLabel={direct ? `Message ${otherName}` : 'Message your crew'}
              />
              <Pressable
                onPress={() => send(text)}
                disabled={!text.trim()}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                style={({ pressed }) => [styles.send, !text.trim() && styles.dim, pressed && styles.pressed]}
              >
                <Text style={styles.sendText}>Send</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  notices: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.xs },
  noticeLate: { ...type.caption, color: AMBER, lineHeight: 17 },
  noticeSent: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.sm, borderRadius: radius.sm, backgroundColor: glowA(0.14) },
  noticeSentText: { ...type.caption, color: color.moon, flex: 1, lineHeight: 17 },
  noticeClose: { ...type.label, color: color.moonDim },
  noticeWaiting: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.sm, backgroundColor: 'rgba(255,184,107,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,184,107,0.5)' },
  noticeWaitingText: { ...type.caption, color: AMBER, flex: 1, lineHeight: 17 },
  tryNow: { ...type.label, color: color.moon },
  root: { flex: 1, backgroundColor: color.night },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  title: { ...type.headline, color: color.moon },
  dmHead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sub: { ...type.caption, color: color.moonDim },
  quiet: { ...type.body, color: color.moonDim },
  center: { textAlign: 'center', marginTop: space.lg },
  rules: { padding: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, gap: 4, marginBottom: space.md },
  rulesTitle: { ...type.label, color: color.moon, marginBottom: 2 },
  rule: { ...type.caption, color: color.moonDim, lineHeight: 17 },
  rulesLink: { ...type.caption, color: color.glow, marginTop: 4 },
  day: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.lg, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  runStart: { marginTop: space.sm },
  avatarSlot: { width: 28 },
  bubbleCol: { maxWidth: '78%', gap: 2 },
  name: { ...type.caption, color: color.moonDim, marginLeft: space.sm },
  bubble: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 18 },
  mine: { backgroundColor: color.glowDeep },
  theirs: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  waiting: { opacity: 0.6 },
  failed: { borderWidth: 1, borderColor: AMBER, opacity: 0.8 },
  text: { ...type.body, color: color.moon },
  sharedBubble: { padding: space.xs },
  caption: { paddingHorizontal: space.sm, paddingTop: space.xs, paddingBottom: space.sm, maxWidth: 236 },
  meta: { ...type.caption, fontSize: 11, color: color.moonFaint, marginHorizontal: space.sm },
  compose: { paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, backgroundColor: nightA(0.92), gap: space.sm },
  quickRow: { gap: space.sm, paddingHorizontal: space.lg },
  chip: { alignSelf: 'flex-start', paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  chipText: { ...type.label, color: color.moon },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.lg },
  input: { flex: 1, ...type.body, color: color.moon, maxHeight: 120, minHeight: 40, paddingHorizontal: space.md, paddingTop: 10, paddingBottom: 10, borderRadius: 20, backgroundColor: color.glass },
  send: { paddingHorizontal: space.lg, height: 40, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glowDeep },
  sendText: { ...type.headline, color: color.moon },
  dim: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
