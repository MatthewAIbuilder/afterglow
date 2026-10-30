import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { PageFeedback } from '../../components/PageFeedback';
import { PageTitle } from '../../components/PageTitle';
import { SOUND_LABEL, type Artist, type SoundTag } from '../../data/models';
import { stageName } from '../../data/festival';
import { clashLine, clashSlots, MAYBE, MUST, nextToVote, rowLine, SKIP, tallyClash, tallyLineup, type Vote, VOTE_LABEL, votedCount, wanted } from '../../features/crews/votes';
import { formatTime } from '../../features/festivals/format';
import { clockTime } from '../../features/plan/route';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useCrewVotes } from '../../state/crewVotes';
import { useCrews } from '../../state/crews';
import { usePlan } from '../../state/plan';
import { useSocial } from '../../state/social';
import { useTaste } from '../../state/taste';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { t, tn } from '../../i18n';

type Tab = 'vote' | 'results' | 'clashes';

/**
 * Vote on the lineup with your crew (`/crew-vote/<crew id>`). One act at a
 * time: Must see, Maybe or Skip, with crewmates' answers shown once you've
 * given yours. Results rank the lineup by the crew's total; once set times
 * are out, everyone picks a side in each clash. The crew's choices feed "Our
 * route"; your own plan changes only when you tap "Use the crew's picks".
 */
