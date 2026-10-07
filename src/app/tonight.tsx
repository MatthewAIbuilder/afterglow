import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistRow } from '../components/ArtistRow';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { NightSky } from '../components/NightSky';
import { PageTitle } from '../components/PageTitle';
import { CloseIcon } from '../components/TabIcons';
import type { Festival } from '../data/models';
import { CameraIcon } from '../features/camera/icons';
import { CareCard } from '../features/care/CareCard';
import { SideQuestsCard } from '../features/quests/SideQuestsCard';
import { FestivalModeCard } from '../features/festivalMode/FestivalModeCard';
import { CrewLatest } from '../features/crews/CrewLatest';
import { CheckInPanel } from '../features/crews/CheckInPanel';
import { CrewHelpAlerts } from '../features/crews/CrewHelpAlerts';
import { MeetSpotCard } from '../features/crews/MeetSpotCard';
import { CrewWhereCard } from '../features/crews/CrewWhereCard';
import { picksByDay } from '../features/plan/byDay';
import { LiveNow } from '../features/plan/LiveNow';
import { LiveCrowdRow } from '../features/festivals/LiveCrowdRow';
import { useFestivalPlan } from '../features/plan/useFestivalPlan';
import { TONIGHT } from '../features/discover/focus';
import { tonightClips, tonightTitle } from '../features/tonight/tonight';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { useWeekends } from '../state/weekends';
import { useToday } from '../lib/useToday';
import { bySoonest, isOver } from '../features/festivals/shelves';
import { countdown } from '../features/festivals/when';
import { useTonight } from '../features/tonight/useTonight';
import { Sprout } from '../features/sprouts/Sprout';
import { haptic } from '../lib/haptics';
import { useCrews } from '../state/crews';
import { useCrewUpdates } from '../state/crewUpdates';
import { useSocial } from '../state/social';
import { color, radius, space, type, glowA } from '../theme/tokens';
import { goBack } from '../lib/nav';
import { dayWord, t } from '../i18n';
import { datesLine } from '../features/festivals/format';
import { eventPath, isShowEvent, upcomingShowEvents } from '../features/festivalMode/showEvent';
import { useGoingShows } from '../state/goingShows';

/** Picks shown for tonight before set times are out. */
const TONIGHT_PICKS = 6;

/**
 * Festival-day mode: everything for right now in one place. Where your plan
 * says to be and what's next, your crew's latest, looking after yourself, and
 * quick ways to film or check in. Everything but the crew works with no
 * signal: the plan, lineup and route are on the phone.
 */
export default function TonightScreen() {
  const insets = useSafeAreaInsets();
  const tonight = useTonight();

  return (
    <View style={styles.root}>
      <PageTitle title={t('Tonight')} />
      <NightSky />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxxl }]}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{t('Tonight')}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {tonight ? tonightTitle(tonight) : t('Nothing on tonight')}
            </Text>
          </View>
          <GlassCircleButton label={t('Close')} onPress={() => goBack()}>
            <CloseIcon color={color.moon} size={18} />
          </GlassCircleButton>
        </View>
        {tonight ? (
          <TonightBody festival={tonight.festival} night={tonight.night} />
        ) : (
          <NextUp />
        )}
      </ScrollView>
    </View>
  );
}

