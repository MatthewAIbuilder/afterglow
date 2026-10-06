import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { t, tn } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { color, glowA, radius, space, tintA, type } from '../../theme/tokens';
import { type Care, elapsed, feelingsBetween, HELP_MOODS, lastFeeling, type Mood, MOOD_GROUPS, MOOD_LABEL, MOOD_LEVEL, MOOD_TIP, nightStart, recoveryFrom, recoveryLine } from './care';
import { FEELING_LINE, moodColor } from './feelings';
import { MoodOrb } from './MoodOrb';
import { TonightGraph } from './TonightGraph';
import { CareButtons } from '../crews/CareButtons';
import { careFor } from '../crews/care';

const MIN = 60_000;
/** After a check-in, telling your crew is offered for this long. */
const CREW_OFFER_MS = 30 * MIN;
/** After this long, a check-in is "a while ago" and the picker comes back. */
const STALE_MS = 45 * MIN;
const ORB = 58;
const BIG_ORB = 76;
const SMALL_BIG_ORB = 62;

/**
 * How are you feeling. Until you check in (or after a while), the feelings
 * to pick from: three glowing orbs for the good ones, then something's off,
 * then needing a hand. Right after, your feeling as a big softly breathing
 * orb with what to do about it, Tell my crew and Change. Tonight's check-ins
 * as a line once there are two, and a note when you've felt better since a
 * low point (only what you said, never why).
 */
export function FeelingCard({ care, now, onFeel, crewFestival }: { care: Care; now: number; onFeel: (m: Mood) => void; crewFestival?: string }) {
  const [changing, setChanging] = useState(false);
  const [bloomFor, setBloomFor] = useState<Mood | undefined>();
  const [crewOpen, setCrewOpen] = useState(false);
  const last = lastFeeling(care, now);
  const tonight = feelingsBetween(care, nightStart(now), now);
  const since = last ? now - last.at : undefined;
  const stale = since !== undefined && since > STALE_MS;
  const after = last && !stale && !changing;
  const low = recoveryFrom(tonight);

  const pick = (m: Mood) => {
    haptic.select();
    setBloomFor(m);
    setChanging(false);
    setCrewOpen(false);
    onFeel(m);
  };

  return (
    <View style={styles.card}>
      {after && last ? (
        <After
          mood={last.mood}
          ago={elapsed(now - last.at)}
          bloom={bloomFor === last.mood}
          crew={crewFestival && since !== undefined && since < CREW_OFFER_MS ? crewFestival : undefined}
          crewOpen={crewOpen}
          onCrew={() => setCrewOpen((o) => !o)}
          onChange={() => {
            haptic.select();
            setChanging(true);
          }}
        />
      ) : (
        <Picker
          title={stale ? t('It’s been a while. How are you now?') : last ? t('How are you now?') : t('How are you right now?')}
          earlier={stale && last ? last : undefined}
          now={now}
          onPick={pick}
          onCancel={changing ? () => setChanging(false) : undefined}
        />
      )}
      {!last ? <Text style={styles.intro}>{t('Check in now and then. It’s the quickest way to notice when things change, for you or a friend.')}</Text> : null}
      {tonight.length >= 2 ? (
        <View style={styles.graph}>
          <View style={styles.graphHead}>
            <Text style={styles.graphTitle}>{t('Tonight')}</Text>
            <Text style={styles.graphCount}>{tn(tonight.length, '{n} check-in', '{n} check-ins')}</Text>
          </View>
          <TonightGraph points={tonight} now={now} />
        </View>
      ) : null}
      {low ? <Text style={styles.better}>{recoveryLine(low)}</Text> : null}
    </View>
  );
}

