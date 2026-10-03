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
import { useTonight } from '../features/tonight/useTonight';
import { haptic } from '../lib/haptics';
import { useCrews } from '../state/crews';
import { useCrewUpdates } from '../state/crewUpdates';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';

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
      <PageTitle title="Tonight" />
      <NightSky />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxxl }]}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Tonight</Text>
            <Text style={styles.title} accessibilityRole="header">
              {tonight ? tonightTitle(tonight) : 'No festival tonight'}
            </Text>
          </View>
          <GlassCircleButton label="Close" onPress={() => router.back()}>
            <CloseIcon color={color.moon} size={18} />
          </GlassCircleButton>
        </View>
        {tonight ? (
          <TonightBody festival={tonight.festival} night={tonight.night} />
        ) : (
          <Text style={styles.quiet}>Tonight opens here while a festival you’re going to is on.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function TonightBody({ festival, night }: { festival: Festival; night?: string }) {
  const { picks, schedule, route } = useFestivalPlan(festival);
  const social = useSocial();
  const { crewsAt } = useCrews();
  const { ready } = useCrewUpdates();
  const crews = social.user ? crewsAt(festival.id) : [];
  // Sets to preview in Discover: the lineup's clips of tonight's artists.
  const catalog = useCatalog();
  const previewable = tonightClips(festival, catalog.clips, night).length > 0;
  // Before set times: tonight's picks from the lineup's days (or your top picks when days aren't known).
  const tonightPicks = schedule
    ? []
    : ((night ? picksByDay(festival, picks).days.find((d) => d.day === night)?.planned : undefined) ??
        picks.filter((p) => p.tier !== 'explore')
      ).slice(0, TONIGHT_PICKS);

  return (
    <>
      <FestivalModeCard festival={festival} />
      <LiveCrowdRow festival={festival} inset={0} />

      <Section title={schedule ? 'Your route' : night ? `Your picks for ${night}` : 'Your picks'}>
        {schedule ? (
          <LiveNow festival={festival} schedule={schedule} route={route} />
        ) : tonightPicks.length ? (
          tonightPicks.map((p) => <ArtistRow key={p.artist.id} artist={p.artist} affinity={p.match} festivalId={festival.id} detail={p.pinned ? 'Must see' : undefined} />)
        ) : (
          <Text style={styles.quiet}>No picks yet. Rate the lineup to fill your night.</Text>
        )}
        <Pressable
          onPress={() => {
            haptic.select();
            router.push(`/festival/${festival.id}`);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Your whole plan for ${festival.name}`}
          hitSlop={8}
        >
          <Text style={styles.link}>Your whole plan ›</Text>
        </Pressable>
      </Section>

      {social.availability.ok ? (
        <Section title="Your crew">
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
              accessibilityLabel="Start a crew to see where your friends are"
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.cardTitle}>See where your friends are</Text>
              <Text style={styles.cardBody}>Start a crew and everyone’s videos and check-ins show up here, with when they happened.</Text>
            </Pressable>
          )}
        </Section>
      ) : null}

      <Section title="Tonight’s side quests">
        <SideQuestsCard />
      </Section>

      <Section title="Look after yourself">
        <CareCard />
      </Section>

      <View style={styles.actions}>
        {Platform.OS !== 'web' ? (
          <Action label="Film" a11y="Film a video" onPress={() => router.push('/camera')} icon={<CameraIcon color={color.moon} size={20} />} />
        ) : null}
        {ready && crews.length ? <Action label="Check in" a11y="Check in with your crew" onPress={() => router.push('/check-in')} /> : null}
        {previewable ? (
          <Action
            label="Preview"
            a11y={`Preview tonight's sets in Discover, in set order`}
            onPress={() => router.dismissTo({ pathname: '/', params: { festival: TONIGHT } })}
          />
        ) : null}
        <Action label="Lineup" a11y={`${festival.name} lineup`} onPress={() => router.push(`/festival/${festival.id}`)} />
      </View>
      <Text style={styles.footnote}>Your plan, lineup and route work without signal.</Text>
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
  section: { marginTop: space.xl, gap: space.sm },
  sectionTitle: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  link: { ...type.label, color: color.glow, marginTop: space.xs },
  card: { padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(169,124,255,0.4)', gap: space.xs },
  cardTitle: { ...type.headline, color: color.moon },
  cardBody: { ...type.body, color: color.moonDim },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(169,124,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.45)',
  },
  actionText: { ...type.headline, color: color.moon },
  footnote: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.lg },
});
