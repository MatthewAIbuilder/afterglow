import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FilterChips } from '../../components/FilterChips';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { repliesOf, type SupportMessage } from '../social/models';
import { agoShort, inFilter, mailtoLink, type SupportFilter, topicLabel } from './admin';

/**
 * Support messages, newest first: who sent it, what about, when, from which
 * phone and version, and the words. Reply right here (they see it in the
 * app under Contact support), email them back, or close it. Open ones
 * first by default.
 */
export function AdminSupport({ onCount }: { onCount?: (open: number) => void }) {
  const { service } = useSocial();
  const [list, setList] = useState<SupportMessage[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<SupportFilter>('open');
  const load = useCallback(async () => {
    try {
      const all = await service.supportInbox(300);
      setList(all);
      setFailed(false);
      onCount?.(all.filter((m) => m.status === 'open').length);
    } catch {
      setFailed(true);
    }
  }, [service, onCount]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  if (!list) return failed ? <Text style={styles.empty}>Couldn’t load support messages. Check the signal and try again.</Text> : <ActivityIndicator color={color.glow} style={{ marginTop: space.xxl }} />;
  const shown = list.filter((m) => inFilter(m, filter));
  const count = (f: SupportFilter) => list.filter((m) => inFilter(m, f)).length;
  return (
    <View style={styles.wrap}>
      <FilterChips
        inset={space.lg}
        chips={(['open', 'answered', 'closed', 'all'] as const).map((f) => ({
          key: f,
          label: f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1),
          count: count(f),
          accessibilityLabel: `${f === 'all' ? 'All' : f} messages, ${count(f)}`,
        }))}
        value={filter}
        onChange={(k) => setFilter((k as SupportFilter | undefined) ?? 'open')}
      />
      {shown.length ? (
        shown.map((m) => <SupportCard key={m.id} message={m} onChanged={load} />)
      ) : (
        <Text style={styles.empty}>{filter === 'open' ? 'All caught up. No messages waiting.' : 'Nothing here.'}</Text>
      )}
    </View>
  );
}

function SupportCard({ message: m, onChanged }: { message: SupportMessage; onChanged: () => void }) {
  const { service } = useSocial();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const now = useNow().getTime();
  // Only for an address that looks like one, written safely into the link.
  const mail = m.email ? mailtoLink(m.email, 'Afterglow support') : undefined;
  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await service.answerSupport(m.id, reply);
      haptic.settle();
      setReply('');
      onChanged();
    } catch {
      showAlert('Couldn’t send the reply', 'Check the signal and try again.');
    } finally {
      setBusy(false);
    }
  };
  const setStatus = async (status: 'open' | 'closed') => {
    try {
      await service.setSupportStatus(m.id, status);
      haptic.select();
      onChanged();
    } catch {
      showAlert('Couldn’t update it', 'Check the signal and try again.');
    }
  };
  return (
    <View style={[styles.card, m.status === 'open' && styles.cardOpen]}>
      <View style={styles.head}>
        <Text style={styles.who} numberOfLines={1}>
          {m.name ?? 'Someone'}
          {m.handle ? <Text style={styles.handle}> @{m.handle}</Text> : null}
        </Text>
        <Text style={styles.when}>{agoShort(m.createdAt, now)}</Text>
      </View>
      <View style={styles.tags}>
        <Text style={styles.tag}>{topicLabel(m.topic)}</Text>
        <Text style={[styles.tag, m.status === 'open' ? styles.tagOpen : m.status === 'answered' ? styles.tagDone : undefined]}>{m.status === 'open' ? 'Waiting' : m.status === 'answered' ? 'Answered' : 'Closed'}</Text>
        {m.platform ? <Text style={styles.meta}>{[m.platform, m.version].filter(Boolean).join(' · ')}</Text> : null}
      </View>
      <Text style={styles.text}>{m.text}</Text>
      {repliesOf(m).map((r, i) => (
        <View key={i} style={styles.replied}>
          <Text style={styles.repliedLabel}>You replied{r.at ? ` ${agoShort(r.at, now)}` : ''}</Text>
          <Text style={styles.repliedText}>{r.text}</Text>
        </View>
      ))}
      {m.status !== 'closed' ? (
        <View style={styles.replyRow}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder={m.reply ? 'Write again…' : 'Write a reply…'}
            placeholderTextColor={color.moonFaint}
            multiline
            maxLength={2000}
            style={styles.input}
            accessibilityLabel={`Reply to ${m.name ?? 'this message'}`}
          />
          <Pressable onPress={() => void send()} disabled={busy || !reply.trim()} accessibilityRole="button" accessibilityLabel="Send the reply" style={({ pressed }) => [styles.send, (!reply.trim() || busy) && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}>
            <Text style={styles.sendText}>{busy ? '…' : 'Send'}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.actions}>
        {mail ? (
          <Pressable onPress={() => void Linking.openURL(mail).catch(() => {})} accessibilityRole="button" accessibilityLabel={`Email ${m.email}`} hitSlop={6}>
            <Text style={styles.link}>Email {m.email}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={() => void setStatus(m.status === 'closed' ? 'open' : 'closed')} accessibilityRole="button" hitSlop={6}>
          <Text style={styles.linkDim}>{m.status === 'closed' ? 'Open again' : 'Close'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  empty: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.xl, paddingHorizontal: space.xl },
  card: { marginHorizontal: space.lg, padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  cardOpen: { borderColor: 'rgba(255,184,107,0.5)', borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  who: { ...type.headline, color: color.moon, flex: 1 },
  handle: { ...type.label, color: color.moonDim, fontWeight: '400' },
  when: { ...type.caption, color: color.moonFaint },
  tags: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  tag: { ...type.caption, color: color.moonDim, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  tagOpen: { color: '#FFB86B', backgroundColor: 'rgba(255,184,107,0.14)' },
  tagDone: { color: '#5BE3B5', backgroundColor: 'rgba(91,227,181,0.12)' },
  meta: { ...type.caption, color: color.moonFaint },
  text: { ...type.body, color: color.moon },
  replied: { padding: space.md, gap: 2, borderRadius: radius.md, backgroundColor: 'rgba(169,124,255,0.12)' },
  repliedLabel: { ...type.caption, color: color.glow },
  repliedText: { ...type.body, color: color.moon },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: { ...type.body, color: color.moon, flex: 1, minHeight: 44, maxHeight: 140, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.06)' },
  send: { minHeight: 44, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  sendText: { ...type.label, color: color.night },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { ...type.caption, color: color.glow },
  linkDim: { ...type.label, color: color.moonDim },
});
