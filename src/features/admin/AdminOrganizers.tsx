import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ORG_STARTERS } from '../../config/organizers';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { setOrgs } from '../../state/orgs';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { localDay } from '../artists/shows';
import { OrgDot } from '../organizers/OrgMark';
import { foundEvents, handleFor, type Org, ORG_EVENTS_MAX, orgFromStarter, type OrgRequest, promotionUntil, REQUEST_LABEL } from '../organizers/organizers';
import { refreshOrgs } from '../organizers/OrgSync';
import { STATUS_LABEL } from '../organizers/studio/StudioPromote';
import { socialErrorKind, SOCIAL_ERROR_COPY } from '../social/service';

const EMAIL = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/;

/**
 * HQ's Organizers tab: event organizers on Afterglow. Set one up from its
 * starter (config/organizers.ts), choose which emails may sign in to its
 * studio (a test login now, the organizer's own later), open its studio,
 * stop a promotion, and answer what organizers ask for: promotions (approve
 * for the days asked), designs and gifts.
 */
export function AdminOrganizers() {
  const { service } = useSocial();
  const [orgs, setList] = useState<Org[] | undefined>();
  const [members, setMembers] = useState<Record<string, string[]>>({});
  const [requests, setRequests] = useState<OrgRequest[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, reqs] = await Promise.all([service.orgs(), service.orgRequests(null, 100).catch(() => [])]);
      setList(list);
      setOrgs(list);
      setRequests(reqs);
      const pairs = await Promise.all(list.map(async (o) => [o.id, await service.orgMembers(o.id).catch(() => [])] as const));
      setMembers(Object.fromEntries(pairs));
    } catch {
      setList((x) => x ?? []);
    }
  }, [service]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const fail = (e: unknown) => showAlert('Couldn’t save that', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await work();
      haptic.settle();
      await load();
      refreshOrgs();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const setUp = (starter: (typeof ORG_STARTERS)[number]) =>
    void run(async () => {
      await service.saveOrg(orgFromStarter(starter));
      await service.setOrgMember(starter.loginEmail, starter.id);
    });

  if (!orgs) return <ActivityIndicator color={color.glow} />;
  const waiting = ORG_STARTERS.filter((s) => !orgs.some((o) => o.id === s.id));
  const open = requests.filter((r) => r.status === 'open');

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>Event organizers run their own page in the organizer studio: events and lineups, words on their artists, badges, gifts and stickers. Their emails sign in to it once confirmed; promotions are only ever given here.</Text>

      {waiting.map((s) => (
        <View key={s.id} style={styles.card}>
          <Text style={styles.h3}>{s.name}</Text>
          <Text style={styles.body}>
            Ready to set up: its page (name, website, Instagram and logo) and a test login, {s.loginEmail}. That’s a “+” address on the support Gmail, so its confirmation email lands in the support inbox.
          </Text>
          <Pressable onPress={() => setUp(s)} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.primary, busy && { opacity: 0.6 }, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Set up {s.name}</Text>
          </Pressable>
        </View>
      ))}

      {orgs.map((o) => (
        <OrgCard key={o.id} org={o} emails={members[o.id] ?? []} busy={busy} run={run} />
      ))}
      {!orgs.length && !waiting.length ? <Text style={styles.body}>No organizers yet.</Text> : null}

      <Text style={styles.h3}>Requests{open.length ? ` · ${open.length} waiting` : ''}</Text>
      {!requests.length ? <Text style={styles.body}>Nothing asked yet.</Text> : null}
      {requests.map((r) => (
        <RequestCard key={r.id} r={r} org={orgs.find((o) => o.id === r.orgId)} busy={busy} run={run} />
      ))}
    </View>
  );
}

