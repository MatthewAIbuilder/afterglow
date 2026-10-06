import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetClose } from '../../components/SheetClose';
import { ChevronIcon, PlusIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useDayHours } from '../../state/dayHours';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import {
  BREAK_LABELS,
  breakLabel,
  cleanHours,
  clockLabel,
  dayRange,
  type DayHours,
  fixLabel,
  hoursLine,
  hoursSaid,
  HOURS_STEP,
  isAllDay,
  MAX_BREAKS,
  makeRoom,
  missedLine,
  newBreak,
  stepTime,
} from './hours';
import type { DayRoute } from './route';
import { dayWord, t } from '../../i18n';

type Range = NonNullable<ReturnType<typeof dayRange>>;

/**
 * Under the full day's summary: your hours that day ("Your hours: all day",
 * or "Arriving 4:00 PM · Leaving 2:00 AM · Dinner 7–8 PM"), tap to change
 * them; and a quiet amber note for each must-see they leave no time for, with
 * a one-tap way to make room.
 */
export function DayHoursBar({ festival, day, route }: { festival: Festival; day: string; route?: DayRoute }) {
  const { hours, set } = useDayHours(festival.id);
  const [editing, setEditing] = useState(false);
  const range = dayRange(festival, day);
  if (!range) return null;
  const h = hours[day];
  return (
    <View>
      <Pressable
        onPress={() => {
          haptic.select();
          setEditing(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('Your hours on {day}: {hours}. Change when you arrive, leave and take breaks.', { day: dayWord(day), hours: hoursSaid(h) })}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.rowText} numberOfLines={2}>
          <Text style={styles.rowLabel}>{`${t('Your hours')}  `}</Text>
          {isAllDay(h) ? t('all day') : hoursLine(h)}
        </Text>
        <ChevronIcon color={color.moonFaint} size={14} />
      </Pressable>
      {h
        ? route?.missed?.map((m) => {
            const line = missedLine(m.artist.name, m);
            return (
              <View key={`${m.artist.id}-${m.start}`} style={styles.note}>
                <Text style={styles.noteText}>{line}</Text>
                <Pressable
                  onPress={() => {
                    haptic.select();
                    set(day, makeRoom(h, m));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('{fix}, so {artist} is back on your day', { fix: fixLabel(m), artist: m.artist.name })}
                  hitSlop={6}
                  style={({ pressed }) => [styles.fix, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.fixText}>{fixLabel(m)}</Text>
                </Pressable>
              </View>
            );
          })
        : null}
      {editing ? (
        <HoursEditor
          day={day}
          range={range}
          initial={h}
          onClose={() => setEditing(false)}
          onSave={(next) => {
            set(day, next);
            setEditing(false);
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * The editor: arrive and leave in 15-minute steps, up to four breaks with a
 * name and their own times, reset to all day, save. Steppers rather than a
 * native time picker, so it works the same by touch on a phone and on the web.
 */
function HoursEditor({
  day,
  range,
  initial,
  onClose,
  onSave,
}: {
  day: string;
  range: Range;
  initial: DayHours | undefined;
  onClose: () => void;
  onSave: (h: DayHours | undefined) => void;
}) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState<DayHours>(() => initial ?? { breaks: [] });
  const lo = draft.arrive ?? range.min;
  const hi = draft.leave ?? range.max;
  const change = (next: DayHours) => {
    haptic.select();
    setDraft(next);
  };
  const setBreak = (i: number, patch: Partial<DayHours['breaks'][number]>) =>
    change({ ...draft, breaks: draft.breaks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  return (
    <Modal transparent visible animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close your hours')} />
        <View style={[styles.sheet, { maxHeight: height * 0.88, paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <SheetClose onPress={onClose} />
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.title} accessibilityRole="header">
              {t('Your hours')}
            </Text>
            <Text style={styles.sub}>{t('{day}. Your full day plans only inside these, and keeps your breaks free.', { day: t(day) })}</Text>

            <Stepper
              title={t('Arrive')}
              value={draft.arrive === undefined ? t('From the start') : clockLabel(draft.arrive)}
              what={t('Arrive')}
              onStep={(dir) => {
                const next = stepTime(draft.arrive ?? range.first, dir, range.min, hi - HOURS_STEP);
                if (next !== draft.arrive) change({ ...draft, arrive: next });
              }}
            />
            <Stepper
              title={t('Leave')}
              value={draft.leave === undefined ? t('Until the end') : clockLabel(draft.leave)}
              what={t('Leave')}
              onStep={(dir) => {
                const next = stepTime(draft.leave ?? range.last, dir, lo + HOURS_STEP, range.max);
                if (next !== draft.leave) change({ ...draft, leave: next });
              }}
            />

            <Text style={styles.section}>{t('Breaks')}</Text>
            {draft.breaks.length === 0 ? <Text style={styles.sub}>{t('None. Add one for dinner, a rest or meeting someone.')}</Text> : null}
            {draft.breaks.map((b, i) => {
              const name = b.label != null ? breakLabel(b.label) : t('Break');
              return (
                <View key={i} style={styles.breakCard}>
                  <View style={styles.chips} accessibilityRole="radiogroup">
                    {BREAK_LABELS.map((l) => {
                      const on = b.label === l;
                      return (
                        <Pressable
                          key={l}
                          onPress={() => !on && setBreak(i, { label: l })}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={t('Break {n}: {label}', { n: i + 1, label: breakLabel(l) })}
                          style={[styles.chip, on && styles.chipOn]}
                        >
                          <Text style={[styles.chipText, on && { color: color.moon }]}>{breakLabel(l)}</Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => change({ ...draft, breaks: draft.breaks.filter((_, j) => j !== i) })}
                      accessibilityRole="button"
                      accessibilityLabel={t('Remove {name}', { name: name.toLowerCase() })}
                      hitSlop={6}
                      style={({ pressed }) => [styles.remove, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={styles.removeText}>{t('Remove')}</Text>
                    </Pressable>
                  </View>
                  <Stepper
                    title={t('From')}
                    value={clockLabel(b.from)}
                    what={t('{name} start', { name })}
                    onStep={(dir) => {
                      const from = stepTime(b.from, dir, lo, b.to - HOURS_STEP);
                      if (from !== b.from) setBreak(i, { from });
                    }}
                  />
                  <Stepper
                    title={t('To')}
                    value={clockLabel(b.to)}
                    what={t('{name} end', { name })}
                    onStep={(dir) => {
                      const to = stepTime(b.to, dir, b.from + HOURS_STEP, hi);
                      if (to !== b.to) setBreak(i, { to });
                    }}
                  />
                </View>
              );
            })}
            {draft.breaks.length < MAX_BREAKS ? (
              <Pressable
                onPress={() => change({ ...draft, breaks: [...draft.breaks, newBreak(draft, range, BREAK_LABELS[draft.breaks.length % BREAK_LABELS.length])] })}
                accessibilityRole="button"
                accessibilityLabel={t('Add a break')}
                style={({ pressed }) => [styles.add, pressed && { opacity: 0.6 }]}
              >
                <PlusIcon color={color.glow} size={14} />
                <Text style={styles.addText}>{t('Add a break')}</Text>
              </Pressable>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  haptic.select();
                  onSave(undefined);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Reset to all day')}
                style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.buttonText}>{t('Reset to all day')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic.tap();
                  onSave(cleanHours(draft));
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Save your hours')}
                style={({ pressed }) => [styles.button, styles.primary, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.buttonText, { color: color.moon }]}>{t('Save')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** A time with a step back and a step on, 15 minutes each. */
function Stepper({ title, value, what, onStep }: { title: string; value: string; what: string; onStep: (dir: 1 | -1) => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Pressable
        onPress={() => onStep(-1)}
        accessibilityRole="button"
        accessibilityLabel={t('{what} 15 minutes earlier', { what })}
        hitSlop={6}
        style={({ pressed }) => [styles.stepButton, pressed && { opacity: 0.6 }]}
      >
        <View style={styles.minus} />
      </Pressable>
      <Text style={styles.stepValue} accessibilityLabel={`${title}: ${value}`}>
        {value}
      </Text>
      <Pressable
        onPress={() => onStep(1)}
        accessibilityRole="button"
        accessibilityLabel={t('{what} 15 minutes later', { what })}
        hitSlop={6}
        style={({ pressed }) => [styles.stepButton, pressed && { opacity: 0.6 }]}
      >
        <PlusIcon color={color.moon} size={14} />
      </Pressable>
    </View>
  );
}

const STEP = 34;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  rowText: { ...type.caption, color: color.moon, flex: 1 },
  rowLabel: { color: color.moonFaint },
  note: {
    marginBottom: space.md,
    padding: space.md,
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.amber,
  },
  noteText: { ...type.caption, color: color.amber },
  fix: { alignSelf: 'flex-start' },
  fixText: { ...type.label, color: color.moon },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
    backgroundColor: color.nightRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  sheetBody: { padding: space.xl, paddingTop: space.xl, gap: space.md },
  title: { ...type.title, color: color.moon, marginRight: space.xxxl },
  sub: { ...type.caption, color: color.moonDim },
  section: { ...type.label, color: color.moon, marginTop: space.md },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepTitle: { ...type.label, color: color.moonDim, width: 56 },
  stepValue: { ...type.headline, color: color.moon, flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
  stepButton: {
    width: STEP,
    height: STEP,
    borderRadius: STEP / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  minus: { width: 12, height: 1.5, borderRadius: 1, backgroundColor: color.moon },

  breakCard: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  chip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color.glass },
  chipOn: { backgroundColor: glowA(0.22) },
  chipText: { ...type.caption, color: color.moonDim },
  remove: { marginLeft: 'auto', paddingVertical: 6 },
  removeText: { ...type.caption, color: color.moonFaint },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  addText: { ...type.label, color: color.glow },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
  },
  primary: { backgroundColor: glowA(0.35) },
  buttonText: { ...type.label, color: color.moonDim },
});
