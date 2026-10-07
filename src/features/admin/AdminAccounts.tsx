import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { FilterChips } from '../../components/FilterChips';
import { SearchField } from '../../components/SearchField';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useSocial } from '../../state/social';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import type { FlairKind, Privileges, Profile } from '../social/models';
import { ORG_STARTERS } from '../../config/organizers';
import { useOrgs } from '../../state/orgs';
import { orgFromStarter, orgOfAccount } from '../organizers/organizers';
import { refreshOrgs } from '../organizers/OrgSync';
import { FLAIR_KINDS } from '../social/models';
import { StandingAvatar } from '../standing/StandingAvatar';
import { rememberStanding } from '../standing/useStanding';
import { FLAIR_CAPTION, PLUS_TERMS, plusUntil } from './drops';

const FLAIR_LABEL: Record<FlairKind, string> = { artist: 'Artist', team: 'Team', partner: 'Partner' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

/** "Plus until Jan 3, 2027 · Artist flair". */
function privilegeLine(p: Privileges | undefined): string {
  if (!p) return 'No special privileges';
  const parts: string[] = [];
  if (p.plus) parts.push(p.plus.until ? `Plus until ${dateLabel(p.plus.until)}` : 'Plus');
  if (p.flair) parts.push(`${FLAIR_LABEL[p.flair.kind]} flair: “${p.flair.caption}”`);
  return parts.join(' · ') || 'No special privileges';
}

/**
 * HQ's Accounts tab: find anyone and give them special privileges.
 * Afterglow Plus (their videos show without the edge glow, for good or for a
 * while) and a flair (an Artist, Team or Partner ring with a caption on
 * their profile). Everyone who has one is listed first. More privileges can
 * join this page later.
 */
export function AdminAccounts() {
  const social = useSocial();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Profile[]>([]);
  const [list, setList] = useState<(Privileges & { profile?: Profile | null })[] | undefined>();
  const [chosen, setChosen] = useState<Profile | undefined>();
  // The list couldn't be read: say so (with Try again) rather than "No one yet".
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const ps = await social.service.privileged();
      const withProfiles = await Promise.all(ps.map(async (p) => ({ ...p, profile: await social.service.profileOf(p.uid).catch(() => null) })));
      setList(withProfiles);
    } catch {
      setFailed(true);
    }
  }, [social.service]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    const q = query.trim();
    if (q.replace(/^@/, '').length < 2) {
      const t = setTimeout(() => setFound([]), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      social.service
        .searchProfiles(q)
        .then((r) => setFound(r.slice(0, 8)))
        .catch(() => setFound([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query, social.service]);

  const current = chosen ? list?.find((p) => p.uid === chosen.uid) : undefined;

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>Give someone Afterglow Plus or a flair. More privileges can be added here later.</Text>
      <SearchField value={query} onChange={setQuery} placeholder="Find someone by name or @handle" label="Find someone by name or @handle" />
      {found.map((p) => (
        <PersonLine key={p.uid} profile={p} detail={privilegeLine(list?.find((x) => x.uid === p.uid))} onPress={() => setChosen(p)} />
      ))}

      {/* Only once the list has been read, so the panel starts from what they really have (saving never wipes a privilege it didn't know about). */}
      {chosen && list ? <Grant key={chosen.uid} profile={chosen} current={current} onSaved={load} onClose={() => setChosen(undefined)} /> : null}
      {chosen && !list ? (
        <Text style={styles.small}>{failed ? `${chosen.displayName}’s privileges couldn’t be read yet.` : `Reading ${chosen.displayName}’s privileges…`}</Text>
      ) : null}

      <Text style={styles.section}>With privileges</Text>
      {failed ? (
        <View style={styles.person}>
          <Text style={[styles.small, { flex: 1 }]}>Couldn’t read who has privileges. Check the signal.</Text>
          <Pressable onPress={() => void load()} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
      {!list && !failed ? <ActivityIndicator color={color.glow} /> : null}
      {list && !list.length && !failed ? <Text style={styles.small}>No one yet.</Text> : null}
      {list?.map((p) =>
        p.profile ? (
          <PersonLine key={p.uid} profile={p.profile} detail={privilegeLine(p)} onPress={() => setChosen(p.profile!)} />
        ) : (
          <View key={p.uid} style={styles.person}>
            <Text style={styles.small}>
              An account without a profile ({p.uid.slice(0, 8)}…): {privilegeLine(p)}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

function PersonLine({ profile, detail, onPress }: { profile: Profile; detail: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${profile.displayName}, @${profile.handle}. ${detail}`}
      style={({ pressed }) => [styles.person, pressed && styles.pressed]}
    >
      <StandingAvatar name={profile.displayName} url={profile.avatarUrl} size={40} uid={profile.uid} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {profile.displayName} <Text style={styles.handle}>@{profile.handle}</Text>
        </Text>
        <Text style={styles.small} numberOfLines={2}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

/** One person's privileges, changed and saved together. */
function Grant({ profile, current, onSaved, onClose }: { profile: Profile; current?: Privileges; onSaved: () => void; onClose: () => void }) {
  const social = useSocial();
  const [plus, setPlus] = useState(!!current?.plus);
  const [term, setTerm] = useState<string>(current?.plus?.until ? 'keep' : 'always');
  const [flair, setFlair] = useState<FlairKind | undefined>(current?.flair?.kind);
  const [caption, setCaption] = useState(current?.flair?.caption ?? '');
  const [busy, setBusy] = useState(false);
  // Which organizer this account runs: one already on Afterglow, or one ready to set up (config/organizers.ts).
  const orgs = useOrgs();
  const wasOrg = orgOfAccount(orgs, profile.uid)?.id;
  // Unless it's changed here, it shows what Afterglow has (which may arrive after this opens).
  const [picked, setPicked] = useState<{ org: string | undefined } | undefined>();
  const org = picked ? picked.org : wasOrg;
  const orgChoices = [...orgs.map((o) => ({ id: o.id, name: o.name })), ...ORG_STARTERS.filter((st) => !orgs.some((o) => o.id === st.id)).map((st) => ({ id: st.id, name: st.name }))];

  const save = async () => {
    setBusy(true);
    try {
      const months = PLUS_TERMS.find((t) => t.key === term)?.months ?? 0;
      const until = term === 'keep' ? current?.plus?.until : plusUntil(months, new Date());
      const words = (caption.trim() || (flair ? FLAIR_CAPTION[flair] : '')).slice(0, 40);
      // Only what was changed here is written, so a privilege set elsewhere meanwhile is left alone.
      const plusChanged = plus !== !!current?.plus || (plus && until !== current?.plus?.until);
      const flairChanged = flair !== current?.flair?.kind || (!!flair && words !== current?.flair?.caption);
      if (plusChanged) await social.service.setPlus(profile.uid, plus ? (until ? { until } : {}) : null);
      if (flairChanged) await social.service.setFlair(profile.uid, flair ? { kind: flair, caption: words } : null);
      if (picked && org !== wasOrg) {
        if (wasOrg) await social.service.setOrgAccount(wasOrg, profile.uid, false);
        if (org) {
          // Not set up yet: its page first (from its starter), then the account.
          const starter = ORG_STARTERS.find((st) => st.id === org);
          if (!orgs.some((o) => o.id === org) && starter) await social.service.saveOrg(orgFromStarter(starter));
          await social.service.setOrgAccount(org, profile.uid, true);
        }
        refreshOrgs();
      }
      // Their ring and caption change straight away on this phone.
      const standing = await social.service.standingOf(profile.uid).catch(() => undefined);
      if (standing) rememberStanding(profile.uid, standing);
      haptic.settle();
      onSaved();
      showAlert('Saved', `${profile.displayName}’s privileges are updated. They see them the next time their app reads their profile.`);
    } catch {
      showAlert('Couldn’t save', 'Check the signal and try again. If it keeps happening, the newest database rules may not be deployed yet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.grant}>
      <View style={styles.grantHead}>
        <StandingAvatar name={profile.displayName} url={profile.avatarUrl} size={52} uid={profile.uid} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.displayName}</Text>
          <Text style={styles.handle}>@{profile.handle}</Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
          <Text style={styles.close}>×</Text>
        </Pressable>
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Afterglow Plus</Text>
          <Text style={styles.small}>Their videos show without the edge glow.</Text>
        </View>
        <Switch value={plus} onValueChange={setPlus} accessibilityLabel="Afterglow Plus" trackColor={{ false: 'rgba(255,255,255,0.18)', true: color.glow }} />
      </View>
      {plus ? (
        <FilterChips
          inset={0}
          value={term}
          onChange={(k) => setTerm(k ?? 'always')}
          chips={[
            ...(current?.plus?.until ? [{ key: 'keep', label: `Until ${dateLabel(current.plus.until)}`, accessibilityLabel: `Keep the end date, ${dateLabel(current.plus.until)}` }] : []),
            ...PLUS_TERMS.map((t) => ({ key: t.key, label: t.label, accessibilityLabel: t.months ? `Plus for ${t.label}` : 'Plus with no end' })),
          ]}
        />
      ) : null}

      <Text style={[styles.label, { marginTop: space.md }]}>Flair</Text>
      <Text style={styles.small}>A ring and a caption on their profile.</Text>
      <FilterChips
        inset={0}
        value={flair ?? 'none'}
        onChange={(k) => {
          const next = k === 'none' || !k ? undefined : (k as FlairKind);
          setFlair(next);
          if (next && (!caption.trim() || Object.values(FLAIR_CAPTION).includes(caption.trim() as never))) setCaption(FLAIR_CAPTION[next]);
        }}
        chips={[{ key: 'none', label: 'None', accessibilityLabel: 'No flair' }, ...FLAIR_KINDS.map((k) => ({ key: k, label: FLAIR_LABEL[k], accessibilityLabel: `${FLAIR_LABEL[k]} flair` }))]}
      />
      {flair ? (
        <TextInput
          value={caption}
          onChangeText={(t) => setCaption(t.slice(0, 40))}
          placeholder={FLAIR_CAPTION[flair]}
          placeholderTextColor={color.moonFaint}
          accessibilityLabel="Flair caption"
          style={styles.input}
        />
      ) : null}

      <Text style={[styles.label, { marginTop: space.md }]}>Organizer</Text>
      <Text style={styles.small}>They run this organizer: their profile shows it, and they get its studio (no email to confirm).</Text>
      <FilterChips
        inset={0}
        value={org ?? 'none'}
        onChange={(k) => setPicked({ org: k === 'none' || !k ? undefined : k })}
        chips={[{ key: 'none', label: 'None', accessibilityLabel: 'Not an organizer' }, ...orgChoices.map((o) => ({ key: o.id, label: o.name, accessibilityLabel: `Runs ${o.name}` }))]}
      />

      <Pressable onPress={() => void save()} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.save, busy && { opacity: 0.6 }, pressed && styles.pressed]}>
        <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save privileges'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, gap: space.sm },
  lead: { ...type.body, color: color.moonDim, marginBottom: space.xs },
  section: { ...type.title, color: color.moon, marginTop: space.lg },
  small: { ...type.caption, color: color.moonDim },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  name: { ...type.headline, color: color.moon },
  handle: { ...type.label, color: color.moonDim, fontWeight: '500' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  grant: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: glowA(0.08), borderWidth: 1, borderColor: glowA(0.45) },
  grantHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  close: { fontSize: 24, color: color.moonFaint, paddingHorizontal: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  label: { ...type.headline, color: color.moon },
  input: { ...type.body, color: color.moon, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  save: { alignSelf: 'flex-start', marginTop: space.md, paddingHorizontal: space.xl, minHeight: 44, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  saveText: { ...type.headline, color: color.night },
  retry: { ...type.label, color: color.glow },
});
