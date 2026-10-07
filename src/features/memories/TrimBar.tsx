import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { CLIP_LENGTHS, CLIP_MAX, clockOf, isWhole, movedTo, needsTrim, withLength, type ClipWindow } from './trim';

/**
 * Choosing the part of a video that plays: the whole length as a bar, the
 * part as a bright window you drag along it, its length one tap away (up to
 * a minute), and a second either way for fine tuning. A video longer than a
 * minute always has a part; a shorter one can play whole.
 */
export function TrimBar({ durationSec, value, onChange }: { durationSec: number; value: ClipWindow | undefined; onChange: (w: ClipWindow | undefined) => void }) {
  const [width, setWidth] = useState(0);
  const drag = useRef<{ x: number; start: number } | undefined>(undefined);
  const must = needsTrim(durationSec);
  const part = value ?? { start: 0, end: durationSec };
  const length = part.end - part.start;
  const left = width ? (part.start / durationSec) * width : 0;
  const barW = width ? Math.max(12, (length / durationSec) * width) : 0;

  const move = (start: number) => {
    const next = movedTo(part, start, durationSec);
    if (next && (next.start !== part.start || next.end !== part.end)) onChange(next);
  };
  const grant = (e: GestureResponderEvent) => {
    drag.current = { x: e.nativeEvent.pageX, start: part.start };
    haptic.select();
  };
  const moveWith = (e: GestureResponderEvent) => {
    if (!drag.current || !width) return;
    move(drag.current.start + ((e.nativeEvent.pageX - drag.current.x) / width) * durationSec);
  };
  const lengths = CLIP_LENGTHS.filter((l) => l < durationSec);

  return (
    <View style={styles.root}>
      <Text style={styles.line} accessibilityLiveRegion="polite">
        {isWhole(value, durationSec)
          ? t('Plays the whole video · {length}', { length: clockOf(durationSec) })
          : t('Plays {from} to {to} · {length}', { from: clockOf(part.start), to: clockOf(part.end), length: clockOf(length) })}
      </Text>
      <View
        style={styles.track}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={grant}
        onResponderMove={moveWith}
        onResponderRelease={() => (drag.current = undefined)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('The part that plays')}
        accessibilityValue={{ text: t('{from} to {to}', { from: clockOf(part.start), to: clockOf(part.end) }) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => move(part.start + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      >
        <View style={[styles.window, { left, width: barW }]} pointerEvents="none">
          <View style={styles.grip} />
          <View style={styles.grip} />
        </View>
      </View>
      <View style={styles.row}>
        <Nudge label="−1s" a11y={t('A second earlier')} onPress={() => move(part.start - 1)} />
        <View style={styles.lengths}>
          {lengths.map((l) => (
            <Pressable
              key={l}
              onPress={() => {
                haptic.select();
                onChange(withLength(part, l, durationSec));
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: Math.round(length) === l }}
              accessibilityLabel={t('{n} seconds', { n: l })}
              style={[styles.len, Math.round(length) === l && styles.lenOn]}
            >
              <Text style={[styles.lenText, Math.round(length) === l && styles.lenTextOn]}>{t('{n}s', { n: l })}</Text>
            </Pressable>
          ))}
          {!must ? (
            <Pressable
              onPress={() => {
                haptic.select();
                onChange(undefined);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isWhole(value, durationSec) }}
              style={[styles.len, isWhole(value, durationSec) && styles.lenOn]}
            >
              <Text style={[styles.lenText, isWhole(value, durationSec) && styles.lenTextOn]}>{t('Whole')}</Text>
            </Pressable>
          ) : null}
        </View>
        <Nudge label="+1s" a11y={t('A second later')} onPress={() => move(part.start + 1)} />
      </View>
      {must ? <Text style={styles.note}>{t('Discover plays up to {n} seconds. Drag the bright part to the moment you want.', { n: CLIP_MAX })}</Text> : null}
    </View>
  );
}

function Nudge({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={8}
      style={({ pressed }) => [styles.nudge, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.nudgeText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm, paddingHorizontal: space.xl },
  line: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'], textAlign: 'center' },
  track: { height: 44, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim, overflow: 'hidden' },
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radius.md,
    backgroundColor: glowA(0.28),
    borderWidth: 2,
    borderColor: color.glow,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  grip: { width: 3, height: 18, borderRadius: 2, backgroundColor: color.moon },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  lengths: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs, flex: 1 },
  len: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: color.glass },
  lenOn: { backgroundColor: glowA(0.25) },
  lenText: { ...type.label, color: color.moonDim, fontVariant: ['tabular-nums'] },
  lenTextOn: { color: color.moon },
  nudge: { paddingHorizontal: space.sm, paddingVertical: space.xs + 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  nudgeText: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  note: { ...type.caption, color: color.moonFaint, textAlign: 'center' },
});
