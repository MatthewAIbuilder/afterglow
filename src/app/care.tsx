import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { router, useLocalSearchParams } from 'expo-router';
import { BodyCard } from '../features/care/BodyCard';
import { BloomWash, HeartMark } from '../features/care/HeartIntro';
import { countTonight, feelingsBetween, lastFeeling, regionOf, emergencyNumber, lastLine, MOOD_LABEL, needsHelp, TIMERS_MAX, WATER_EVERY, FEEL_EVERY } from '../features/care/care';
import { FeelingCard } from '../features/care/FeelingCard';
import { careFestival } from '../features/crews/care';
import { CrewHelpAlerts } from '../features/crews/CrewHelpAlerts';
import { useTonight } from '../features/tonight/useTonight';
import { useCrewUpdates } from '../state/crewUpdates';
import { GuideList } from '../features/care/GuideList';
import { riskyMixes } from '../features/care/guide';
import { useAppSettings } from '../state/appSettings';
import { StartStopwatch } from '../features/care/StartStopwatch';
import { StopwatchCard } from '../features/care/StopwatchCard';
import { t, tc } from '../i18n';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { shareMessage } from '../lib/share';
import { useNow } from '../lib/useNow';
import { useCare } from '../state/care';
import { color, radius, space, type, glowA, accentEdge } from '../theme/tokens';

const HARM_REDUCTION_URL = 'https://dancesafe.org';

