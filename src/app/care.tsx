import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { countTonight, regionOf, elapsed, emergencyNumber, lastLine, type Mood, MOOD_LABEL, needsHelp, TIMERS_MAX, WATER_EVERY } from '../features/care/care';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { shareMessage } from '../lib/share';
import { useNow } from '../lib/useNow';
import { useCare } from '../state/care';
import { color, radius, space, type } from '../theme/tokens';

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
 * Look after yourself: timers in your own words, water and food, check-ins,
 * and help one tap away. Private: only on this phone, optionally behind Face
 * ID. No substances are named and no dosing advice is given.
 */
export default function CareScreen() {
  const insets = useSafeAreaInsets();
  const { care, hydrated, start, stop, log, undo, checkIn, setLock, setWaterEvery, clear } = useCare();
  const now = useNow(15_000).getTime();
  const [label, setLabel] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const canLock = Platform.OS !== 'web';
  const locked = canLock && hydrated && care.lock && !unlocked;
  const help = needsHelp(care, now);

  // Face ID (or the passcode); a phone without either just opens.
  const askToUnlock = () =>
    LocalAuthentication.hasHardwareAsync()
      .then((has) => (has ? LocalAuthentication.authenticateAsync({ promptMessage: 'Open Look after yourself' }).then((r) => r.success) : true))
      .catch(() => true);
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
        <PageTitle title="Look after yourself" />
        <NightSky />
        <PageActions />
        <View style={[styles.lockedBox, { paddingTop: insets.top + 120 }]}>
          <Text style={styles.title}>Locked</Text>
          <Text style={styles.sub}>Your notes are private. Unlock with Face ID or your passcode.</Text>
          <Big label="Unlock" onPress={unlock} />
        </View>
      </View>
    );
  }

  const number = emergencyNumber(region());
  const tap = (kind: 'water' | 'food') => {
    haptic.tap();
    log(kind);
  };

  return (
    <View style={styles.root}>
      <PageTitle title="Look after yourself" />
      <NightSky />
      <PageActions />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Look after yourself</Text>
        <Text style={styles.sub}>Private to you: kept only on this phone, never shared.</Text>

        {help ? <Help number={number} first /> : null}

        {/* Timers */}
        <Text style={styles.section}>Timers</Text>
        {care.timers.map((t) => (
          <View key={t.id} style={styles.card} accessible accessibilityLabel={`${t.label || 'Timer'}, ${elapsed(now - t.startedAt)}, started ${clock(t.startedAt)}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.timerLabel} numberOfLines={1}>
                {t.label || 'Timer'}
              </Text>
              <Text style={styles.timerBig}>{elapsed(now - t.startedAt)}</Text>
              <Text style={styles.cardSub}>Started {clock(t.startedAt)}</Text>
            </View>
            <Pressable
              onPress={() =>
                showAlert('Stop this timer?', t.label ? `“${t.label}”, started ${clock(t.startedAt)}.` : `Started ${clock(t.startedAt)}.`, [
                  { text: 'Keep it', style: 'cancel' },
                  { text: 'Stop', style: 'destructive', onPress: () => stop(t.id) },
                ])
              }
              accessibilityRole="button"
              accessibilityLabel={`Stop ${t.label || 'timer'}`}
              hitSlop={8}
              style={({ pressed }) => [styles.small, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.smallText}>Stop</Text>
            </Pressable>
          </View>
        ))}
        {care.timers.length < TIMERS_MAX ? (
          <View style={styles.startRow}>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="Label it your way (optional)"
              placeholderTextColor={color.moonFaint}
              accessibilityLabel="Timer label"
              maxLength={40}
              style={styles.input}
              returnKeyType="done"
            />
            <Pressable
              onPress={() => {
                haptic.tap();
                start(label);
                setLabel('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Start a timer"
              style={({ pressed }) => [styles.startButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.startText}>Start</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Water and food */}
        <Text style={styles.section}>Water and food</Text>
        <View style={styles.pair}>
          {(['water', 'food'] as const).map((kind) => {
            const n = countTonight(care, kind, now);
            const name = kind === 'water' ? 'Water' : 'Food';
            return (
              <Pressable
                key={kind}
                onPress={() => tap(kind)}
                onLongPress={() => n && undo(kind)}
                accessibilityRole="button"
                accessibilityLabel={`${name}: add one. ${n} tonight. ${lastLine(care, kind, now)}.`}
                accessibilityHint="Press and hold to take the last one back"
                style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.97 }] }]}
              >
                <Text style={styles.tileName}>{kind === 'water' ? 'Water refill' : 'Ate something'}</Text>
                <Text style={styles.tileCount}>{n}</Text>
                <Text style={styles.cardSub}>{lastLine(care, kind, now)}</Text>
                <Text style={styles.tilePlus}>+ Tap to add</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.note}>Sip regularly and take breaks somewhere cool. Drinking a lot more water than you need can be dangerous too. Press and hold to take one back.</Text>

        {/* Gentle water reminders on the phone, during a festival night you're going to. */}
        {Platform.OS !== 'web' ? (
          <View style={styles.remind}>
            <Text style={styles.remindTitle}>Remind me to drink water</Text>
            <View style={styles.remindRow} accessibilityRole="radiogroup">
              {([undefined, ...WATER_EVERY] as const).map((m) => {
                const on = care.waterEvery === m;
                const label = m === undefined ? 'Off' : m === 60 ? 'Every hour' : `Every ${m} min`;
                return (
                  <Pressable
                    key={m ?? 'off'}
                    onPress={() => {
                      haptic.select();
                      setWaterEvery(m);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={m === undefined ? 'No water reminders' : `Water reminders ${label.toLowerCase()}`}
                    style={({ pressed }) => [styles.remindChip, on && styles.remindChipOn, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={[styles.remindChipText, on && { color: color.moon }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.note}>
              {care.waterEvery
                ? 'While a festival you’re going to is on, until 6 AM. Each water you log starts the clock again.'
                : 'A quiet nudge while a festival you’re going to is on. Nothing private shows on your lock screen.'}
            </Text>
          </View>
        ) : null}

        {/* Check-in */}
        <Text style={styles.section}>How are you feeling?</Text>
        <View style={styles.moods}>
          {(['good', 'okay', 'rough'] as Mood[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                haptic.select();
                checkIn(m);
              }}
              accessibilityRole="button"
              accessibilityLabel={`I'm feeling ${MOOD_LABEL[m].toLowerCase()}`}
              style={({ pressed }) => [styles.mood, m === 'rough' && styles.moodRough, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.moodText}>{MOOD_LABEL[m]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>{lastLine(care, 'checkin', now).replace('None yet tonight', 'No check-ins yet tonight')}</Text>

        {!help ? <Help number={number} /> : null}

        {/* Privacy */}
        <Text style={styles.section}>Privacy</Text>
        <View style={styles.card}>
          {canLock ? (
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Lock with Face ID</Text>
                <Text style={styles.cardSub}>Or your passcode, each time you open this.</Text>
              </View>
              <Switch
                value={care.lock}
                onValueChange={(on) => {
                  haptic.select();
                  setLock(on);
                  if (on) setUnlocked(true);
                }}
                accessibilityLabel="Lock with Face ID"
                trackColor={{ true: color.glowDeep, false: color.glass }}
              />
            </View>
          ) : null}
          <Pressable
            onPress={() =>
              showAlert('Clear everything?', 'Your timers, water, food and check-ins are removed from this phone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: clear },
              ])
            }
            accessibilityRole="button"
            style={({ pressed }) => [styles.clear, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.clearText}>Clear everything</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/** Help, always on the page; first when you've just said you're not great. */
function Help({ number, first }: { number: string; first?: boolean }) {
  return (
    <View style={[styles.help, first && styles.helpFirst]}>
      <Text style={styles.helpTitle}>{first ? 'You said you’re not great. Help is close.' : 'Get help'}</Text>
      <Text style={styles.helpBody}>
        Get medical help straight away if you or a friend: feel very hot, confused or faint, can’t be woken, has a seizure, or struggles to breathe. Festival
        medics are there to help, not to get anyone in trouble.
      </Text>
      <Big label={`Call ${number}`} onPress={() => void Linking.openURL(`tel:${number}`).catch(() => {})} danger />
      <Text style={styles.helpBody}>Find the medical tent: ask any staff or security and they’ll take you there.</Text>
      <Big label="Ask a friend to find me" onPress={() => void shareMessage('Can you come and find me? I’m not feeling great.')} />
      <Pressable onPress={() => void Linking.openURL(HARM_REDUCTION_URL).catch(() => {})} accessibilityRole="link" style={styles.link}>
        <Text style={styles.linkText}>Harm reduction info from DanceSafe ↗</Text>
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

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640 },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim, marginTop: space.xs },
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
  },
  startButton: { minHeight: 44, paddingHorizontal: space.xl, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glowDeep },
  startText: { ...type.label, color: color.moon },
  pair: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  tileName: { ...type.label, color: color.moonDim },
  tileCount: { ...type.largeTitle, color: color.moon, fontVariant: ['tabular-nums'], marginTop: space.xs },
  tilePlus: { ...type.caption, color: color.glow, marginTop: space.md },
  note: { ...type.caption, color: color.moonFaint, marginTop: space.sm },
  remind: { marginTop: space.lg },
  remindTitle: { ...type.label, color: color.moon },
  remindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  remindChip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  remindChipOn: { backgroundColor: 'rgba(169,124,255,0.22)', borderColor: 'rgba(169,124,255,0.5)' },
  remindChipText: { ...type.caption, color: color.moonDim },
  moods: { flexDirection: 'row', gap: space.sm },
  mood: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  moodRough: { borderColor: 'rgba(255,140,140,0.45)' },
  moodText: { ...type.label, color: color.moon },
  help: { marginTop: space.xxl, padding: space.lg, gap: space.md, borderRadius: radius.lg, backgroundColor: 'rgba(255,120,120,0.07)', borderWidth: 1, borderColor: 'rgba(255,140,140,0.3)' },
  helpFirst: { marginTop: space.xl },
  helpTitle: { ...type.headline, color: color.moon },
  helpBody: { ...type.body, color: color.moonDim },
  big: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: color.glass, borderWidth: 1, borderColor: color.hairline },
  bigDanger: { backgroundColor: 'rgba(220,70,80,0.85)', borderColor: 'rgba(255,140,140,0.6)' },
  bigText: { ...type.headline, color: color.moon },
  link: { paddingVertical: space.xs },
  linkText: { ...type.label, color: color.glow },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, width: '100%' },
  rowTitle: { ...type.headline, fontSize: 16, color: color.moon },
  clear: { paddingVertical: space.sm, width: '100%' },
  clearText: { ...type.label, color: 'rgba(255,150,150,0.95)' },
  lockedBox: { paddingHorizontal: space.xl, gap: space.lg },
});