/** Between festivals: the next one you're going to and how long until it, or a way to find one. */
function NextUp() {
  const { festivals, festival, shows: catalogShows } = useCatalog();
  const { going } = useGoing();
  const { forYou } = useWeekends();
  const today = useToday();
  const { shows } = useGoingShows();
  const nextFestival = bySoonest(
    going.map(festival).filter((f): f is Festival => !!f && !isOver(f, today)),
    today,
  )[0];
  // A one-night show you're going to counts too, when it comes first.
  const nextShow = upcomingShowEvents(shows, catalogShows, today)[0];
  const next = nextShow && (!nextFestival?.startDate || nextShow.startDate! < nextFestival.startDate) ? nextShow : nextFestival;
  const f = next ? (isShowEvent(next) ? next : forYou(next)) : undefined;
  const soon = f ? countdown(f, today) : undefined;
  return (
    <>
      <Text style={styles.quiet}>{t('Tonight opens here while a festival or show you’re going to is on: where to be, what’s next, your crew and looking after yourself, all in one place.')}</Text>
      {f ? (
        <Pressable
          onPress={() => {
            haptic.select();
            router.push(eventPath(f));
          }}
          accessibilityRole="button"
          accessibilityLabel={
            isShowEvent(f)
              ? t('Your next show: {show}, {when}. Open', { show: f.name, when: soon ?? datesLine(f) })
              : soon
                ? t('Your next festival: {festival}, {when}. Open', { festival: f.name, when: soon })
                : t('Your next festival: {festival}. Open', { festival: f.name })
          }
          style={({ pressed }) => [styles.next, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.nextKicker}>{isShowEvent(f) ? t('Your next show') : t('Your next festival')}</Text>
          <Text style={styles.nextName}>{f.name}</Text>
          <Text style={styles.nextWhen}>{[soon, datesLine(f)].filter(Boolean).join(' · ')}</Text>
        </Pressable>
      ) : festivals.length ? (
        <Pressable
          onPress={() => {
            haptic.select();
            router.navigate('/festivals');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('Find a festival to go to')}
          style={({ pressed }) => [styles.next, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.nextName}>{t('Find a festival')}</Text>
          <Text style={styles.nextWhen}>{t('Tap I’m going on one and its nights open here.')}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

function TonightBody({ festival, night }: { festival: Festival; night?: string }) {
  const { picks, schedule, route } = useFestivalPlan(festival);
  // A one-night show: its bill, no set times or route.
  const show = isShowEvent(festival);
  const social = useSocial();
  const { crewsAt } = useCrews();
  const { ready } = useCrewUpdates();
  const crews = social.user ? crewsAt(festival.id) : [];
  // Sets to preview in Discover: the lineup's clips of tonight's artists.
  const catalog = useCatalog();
  const previewable = tonightClips(festival, catalog.clips, night).length > 0;
  // Before set times: tonight's picks from the lineup's days (or your top picks when days aren't known).
  const tonightPicks = show
    ? picks.slice(0, TONIGHT_PICKS)
    : schedule
    ? []
    : ((night ? picksByDay(festival, picks).days.find((d) => d.day === night)?.planned : undefined) ??
        picks.filter((p) => p.tier !== 'explore')
      ).slice(0, TONIGHT_PICKS);

  return (
    <>
      <FestivalModeCard festival={festival} />
      <LiveCrowdRow festival={festival} inset={0} />

      <Section title={show ? t('On the bill') : schedule ? t('Your route') : night ? t('Your picks for {night}', { night: dayWord(night) }) : t('Your picks')}>
        {schedule ? (
          <LiveNow festival={festival} schedule={schedule} route={route} />
        ) : tonightPicks.length ? (
          tonightPicks.map((p) => <ArtistRow key={p.artist.id} artist={p.artist} affinity={p.match} festivalId={show ? undefined : festival.id} detail={p.pinned ? t('Must see') : undefined} />)
        ) : (
          <Text style={styles.quiet}>{show ? t('Nobody on the bill is on Afterglow yet.') : t('No picks yet. Rate the lineup to fill your night.')}</Text>
        )}
        <Pressable
          onPress={() => {
            haptic.select();
            router.push(eventPath(festival));
          }}
          accessibilityRole="button"
          accessibilityLabel={show ? t('{show}: the show page', { show: festival.name }) : t('Your whole plan for {festival}', { festival: festival.name })}
          hitSlop={8}
        >
          <Text style={styles.link}>{show ? t('The show ›') : t('Your whole plan ›')}</Text>
        </Pressable>
      </Section>

      {social.availability.ok ? (
        <Section title={t('Your crew')}>
          {crews.length ? (
            <>
              <CrewHelpAlerts festivalId={festival.id} />
              {ready ? <CheckInPanel festivalId={festival.id} /> : null}
              <CrewWhereCard festival={festival} crews={crews} />
              {crews.map((c) => (
                <MeetSpotCard key={`meet-${c.id}`} crew={c} compact={crews.length > 1} />
              ))}
              {crews.map((c) => (
                <CrewLatest key={c.id} crew={c} nameOf={() => undefined} />
              ))}
            </>
          ) : (
            <Pressable
              onPress={() => {
                haptic.select();
                router.push(social.profile ? '/start-crew' : '/friends');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Start a crew to see where your friends are')}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.cardTitle}>{t('See where your friends are')}</Text>
              <Text style={styles.cardBody}>{t('Start a crew and everyone’s videos and check-ins show up here, with when they happened.')}</Text>
            </Pressable>
          )}
        </Section>
      ) : null}

      <Section title={t('Tonight’s side quests')}>
        <SideQuestsCard />
      </Section>

      <Section title={t('Look after yourself')}>
        <CareCard />
      </Section>

      <View style={styles.actions}>
        {Platform.OS !== 'web' ? (
          <Action label={t('Film')} a11y={t('Film a video')} onPress={() => router.push('/camera')} icon={<CameraIcon color={color.moon} size={20} />} />
        ) : null}
        {ready && crews.length ? <Action label={t('Check in')} a11y={t('Check in with your crew')} onPress={() => router.push('/check-in')} /> : null}
        {ready ? (
          <Action label={t('Sprout')} a11y={t('Give someone a sprout')} onPress={() => router.push('/give-sprout')} icon={<Sprout kind="seedling" stage={2} size={26} still />} />
        ) : null}
        {previewable ? (
          <Action
            label={t('Preview')}
            a11y={t("Preview tonight's sets in Discover, in set order")}
            onPress={() => router.dismissTo({ pathname: '/', params: { festival: TONIGHT } })}
          />
        ) : null}
        <Action label={show ? t('The show') : t('Lineup')} a11y={show ? t('{show}: the show page', { show: festival.name }) : t('{festival} lineup', { festival: festival.name })} onPress={() => router.push(eventPath(festival))} />
      </View>
      <Text style={styles.footnote}>{t('Your plan, lineup and route work without signal.')}</Text>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Action({ label, a11y, onPress, icon }: { label: string; a11y: string; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  kicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1.4 },
  title: { ...type.largeTitle, color: color.moon, marginTop: 2 },
  quiet: { ...type.body, color: color.moonDim, marginTop: space.md },
  next: {
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: glowA(0.10),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
    gap: 4,
  },
  nextKicker: { ...type.caption, color: color.glow, textTransform: 'uppercase', letterSpacing: 0.8 },
  nextName: { ...type.title, color: color.moon },
  nextWhen: { ...type.body, color: color.moonDim },
  section: { marginTop: space.xl, gap: space.sm },
  sectionTitle: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  link: { ...type.label, color: color.glow, marginTop: space.xs },
  card: { padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4), gap: space.xs },
  cardTitle: { ...type.headline, color: color.moon },
  cardBody: { ...type.body, color: color.moonDim },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xl },
  action: {
    flexGrow: 1,
    flexBasis: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.45),
  },
  actionText: { ...type.headline, color: color.moon },
  footnote: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.lg },
});
