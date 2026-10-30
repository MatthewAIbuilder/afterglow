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
import { CrewCoverPhoto } from '../../features/crews/CrewCoverPhoto';
import { MeetSpotCard } from '../../features/crews/MeetSpotCard';
import { MeetupsCard } from '../../features/crews/MeetupsCard';
import { VoteCard } from '../../features/crews/VoteCard';
import { CrewMapCard } from '../../features/crews/CrewMapCard';
import { CrewListCard } from '../../features/crews/CrewListCard';
import { CrewMoments } from '../../features/crews/CrewMoments';
import { clashSlots, mergeStars, starsFromVotes, tallyLineup, wanted } from '../../features/crews/votes';
import { useCrewVotes } from '../../state/crewVotes';
import { CrewChatCard } from '../../features/crews/CrewChatCard';
import { CrewStayCard } from '../../features/crews/CrewStayCard';
import { CHAT_RULES } from '../../features/crews/chat';
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
import { color, radius, space, type, glowA, pageColumn } from '../../theme/tokens';
import { goBack } from '../../lib/nav';
import { LastUpdated } from '../../features/offline/LastUpdated';
import { CrewOrb } from '../../features/friends/CrewOrb';
import { t, tn } from '../../i18n';
import { useToday } from '../../lib/useToday';
import { countdown } from '../../features/festivals/when';
import { useEventLookup } from '../../features/festivalMode/useEvent';
import { eventPath } from '../../features/festivalMode/showEvent';
import { PageFeedback } from '../../components/PageFeedback';

/**
 * A festival crew. Someone who opens an invite sees the crew and who's in it,
 * and can join (their stars at that festival are then shared with the crew).
 * Members see the sets more than one of them starred, everyone's picks,
 * invite more friends, and can leave; the owner can rename the crew and
 * remove people.
 */
