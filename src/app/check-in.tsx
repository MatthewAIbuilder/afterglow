import { useNetworkState } from 'expo-network';
import { router } from 'expo-router';
import { useState } from 'react';
import type { Artist, Festival, TasteProfile } from '../data/types';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTitle } from '../components/PageTitle';
import { CHECK_INS, clock, cleanNote } from '../features/crews/updates';
import { guessArtists, nightOf } from '../features/memories/guess';
import { isOffline } from '../features/offline/status';
import { LostButton } from '../features/crews/LostButton';
import { CREW_NOTE_MAX } from '../features/social/models';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useCrews } from '../state/crews';
import { useCrewUpdates } from '../state/crewUpdates';
import { usePlan } from '../state/plan';
import { useTaste } from '../state/taste';
import { color, radius, space, type } from '../theme/tokens';

/**
 * Check in with your crew: one tap says where you are, stamped with the
 * moment you tapped. Tiny, so it gets through on the weakest signal; if
 * there's none, it waits on the phone and sends itself later, still marked
 * with the time you tapped.
 */
export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const { crewFestivals, checkIn, ready, outbox, dropped } = useCrewUpdates();
  const { crewsAt } = useCrews();
  const { taste } = useTaste();
  const { mustSeesAt } = usePlan();
  const offline = isOffline(useNetworkState());

  // The festival: the one on right now, else the first of your crews'.
  const [now] = useState(() => new Date());
  const festivals = crewFestivals.map((id) => catalog.festival(id)).filter((f) => !!f);
  const onNow = festivals.find((f) => nightOf(f, now));
  const [chosen, setChosen] = useState<string | undefined>();
  const festival = festivals.find((f) => f.id === chosen) ?? onNow ?? festivals[0];

  // Who's playing now, from the set times: offered as "Watching …".
  const playing = playingNow(festival, now, catalog.artists, taste, mustSeesAt);

  const [stage, setStage] = useState<string | undefined>();
  const [watching, setWatching] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<{ id: string; at: Date } | undefined>();

  if (!ready || !festival) {
    return (
      <View style={[styles.root, { paddingTop: space.xl }]}>
        <Text style={styles.title}>Check in with your crew</Text>
        <Text style={styles.body}>Start or join a crew for a festival you’re going to, and you can tell them where you are from here.</Text>
      </View>
    );
  }

  const crews = crewsAt(festival.id);
  const send = (words?: string) => {
    const id = checkIn(festival.id, {
      note: words,
      stage: watching && playing?.stage ? playing.stage : stage,
      artistId: watching ? playing?.artist.id : undefined,
    });
    if (!id) return;
    haptic.settle();
    setSent({ id, at: new Date() });
  };

  if (sent) {
    // Said only once it's really through: until then it's sending, or waiting for signal.
    const waiting = outbox.some((o) => o.id === sent.id);
    const refused = dropped.includes(sent.id);
    const marked = clock(sent.at.toISOString());
    return (
      <View style={[styles.root, styles.done, { paddingBottom: insets.bottom + space.xl }]} accessibilityLiveRegion="polite">
        <Text style={styles.doneTime}>{marked}</Text>
        <Text style={styles.title}>{refused ? 'Couldn’t reach your crew' : !waiting ? 'Sent to your crew' : offline ? 'Saved for when there’s signal' : 'Sending…'}</Text>
        <Text style={styles.body}>
          {refused
            ? 'Your crew couldn’t take this check-in (the crew may have ended, or your phone’s clock may be off). Try checking in again.'
            : !waiting
            ? `${crews.map((c) => c.name).join(' and ')} ${crews.length === 1 ? 'sees' : 'see'} it marked ${marked}.`
            : offline
              ? `No signal right now. It sends itself as soon as there is, still marked ${marked}, so your crew knows when you were there.`
              : `The signal’s slow. It keeps trying by itself, still marked ${marked}. You can close this.`}
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageTitle title="Check in" />
      <ScrollView contentContainerStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.xl }} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, styles.pad]}>Check in with your crew</Text>
        <Text style={[styles.body, styles.pad]}>
          {crews.map((c) => c.name).join(' and ')} {crews.length === 1 ? 'sees' : 'see'} the time you tap, even if the signal holds it back.
        </Text>
        {offline ? <Text style={[styles.offline, styles.pad]}>No signal right now: it’ll send itself later, marked with this moment.</Text> : null}
        <View style={[styles.pad, { marginTop: space.md }]}>
          <LostButton festivalId={festival.id} />
        </View>

        {festivals.length > 1 ? (
          <Chips label="Festival">
            {festivals.map((f) => (
              <Chip key={f.id} label={f.name} on={f.id === festival.id} onPress={() => setChosen(f.id)} />
            ))}
          </Chips>
        ) : null}

        {playing ? (
          <Chips label="Watching">
            <Chip
              label={`${playing.artist.name}${playing.stage ? ` · ${playing.stage}` : ''}`}
              on={watching}
              onPress={() => {
                setWatching((w) => !w);
                setStage(undefined);
              }}
            />
          </Chips>
        ) : null}

        {festival.stages.length > 0 ? (
          <Chips label="Where are you?">
            {festival.stages.map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                on={!watching && stage === s.name}
                onPress={() => {
                  setWatching(false);
                  setStage((x) => (x === s.name ? undefined : s.name));
                }}
              />
            ))}
          </Chips>
        ) : null}

        <Text style={[styles.section, styles.pad]}>Say</Text>
        <View style={[styles.quick, styles.pad]}>
          {CHECK_INS.map((words) => (
            <Pressable
              key={words}
              onPress={() => send(words)}
              accessibilityRole="button"
              accessibilityLabel={`Send “${words}” to your crew`}
              style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
            >
              <Text style={styles.quickText}>{words}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.own, styles.pad]}>
          <TextInput
            value={note}
            onChangeText={(t) => setNote(t.slice(0, CREW_NOTE_MAX))}
            placeholder="Or say something…"
            placeholderTextColor={color.moonFaint}
            style={styles.input}
            accessibilityLabel="Your own words for your crew"
            returnKeyType="send"
            onSubmitEditing={() => cleanNote(note) && send(note)}
          />
          <Pressable
            onPress={() => send(cleanNote(note) || undefined)}
            accessibilityRole="button"
            accessibilityLabel={cleanNote(note) ? 'Send to your crew' : 'Send where you are to your crew'}
            style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Send</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Who's on now at this festival, from the set times (your route and must-sees first), when anyone is. */
function playingNow(
  f: Festival | undefined,
  now: Date,
  artists: Artist[],
  taste: TasteProfile,
  mustSeesAt: (id: string) => ReadonlySet<string>,
) {
  if (!f?.sets?.length) return undefined;
  const at = nightOf(f, now);
  if (!at) return undefined;
  const g = guessArtists({ festival: f, night: at.night, minute: at.minute, artists, taste, pinned: mustSeesAt(f.id) })[0];
  return g?.set ? g : undefined;
}

function Chips({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <Text style={[styles.section, styles.pad]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {children}
      </ScrollView>
    </>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, on && { color: color.moon }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.nightRaised },
  pad: { paddingHorizontal: space.xl },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.sm },
  offline: { ...type.caption, color: '#FFB86B', marginTop: space.md },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.xl, marginBottom: space.sm },
  chips: { paddingHorizontal: space.xl, gap: space.sm },
  chip: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipOn: { backgroundColor: 'rgba(169,124,255,0.2)', borderColor: 'rgba(169,124,255,0.55)' },
  chipText: { ...type.label, color: color.moonDim },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quickButton: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(169,124,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.4)',
  },
  quickText: { ...type.headline, color: color.moon },
  own: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl },
  input: {
    flex: 1,
    ...type.body,
    color: color.moon,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  sendButton: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  primary: { marginTop: space.xl, alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  primaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  done: { justifyContent: 'center', paddingHorizontal: space.xl },
  doneTime: { ...type.largeTitle, color: color.glow, fontVariant: ['tabular-nums'], marginBottom: space.sm },
});