/** The phone's region ("US"), for the emergency number: read from the locale ("en-US"). */
const region = () => {
  try {
    return regionOf(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return undefined;
  }
};

/**
 * Look after yourself: stopwatches that say when things usually kick in and
 * wear off (the timing guide, never doses), warnings about risky mixes,
 * water and food, steps and a pulse check, check-ins, help one tap away, and
 * the guide itself to read with no signal. Private: only on this phone,
 * optionally behind Face ID.
 */
export default function CareScreen() {
  const insets = useSafeAreaInsets();
  // Opened by holding the camera button: the heart lands into place.
  const params = useLocalSearchParams<{ from?: string; part?: string }>();
  const fromHeart = params.from === 'heart';
  const { care, hydrated, start, stop, tookMore, log, undo, checkIn, setLock, setWaterEvery, setFeelEvery, clear } = useCare();
  // Every second, for the stopwatches.
  const now = useNow(1000).getTime();
  // The timing guide can be switched off for everyone from HQ: stopwatches then just count, in your own words.
  const { careGuide } = useAppSettings();
  const mixes = careGuide ? riskyMixes(care.timers.map((t) => t.guide).filter((g): g is string => !!g)) : [];
  const [unlocked, setUnlocked] = useState(false);
  const canLock = Platform.OS !== 'web';
  const locked = canLock && hydrated && care.lock && !unlocked;
  const help = needsHelp(care, now);
  // Your crew at the festival on now, to tell how you are (only when you tap).
  const tonight = useTonight();
  const crewUpdates = useCrewUpdates();
  const crewAt = crewUpdates.ready ? careFestival(tonight?.festival.id, crewUpdates.crewFestivals) : undefined;
  // Where each part of the page starts, for the jump chips.
  const scroller = useRef<ScrollView>(null);
  const spots = useRef<Partial<Record<PartId, number>>>({});
  const at = useCallback((id: PartId, y: number) => {
    spots.current[id] = y;
  }, []);
  const jumpTo = (id: PartId) => {
    const y = spots.current[id];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };
  // Opened from a reminder ("How are you feeling?"): that part, once laid out.
  const opened = params.part;
  useEffect(() => {
    if (!opened || !(PART_IDS as readonly string[]).includes(opened)) return;
    const timer = setTimeout(() => {
      const y = spots.current[opened as PartId];
      if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [opened]);

  // Face ID (or the passcode); a phone without either set up just opens (the lock can't work there, and you're never locked out).
  const askToUnlock = () =>
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()])
      .then(([has, enrolled]) => (has && enrolled ? LocalAuthentication.authenticateAsync({ promptMessage: t('Open Look after yourself') }).then((r) => r.success) : true))
      .catch(() => true);
  // Leaving the app locks it again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') setUnlocked(false);
    });
    return () => sub.remove();
  }, []);
  const unlock = () => {
    void askToUnlock().then((ok) => ok && setUnlocked(true));
  };
  // Locked: ask once when the page opens.
  useEffect(() => {
    if (!locked) return;
    let live = true;
    void askToUnlock().then((ok) => {
      if (live && ok) setUnlocked(true);
    });
    return () => {
      live = false;
    };
  }, [locked]);

  if (locked) {
    return (
      <View style={styles.root}>
        <PageTitle title={t('Look after yourself')} />
        <NightSky />
        <PageActions />
        <View style={[styles.lockedBox, { paddingTop: insets.top + 120 }]}>
          <Text style={styles.title}>{t('Locked')}</Text>
          <Text style={styles.sub}>{t('Your notes are private. Unlock with Face ID or your passcode.')}</Text>
          <Big label={t('Unlock')} onPress={unlock} />
        </View>
      </View>
    );
  }

  const number = emergencyNumber(region());
  const feeling = lastFeeling(care, now);
  const water = countTonight(care, 'water', now);
  const jumps: { id: PartId; label: string; detail?: string }[] = [
    { id: 'feelings', label: t('Feelings'), detail: feeling ? MOOD_LABEL[feeling.mood] : undefined },
    { id: 'stopwatches', label: t('Stopwatches'), detail: care.timers.length ? String(care.timers.length) : undefined },
    { id: 'water', label: t('Water'), detail: water ? String(water) : undefined },
    { id: 'body', label: t('Body') },
    { id: 'help', label: t('Get help') },
    ...(careGuide ? [{ id: 'guide' as const, label: t('Timing guide') }] : []),
  ];
  const tap = (kind: 'water' | 'food') => {
    haptic.tap();
    log(kind);
  };

  return (
    <View style={styles.root}>
      <PageTitle title={t('Look after yourself')} />
      <NightSky />
      <PageActions />
      <ScrollView
        ref={scroller}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <HeartMark bloom={fromHeart} />
        <Text style={styles.title}>{t('Look after yourself')}</Text>
        <Text style={styles.sub}>{t('Private to you: kept only on this phone, never shared.')}</Text>
        {Platform.OS !== 'web' ? <Text style={styles.tip}>{t('Tip: hold the camera button to get back here quickly.')}</Text> : null}

        {/* Jump to a part of the page, each with what's there tonight. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jumpWrap} contentContainerStyle={styles.jump}>
          {jumps.map((j) => (
            <Pressable
              key={j.id}
              onPress={() => {
                haptic.select();
                jumpTo(j.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={j.detail ? t('{label}, {detail}. Jump there', { label: j.label, detail: j.detail }) : t('{label}. Jump there', { label: j.label })}
              style={({ pressed }) => [styles.jumpChip, j.id === 'help' && help && styles.jumpHelp, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.jumpText}>{j.label}</Text>
              {j.detail ? <Text style={styles.jumpDetail}>{j.detail}</Text> : null}
            </Pressable>
          ))}
        </ScrollView>

        <CrewHelpAlerts />

        {help ? (
          <Part id="help" at={at}>
            <Help number={number} first />
          </Part>
        ) : null}

        {/* How you're feeling, near the top: check in often. */}
        <Part id="feelings" at={at}>
          <View style={styles.feelings}>
            <FeelingCard care={care} now={now} onFeel={checkIn} crewFestival={crewAt} />
          </View>
        </Part>

        {/* Stopwatches: from the timing guide, or your own words, each with how you've felt since. */}
        <Part id="stopwatches" title={t('Stopwatches')} at={at}>
          {mixes.map((m) => (
            <View key={`${m.a.id}-${m.b.id}`} style={styles.mix} accessible accessibilityLabel={t('Careful: {a} and {b} together. {why}', { a: m.a.name, b: m.b.name, why: m.why })}>
              <Text style={styles.mixTitle}>{t('Careful: {a} and {b}', { a: m.a.name, b: m.b.name })}</Text>
              <Text style={styles.mixBody}>{m.why}</Text>
            </View>
          ))}
          {care.timers.map((timer) => (
            <StopwatchCard
              key={timer.id}
              timer={timer}
              now={now}
              feelings={feelingsBetween(care, timer.startedAt, now)}
              onFeel={checkIn}
              onTookMore={() => tookMore(timer.id)}
              onStop={() => stop(timer.id)}
              guided={careGuide}
            />
          ))}
          {care.timers.length < TIMERS_MAX ? <StartStopwatch onStart={start} guided={careGuide} /> : null}
          {/* "How are you feeling?" on the phone while a stopwatch runs. */}
          {Platform.OS !== 'web' && (care.timers.length || care.feelEvery) ? (
            <View style={styles.remind}>
              <Text style={styles.remindTitle}>{t('Ask how I’m feeling')}</Text>
              <ReminderChoice
                options={FEEL_EVERY}
                value={care.feelEvery}
                onPick={setFeelEvery}
                a11y={(label) => (label ? t('Ask how I’m feeling {every}', { every: label.toLowerCase() }) : t('Don’t ask how I’m feeling'))}
              />
              <Text style={styles.note}>
                {care.feelEvery
                  ? t('While a stopwatch runs, until it should have worn off. Each check-in starts the clock again.')
                  : t('A quiet nudge to check in, so your graph fills in. Nothing private shows on your lock screen.')}
              </Text>
            </View>
          ) : null}
          {!care.timers.length ? <Text style={styles.note}>{t('Start one when you take something. It tells you when it usually kicks in, and charts how you feel along the way.')}</Text> : null}
        </Part>

        {/* Water and food */}
        <Part id="water" title={t('Water and food')} at={at}>
          <View style={styles.pair}>
            {(['water', 'food'] as const).map((kind) => {
              const n = countTonight(care, kind, now);
              const name = kind === 'water' ? t('Water') : t('Food');
              return (
                <Pressable
                  key={kind}
                  onPress={() => tap(kind)}
                  onLongPress={() => n && undo(kind)}
                  accessibilityRole="button"
                  accessibilityLabel={t('{name}: add one. {n} tonight. {last}.', { name, n, last: lastLine(care, kind, now) })}
                  accessibilityHint={t('Press and hold to take the last one back')}
                  style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.97 }] }]}
                >
                  <Text style={styles.tileName}>{kind === 'water' ? t('Water refill') : t('Ate something')}</Text>
                  <Text style={styles.tileCount}>{n}</Text>
                  <Text style={styles.cardSub}>{lastLine(care, kind, now)}</Text>
                  <Text style={styles.tilePlus}>{t('+ Tap to add')}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.note}>{t('Sip regularly and take breaks somewhere cool. Drinking a lot more water than you need can be dangerous too. Press and hold to take one back.')}</Text>

          {/* Gentle water reminders on the phone, during a festival night you're going to. */}
          {Platform.OS !== 'web' ? (
            <View style={styles.remind}>
              <Text style={styles.remindTitle}>{t('Remind me to drink water')}</Text>
              <ReminderChoice
                options={WATER_EVERY}
                value={care.waterEvery}
                onPick={setWaterEvery}
                a11y={(label) => (label ? t('Water reminders {every}', { every: label.toLowerCase() }) : t('No water reminders'))}
              />
              <Text style={styles.note}>
                {care.waterEvery
                  ? t('While a festival you’re going to is on, until 6 AM. Each water you log starts the clock again.')
                  : t('A quiet nudge while a festival you’re going to is on. Nothing private shows on your lock screen.')}
              </Text>
            </View>
          ) : null}
        </Part>

        {/* Your body */}
        <Part id="body" title={t('Your body')} at={at}>
          <BodyCard now={now} />
          {Platform.OS !== 'web' ? (
            <Pressable
              onPress={() => {
                haptic.select();
                router.push('/trail');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Your festival trail. Where you walked on festival days.')}
              style={({ pressed }) => [styles.trailLink, pressed && { opacity: 0.8 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.trailTitle}>{t('Your festival trail')}</Text>
                <Text style={styles.trailSub}>{t('Where you walked on festival days, on a map.')}</Text>
              </View>
              <Text style={styles.trailChevron}>›</Text>
            </Pressable>
          ) : null}
        </Part>

        {!help ? (
          <Part id="help" at={at}>
            <Help number={number} />
          </Part>
        ) : null}

        {/* The timing guide, readable with no signal. */}
        {careGuide ? (
          <Part id="guide" title={t('Timing guide')} at={at}>
            <GuideList />
          </Part>
        ) : null}

        {/* Privacy */}
        <Text style={styles.section}>{t('Privacy')}</Text>
        <View style={styles.card}>
          {canLock ? (
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t('Lock with Face ID')}</Text>
                <Text style={styles.cardSub}>{t('Or your passcode, each time you open this.')}</Text>
              </View>
              <Switch
                value={care.lock}
                onValueChange={(on) => {
                  haptic.select();
                  setLock(on);
                  if (on) setUnlocked(true);
                }}
                accessibilityLabel={t('Lock with Face ID')}
                trackColor={{ true: color.glowDeep, false: color.glass }}
              />
            </View>
          ) : null}
          <Pressable
            onPress={() =>
              showAlert(t('Clear everything?'), t('Your stopwatches, water, food and check-ins are removed from this phone.'), [
                { text: t('Cancel'), style: 'cancel' },
                { text: t('Clear'), style: 'destructive', onPress: clear },
              ])
            }
            accessibilityRole="button"
            style={({ pressed }) => [styles.clear, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.clearText}>{t('Clear everything')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <BloomWash bloom={fromHeart} />
    </View>
  );
}

const PART_IDS = ['help', 'feelings', 'stopwatches', 'water', 'body', 'guide'] as const;
type PartId = (typeof PART_IDS)[number];

/** Off, then each "every N min" choice, as a row of chips. */
function ReminderChoice<T extends number>({ options, value, onPick, a11y }: { options: readonly T[]; value: T | undefined; onPick: (v: T | undefined) => void; a11y: (label?: string) => string }) {
  return (
    <View style={styles.remindRow} accessibilityRole="radiogroup">
      {([undefined, ...options] as const).map((m) => {
        const on = value === m;
        const label = m === undefined ? tc('reminder', 'Off') : m === 60 ? t('Every hour') : t('Every {n} min', { n: m });
        return (
          <Pressable
            key={m ?? 'off'}
            onPress={() => {
              haptic.select();
              onPick(m);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={a11y(m === undefined ? undefined : label)}
            style={({ pressed }) => [styles.remindChip, on && styles.remindChipOn, pressed && { opacity: 0.8 }]}
          >
            <Text style={[styles.remindChipText, on && { color: color.moon }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One part of the page: a heading (when it has one), and where it starts for the jump chips. */
function Part({ id, title, at, children }: { id: PartId; title?: string; at: (id: PartId, y: number) => void; children: React.ReactNode }) {
  return (
    <View onLayout={(e) => at(id, e.nativeEvent.layout.y)}>
      {title ? (
        <Text style={styles.section} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Help, always on the page; first when you've just said you're not great. */
function Help({ number, first }: { number: string; first?: boolean }) {
  return (
    <View style={[styles.help, first && styles.helpFirst]}>
      <Text style={styles.helpTitle}>{first ? t('You said you’re not great. Help is close.') : t('Get help')}</Text>
      <Text style={styles.helpBody}>
        {t(
          'Get medical help straight away if you or a friend: feel very hot, confused or faint, can’t be woken, has a seizure, or struggles to breathe. Festival medics are there to help, not to get anyone in trouble.',
        )}
      </Text>
      <Big label={t('Call {number}', { number })} onPress={() => void Linking.openURL(`tel:${number}`).catch(() => {})} danger />
      <Text style={styles.helpBody}>{t('Find the medical tent: ask any staff or security and they’ll take you there.')}</Text>
      <Big label={t('Ask a friend to find me')} onPress={() => void shareMessage(t('Can you come and find me? I’m not feeling great.'))} />
      <Pressable onPress={() => void Linking.openURL(HARM_REDUCTION_URL).catch(() => {})} accessibilityRole="link" style={styles.link}>
        <Text style={styles.linkText}>{t('Harm reduction info from DanceSafe ↗')}</Text>
      </Pressable>
    </View>
  );
}

function Big({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [styles.big, danger && styles.bigDanger, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.bigText}>{label}</Text>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  trailLink: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  trailTitle: { ...type.headline, fontSize: 16, color: color.moon },
  trailSub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  trailChevron: { ...type.title, color: color.moonFaint },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640 },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs },
  tip: { ...type.caption, color: '#FF9ECB', marginTop: space.xs },
  // How you feel has no section title (its card asks the question), so it keeps the same room above.
  feelings: { marginTop: space.xl },
  section: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.xxl, marginBottom: space.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    marginBottom: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
    flexWrap: 'wrap',
  },
  cardSub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  timerLabel: { ...type.label, color: color.moonDim },
  timerBig: { ...type.largeTitle, color: color.moon, fontVariant: ['tabular-nums'] },
  small: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: color.hairline },
  smallText: { ...type.label, color: color.moon },
  startRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: {
    flex: 1,
    ...type.body,
    color: color.moon,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  startButton: { minHeight: 44, paddingHorizontal: space.xl, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glowDeep, ...accentEdge },
  startText: { ...type.label, color: color.moon },
  pair: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  tileName: { ...type.label, color: color.moonDim },
  tileCount: { ...type.largeTitle, color: color.moon, fontVariant: ['tabular-nums'], marginTop: space.xs },
  tilePlus: { ...type.caption, color: color.glow, marginTop: space.md },
  note: { ...type.caption, color: color.moonFaint, marginTop: space.sm },
  remind: { marginTop: space.lg },
  remindTitle: { ...type.label, color: color.moon },
  remindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  remindChip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  remindChipOn: { backgroundColor: glowA(0.22), borderColor: glowA(0.5) },
  remindChipText: { ...type.caption, color: color.moonDim },
  help: { marginTop: space.xxl, padding: space.lg, gap: space.md, borderRadius: radius.lg, backgroundColor: 'rgba(255,120,120,0.07)', borderWidth: 1, borderColor: 'rgba(255,140,140,0.3)' },
  helpFirst: { marginTop: space.xl },
  helpTitle: { ...type.headline, color: color.moon },
  helpBody: { ...type.body, color: color.moonDim },
  big: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: color.glass, borderWidth: 1, borderColor: color.hairline, borderTopColor: color.rim },
  bigDanger: { backgroundColor: 'rgba(220,70,80,0.85)', borderColor: 'rgba(255,140,140,0.6)' },
  bigText: { ...type.headline, color: color.moon },
  link: { paddingVertical: space.xs },
  linkText: { ...type.label, color: color.glow },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, width: '100%' },
  rowTitle: { ...type.headline, fontSize: 16, color: color.moon },
  clear: { paddingVertical: space.sm, width: '100%' },
  clearText: { ...type.label, color: 'rgba(255,150,150,0.95)' },
  lockedBox: { paddingHorizontal: space.xl, gap: space.lg },
  jumpWrap: { marginTop: space.lg, marginHorizontal: -space.xl },
  jump: { gap: space.sm, paddingHorizontal: space.xl },
  jumpChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  jumpHelp: { borderColor: 'rgba(255,140,140,0.6)', backgroundColor: 'rgba(255,120,120,0.12)' },
  jumpText: { ...type.label, color: color.moon },
  jumpDetail: { ...type.caption, color: color.glow },
  mix: { padding: space.lg, marginBottom: space.sm, gap: space.xs, borderRadius: radius.lg, backgroundColor: 'rgba(255,120,120,0.1)', borderWidth: 1, borderColor: 'rgba(255,140,140,0.5)' },
  mixTitle: { ...type.headline, color: 'rgba(255,190,190,1)' },
  mixBody: { ...type.body, color: color.moon },
});