/** Right after a check-in: the feeling, when, what to do, and Tell my crew / Change. */
function After({ mood, ago, bloom, crew, crewOpen, onCrew, onChange }: { mood: Mood; ago: string; bloom: boolean; crew?: string; crewOpen: boolean; onCrew: () => void; onChange: () => void }) {
  const careful = HELP_MOODS.includes(mood);
  const when = ago === t('Just now') ? t('Checked in just now') : t('Checked in {time} ago', { time: ago });
  // A smaller phone (iPhone SE) gets a smaller orb and, for a long word, smaller type.
  const narrow = useWindowDimensions().width < 360;
  const orb = narrow ? SMALL_BIG_ORB : BIG_ORB;
  return (
    <View style={styles.after}>
      <View style={[styles.nowRow, narrow && styles.nowRowNarrow]} accessible accessibilityLabel={t('Last check-in: {feeling}, {time} ago. {tip}', { feeling: MOOD_LABEL[mood], time: ago, tip: MOOD_TIP[mood] })}>
        <View style={{ width: orb, height: orb, alignItems: 'center', justifyContent: 'center' }}>
          <MoodOrb key={mood} tint={moodColor(mood)} size={orb} glow={0.5} rings breathe bloom={bloom} />
        </View>
        <View style={styles.nowText}>
          <Text style={[styles.nowTitle, narrow && MOOD_LABEL[mood].length > 8 && styles.nowTitleLong]} numberOfLines={1} adjustsFontSizeToFit>
            {MOOD_LABEL[mood]}
          </Text>
          <Text style={styles.nowWhen}>{when}</Text>
        </View>
      </View>
      <Text style={[styles.tip, careful && styles.tipCareful]}>{MOOD_TIP[mood]}</Text>
      <View style={styles.buttons}>
        {crew ? (
          <Pressable
            onPress={() => {
              haptic.select();
              onCrew();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Tell my crew how I am')}
            accessibilityState={{ expanded: crewOpen }}
            style={({ pressed }) => [styles.button, styles.buttonGlow, crewOpen && styles.buttonOn, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>{t('Tell my crew')}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onChange} accessibilityRole="button" accessibilityLabel={t('Change how I feel')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>{t('Change')}</Text>
        </Pressable>
      </View>
      {/* Never sent by itself: the one that fits, sent only when tapped. */}
      {crew && crewOpen ? <CareButtons festivalId={crew} only={careFor(MOOD_LEVEL[mood])} /> : null}
    </View>
  );
}

/** The feelings to pick from, in their groups. */
function Picker({ title, earlier, now, onPick, onCancel }: { title: string; earlier?: { mood: Mood; at: number }; now: number; onPick: (m: Mood) => void; onCancel?: () => void }) {
  return (
    <View>
      {earlier ? (
        <View style={styles.earlier} accessible accessibilityLabel={t('Last check-in: {feeling}, {time} ago. {tip}', { feeling: MOOD_LABEL[earlier.mood], time: elapsed(now - earlier.at), tip: MOOD_TIP[earlier.mood] })}>
          <View style={[styles.dot, { backgroundColor: moodColor(earlier.mood) }]} />
          <Text style={styles.earlierText} numberOfLines={1}>
            {t('Earlier: {feeling} · {time} ago', { feeling: MOOD_LABEL[earlier.mood], time: elapsed(now - earlier.at) })}
          </Text>
        </View>
      ) : null}
      <View style={styles.pickHead}>
        <Text style={styles.question} accessibilityRole="header">
          {title}
        </Text>
        {onCancel ? (
          <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel={t('Keep how I said I feel')} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.cancel}>{t('Cancel')}</Text>
          </Pressable>
        ) : null}
      </View>
      {MOOD_GROUPS.map((g) =>
        g.id === 'fine' ? (
          <View key={g.id} style={styles.orbs}>
            {g.moods.map((m) => (
              <Pressable
                key={m}
                onPress={() => onPick(m)}
                accessibilityRole="button"
                accessibilityLabel={FEELING_LINE[m]}
                style={({ pressed }) => [styles.orbButton, pressed && styles.orbPressed]}
              >
                <View style={styles.orbSlot}>
                  <MoodOrb tint={moodColor(m)} size={ORB} glow={0.32 + 0.06 * (MOOD_LEVEL[m] - 3)} />
                </View>
                <Text style={styles.orbLabel}>{MOOD_LABEL[m]}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View key={g.id}>
            <Text style={styles.group} accessibilityRole="header">
              {g.title}
            </Text>
            <View style={styles.pills}>
              {g.moods.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => onPick(m)}
                  accessibilityRole="button"
                  accessibilityLabel={FEELING_LINE[m]}
                  style={({ pressed }) => [styles.pill, g.id === 'hand' && styles.pillHand, pressed && styles.pressed]}
                >
                  <View style={[styles.dot, { backgroundColor: moodColor(m) }]} />
                  <Text style={styles.pillText} numberOfLines={1}>
                    {MOOD_LABEL[m]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg + 2, gap: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4) },
  intro: { ...type.caption, fontSize: 13, lineHeight: 18, color: color.moonFaint },

  pickHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md, marginBottom: space.lg },
  question: { ...type.headline, color: color.moon, flex: 1 },
  cancel: { ...type.label, color: color.moonDim },
  earlier: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', marginBottom: space.md, paddingVertical: 6, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color.glass },
  earlierText: { ...type.caption, color: color.moonDim, flexShrink: 1 },
  orbs: { flexDirection: 'row', justifyContent: 'space-around' },
  orbButton: { alignItems: 'center', gap: space.sm + 2, minWidth: 72, paddingVertical: space.xs },
  orbPressed: { transform: [{ scale: 0.93 }], opacity: 0.9 },
  // The orb's glow spills past its slot without pushing the layout around.
  orbSlot: { width: ORB, height: ORB, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  orbLabel: { ...type.label, color: color.moon },
  group: { ...type.caption, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: color.moonFaint, marginTop: space.xl, marginBottom: space.sm + 2, marginLeft: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  pillHand: { backgroundColor: tintA(color.coral, 0.08), borderColor: tintA(color.coral, 0.45), borderWidth: 1 },
  pillText: { ...type.body, fontWeight: '500', color: color.moon },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },

  after: { gap: space.lg },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: space.xl + 2, paddingTop: space.md, paddingLeft: space.md },
  nowText: { flex: 1, gap: 2 },
  nowTitle: { ...type.title, fontSize: 30, lineHeight: 36, letterSpacing: -0.7, color: color.moon },
  nowTitleLong: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  nowRowNarrow: { gap: space.lg + 2, paddingLeft: space.sm },
  nowWhen: { ...type.label, fontWeight: '500', color: color.moonDim },
  tip: { ...type.body, lineHeight: 22, color: color.moonDim },
  tipCareful: { padding: space.md, borderRadius: radius.md, overflow: 'hidden', backgroundColor: tintA(color.coral, 0.1), borderWidth: 1, borderColor: tintA(color.coral, 0.35), color: color.moon },
  buttons: { flexDirection: 'row', gap: space.sm },
  button: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  buttonGlow: { backgroundColor: glowA(0.18), borderColor: glowA(0.45), borderWidth: 1 },
  buttonOn: { backgroundColor: glowA(0.28) },
  buttonText: { ...type.headline, fontSize: 15, color: color.moon },

  graph: { gap: space.sm },
  graphHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  graphTitle: { ...type.headline, fontSize: 15, color: color.moon },
  graphCount: { ...type.caption, color: color.moonFaint },
  better: { ...type.label, fontWeight: '500', lineHeight: 18, color: tintA(color.amber, 0.95), padding: space.md, borderRadius: 14, overflow: 'hidden', backgroundColor: tintA(color.amber, 0.08), borderWidth: StyleSheet.hairlineWidth, borderColor: tintA(color.amber, 0.35) },
});
