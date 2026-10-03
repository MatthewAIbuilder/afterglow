import { Image } from 'expo-image';
import { PageTitle } from '../../components/PageTitle';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistRow } from '../../components/ArtistRow';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon, ShareIcon } from '../../components/TabIcons';
import { crewTogether, firstName, whoLine } from '../../features/crews/together';
import { CrewRouteSection } from '../../features/crews/CrewRouteSection';
import { CrewLatest } from '../../features/crews/CrewLatest';
import { MeetSpotCard } from '../../features/crews/MeetSpotCard';
import { useWeekends } from '../../state/weekends';
import { useCrewPage } from '../../features/crews/useCrewPage';
import { whereWhen } from '../../features/festivals/format';
import { CREW_MAX, CREW_NAME_MAX, type Crew, type Profile } from '../../features/social/models';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../../features/social/service';
import { crewNameProblem } from '../../features/social/validate';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useCrews } from '../../state/crews';
import { usePlan } from '../../state/plan';
import { useSocial } from '../../state/social';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * A festival crew. Someone who opens an invite sees the crew and who's in it,
 * and can join (their stars at that festival are then shared with the crew).
 * Members see the sets more than one of them starred, everyone's picks,
 * invite more friends, and can leave; the owner can rename the crew and
 * remove people.
 */
export default function CrewScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const { page, reload, update } = useCrewPage(id);

  const body = (() => {
    switch (page.status) {
      case 'loading':
        return <ActivityIndicator color={color.glow} style={{ marginTop: space.xxl }} />;
      case 'signed-out':
        return (
          <Intro title="Plan a festival together" line="A friend invited you to their festival crew. Sign in to see it and join.">
            <Primary label="Sign in" onPress={() => router.push('/account')} />
          </Intro>
        );
      case 'missing':
        return <Intro title="This crew has ended" line="Everyone left, or the link isn’t quite right. Ask your friend to send it again." />;
      case 'failed':
        return (
          <Intro title="Couldn’t open this crew" line={SOCIAL_ERROR_COPY.network}>
            <Primary label="Try again" onPress={() => void reload()} />
          </Intro>
        );
      case 'ready':
        return page.member ? (
          <Member crew={page.crew} profiles={page.profiles} picks={page.picks} fresh={fresh === '1'} onChange={update} />
        ) : (
          <Invite crew={page.crew} profiles={page.profiles} onJoined={() => void reload()} />
        );
    }
  })();

  return (
    <View style={styles.root}>
      <PageTitle title={'Festival crew'} />
      <NightSky />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl, gap: space.md }}
        >
          {social.availability.ok ? body : <Intro title="Festival crews" line={SOCIAL_ERROR_COPY.unavailable} />}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

function Intro({ title, line, children }: { title: string; line: string; children?: React.ReactNode }) {
  return (
    <>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{line}</Text>
      {children}
    </>
  );
}