export default function CrewScreen() {
  const { id, fresh, code } = useLocalSearchParams<{ id: string; fresh?: string; code?: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const { page, reload, update } = useCrewPage(id);

  const body = (() => {
    switch (page.status) {
      case 'loading':
        return <ActivityIndicator color={color.glow} style={{ marginTop: space.xxl }} />;
      case 'signed-out':
        return (
          <Intro title={t('Plan a festival together')} line={t('A friend invited you to their festival crew. Sign in to see it and join.')}>
            <Primary label={t('Sign in')} onPress={() => router.push('/account')} />
          </Intro>
        );
      case 'missing':
        return <Intro title={t('This crew has ended')} line={t('Everyone left, or the link isn’t quite right. Ask your friend to send it again.')} />;
      case 'failed':
        return (
          <Intro title={t('Couldn’t open this crew')} line={SOCIAL_ERROR_COPY.network}>
            <Primary label={t('Try again')} onPress={() => void reload()} />
          </Intro>
        );
      case 'ready':
        return page.member ? (
          <Member crew={page.crew} profiles={page.profiles} picks={page.picks} fresh={fresh === '1'} onChange={update} readAt={page.readAt} kept={!!page.kept} />
        ) : (
          <Invite crew={page.crew} profiles={page.profiles} code={code} onJoined={() => void reload()} />
        );
    }
  })();

  return (
    <View style={styles.root}>
      <PageTitle title={t('Festival crew')} />
      <NightSky />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[pageColumn, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl, gap: space.md }]}
        >
          {social.availability.ok ? body : <Intro title={t('Festival crews')} line={SOCIAL_ERROR_COPY.unavailable} />}
          <PageFeedback />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label={t('Back')} onPress={() => (router.canGoBack() ? goBack() : router.replace('/'))}>
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

const nameOf = (profiles: Record<string, Profile>) => (uid: string) => (profiles[uid] ? firstName(profiles[uid].displayName) : t('Someone'));

/**
 * Someone opened a crew they're not in. Crews are invite only: with an invite
 * in the app, or an invite link's code, they see the crew, the chat rules
 * they agree to by joining, and Join. Without one, they're told to ask.
 */
function Invite({ crew, profiles, code, onJoined }: { crew: Crew; profiles: Record<string, Profile>; code?: string; onJoined: () => void }) {
  const social = useSocial();
  const { join, invites, inviters, declineInvite } = useCrews();
  const festival = useEventLookup()(crew.festivalId);
  const [busy, setBusy] = useState(false);
  // Invited in the app: say by whom, and offer No thanks.
  const invited = invites.find((i) => i.crewId === crew.id);
  const inviter = invited ? inviters[invited.from] : undefined;
  const full = crew.members.length >= CREW_MAX;
  const festivalName = festival?.name ?? t('this festival');
  const canJoin = !!invited || !!code;

  const press = async () => {
    haptic.select();
    if (!social.profile) {
      router.push('/profile-edit');
      return;
    }
    setBusy(true);
    try {
      await join(crew.id, invited ? undefined : code);
      haptic.settle();
      onJoined();
    } catch (e) {
      showAlert(t('Couldn’t join'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Text style={styles.kicker}>{invited ? t('{name} invited you · {festival}', { name: inviter ? firstName(inviter.displayName) : t('A friend'), festival: festivalName }) : festivalName}</Text>
      <Text style={styles.title} accessibilityRole="header">
        {crew.name}
      </Text>
      <Text style={styles.body}>{t('Plan {festival} together: see which sets you all want, everyone’s picks, and chat with the crew.', { festival: festivalName })}</Text>
      <Faces uids={crew.members} profiles={profiles} />
      {!canJoin ? (
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>{t('This crew is invite only')}</Text>
          <Text style={styles.note}>{t('Ask someone in it to invite you in the app, or to send you a new invite link.')}</Text>
        </View>
      ) : full ? (
        <Text style={styles.body}>{t('This crew is full ({n} people).', { n: CREW_MAX })}</Text>
      ) : (
        <>
          <View style={styles.rulesCard} accessible accessibilityLabel={`${t('By joining, you agree to the crew chat rules.')} ${CHAT_RULES.map((r) => t(r)).join(' ')}`}>
            <Text style={styles.rulesTitle}>{t('By joining, you agree to the crew chat rules')}</Text>
            {CHAT_RULES.map((r) => (
              <Text key={r} style={styles.rule}>
                · {t(r)}
              </Text>
            ))}
          </View>
          <Pressable onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'guidelines' } })} accessibilityRole="link" hitSlop={8}>
            <Text style={styles.link}>{t('Read the community guidelines')}</Text>
          </Pressable>
          <Primary label={social.profile ? t('Agree and join') : t('Create your profile to join')} onPress={() => void press()} busy={busy} />
          <Text style={styles.note}>{t('When you join, the sets you star at {festival} are shared with this crew. You can leave any time.', { festival: festivalName })}</Text>
          {invited ? (
            <Pressable
              onPress={() => {
                haptic.select();
                void declineInvite(crew.id);
                if (router.canGoBack()) goBack();
                else router.replace('/together');
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.decline, pressed && styles.pressed]}
            >
              <Text style={styles.declineText}>{t('No thanks')}</Text>
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
    <View style={styles.facesRow} accessible accessibilityLabel={t('In this crew: {names}', { names: names.join(', ') })}>
      <View style={{ flexDirection: 'row' }}>
        {uids.slice(0, 6).map((u, i) => (
          <Face key={u} profile={profiles[u]} first={i === 0} />
        ))}
      </View>
      <Text style={styles.facesLine} numberOfLines={2}>
        {names.length > 3 ? t('{names} and {n} more', { names: names.slice(0, 3).join(', '), n: names.length - 3 }) : names.join(', ')}
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
  readAt,
  kept,
}: {
  crew: Crew;
  profiles: Record<string, Profile>;
  picks: { uid: string; artists: string[]; updatedAt: string }[];
  fresh: boolean;
  onChange: (crew: Crew) => void;
  /** When the crew was read, and whether that's this phone's copy (no signal). */
  readAt: number;
  kept: boolean;
}) {
  const social = useSocial();
  const me = social.user?.uid;
  const crews = useCrews();
  const catalog = useCatalog();
  const eventOf = useEventLookup();
  const festival = eventOf(crew.festivalId);
  const plan = usePlan();
  const { taste } = useTaste();
  const owner = crew.owner === me;
  const [editing, setEditing] = useState(fresh && owner);
  const [name, setName] = useState(crew.name);
  const [saving, setSaving] = useState(false);
  // The person whose picks are open in the list of people.
  const [openUid, setOpenUid] = useState<string | undefined>();
  const today = useToday();
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
  // The crew's votes: Must sees count as stars, and a clash the crew settled is a star from everyone.
  const crewVotes = useCrewVotes(crew.id);
  const routeStars = useMemo(() => {
    if (!festival) return stars;
    const rows = tallyLineup(crewVotes.votes, crew.members, festival.lineup);
    const slots = festival.sets?.length ? clashSlots(festival, wanted(rows)) : [];
    return mergeStars(stars, starsFromVotes(crewVotes.votes, crew.members, slots));
  }, [stars, festival, crewVotes.votes, crew.members]);

  const problem = crewNameProblem(name);
  const saveName = async () => {
    if (problem) return;
    setSaving(true);
    try {
      onChange(await crews.rename(crew.id, name));
      haptic.settle();
      setEditing(false);
    } catch (e) {
      showAlert(t('Couldn’t rename the crew'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
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
      last ? t('End this crew?') : t('Leave this crew?'),
      last ? t('You’re the only one in it, so it ends when you leave.') : t('Your picks and messages are taken out of the crew. You’d need a new invite to join again.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: last ? t('End crew') : t('Leave'),
          style: 'destructive',
          onPress: () => {
            crews
              .leave(crew.id)
              .then(() => (router.canGoBack() ? goBack() : router.replace('/')))
              .catch((e) => showAlert(last ? t('Couldn’t end the crew') : t('Couldn’t leave'), SOCIAL_ERROR_COPY[socialErrorKind(e)]));
          },
        },
      ],
    );
  };

  // The owner can end the crew for everyone (leaving would hand it on instead).
  const endForAll = () => {
    haptic.select();
    showAlert(t('End this crew for everyone?'), t('The crew, its chat, everyone’s picks, updates and the meeting spot are removed for all of you. This can’t be undone.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('End crew'),
        style: 'destructive',
        onPress: () => {
          crews
            .end(crew.id)
            .then(() => (router.canGoBack() ? goBack() : router.replace('/')))
            .catch((e) => showAlert(t('Couldn’t end the crew'), SOCIAL_ERROR_COPY[socialErrorKind(e)]));
        },
      },
    ]);
  };

  const remove = (uid: string) => {
    haptic.select();
    const n = profiles[uid]?.displayName;
    showAlert(n ? t('Remove {name}?', { name: n }) : t('Remove them?'), t('Their picks and messages are taken out of the crew. They can only come back with a new invite.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Remove'),
        style: 'destructive',
        onPress: () => {
          crews
            .remove(crew.id, uid)
            .then(onChange)
            .catch((e) => showAlert(t('Couldn’t remove them'), SOCIAL_ERROR_COPY[socialErrorKind(e)]));
        },
      },
    ]);
  };

  const others = crew.members.filter((m) => m !== me);
  const artist = (aid: string) => catalog.artist(aid);

  return (
    <>
      <CrewCoverPhoto crew={crew} />
      {/* The crew at a glance: its picture, name, the festival and how soon, and the one thing you do most: invite. */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <CrewOrb
            name={crew.name}
            people={others.map((u) => profiles[u]).filter((x): x is Profile => !!x).map((x) => ({ name: x.displayName, url: x.avatarUrl }))}
            total={others.length}
            size={72}
          />
          <View style={styles.heroText}>
            {festival ? (
              <Pressable
                onPress={() => router.push(eventPath(festival))}
                accessibilityRole="link"
                accessibilityLabel={t('{festival}. Open the festival.', { festival: festival.name })}
                style={styles.festivalLink}
              >
                <Text style={styles.kicker} numberOfLines={1}>
                  {festival.name}
                </Text>
                <ChevronIcon color={color.glow} size={10} />
              </Pressable>
            ) : null}
            {editing ? (
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
                maxLength={CREW_NAME_MAX + 10}
                placeholder={t('Crew name')}
                placeholderTextColor={color.moonFaint}
                accessibilityLabel={t('Crew name')}
                returnKeyType="done"
                onSubmitEditing={() => void saveName()}
                style={styles.input}
              />
            ) : (
              <Pressable
                disabled={!owner}
                onPress={() => setEditing(true)}
                accessibilityRole={owner ? 'button' : 'header'}
                accessibilityLabel={owner ? t('{crew}. Rename the crew.', { crew: crew.name }) : crew.name}
              >
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {crew.name}
                </Text>
              </Pressable>
            )}
            {festival ? (
              <Text style={styles.meta} numberOfLines={2}>
                {whereWhen(festival)}
              </Text>
            ) : null}
            <Text style={styles.meta} numberOfLines={1}>
              {[festival ? countdown(festival, today) : undefined, tn(crew.members.length, '{n} person', '{n} people')].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        {editing ? (
          <View style={{ gap: space.sm }}>
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
                <Text style={styles.quietText}>{t('Cancel')}</Text>
              </Pressable>
              <Pressable onPress={() => void saveName()} disabled={!!problem || saving} accessibilityRole="button" accessibilityLabel={t('Save name')} style={[styles.smallPrimary, (!!problem || saving) && styles.dim]}>
                <Text style={styles.primaryText}>{t('Save')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.heroActions}>
            <Pressable onPress={invite} accessibilityRole="button" accessibilityLabel={t('Invite friends')} style={({ pressed }) => [styles.primary, styles.inviteRow, styles.heroInvite, pressed && styles.pressed]}>
              <ShareIcon color={color.moon} size={16} />
              <Text style={styles.primaryText}>{t('Invite friends')}</Text>
            </Pressable>
            {owner ? (
              <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel={t('Rename the crew')} style={({ pressed }) => [styles.heroSecondary, pressed && styles.pressed]}>
                <Text style={styles.quietText}>{t('Rename')}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        <LastUpdated at={readAt} live={!kept} />
      </View>
      {!others.length ? <Text style={styles.note}>{t('Crews are invite only. Invite friends in the app or send them the invite link, up to {n} people.', { n: CREW_MAX })}</Text> : null}

      <CrewChatCard crew={crew} nameOf={who} />

      {/* Where everyone is, while the festival is on or coming up. */}
      <CrewLatest crew={crew} nameOf={who} />
      <MeetSpotCard crew={crew} />
      <MeetupsCard crew={crew} nameOf={who} />
      {festival ? <CrewMapCard crew={crew} festival={festival} nameOf={who} /> : null}
      {others.length ? <CrewListCard crew={crew} nameOf={who} /> : null}

      {/* The countdown and the crew's warm-up before; the crew's festival looked back on after. */}
      {festival && others.length ? <CrewMoments crew={crew} festival={festival} stars={routeStars} shared={together.shared.length} /> : null}
      {festival && others.length ? <VoteCard crew={crew} votes={crewVotes.votes} lineup={festival.lineup} /> : null}

      <Text style={styles.section}>{t('Sets you share')}</Text>
      {together.shared.length ? (
        together.shared.map((s) => {
          const a = artist(s.artistId);
          return a ? <ArtistRow key={s.artistId} artist={a} affinity={taste[a.id] ?? 0} detail={whoLine(s.who, crew.members.length, me, who)} festivalId={crew.festivalId} /> : null;
        })
      ) : (
        <Text style={styles.quiet}>
          {others.length ? t('When two of you star the same set, it shows up here.') : t('Once friends join, the sets you both starred show up here.')}
        </Text>
      )}

      {/* Once set times are out: one route for the crew, with who splits off where. */}
      {festival?.sets?.length && me && others.length ? (
        <CrewRouteSection festival={forYou(festival)} me={me} members={crew.members} stars={routeStars} nameOf={who} crewName={crew.name} crew={crew} />
      ) : null}

      {/* Everyone in the crew: a row each, opening to show their starred sets. */}
      <Text style={styles.section}>{t('People')}</Text>
      <View style={styles.people}>
        {[...(me ? [me] : []), ...others].map((uid, i, all) => {
          const list = together.byMember[uid] ?? [];
          const mine = uid === me;
          const open = openUid === uid;
          const name = mine ? t('You') : (profiles[uid]?.displayName ?? t('Someone'));
          return (
            <View key={uid} style={[styles.person, i === all.length - 1 && styles.personLast]}>
              <Pressable
                onPress={() => {
                  haptic.select();
                  setOpenUid(open ? undefined : uid);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${name}${uid === crew.owner ? `, ${t('started the crew')}` : ''}, ${tn(list.length, '{n} pick', '{n} picks')}`}
                style={({ pressed }) => [styles.personHead, pressed && { opacity: 0.8 }]}
              >
                <Face profile={profiles[uid]} first size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {name}
                  </Text>
                  {uid === crew.owner ? <Text style={styles.ownerTag}>{t('started the crew')}</Text> : null}
                </View>
                <Text style={styles.pickCount}>{tn(list.length, '{n} pick', '{n} picks')}</Text>
                <ChevronIcon color={color.moonFaint} size={11} direction={open ? 'up' : 'down'} />
              </Pressable>
              {open ? (
                <View style={styles.personBody}>
                  {list.length ? (
                    <Text style={styles.picks}>{list.map((aid) => artist(aid)?.name ?? aid).join(' · ')}</Text>
                  ) : (
                    <Text style={styles.quiet}>{mine ? t('Star sets on the festival page to share them with your crew.') : t('No starred sets yet.')}</Text>
                  )}
                  {owner && !mine ? (
                    <Pressable onPress={() => remove(uid)} accessibilityRole="button" accessibilityLabel={profiles[uid]?.displayName ? t('Remove {name} from the crew', { name: profiles[uid].displayName }) : t('Remove them from the crew')} hitSlop={8}>
                      <Text style={styles.removeText}>{t('Remove from the crew')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {festival ? <CrewStayCard crew={crew} event={festival} /> : null}
      {mineNote(festival?.name)}

      <Pressable onPress={leave} accessibilityRole="button" style={styles.leave}>
        <Text style={styles.danger}>{crew.members.length === 1 ? t('End this crew') : t('Leave this crew')}</Text>
      </Pressable>
      {crew.owner === me && crew.members.length > 1 ? (
        <Pressable onPress={endForAll} accessibilityRole="button" accessibilityLabel={t('End this crew for everyone')} style={styles.endAll}>
          <Text style={styles.danger}>{t('End this crew for everyone')}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const mineNote = (festivalName?: string) => (
  <Text style={styles.note}>
    {festivalName
      ? t('Your crew sees the sets you star at {festival}. Nothing else about your taste is shared.', { festival: festivalName })
      : t('Your crew sees the sets you star. Nothing else about your taste is shared.')}
  </Text>
);

const styles = StyleSheet.create({
  rulesCard: { padding: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim, gap: 4 },
  rulesTitle: { ...type.label, color: color.moon, marginBottom: 2 },
  rule: { ...type.caption, color: color.moonDim, lineHeight: 17 },
  endAll: { alignSelf: 'center', paddingVertical: space.sm },
  decline: { alignSelf: 'center', minHeight: 40, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  declineText: { ...type.label, color: color.moonDim },
  root: { flex: 1, backgroundColor: color.night },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  kicker: { ...type.label, color: color.glow, fontWeight: '600' },
  hero: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  heroText: { flex: 1, minWidth: 0, gap: 2 },
  heroTitle: { ...type.title, fontSize: 24, lineHeight: 29, color: color.moon },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroInvite: { flex: 1, marginTop: 0 },
  heroSecondary: { paddingHorizontal: space.lg, paddingVertical: space.md },
  people: { borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim, overflow: 'hidden' },
  person: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  personLast: { borderBottomWidth: 0 },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  personBody: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  pickCount: { ...type.caption, color: color.moonDim },
  orb: { marginBottom: space.md },
  festivalLink: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start' },
  meta: { ...type.caption, color: color.moonDim },
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
    borderTopColor: color.rim,
  },
  editRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.md },
  quietButton: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  quietText: { ...type.headline, color: color.moonDim },
  smallPrimary: { paddingHorizontal: space.xl, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: glowA(0.3), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.6) },
  primary: {
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.3),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.6),
    marginTop: space.sm,
  },
  inviteRow: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  primaryText: { ...type.headline, color: color.moon },
  memberCard: { gap: space.sm, padding: space.lg, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
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