function OrgCard({ org, emails, busy, run }: { org: Org; emails: string[]; busy: boolean; run: (work: () => Promise<unknown>) => Promise<void> }) {
  const { service } = useSocial();
  const today = localDay(useToday());
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState(org.handle ?? handleFor(org.name) ?? '');
  const saveHandle = () => {
    const h = handle.trim().toLowerCase().replace(/^@/, '');
    if (h && !/^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/.test(h)) return showAlert('That @handle doesn’t look right', '3 to 20 letters, numbers, dots or underscores.');
    void run(() => service.setOrgHandle(org.id, h || null));
  };
  const promoted = Object.entries(org.promoted).filter(([, until]) => until >= today);
  // Past events found on its own ticket pages, not on its page yet.
  const found = foundEvents(org, ORG_STARTERS.find((x) => x.id === org.id)?.pastEvents);
  const addEmail = () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL.test(e)) return showAlert('That email doesn’t look right', 'Like stefan@example.com');
    void run(() => service.setOrgMember(e, org.id)).then(() => setEmail(''));
  };
  const removeEmail = (e: string) =>
    showAlert(`Stop ${e} signing in to ${org.name}’s studio?`, 'Their account stays; it just can’t run this page any more.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void run(() => service.setOrgMember(e, null)) },
    ]);
  return (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <OrgDot org={org} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.h3}>{org.name}</Text>
          <Text style={styles.body}>
            {org.events.filter((e) => e.published).length} published · {org.events.filter((e) => !e.published).length} drafts · {Object.keys(org.artists).length} artists edited
          </Text>
        </View>
      </View>
      <View style={styles.actionsRow}>
        <Pressable onPress={() => router.push({ pathname: '/studio', params: { org: org.id } })} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>Open its studio</Text>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/org/[id]', params: { id: org.id } })} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>View its page</Text>
        </Pressable>
      </View>
      {found.length ? (
        <Pressable
          onPress={() => void run(() => service.saveOrg({ ...org, events: [...org.events, ...found].slice(0, ORG_EVENTS_MAX) }))}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Add {found.length} past events found on its ticket pages</Text>
        </Pressable>
      ) : null}

      <Text style={styles.label}>Its profile</Text>
      <Text style={styles.body}>Accounts that run it show as {org.name}, with this @handle (they take it the next time they open the studio).</Text>
      <View style={styles.rowTop}>
        <TextInput value={handle} onChangeText={setHandle} placeholder="handle" placeholderTextColor={color.moonFaint} autoCapitalize="none" style={[styles.input, { flex: 1 }]} accessibilityLabel="Profile handle" />
        <Pressable onPress={saveHandle} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>{org.handle ? 'Save' : 'Use it'}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Who can sign in to its studio</Text>
      {emails.length ? (
        emails.map((e) => (
          <View key={e} style={styles.row}>
            <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>
              {e}
            </Text>
            <Pressable onPress={() => removeEmail(e)} accessibilityRole="button" accessibilityLabel={`Remove ${e}`} hitSlop={8}>
              <Text style={styles.danger}>Remove</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={styles.body}>Nobody yet.</Text>
      )}
      <TextInput value={email} onChangeText={setEmail} placeholder="Add an email" placeholderTextColor={color.moonFaint} autoCapitalize="none" keyboardType="email-address" style={styles.input} accessibilityLabel="Email to add" onSubmitEditing={addEmail} />
      <Pressable onPress={addEmail} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Text style={styles.secondaryText}>Add email</Text>
      </Pressable>
      <Text style={styles.body}>They sign up in the app with that email and confirm it. To hand over from a test login, add the organizer’s real email, then remove the test one.</Text>

      {promoted.length ? (
        <>
          <Text style={styles.label}>Promoted now</Text>
          {promoted.map(([id, until]) => (
            <View key={id} style={styles.row}>
              <Text style={[styles.rowTitle, { flex: 1 }]}>
                {org.events.find((e) => e.id === id)?.name ?? id} · until {until}
              </Text>
              <Pressable onPress={() => void run(() => service.setPromotion(org.id, id, null))} accessibilityRole="button" accessibilityLabel={`Stop promoting ${id}`} hitSlop={8}>
                <Text style={styles.danger}>Stop</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function RequestCard({ r, org, busy, run }: { r: OrgRequest; org: Org | undefined; busy: boolean; run: (work: () => Promise<unknown>) => Promise<void> }) {
  const { service } = useSocial();
  const today = localDay(useToday());
  const [reply, setReply] = useState('');
  const event = org?.events.find((e) => e.id === r.eventId);
  const answer = (status: OrgRequest['status']) => run(() => service.answerOrgRequest(r.id, status, reply));
  const approve = () => {
    if (!org || !event) return showAlert('That event isn’t there any more', 'It may have been deleted. Decline the request instead.');
    if (!event.published) return showAlert('That event is a draft', 'It needs to be published before it can be promoted.');
    const until = promotionUntil(today, r.days ?? 7, event);
    showAlert(`Promote ${event.name} until ${until}?`, 'It shows at the top of everyone’s Festivals tab, labelled Promoted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Promote',
        onPress: () =>
          void run(async () => {
            await service.setPromotion(org.id, event.id, until);
            await service.answerOrgRequest(r.id, 'approved', reply.trim() || `Promoted until ${until}.`);
          }),
      },
    ]);
  };
  return (
    <View style={styles.card}>
      <Text style={styles.rowTitle}>
        {org?.name ?? r.orgId} · {REQUEST_LABEL[r.kind]}
        {event ? ` · ${event.name}` : ''}
        {r.days ? ` · ${r.days} days` : ''}
        {r.about ? ` · ${r.about}` : ''}
      </Text>
      <Text style={styles.body}>
        {STATUS_LABEL[r.status]} · {r.createdAt.slice(0, 10)}
      </Text>
      <Text style={styles.text}>{r.text}</Text>
      {r.reply ? <Text style={styles.body}>Replied: {r.reply}</Text> : null}
      {r.status === 'open' ? (
        <>
          <TextInput value={reply} onChangeText={setReply} placeholder="Reply (they see it in their studio)" placeholderTextColor={color.moonFaint} multiline style={[styles.input, { minHeight: 60 }]} accessibilityLabel="Reply" />
          <View style={styles.actionsRow}>
            {r.kind === 'promotion' ? (
              <Pressable onPress={approve} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.primarySmall, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>Approve</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => void answer('done')} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.primarySmall, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>Reply and mark done</Text>
              </Pressable>
            )}
            <Pressable onPress={() => void answer('declined')} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>Decline</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, gap: space.md },
  lead: { ...type.body, color: color.moonDim },
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  h3: { ...type.headline, color: color.moon },
  body: { ...type.caption, color: color.moonDim },
  text: { ...type.body, color: color.moon },
  label: { ...type.label, color: color.moonDim, marginTop: space.xs },
  input: { ...type.body, color: color.moon, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md, backgroundColor: color.glass },
  rowTitle: { ...type.label, color: color.moon },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  primary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glow, marginTop: space.xs },
  primarySmall: { alignItems: 'center', paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.headline, color: color.night },
  secondary: { alignItems: 'center', paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.label, color: color.moon },
  danger: { ...type.caption, color: color.coral },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
