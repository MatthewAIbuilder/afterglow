import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { BEFORE_ANYTHING, GUIDE, GUIDE_NOTE, MIXES, guideEntry, rangeText } from './guide';

/**
 * The timing guide as a reference you can read with no signal: before you
 * take anything, then each entry with when it usually starts, is strongest
 * and wears off, its tips and what not to mix it with. Tap to open one.
 */
export function GuideList() {
  const [open, setOpen] = useState<string | undefined>();
  return (
    <View style={styles.wrap}>
      <View style={styles.before}>
        <Text style={styles.beforeTitle}>Before you take anything</Text>
        {BEFORE_ANYTHING.map((line) => (
          <Text key={line} style={styles.bullet}>
            • {line}
          </Text>
        ))}
      </View>
      <Text style={styles.note}>{GUIDE_NOTE}</Text>
      {GUIDE.map((g) => {
        const on = open === g.id;
        const mixes = MIXES.filter((m) => m.a === g.id || m.b === g.id);
        return (
          <View key={g.id} style={[styles.row, on && styles.rowOn]}>
            <Pressable
              onPress={() => {
                haptic.select();
                setOpen(on ? undefined : g.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: on }}
              accessibilityLabel={`${g.name}, ${g.how}. Starts in ${rangeText(g.onset)}, lasts ${rangeText(g.total)}.`}
              style={styles.head}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{g.name}</Text>
                <Text style={styles.times}>
                  Starts {rangeText(g.onset)} · lasts {rangeText(g.total)}
                </Text>
              </View>
              <Text style={styles.chev}>{on ? '−' : '+'}</Text>
            </Pressable>
            {on ? (
              <View style={styles.body}>
                <View style={styles.timeline}>
                  <Stat label="Starts" value={rangeText(g.onset)} />
                  <Stat label="Strongest until" value={rangeText(g.peak)} />
                  <Stat label="Worn off by" value={rangeText(g.total)} />
                </View>
                <Text style={styles.how}>Times are for {g.how}.</Text>
                {g.tips.map((t) => (
                  <Text key={t} style={styles.bullet}>
                    • {t}
                  </Text>
                ))}
                {mixes.length ? (
                  <View style={styles.mixes}>
                    <Text style={styles.mixTitle}>Riskier mixed with</Text>
                    {mixes.map((m) => {
                      const other = guideEntry(m.a === g.id ? m.b : m.a);
                      return (
                        <Text key={`${m.a}-${m.b}`} style={styles.bullet}>
                          • <Text style={styles.mixName}>{other?.name}</Text>: {m.why}
                        </Text>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  before: { padding: space.lg, gap: space.xs, borderRadius: radius.lg, backgroundColor: 'rgba(255,184,107,0.08)', borderWidth: 1, borderColor: 'rgba(255,184,107,0.35)' },
  beforeTitle: { ...type.headline, color: color.moon, marginBottom: space.xs },
  note: { ...type.caption, color: color.moonFaint, marginVertical: space.xs },
  row: { borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, overflow: 'hidden' },
  rowOn: { borderColor: 'rgba(169,124,255,0.45)' },
  head: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md },
  name: { ...type.headline, color: color.moon },
  times: { ...type.caption, color: color.moonDim, marginTop: 2 },
  chev: { ...type.title, color: color.moonDim, width: 20, textAlign: 'center' },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.xs },
  timeline: { flexDirection: 'row', gap: space.sm, marginBottom: space.xs },
  stat: { flex: 1, padding: space.sm, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.05)' },
  statLabel: { ...type.caption, fontSize: 11, color: color.moonFaint },
  statValue: { ...type.label, color: color.moon, marginTop: 2 },
  how: { ...type.caption, color: color.moonFaint },
  bullet: { ...type.body, fontSize: 15, color: color.moonDim },
  mixes: { marginTop: space.sm, padding: space.md, gap: space.xs, borderRadius: radius.md, backgroundColor: 'rgba(255,120,120,0.07)', borderWidth: 1, borderColor: 'rgba(255,140,140,0.25)' },
  mixTitle: { ...type.label, color: 'rgba(255,170,170,0.95)' },
  mixName: { fontWeight: '700', color: color.moon },
});
