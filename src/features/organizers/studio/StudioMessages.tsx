import { useState } from 'react';
import { Text, View } from 'react-native';
import { showAlert } from '../../../lib/dialog';
import { haptic } from '../../../lib/haptics';
import { socialErrorKind, SOCIAL_ERROR_COPY } from '../../social/service';
import { type Org, REQUEST_LABEL, REQUEST_TEXT_MAX } from '../organizers';
import { STATUS_LABEL, useOrgRequests } from './StudioPromote';
import { Button, Card, Field, studio } from './ui';

/**
 * The studio's Messages tab: the organizer's conversation with Afterglow.
 * Everything it sent (messages, promotion, design and gift requests) with
 * Afterglow's replies, newest first, and a box to write to Afterglow. HQ
 * answers from its Organizers tab.
 */
export function StudioMessages({ org }: { org: Org }) {
  const { requests, sendRequest } = useOrgRequests(org.id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await sendRequest({ orgId: org.id, kind: 'other', text: text.trim() });
      haptic.settle();
      setText('');
    } catch (e) {
      showAlert('Couldn’t send that', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setBusy(false);
    }
  };
  const answered = (requests ?? []).filter((r) => r.reply).length;
  return (
    <View style={studio.wrap}>
      <Card title="Message Afterglow" sub="Questions, ideas, problems: anything. Afterglow replies here.">
        <Field label="Your message" value={text} onChangeText={setText} placeholder="Write to Afterglow" multiline maxLength={REQUEST_TEXT_MAX} />
        <Button label="Send" busy={busy} onPress={() => void send()} />
      </Card>
      <Text style={studio.h3}>Your conversation{answered ? ` · ${answered} ${answered === 1 ? 'reply' : 'replies'}` : ''}</Text>
      {requests && !requests.length ? <Text style={studio.muted}>Nothing yet. Messages and requests you send show here with Afterglow’s replies.</Text> : null}
      {(requests ?? []).map((r) => (
        <View key={r.id} style={{ gap: 6 }}>
          <View style={[studio.row, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={studio.rowSub}>
                You · {REQUEST_LABEL[r.kind]}
                {r.eventId ? ` · ${org.events.find((e) => e.id === r.eventId)?.name ?? r.eventId}` : ''} · {r.createdAt.slice(0, 10)}
              </Text>
              <Text style={studio.rowTitle}>{r.text}</Text>
            </View>
            <Text style={[studio.status, r.status === 'approved' && studio.live]}>{STATUS_LABEL[r.status]}</Text>
          </View>
          {r.reply ? (
            <View style={[studio.row, { marginLeft: 24, backgroundColor: 'rgba(169,124,255,0.12)' }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={studio.rowSub}>Afterglow{r.answeredAt ? ` · ${r.answeredAt.slice(0, 10)}` : ''}</Text>
                <Text style={studio.rowTitle}>{r.reply}</Text>
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
