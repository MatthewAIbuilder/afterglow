import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { showAlert } from '../../../lib/dialog';
import { haptic } from '../../../lib/haptics';
import { useCatalog } from '../../../state/catalog';
import { useToday } from '../../../lib/useToday';
import { localDay } from '../../artists/shows';
import { color, radius, space, type } from '../../../theme/tokens';
import { cleanEvent, eventFestivalId, foldName, httpsLink, isDay, isTime, LINEUP_MAX, newEventId, type Org, type OrgAct, type OrgEvent, ORG_EVENTS_MAX, splitEvents, EVENT_ABOUT_MAX, EVENT_NAME_MAX, EVENT_PLACE_MAX } from '../organizers';
import { Action, Button, Card, Chip, Field, studio } from './ui';

const blank = (): OrgEvent => ({ id: '', name: '', date: '', venue: '', city: '', lineup: [], published: false });

/**
 * The studio's Events tab: every event, drafts and published, and an editor
 * for one: name, nights, doors, venue, words, tickets and flyer links, the
 * festival it's the after party of, and the lineup with set times. A
 * published event shows to everyone like a festival.
 */
export function StudioEvents({ org, save }: { org: Org; save: (next: Org) => Promise<boolean> }) {
  const [editing, setEditing] = useState<{ event: OrgEvent; isNew: boolean } | undefined>();
  const today = localDay(useToday());
  const { upcoming, past } = splitEvents(org, today, true);

  if (editing) return <EventEditor org={org} start={editing.event} isNew={editing.isNew} save={save} done={() => setEditing(undefined)} />;

  const add = () => {
    if (org.events.length >= ORG_EVENTS_MAX) return showAlert('That’s the most events a page can hold', 'Delete an old one to add another.');
    setEditing({ event: blank(), isNew: true });
  };
  const row = (e: OrgEvent) => (
    <Pressable key={e.id} onPress={() => setEditing({ event: e, isNew: false })} accessibilityRole="button" accessibilityLabel={`Edit ${e.name}`} style={({ pressed }) => [studio.row, pressed && { opacity: 0.8 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={studio.rowTitle}>{e.name}</Text>
        <Text style={studio.rowSub}>
          {e.date}
          {e.endDate ? ` to ${e.endDate}` : ''} · {[e.venue, e.city].filter(Boolean).join(', ') || 'No venue yet'} · {e.lineup.length} {e.lineup.length === 1 ? 'act' : 'acts'}
        </Text>
      </View>
      <Text style={[studio.status, e.published && studio.live]}>{e.published ? 'Live' : 'Draft'}</Text>
    </Pressable>
  );

  return (
    <View style={studio.wrap}>
      <Text style={studio.lead}>Add your events here. A draft is only seen in the studio; publish it and it shows on Afterglow like a festival, with its own page, plans, crowd videos and your badge.</Text>
      <Button label="Add an event" onPress={add} />
      {upcoming.length ? <Text style={studio.h3}>Coming up</Text> : null}
      {upcoming.map(row)}
      {past.length ? <Text style={studio.h3}>Past</Text> : null}
      {past.map(row)}
      {!org.events.length ? <Text style={studio.muted}>No events yet.</Text> : null}
    </View>
  );
}

function EventEditor({ org, start, isNew, save, done }: { org: Org; start: OrgEvent; isNew: boolean; save: (next: Org) => Promise<boolean>; done: () => void }) {
  const catalog = useCatalog();
  const [e, setE] = useState<OrgEvent>(start);
  const [act, setAct] = useState('');
  const [afterQuery, setAfterQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof OrgEvent>(k: K, v: OrgEvent[K]) => setE((x) => ({ ...x, [k]: v }));
  const setActAt = (i: number, next: Partial<OrgAct>) => setE((x) => ({ ...x, lineup: x.lineup.map((a, j) => (j === i ? { ...a, ...next } : a)) }));

  // Afterglow's artists matching what's typed, to pick rather than retype.
  const suggestions = useMemo(() => {
    const q = foldName(act);
    if (q.length < 2) return [];
    return catalog.artists.filter((a) => foldName(a.name).includes(q) && !e.lineup.some((x) => x.artistId === a.id || foldName(x.name) === foldName(a.name))).slice(0, 5);
  }, [act, catalog.artists, e.lineup]);
  const afterFestival = e.afterOf ? catalog.festival(e.afterOf) : undefined;
  const festivals = useMemo(() => {
    const q = foldName(afterQuery);
    if (q.length < 2) return [];
    return catalog.festivals.filter((f) => !f.organizer && foldName(f.name).includes(q)).slice(0, 5);
  }, [afterQuery, catalog.festivals]);

  const addAct = (name: string, artistId?: string) => {
    if (!name.trim()) return;
    if (e.lineup.length >= LINEUP_MAX) return showAlert('That’s a full lineup', `An event can list up to ${LINEUP_MAX} acts.`);
    haptic.select();
    setE((x) => ({ ...x, lineup: [...x.lineup, { name: name.trim(), ...(artistId ? { artistId } : {}) }] }));
    setAct('');
  };
  const move = (i: number) => setE((x) => (i <= 0 ? x : { ...x, lineup: x.lineup.map((a, j) => (j === i - 1 ? x.lineup[i] : j === i ? x.lineup[i - 1] : a)) }));

  const problem = (): string | undefined => {
    if (!e.name.trim()) return 'Give the event a name.';
    if (!isDay(e.date)) return 'Write the night it starts as year-month-day, like 2026-11-14.';
    if (e.endDate && (!isDay(e.endDate) || e.endDate <= e.date)) return 'The last night needs to be after the first (year-month-day), or leave it empty.';
    if (e.doors && !isTime(e.doors)) return 'Write doors on the 24-hour clock, like 22:00, or leave it empty.';
    if (e.tickets && !httpsLink(e.tickets)) return 'The tickets link needs to start with https://';
    if (e.poster && !httpsLink(e.poster)) return 'The flyer link needs to start with https://';
    const badTime = e.lineup.find((a) => (a.start && !isTime(a.start)) || (a.end && !isTime(a.end)) || (!!a.start !== !!a.end));
    if (badTime) return `Set times for ${badTime.name} need a start and an end on the 24-hour clock, like 23:30 and 01:00.`;
    return undefined;
  };

  const commit = async (published: boolean) => {
    const p = problem();
    if (p) return showAlert('Check the event', p);
    const id = isNew ? newEventId(org, e.name, e.date) : e.id;
    const clean = cleanEvent({ ...e, id, published });
    if (!clean) return showAlert('Check the event', 'Something in it doesn’t look right.');
    setBusy(true);
    const ok = await save({ ...org, events: isNew ? [...org.events, clean] : org.events.map((x) => (x.id === id ? clean : x)) });
    setBusy(false);
    if (ok) {
      haptic.settle();
      done();
    }
  };
  const publish = () =>
    showAlert('Publish this event?', 'It shows to everyone on Afterglow straight away, with its lineup. You can still change it.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Publish', onPress: () => void commit(true) },
    ]);
  const remove = () =>
    showAlert(`Delete “${e.name || 'this event'}”?`, 'It leaves Afterglow. Videos people filmed there stay theirs.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void save({ ...org, events: org.events.filter((x) => x.id !== e.id) }).then((ok) => ok && done()),
      },
    ]);

  return (
    <View style={studio.wrap}>
      <Action label="‹ All events" onPress={done} a11y="Back to all events" />
      <Card title={isNew ? 'New event' : e.name} sub={e.published ? 'Live on Afterglow. Changes show for everyone when you save.' : 'A draft: only you see it until you publish.'}>
        <Field label="Name" value={e.name} onChangeText={(v) => set('name', v)} placeholder="Like Transmutation" maxLength={EVENT_NAME_MAX} />
        <Field label="Night" value={e.date} onChangeText={(v) => set('date', v.trim())} placeholder="2026-11-14" autoCapitalize="none" hint="The night it starts. An after party past midnight still belongs to this night." />
        <Field label="Last night (more than one night only)" value={e.endDate ?? ''} onChangeText={(v) => set('endDate', v.trim() || undefined)} placeholder="Leave empty for one night" autoCapitalize="none" />
        <Field label="Doors" value={e.doors ?? ''} onChangeText={(v) => set('doors', v.trim() || undefined)} placeholder="22:00" autoCapitalize="none" />
        <Field label="Venue" value={e.venue} onChangeText={(v) => set('venue', v)} placeholder="Where it is" maxLength={EVENT_PLACE_MAX} />
        <Field label="City" value={e.city} onChangeText={(v) => set('city', v)} placeholder="Like Orlando, FL" maxLength={EVENT_PLACE_MAX} />
        <Field label="About the night" value={e.about ?? ''} onChangeText={(v) => set('about', v || undefined)} placeholder="What to expect, dress code, age limit…" multiline maxLength={EVENT_ABOUT_MAX} />
        <Field label="Tickets link" value={e.tickets ?? ''} onChangeText={(v) => set('tickets', v.trim() || undefined)} placeholder="https://" autoCapitalize="none" keyboardType="url" />
        <Field label="Flyer link" value={e.poster ?? ''} onChangeText={(v) => set('poster', v.trim() || undefined)} placeholder="https:// (a picture you have the rights to)" autoCapitalize="none" keyboardType="url" hint="Shown as the event’s poster." />
      </Card>

      <Card title="After party of" sub="Link it to a festival on Afterglow and it shows on that festival’s page, under After parties.">
        {afterFestival ? (
          <View style={studio.row}>
            <Text style={[studio.rowTitle, { flex: 1 }]}>{afterFestival.name}</Text>
            <Action label="Remove" danger onPress={() => set('afterOf', undefined)} a11y={`Unlink from ${afterFestival.name}`} />
          </View>
        ) : (
          <>
            <TextInput value={afterQuery} onChangeText={setAfterQuery} placeholder="Search festivals" placeholderTextColor={color.moonFaint} style={inputStyle} accessibilityLabel="Search festivals" />
            {festivals.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  haptic.select();
                  set('afterOf', f.id);
                  setAfterQuery('');
                }}
                accessibilityRole="button"
                style={studio.row}
              >
                <Text style={studio.rowTitle}>{f.name}</Text>
                <Text style={studio.rowSub}>{f.dates}</Text>
              </Pressable>
            ))}
          </>
        )}
      </Card>

      <Card title={`Lineup · ${e.lineup.length}`} sub="In billing order. Pick artists already on Afterglow when they come up, so the event shows on their pages. Set times are optional, on the 24-hour clock.">
        {e.lineup.map((a, i) => (
          <View key={`${a.name}-${i}`} style={[studio.row, { flexWrap: 'wrap' }]}>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={studio.rowTitle}>{a.name}</Text>
              <Text style={studio.rowSub}>{a.artistId || catalog.artists.some((x) => foldName(x.name) === foldName(a.name)) ? 'On Afterglow' : 'New to Afterglow'}</Text>
            </View>
            <TextInput value={a.start ?? ''} onChangeText={(v) => setActAt(i, { start: v.trim() || undefined })} placeholder="Start" placeholderTextColor={color.moonFaint} style={timeStyle} accessibilityLabel={`${a.name} starts`} autoCapitalize="none" />
            <TextInput value={a.end ?? ''} onChangeText={(v) => setActAt(i, { end: v.trim() || undefined })} placeholder="End" placeholderTextColor={color.moonFaint} style={timeStyle} accessibilityLabel={`${a.name} ends`} autoCapitalize="none" />
            <View style={studio.actions}>
              {i > 0 ? <Action label="Up" onPress={() => move(i)} a11y={`Move ${a.name} up`} /> : null}
              <Action label="Remove" danger onPress={() => setE((x) => ({ ...x, lineup: x.lineup.filter((_, j) => j !== i) }))} a11y={`Remove ${a.name}`} />
            </View>
          </View>
        ))}
        <TextInput value={act} onChangeText={setAct} onSubmitEditing={() => addAct(act)} placeholder="Add an artist" placeholderTextColor={color.moonFaint} style={inputStyle} accessibilityLabel="Add an artist" returnKeyType="done" />
        {suggestions.map((a) => (
          <Chip key={a.id} label={`+ ${a.name}`} onPress={() => addAct(a.name, a.id)} a11y={`Add ${a.name}, on Afterglow`} />
        ))}
        {act.trim().length > 1 ? <Chip label={`+ Add “${act.trim()}”`} onPress={() => addAct(act)} a11y={`Add ${act.trim()} as a new artist`} /> : null}
      </Card>

      {e.published ? (
        <>
          <Button label="Save changes" busy={busy} onPress={() => void commit(true)} />
          <Button kind="secondary" label="Unpublish (back to draft)" onPress={() => void commit(false)} />
          <Button kind="secondary" label="See it on Afterglow" onPress={() => router.push(`/festival/${eventFestivalId(org.id, e.id)}`)} />
        </>
      ) : (
        <>
          <Button label="Publish" busy={busy} onPress={publish} />
          <Button kind="secondary" label="Save as draft" onPress={() => void commit(false)} />
        </>
      )}
      {!isNew ? <Button kind="danger" label="Delete event" onPress={remove} /> : null}
    </View>
  );
}

const inputStyle = { ...type.body, color: color.moon, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: color.hairline };
const timeStyle = { ...inputStyle, width: 64, textAlign: 'center' as const };
