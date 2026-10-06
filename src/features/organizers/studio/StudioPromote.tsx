import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { showAlert } from '../../../lib/dialog';
import { haptic } from '../../../lib/haptics';
import { useToday } from '../../../lib/useToday';
import { useSocial } from '../../../state/social';
import { socialErrorKind, SOCIAL_ERROR_COPY } from '../../social/service';
import { localDay } from '../../artists/shows';
import { type Org, type OrgRequest, PROMO_DAYS, REQUEST_LABEL, REQUEST_TEXT_MAX, splitEvents } from '../organizers';
import { Button, Card, Chip, Field, studio } from './ui';

/** "Waiting", "Approved"… */
export const STATUS_LABEL: Record<OrgRequest['status'], string> = { open: 'Waiting', approved: 'Approved', declined: 'Not this time', done: 'Done' };

/**
 * The studio's Promote tab: ask Afterglow to promote an upcoming event (it
 * then shows, labelled Promoted, at the top of everyone's Festivals tab for
 * the days given), see what's promoted now, and every request with its
 * answer.
 */
export function StudioPromote({ org }: { org: Org }) {
  const today = localDay(useToday());
  const { upcoming } = splitEvents(org, today);
  const [eventId, setEventId] = useState<string | undefined>(upcoming[0]?.id);
  const [days, setDays] = useState<number>(7);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const live = Object.entries(org.promoted).filter(([, until]) => until >= today);
  const { requests, sendRequest } = useOrgRequests(org.id);

  const send = async () => {
    if (!eventId) return showAlert('Pick an event', 'Only published events that are still to come can be promoted.');
    setBusy(true);
    try {
      const event = org.events.find((e) => e.id === eventId);
      await sendRequest({ orgId: org.id, kind: 'promotion', eventId, days, text: text.trim() || `Please promote ${event?.name ?? 'our event'} for ${days} days.` });
      haptic.settle();
      setText('');
      showAlert('Sent to Afterglow', 'You’ll see the answer here. Once it’s approved, your event shows as Promoted at the top of the Festivals tab.');
    } catch (e) {
      showAlert('Couldn’t send that', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={studio.wrap}>
      <Text style={studio.lead}>Promotion puts an event at the top of everyone’s Festivals tab, clearly labelled Promoted, for the days you choose. It never changes anyone’s recommendations.</Text>
      {live.length ? (
        <Card title="Promoted now">
          {live.map(([id, until]) => (
            <Text key={id} style={studio.rowTitle}>
              {org.events.find((e) => e.id === id)?.name ?? id} · until {until}
            </Text>
          ))}
        </Card>
      ) : null}
      <Card title="Request a promotion" sub={upcoming.length ? 'Choose the event and how long.' : 'Publish an upcoming event first.'}>
        <View style={studio.chips}>
          {upcoming.map((e) => (
            <Chip key={e.id} label={e.name} on={eventId === e.id} onPress={() => setEventId(e.id)} />
          ))}
        </View>
        <View style={studio.chips}>
          {PROMO_DAYS.map((d) => (
            <Chip key={d} label={`${d} days`} on={days === d} onPress={() => setDays(d)} />
          ))}
        </View>
        <Field label="Anything we should know" value={text} onChangeText={setText} placeholder="Optional" multiline maxLength={REQUEST_TEXT_MAX} />
        <Button label="Send request" busy={busy} onPress={() => void send()} />
      </Card>
      <RequestList requests={requests} org={org} />
    </View>
  );
}

/** An organizer's requests (newest first), read when shown, with a way to send one that refreshes the list. */
export function useOrgRequests(orgId: string) {
  const { service } = useSocial();
  const [requests, setRequests] = useState<OrgRequest[] | undefined>();
  const load = useCallback(() => service.orgRequests(orgId, 50).then(setRequests, () => setRequests((x) => x ?? [])), [service, orgId]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const sendRequest = useCallback(
    async (input: Parameters<typeof service.sendOrgRequest>[0]) => {
      await service.sendOrgRequest(input);
      await load();
    },
    [service, load],
  );
  return { requests, sendRequest };
}

/** Requests and their answers. */
export function RequestList({ requests, org, kinds }: { requests: OrgRequest[] | undefined; org: Org; kinds?: OrgRequest['kind'][] }) {
  const shown = (requests ?? []).filter((r) => !kinds || kinds.includes(r.kind));
  if (!shown.length) return null;
  return (
    <Card title="Your requests">
      {shown.map((r) => (
        <View key={r.id} style={[studio.row, { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={studio.rowTitle}>
              {REQUEST_LABEL[r.kind]}
              {r.eventId ? ` · ${org.events.find((e) => e.id === r.eventId)?.name ?? r.eventId}` : ''}
              {r.days ? ` · ${r.days} days` : ''}
              {r.about ? ` · ${r.about}` : ''}
            </Text>
            <Text style={studio.rowSub}>{r.text}</Text>
            {r.reply ? <Text style={[studio.rowSub, { color: '#F3F0FF' }]}>Afterglow: {r.reply}</Text> : null}
          </View>
          <Text style={[studio.status, r.status === 'approved' && studio.live]}>{STATUS_LABEL[r.status]}</Text>
        </View>
      ))}
    </Card>
  );
}