export default function CrewVoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const me = social.user?.uid;
  const { crews } = useCrews();
  const crew = crews.find((c) => c.id === id);
  const catalog = useCatalog();
  const festival = crew ? catalog.festival(crew.festivalId) : undefined;
  const { profileOf } = useCrewUpdates();
  const { votes, mine, vote, pick, waiting } = useCrewVotes(crew?.id);
  const [tab, setTab] = useState<Tab>('vote');
  const [later, setLater] = useState<Set<string>>(() => new Set());
  const members = useMemo(() => crew?.members ?? [], [crew]);
  const artistOf = catalog.artist;
  const lineup = useMemo(() => (festival?.lineup ?? []).filter((a) => !!artistOf(a)), [festival, artistOf]);
  const rows = useMemo(() => tallyLineup(votes, members, lineup), [votes, members, lineup]);
  const slots = useMemo(() => (festival?.sets?.length ? clashSlots(festival, wanted(rows)) : []), [festival, rows]);
  const nameOf = (uid: string) => (uid === me ? t('You') : (profileOf(uid)?.displayName ?? t('Someone')));

  if (!crew || !festival) {
    return (
      <View style={styles.root}>
        <PageTitle title={t('Vote on the lineup')} />
        <NightSky />
        <PageActions />
        <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
          <Text style={styles.title}>{t('Vote on the lineup')}</Text>
          <Text style={styles.sub}>{t('This crew isn’t on this phone. Open it from your crews.')}</Text>
        </View>
      </View>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'vote', label: t('Vote') },
    { key: 'results', label: t('Results') },
    ...(festival.sets?.length ? [{ key: 'clashes' as const, label: tn(slots.length, '{n} clash', '{n} clashes') }] : []),
  ];

  return (
    <View style={styles.root}>
      <PageTitle title={t('Vote on the lineup · {crew}', { crew: crew.name })} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>{crew.name}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {t('Vote on the lineup')}
        </Text>
        <Text style={styles.sub}>{festival.name}</Text>

        {/* Who's voted how far. */}
        <View style={styles.people}>
          {members.map((uid) => {
            const v = votes.find((x) => x.uid === uid);
            const n = votedCount(v, lineup);
            return (
              <View key={uid} style={styles.person} accessible accessibilityLabel={t('{name}: {n} of {m} voted', { name: nameOf(uid), n, m: lineup.length })}>
                <Text style={styles.personName} numberOfLines={1}>
                  {nameOf(uid)}
                </Text>
                <View style={styles.personTrack}>
                  <View style={[styles.personFill, { width: `${lineup.length ? Math.round((n / lineup.length) * 100) : 0}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
        {waiting ? <Text style={styles.waiting}>{t('Your votes go to the crew once there’s signal.')}</Text> : null}

        <View style={styles.tabs} accessibilityRole="tablist">
          {tabs.map((x) => (
            <Pressable
              key={x.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === x.key }}
              onPress={() => {
                if (tab === x.key) return;
                haptic.select();
                setTab(x.key);
              }}
              style={[styles.tab, tab === x.key && styles.tabOn]}
            >
              <Text style={[styles.tabText, tab === x.key && { color: color.moon }]}>{x.label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'vote' ? (
          <VoteRound
            lineup={lineup}
            next={nextToVote(mine, lineup, later)}
            mine={mine?.lineup ?? {}}
            votes={votes.filter((v) => v.uid !== me)}
            nameOf={nameOf}
            onVote={(artistId, v) => vote(artistId, v)}
            onLater={(artistId) => setLater((s) => new Set([...s, artistId]))}
            onResults={() => setTab('results')}
            festivalId={festival.id}
          />
        ) : tab === 'results' ? (
          <Results rows={rows} members={members.length} mine={mine?.lineup ?? {}} nameOf={nameOf} onVote={(artistId, v) => vote(artistId, v)} />
        ) : (
          <Clashes
            slots={slots}
            votes={votes}
            members={members}
            mine={mine?.clashes ?? {}}
            nameOf={nameOf}
            stageOf={(stageId) => stageName(festival, stageId)}
            onPick={(key, artistId) => pick(key, artistId)}
            festivalId={festival.id}
          />
        )}
        <PageFeedback />
      </ScrollView>
    </View>
  );
}

const soundsOf = (a: Artist) =>
  (Object.entries(a.sound) as [SoundTag, number][])
    .sort((x, y) => y[1] - x[1])
    .slice(0, 2)
    .map(([s]) => SOUND_LABEL[s])
    .join(' · ');

function VoteRound({
  lineup,
  next,
  mine,
  votes,
  nameOf,
  onVote,
  onLater,
  onResults,
  festivalId,
}: {
  lineup: string[];
  next?: string;
  mine: Record<string, Vote>;
  votes: { uid: string; lineup: Record<string, Vote> }[];
  nameOf: (uid: string) => string;
  onVote: (artistId: string, v: Vote) => void;
  onLater: (artistId: string) => void;
  onResults: () => void;
  festivalId: string;
}) {
  const { artist: artistOf } = useCatalog();
  const { taste, informed } = useTaste();
  const reduceMotion = useReducedMotion();
  const done = lineup.filter((id) => id in mine).length;
  const a = next ? artistOf(next) : undefined;
  const [last, setLast] = useState<string | undefined>();
  const lastArtist = last ? artistOf(last) : undefined;

  if (!a) {
    return (
      <View style={styles.doneCard}>
        <Text style={styles.doneTitle}>{done >= lineup.length ? t('You’ve voted on the whole lineup') : t('That’s everything for now')}</Text>
        <Text style={styles.sub}>{t('See how the crew ranks it, and change any answer there.')}</Text>
        <Pressable onPress={onResults} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && { opacity: 0.8 }]}>
          <Text style={styles.primaryText}>{t('See the results')}</Text>
        </Pressable>
      </View>
    );
  }
  const known = !!informed[a.id];
  const others = votes.filter((v) => a.id in v.lineup).length;
  const choose = (v: Vote) => {
    if (v === MUST) haptic.heavy();
    else haptic.tap();
    setLast(a.id);
    onVote(a.id, v);
  };
  return (
    <View style={styles.round}>
      <Text style={styles.progress}>{t('{n} of {m}', { n: done + 1, m: lineup.length })}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round((done / Math.max(1, lineup.length)) * 100)}%` }]} />
      </View>
      <Animated.View key={a.id} entering={reduceMotion ? undefined : FadeIn.duration(220)} exiting={reduceMotion ? undefined : FadeOut.duration(120)} style={styles.card}>
        <LinearGradient colors={[glowA(0.22), glowA(0)]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <ArtistAvatar artist={a} size={148} />
        <Text style={styles.name} numberOfLines={2}>
          {a.name}
        </Text>
        <Text style={styles.meta}>{[known ? t('{n}% match', { n: Math.round((taste[a.id] ?? 0) * 100) }) : t('New to you'), soundsOf(a)].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.metaQuiet}>{others ? tn(others, '{n} crewmate has voted', '{n} crewmates have voted') : t('Nobody’s voted on them yet')}</Text>
        <Pressable
          onPress={() => {
            haptic.select();
            router.push({ pathname: '/artist/[id]', params: { id: a.id, festival: festivalId } });
          }}
          accessibilityRole="link"
          accessibilityLabel={t('Listen to {artist}', { artist: a.name })}
          hitSlop={8}
        >
          <Text style={styles.link}>{t('Listen first')}</Text>
        </Pressable>
      </Animated.View>
      <View style={styles.choices}>
        {([MUST, MAYBE, SKIP] as Vote[]).map((v) => (
          <Pressable
            key={v}
            onPress={() => choose(v)}
            accessibilityRole="button"
            accessibilityLabel={t('{vote}: {artist}', { vote: VOTE_LABEL[v], artist: a.name })}
            style={({ pressed }) => [styles.choice, v === MUST && styles.must, v === SKIP && styles.skip, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
          >
            <Text style={[styles.choiceText, v === MUST && { color: color.night }]}>{VOTE_LABEL[v]}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => onLater(a.id)} accessibilityRole="button" accessibilityLabel={t('Not sure about {artist} yet', { artist: a.name })} hitSlop={8} style={styles.later}>
        <Text style={styles.laterText}>{t('Not sure yet')}</Text>
      </Pressable>
      {/* What the crew said about the act you just answered. */}
      {lastArtist && last !== a.id ? <LastAnswer artist={lastArtist} votes={votes} nameOf={nameOf} mine={mine[lastArtist.id]} /> : null}
    </View>
  );
}

function LastAnswer({ artist, votes, nameOf, mine }: { artist: Artist; votes: { uid: string; lineup: Record<string, Vote> }[]; nameOf: (uid: string) => string; mine?: Vote }) {
  const said = votes.filter((v) => artist.id in v.lineup);
  const line = said.length ? said.map((v) => `${nameOf(v.uid)}: ${VOTE_LABEL[v.lineup[artist.id]].toLowerCase()}`).join(' · ') : t('You’re the first to vote');
  return (
    <View style={styles.lastCard} accessible accessibilityLabel={`${artist.name}. ${mine !== undefined ? `${t('You')}: ${VOTE_LABEL[mine]}. ` : ''}${line}`}>
      <ArtistAvatar artist={artist} size={28} />
      <Text style={styles.lastText} numberOfLines={2}>
        {line}
      </Text>
    </View>
  );
}

function Results({ rows, members, mine, nameOf, onVote }: { rows: ReturnType<typeof tallyLineup>; members: number; mine: Record<string, Vote>; nameOf: (uid: string) => string; onVote: (artistId: string, v: Vote) => void }) {
  const { artist: artistOf } = useCatalog();
  if (!rows.length) return <Text style={styles.sub}>{t('No votes yet. Start with the Vote tab.')}</Text>;
  return (
    <View style={styles.results}>
      {rows.map((r, i) => {
        const a = artistOf(r.artistId);
        if (!a) return null;
        const share = r.score / Math.max(1, members * 2);
        return (
          <View key={r.artistId} style={[styles.row, r.everyone && styles.rowAll]}>
            <View style={styles.rowTop} accessible accessibilityLabel={`${t('Number {rank}', { rank: i + 1 })}, ${a.name}${r.everyone ? `, ${t('everyone’s in')}` : ''}. ${rowLine(r, nameOf)}`}>
              <Text style={styles.rank}>{String(i + 1).padStart(2, '0')}</Text>
              <ArtistAvatar artist={a} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {a.name}
                </Text>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${Math.round(share * 100)}%` }]} />
                </View>
                <Text style={styles.rowWho} numberOfLines={2}>
                  {r.everyone ? `${t('Everyone’s in')} · ` : ''}
                  {rowLine(r, nameOf)}
                </Text>
              </View>
            </View>
            <View style={styles.mini}>
              {([MUST, MAYBE, SKIP] as Vote[]).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => {
                    haptic.select();
                    onVote(r.artistId, v);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mine[r.artistId] === v }}
                  accessibilityLabel={t('{vote}: {artist}', { vote: VOTE_LABEL[v], artist: a.name })}
                  style={[styles.miniChip, mine[r.artistId] === v && styles.miniOn]}
                >
                  <Text style={[styles.miniText, mine[r.artistId] === v && { color: color.moon }]}>{VOTE_LABEL[v]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Clashes({
  slots,
  votes,
  members,
  mine,
  nameOf,
  stageOf,
  onPick,
  festivalId,
}: {
  slots: ReturnType<typeof clashSlots>;
  votes: Parameters<typeof tallyClash>[1];
  members: readonly string[];
  mine: Record<string, string>;
  nameOf: (uid: string) => string;
  stageOf: (stageId: string) => string;
  onPick: (key: string, artistId: string) => void;
  festivalId: string;
}) {
  const { artist: artistOf } = useCatalog();
  const { goWith } = usePlan();
  if (!slots.length) return <Text style={styles.sub}>{t('No clashes between the acts your crew wants. Nice.')}</Text>;
  const results = slots.map((s) => ({ slot: s, result: tallyClash(s, votes, members) }));
  const decided = results.filter((r) => r.result.winner);
  const artistName = (id: string) => artistOf(id)?.name ?? id;
  const useCrew = () => {
    haptic.select();
    showAlert(t('Use the crew’s picks in your plan?'), tn(decided.length, 'Your plan goes with the crew in {n} clash. Change it any time.', 'Your plan goes with the crew in {n} clashes. Change it any time.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Use them'),
        onPress: () => {
          for (const { slot, result } of decided) goWith(festivalId, result.winner!, slot.sets.map((s) => s.artistId).filter((x) => x !== result.winner));
          haptic.settle();
        },
      },
    ]);
  };
  return (
    <View style={styles.results}>
      {results.map(({ slot, result }) => {
        const sides = slot.sets.filter((s, i, all) => all.findIndex((x) => x.artistId === s.artistId) === i);
        return (
          <View key={slot.key} style={styles.clash}>
            <Text style={styles.clashHead}>
              {t('{day}, {from} to {to}', { day: t(slot.day), from: formatTime(clockTime(slot.start)), to: formatTime(clockTime(slot.end)) })}
            </Text>
            <View style={styles.sides}>
              {sides.map((s) => {
                const a = artistOf(s.artistId);
                if (!a) return null;
                const who = result.counts[s.artistId] ?? [];
                const on = mine[slot.key] === s.artistId;
                const won = result.winner === s.artistId;
                return (
                  <Pressable
                    key={s.artistId}
                    onPress={() => {
                      haptic.tap();
                      onPick(slot.key, s.artistId);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${t('Pick {artist}', { artist: a.name })}, ${formatTime(s.set.start)}, ${stageOf(s.set.stageId)}. ${who.length ? who.map(nameOf).join(', ') : t('Nobody yet')}`}
                    style={({ pressed }) => [styles.side, on && styles.sideOn, won && styles.sideWon, pressed && { opacity: 0.8 }]}
                  >
                    <ArtistAvatar artist={a} size={52} />
                    <Text style={styles.sideName} numberOfLines={2}>
                      {a.name}
                    </Text>
                    <Text style={styles.sideMeta} numberOfLines={1}>
                      {formatTime(s.set.start)} · {stageOf(s.set.stageId)}
                    </Text>
                    <Text style={[styles.sideCount, won && { color: color.glow }]}>{tn(who.length, '{n} vote', '{n} votes')}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.clashLine}>{clashLine(slot, result, artistName, members.length)}</Text>
          </View>
        );
      })}
      {decided.length ? (
        <Pressable onPress={useCrew} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && { opacity: 0.8 }]}>
          <Text style={styles.primaryText}>{t('Use the crew’s picks in my plan')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640, gap: space.md },
  kicker: { ...type.label, color: color.glow },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  person: { width: 96, gap: 4 },
  personName: { ...type.caption, color: color.moon },
  personTrack: { height: 4, borderRadius: 2, backgroundColor: color.hairline, overflow: 'hidden' },
  personFill: { height: '100%', backgroundColor: color.glow },
  waiting: { ...type.caption, color: color.glow },
  tabs: { flexDirection: 'row', alignSelf: 'flex-start', padding: 3, borderRadius: radius.pill, backgroundColor: color.glass, marginTop: space.md },
  tab: { paddingHorizontal: space.lg, paddingVertical: 6, borderRadius: radius.pill },
  tabOn: { backgroundColor: glowA(0.22) },
  tabText: { ...type.label, color: color.moonDim },
  round: { gap: space.md, marginTop: space.sm },
  progress: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: color.hairline, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: color.glow },
  card: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.35),
    borderTopColor: color.rim,
  },
  name: { ...type.title, color: color.moon, textAlign: 'center', marginTop: space.sm },
  meta: { ...type.body, color: color.moonDim, textAlign: 'center' },
  metaQuiet: { ...type.caption, color: color.moonFaint },
  link: { ...type.label, color: color.glow, marginTop: space.xs },
  choices: { flexDirection: 'row', gap: space.sm },
  choice: { flex: 1, alignItems: 'center', paddingVertical: space.lg, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  must: { backgroundColor: color.glow, borderColor: color.glow },
  skip: { backgroundColor: 'transparent' },
  choiceText: { ...type.headline, color: color.moon },
  later: { alignSelf: 'center', paddingVertical: space.xs },
  laterText: { ...type.label, color: color.moonDim },
  lastCard: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: glowA(0.08) },
  lastText: { ...type.caption, color: color.moonDim, flex: 1 },
  doneCard: { gap: space.md, padding: space.xl, borderRadius: radius.lg, backgroundColor: glowA(0.1), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4), marginTop: space.sm },
  doneTitle: { ...type.title, color: color.moon },
  primary: { alignSelf: 'flex-start', paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glow, marginTop: space.sm },
  primaryText: { ...type.label, color: color.night },
  results: { gap: space.md, marginTop: space.sm },
  row: { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  rowAll: { borderColor: glowA(0.55), backgroundColor: glowA(0.12) },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rank: { ...type.caption, color: color.moonFaint, width: 22, fontVariant: ['tabular-nums'] },
  rowName: { ...type.label, color: color.moon },
  bar: { height: 4, borderRadius: 2, backgroundColor: color.hairline, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', backgroundColor: color.glow },
  rowWho: { ...type.caption, color: color.moonDim, marginTop: 4 },
  mini: { flexDirection: 'row', gap: space.xs, marginLeft: 22 + 36 + space.md * 2 },
  miniChip: { paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  miniOn: { backgroundColor: glowA(0.22), borderColor: glowA(0.55) },
  miniText: { ...type.caption, color: color.moonDim },
  clash: { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.35) },
  clashHead: { ...type.label, color: color.glow },
  sides: { flexDirection: 'row', gap: space.sm },
  side: { flex: 1, alignItems: 'center', gap: 4, padding: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  sideOn: { borderColor: color.glow, borderWidth: 1.5 },
  sideWon: { backgroundColor: glowA(0.12) },
  sideName: { ...type.label, color: color.moon, textAlign: 'center' },
  sideMeta: { ...type.caption, color: color.moonDim },
  sideCount: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  clashLine: { ...type.caption, color: color.moon },
});