function Primary({ label, onPress, busy = false }: { label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator color={color.moon} /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

const nameOf = (profiles: Record<string, Profile>) => (uid: string) => (profiles[uid] ? firstName(profiles[uid].displayName) : 'Someone');

/** Someone opened an invite: the crew, who's in it, and Join. */
function Invite({ crew, profiles, onJoined }: { crew: Crew; profiles: Record<string, Profile>; onJoined: () => void }) {
  const social = useSocial();
  const { join, invites, inviters, declineInvite } = useCrews();
  const festival = useCatalog().festival(crew.festivalId);
  const [busy, setBusy] = useState(false);
  // Invited in the app: say by whom, and offer No thanks.
  const invited = invites.find((i) => i.crewId === crew.id);
  const inviter = invited ? inviters[invited.from] : undefined;
  const full = crew.members.length >= CREW_MAX;
  const festivalName = festival?.name ?? 'this festival';

  const press = async () => {
    haptic.select();
    if (!social.profile) {
      router.push('/profile-edit');
      return;
    }
    setBusy(true);
    try {
      await join(crew.id);
      haptic.settle();
      onJoined();
    } catch (e) {
      showAlert('Couldn’t join', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Text style={styles.kicker}>{invited ? `${inviter ? firstName(inviter.displayName) : 'A friend'} invited you · ${festivalName}` : festivalName}</Text>
      <Text style={styles.title} accessibilityRole="header">
        {crew.name}
      </Text>
      <Text style={styles.body}>Plan {festivalName} together: see which sets you all want and everyone’s picks.</Text>
      <Faces uids={crew.members} profiles={profiles} />
      {full ? (
        <Text style={styles.body}>This crew is full ({CREW_MAX} people).</Text>
      ) : (
        <>
          <Primary label={social.profile ? 'Join the crew' : 'Create your profile to join'} onPress={() => void press()} busy={busy} />
          <Text style={styles.note}>When you join, the sets you star at {festivalName} are shared with this crew. You can leave any time.</Text>
          {invited ? (
            <Pressable
              onPress={() => {
                haptic.select();
                void declineInvite(crew.id);
                if (router.canGoBack()) router.back();
                else router.replace('/together');
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.decline, pressed && styles.pressed]}
            >
              <Text style={styles.declineText}>No thanks</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </>
  );
}

function Faces({ uids, profiles }: { uids: string[]; profiles: Record<string, Profile> }) {
  const names = uids.map(nameOf(profiles));
  return (
    <View style={styles.facesRow} accessible accessibilityLabel={`In this crew: ${names.join(', ')}`}>
      <View style={{ flexDirection: 'row' }}>
        {uids.slice(0, 6).map((u, i) => (
          <Face key={u} profile={profiles[u]} first={i === 0} />
        ))}
      </View>
      <Text style={styles.facesLine} numberOfLines={2}>
        {names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ')}
      </Text>
    </View>
  );
}

function Face({ profile: p, first, size = 32 }: { profile?: Profile; first?: boolean; size?: number }) {
  return (
    <View style={[styles.face, { width: size, height: size, borderRadius: size / 2 }, !first && styles.overlap]}>
      {p?.avatarUrl ? (
        <Image source={{ uri: p.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text style={styles.initial}>{(p?.displayName ?? '?').slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

/** A member's view of the crew. */
function Member({
  crew,
  profiles,
  picks,
  fresh,
  onChange,
}: {
  crew: Crew;
  profiles: Record<string, Profile>;
  picks: { uid: string; artists: string[]; updatedAt: string }[];
  fresh: boolean;
  onChange: (crew: Crew) => void;
}) {
  const social = useSocial();
  const me = social.user?.uid;
  const crews = useCrews();
  const catalog = useCatalog();
  const festival = catalog.festival(crew.festivalId);
  const plan = usePlan();
  const { taste } = useTaste();
  const owner = crew.owner === me;
  const [editing, setEditing] = useState(fresh && owner);
  const [name, setName] = useState(crew.name);
  const [saving, setSaving] = useState(false);
  const who = nameOf(profiles);

  // Your own picks are your stars right now (what the crew gets a moment later).
  const myStars = useMemo(() => [...plan.mustSeesAt(crew.festivalId)], [plan, crew.festivalId]);
  const together = useMemo(() => {
    const all = [...picks.filter((p) => p.uid !== me), ...(me ? [{ uid: me, artists: myStars, updatedAt: '' }] : [])];
    return crewTogether(all, crew.members, festival?.lineup ?? []);
  }, [picks, me, myStars, crew.members, festival]);

  // Everyone's stars for the crew route (yours live from the phone).
  const stars = useMemo(() => {
    const all: Record<string, readonly string[]> = {};
    for (const p of picks) if (p.uid !== me) all[p.uid] = p.artists;
    if (me) all[me] = myStars;
    return all;
  }, [picks, me, myStars]);
  const { forYou } = useWeekends();

  const problem = crewNameProblem(name);
  const saveName = async () => {
    if (problem) return;
    setSaving(true);
    try {
      onChange(await crews.rename(crew.id, name));
      haptic.settle();
      setEditing(false);
    } catch (e) {
      showAlert('Couldn’t rename the crew', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setSaving(false);
    }
  };

  const invite = () => {
    haptic.select();
    router.push({ pathname: '/crew-invite/[id]', params: { id: crew.id } });
  };

  const leave = () => {
    haptic.select();
    const last = crew.members.length === 1;
    showAlert(
      last ? 'End this crew?' : 'Leave this crew?',
      last ? 'You’re the only one in it, so it ends when you leave.' : 'Your picks are taken out of the crew. You can join again with the invite link.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: last ? 'End crew' : 'Leave',
          style: 'destructive',
          onPress: () => {
            crews
              .leave(crew.id)
              .then(() => (router.canGoBack() ? router.back() : router.replace('/')))
              .catch((e) => showAlert('Couldn’t leave', SOCIAL_ERROR_COPY[socialErrorKind(e)]));
          },
        },
      ],
    );
  };

  const remove = (uid: string) => {
    haptic.select();
    const n = profiles[uid]?.displayName ?? 'them';
    showAlert(`Remove ${n}?`, 'Their picks are taken out of the crew. They can only come back with the invite link.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          crews
            .remove(crew.id, uid)
            .then(onChange)
            .catch((e) => showAlert('Couldn’t remove them', SOCIAL_ERROR_COPY[socialErrorKind(e)]));
        },
      },
    ]);
  };

  const others = crew.members.filter((m) => m !== me);
  const artist = (aid: string) => catalog.artist(aid);

  return (
    <>
      {festival ? (
        <Pressable
          onPress={() => router.push({ pathname: '/festival/[id]', params: { id: festival.id } })}
          accessibilityRole="link"
          accessibilityLabel={`${festival.name}. Open the festival.`}
          style={styles.festivalLink}
        >
          <Text style={styles.kicker}>{festival.name}</Text>
          <ChevronIcon color={color.glow} size={10} />
        </Pressable>
      ) : null}
      {editing ? (
        <View style={{ gap: space.sm }}>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={CREW_NAME_MAX + 10}
            placeholder="Crew name"
            placeholderTextColor={color.moonFaint}
            accessibilityLabel="Crew name"
            returnKeyType="done"
            onSubmitEditing={() => void saveName()}
            style={styles.input}
          />
          {problem && name.trim() ? <Text style={styles.note}>{problem}</Text> : null}
          <View style={styles.editRow}>
            <Pressable
              onPress={() => {
                setName(crew.name);
                setEditing(false);
              }}
              accessibilityRole="button"
              style={styles.quietButton}
            >
              <Text style={styles.quietText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => void saveName()} disabled={!!problem || saving} accessibilityRole="button" accessibilityLabel="Save name" style={[styles.smallPrimary, (!!problem || saving) && styles.dim]}>
              <Text style={styles.primaryText}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          disabled={!owner}
          onPress={() => setEditing(true)}
          accessibilityRole={owner ? 'button' : 'header'}
          accessibilityLabel={owner ? `${crew.name}. Rename the crew.` : crew.name}
        >
          <Text style={styles.title}>{crew.name}</Text>
          {owner ? <Text style={styles.link}>Rename</Text> : null}
        </Pressable>
      )}
      {festival ? <Text style={styles.meta}>{whereWhen(festival)}</Text> : null}

      <Pressable onPress={invite} accessibilityRole="button" accessibilityLabel="Invite friends" style={({ pressed }) => [styles.primary, styles.inviteRow, pressed && styles.pressed]}>
        <ShareIcon color={color.moon} size={16} />
        <Text style={styles.primaryText}>Invite friends</Text>
      </Pressable>
      {!others.length ? <Text style={styles.note}>Send the invite to your friends. Anyone with the link can join, up to {CREW_MAX} people.</Text> : null}

      {/* Where everyone last was, while the festival is on or coming up. */}
      <CrewLatest crew={crew} nameOf={who} />
      <MeetSpotCard crew={crew} />

      <Text style={styles.section}>Sets you share</Text>
      {together.shared.length ? (
        together.shared.map((s) => {
          const a = artist(s.artistId);
          return a ? <ArtistRow key={s.artistId} artist={a} affinity={taste[a.id] ?? 0} detail={whoLine(s.who, crew.members.length, me, who)} festivalId={crew.festivalId} /> : null;
        })
      ) : (
        <Text style={styles.quiet}>
          {others.length ? 'When two of you star the same set, it shows up here.' : 'Once friends join, the sets you both starred show up here.'}
        </Text>
      )}

      {/* Once set times are out: one route for the crew, with who splits off where. */}
      {festival?.sets?.length && me && others.length ? (
        <CrewRouteSection festival={forYou(festival)} me={me} members={crew.members} stars={stars} nameOf={who} crewName={crew.name} />
      ) : null}

      <Text style={styles.section}>Everyone’s picks</Text>
      {[...(me ? [me] : []), ...others].map((uid) => {
        const list = together.byMember[uid] ?? [];
        const mine = uid === me;
        return (
          <View key={uid} style={styles.memberCard}>
            <View style={styles.memberHead}>
              <Face profile={profiles[uid]} first size={28} />
              <Text style={styles.memberName} numberOfLines={1}>
                {mine ? 'You' : (profiles[uid]?.displayName ?? 'Someone')}
                {uid === crew.owner ? <Text style={styles.ownerTag}>  · started the crew</Text> : null}
              </Text>
              {owner && !mine ? (
                <Pressable onPress={() => remove(uid)} accessibilityRole="button" accessibilityLabel={`Remove ${profiles[uid]?.displayName ?? 'them'} from the crew`} hitSlop={8}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            {list.length ? (
              <Text style={styles.picks}>{list.map((aid) => artist(aid)?.name ?? aid).join(' · ')}</Text>
            ) : (
              <Text style={styles.quiet}>{mine ? 'Star sets on the festival page to share them with your crew.' : 'No starred sets yet.'}</Text>
            )}
          </View>
        );
      })}
      {mineNote(festival?.name)}

      <Pressable onPress={leave} accessibilityRole="button" style={styles.leave}>
        <Text style={styles.danger}>{crew.members.length === 1 ? 'End this crew' : 'Leave this crew'}</Text>
      </Pressable>
    </>
  );
}

const mineNote = (festivalName?: string) => (
  <Text style={styles.note}>Your crew sees the sets you star{festivalName ? ` at ${festivalName}` : ''}. Nothing else about your taste is shared.</Text>
);

const styles = StyleSheet.create({
  decline: { alignSelf: 'center', minHeight: 40, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  declineText: { ...type.label, color: color.moonDim },
  root: { flex: 1, backgroundColor: color.night },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  kicker: { ...type.label, color: color.glow, fontWeight: '600' },
  festivalLink: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start' },
  meta: { ...type.body, color: color.moonDim, marginTop: -space.xs },
  body: { ...type.body, color: color.moonDim },
  note: { ...type.caption, color: color.moonFaint },
  quiet: { ...type.label, color: color.moonDim },
  link: { ...type.label, color: color.glow, marginTop: 2 },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.lg },
  facesRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.sm },
  facesLine: { ...type.label, color: color.moon, flex: 1 },
  face: { overflow: 'hidden', backgroundColor: color.haze, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: color.night },
  overlap: { marginLeft: -8 },
  initial: { ...type.caption, color: color.moon, fontWeight: '700' },
  input: {
    ...type.title,
    color: color.moon,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  editRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.md },
  quietButton: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  quietText: { ...type.headline, color: color.moonDim },
  smallPrimary: { paddingHorizontal: space.xl, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: 'rgba(169,124,255,0.3)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(169,124,255,0.6)' },
  primary: {
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(169,124,255,0.3)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.6)',
    marginTop: space.sm,
  },
  inviteRow: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  primaryText: { ...type.headline, color: color.moon },
  memberCard: { gap: space.sm, padding: space.lg, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  memberName: { ...type.headline, color: color.moon, flex: 1 },
  ownerTag: { ...type.caption, color: color.moonFaint, fontWeight: '400' },
  removeText: { ...type.label, color: color.moonDim },
  picks: { ...type.label, color: color.moon, lineHeight: 20 },
  leave: { alignSelf: 'center', marginTop: space.xl, padding: space.sm },
  danger: { ...type.label, color: color.stage },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
