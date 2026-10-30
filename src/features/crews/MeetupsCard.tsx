import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type Crew, type CrewMeetup, MEETUP_NOTE_MAX, MEETUP_PLACE_MAX } from '../social/models';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../social/service';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useSocial } from '../../state/social';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { meetupTime, upcomingMeetups } from './meetups';
import { t, weekdays } from '../../i18n';

/** A new meetup starts this far ahead, on the quarter hour; the steppers move it in quarters. */
const START_AHEAD_MIN = 30;
const STEP_MIN = 15;
/** "On my way" and "I'm here" show from this long before a meetup. */
const ANSWER_FROM_MS = 2 * 3600_000;

const quarter = (ms: number) => Math.ceil(ms / (STEP_MIN * 60_000)) * STEP_MIN * 60_000;

/**
 * The crew's meetups: a place and a time to find each other, set by anyone
 * in the crew. Everyone's phone reminds them 15 minutes before and at the
 * time (MeetupReminders), and "On my way" / "I'm here" go to the crew as
 * check-ins (they wait for signal like any other).
 */
export function MeetupsCard({ crew, nameOf }: { crew: Crew; nameOf: (uid: string) => string }) {
  const now = useNow(30_000);
  const { meetupsFor, removeMeetup, checkIn, meetSpotFor } = useCrewUpdates();
  const social = useSocial();
  const me = social.user?.uid;
  const owner = crew.owner === me;
  const list = upcomingMeetups(meetupsFor(crew.id), now.getTime());
  const [adding, setAdding] = useState(false);

  const callOff = (m: CrewMeetup) => {
    haptic.select();
    showAlert(t('Call off this meetup?'), t('{place} at {time}. Everyone’s reminder goes too.', { place: m.place, time: meetupTime(m) }), [
      { text: t('Keep it'), style: 'cancel' },
      {
        text: t('Call it off'),
        style: 'destructive',
        onPress: () => void removeMeetup(crew.id, m.id).catch((e) => showAlert(t('Couldn’t call it off'), SOCIAL_ERROR_COPY[socialErrorKind(e)])),
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('Meetups')}</Text>
        {!adding ? (
          <Pressable
            onPress={() => {
              haptic.select();
              setAdding(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Set a meetup for the crew')}
            hitSlop={8}
          >
            <Text style={styles.link}>{t('+ Set a meetup')}</Text>
          </Pressable>
        ) : null}
      </View>
      {!list.length && !adding ? <Text style={styles.quiet}>{t('A place and a time to find each other. Everyone gets a reminder 15 minutes before.')}</Text> : null}
      {list.map((m) => {
        const at = Date.parse(m.at);
        const soon = at - now.getTime() <= ANSWER_FROM_MS;
        const d = new Date(at);
        const sameDay = d.toDateString() === now.toDateString();
        const when = sameDay ? meetupTime(m) : `${weekdays()[d.getDay()]} ${meetupTime(m)}`;
        const mine = m.by === me;
        return (
          <View key={m.id} style={[styles.meetup, soon && styles.soon]} accessible={false}>
            <View style={styles.meetupRow} accessible accessibilityLabel={`${t('Meetup: {place} at {time}', { place: m.place, time: when })}${m.note ? `. ${m.note}` : ''}. ${mine ? t('You set it') : t('Set by {name}', { name: nameOf(m.by) })}`}>
              <Text style={styles.time}>{when}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.place}>{m.place}</Text>
                {m.note ? <Text style={styles.note}>{m.note}</Text> : null}
                <Text style={styles.by}>{mine ? t('You set it') : t('Set by {name}', { name: nameOf(m.by) })}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              {soon ? (
                <>
                  <Pill label={t('On my way')} onPress={() => void checkIn(crew.festivalId, { note: 'On my way' })} a11y={t('Tell the crew you’re on your way')} />
                  <Pill label={t('I’m here')} onPress={() => void checkIn(crew.festivalId, { note: 'I’m here', stage: m.place.slice(0, 40) })} a11y={t('Tell the crew you’re at {place}', { place: m.place })} />
                </>
              ) : null}
              {mine || owner ? <Pill quiet label={t('Call off')} onPress={() => callOff(m)} a11y={t('Call off the meetup at {place}', { place: m.place })} /> : null}
            </View>
          </View>
        );
      })}
      {adding ? <NewMeetup crew={crew} spot={meetSpotFor(crew.id)?.text} onDone={() => setAdding(false)} /> : null}
    </View>
  );
}

function Pill({ label, onPress, a11y, quiet }: { label: string; onPress: () => void; a11y: string; quiet?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [quiet ? styles.pillQuiet : styles.pill, pressed && { opacity: 0.7 }]}
    >
      <Text style={quiet ? styles.pillQuietText : styles.pillText}>{label}</Text>
    </Pressable>
  );
}

/** Set a meetup: where (the crew's spot, a stage, or your own words), when (in quarter hours) and a note. */
export function NewMeetup({ crew, spot, onDone, place: startPlace, atMs: startAt }: { crew: Crew; spot?: string; onDone: () => void; place?: string; atMs?: number }) {
  const { festival } = useCatalog();
  const { addMeetup } = useCrewUpdates();
  const f = festival(crew.festivalId);
  const [place, setPlace] = useState(startPlace ?? spot ?? '');
  const [note, setNote] = useState('');
  const [at, setAt] = useState<number | undefined>(startAt);
  const [saving, setSaving] = useState(false);
  const now = useNow(60_000);
  const when = at ?? quarter(now.getTime() + START_AHEAD_MIN * 60_000);
  const choices = useMemo(() => [...new Set([...(spot ? [spot] : []), ...(f?.stages ?? []).map((s) => s.name)])].slice(0, 8), [spot, f]);
  const d = new Date(when);
  const whenText = `${d.toDateString() === now.toDateString() ? t('Today') : weekdays()[d.getDay()]} ${meetupTime({ at: d.toISOString() })}`;

  const save = async () => {
    if (!place.trim() || saving) return;
    setSaving(true);
    try {
      await addMeetup(crew.id, { place, atMs: when, ...(note.trim() ? { note } : {}) });
      haptic.settle();
      onDone();
    } catch (e) {
      showAlert(t('Couldn’t set the meetup'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.label}>{t('Where')}</Text>
      {choices.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {choices.map((c) => (
            <Pressable key={c} onPress={() => setPlace(c)} accessibilityRole="button" accessibilityState={{ selected: place === c }} style={[styles.chip, place === c && styles.chipOn]}>
              <Text style={[styles.chipText, place === c && { color: color.moon }]} numberOfLines={1}>
                {c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <TextInput value={place} onChangeText={setPlace} maxLength={MEETUP_PLACE_MAX} placeholder={t('Or in your own words: the big flag by the wheel')} placeholderTextColor={color.moonFaint} accessibilityLabel={t('Where to meet')} style={styles.input} />
      <Text style={styles.label}>{t('When')}</Text>
      <View style={styles.stepper}>
        <Step label="−1h" a11y={t('An hour earlier')} onPress={() => setAt(when - 60 * 60_000)} />
        <Step label="−15" a11y={t('15 minutes earlier')} onPress={() => setAt(when - STEP_MIN * 60_000)} />
        <Text style={styles.when} accessibilityLabel={t('Meet at {when}', { when: whenText })}>
          {whenText}
        </Text>
        <Step label="+15" a11y={t('15 minutes later')} onPress={() => setAt(when + STEP_MIN * 60_000)} />
        <Step label="+1h" a11y={t('An hour later')} onPress={() => setAt(when + 60 * 60_000)} />
      </View>
      <TextInput value={note} onChangeText={setNote} maxLength={MEETUP_NOTE_MAX} placeholder={t('A note (optional)')} placeholderTextColor={color.moonFaint} accessibilityLabel={t('A note for the crew')} style={styles.input} />
      <View style={styles.formActions}>
        <Pressable onPress={onDone} accessibilityRole="button" hitSlop={8} style={styles.pillQuiet}>
          <Text style={styles.pillQuietText}>{t('Cancel')}</Text>
        </Pressable>
        <Pressable
          onPress={() => void save()}
          disabled={!place.trim() || saving}
          accessibilityRole="button"
          accessibilityLabel={t('Set the meetup')}
          style={({ pressed }) => [styles.save, (!place.trim() || saving) && { opacity: 0.5 }, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.saveText}>{saving ? t('Setting…') : t('Set the meetup')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Step({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={4}
      style={({ pressed }) => [styles.step, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.lg,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.headline, color: color.moon },
  link: { ...type.label, color: color.glow },
  quiet: { ...type.caption, color: color.moonDim },
  meetup: { gap: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  soon: { borderTopColor: glowA(0.5) },
  meetupRow: { flexDirection: 'row', gap: space.md },
  time: { ...type.label, color: color.glow, minWidth: 72, fontVariant: ['tabular-nums'] },
  place: { ...type.label, color: color.moon },
  note: { ...type.caption, color: color.moonDim, marginTop: 2 },
  by: { ...type.caption, color: color.moonFaint, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginLeft: 72 + space.md },
  pill: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: glowA(0.2) },
  pillText: { ...type.caption, color: color.moon },
  pillQuiet: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  pillQuietText: { ...type.caption, color: color.moonDim },
  form: { gap: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  label: { ...type.caption, color: color.moonDim },
  chips: { gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, maxWidth: 200 },
  chipOn: { backgroundColor: glowA(0.22), borderColor: glowA(0.5) },
  chipText: { ...type.caption, color: color.moonDim },
  input: { ...type.body, color: color.moon, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  step: { paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: color.glass },
  stepText: { ...type.caption, color: color.moon, fontVariant: ['tabular-nums'] },
  when: { ...type.label, color: color.moon, flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  save: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glow },
  saveText: { ...type.label, color: color.night },
});
