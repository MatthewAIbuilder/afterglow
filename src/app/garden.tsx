import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { BadgeCelebration } from '../features/profile/BadgeCelebration';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { SPROUT_GREEN } from '../features/sprouts/look';
import { claimLine } from '../features/sprouts/outbox';
import { Sprout } from '../features/sprouts/Sprout';
import { gardenLine, GROW_TIPS, growthLine, kindOf, seedsLine, SPROUT_KINDS, STAGE_NAMES, STARTER_ID, type GardenView } from '../features/sprouts/sprouts';
import { haptic } from '../lib/haptics';
import { useSprouts } from '../state/sprouts';
import { color, radius, space, type } from '../theme/tokens';

const TILE = 104;
const GIVEN_SHOWN = 12;

const day = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fromLine = (s: GardenView) =>
  s.id === STARTER_ID ? 'Your first sprout' : s.foundAt ? `Found at ${s.foundAt}` : `from ${s.name ?? (s.handle ? `@${s.handle}` : 'someone')}`;
const nameOf = (s: GardenView) => (s.shown === 'seedling' ? 'Sprout' : kindOf(s.shown).name);

/**
 * Your garden: every sprout you've been given (and your first one), growing
 * with what you do; the kinds you've collected; seeds to give; and the
 * sprouts you've given and who picked them up.
 */
export default function GardenScreen() {
  const insets = useSafeAreaInsets();
  const sprouts = useSprouts();
  const [open, setOpen] = useState<GardenView>();
  const { refresh } = sprouts;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const waiting = sprouts.claims.filter((c) => c.state === 'waiting');
  const bloom = sprouts.newBlooms[0];
  const kinds = SPROUT_KINDS.filter((k) => k.id !== 'seedling');
  const collected = kinds.filter((k) => sprouts.collected.has(k.id)).length;

  return (
    <View style={styles.root}>
      <PageTitle title="Your garden" />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.title} accessibilityRole="header">
          Your garden
        </Text>
        <Text style={styles.sub}>{gardenLine(sprouts.garden)}</Text>

        <View style={styles.seedCard}>
          <Text style={styles.seeds}>{seedsLine(sprouts.seeds, sprouts.festivalDay)}</Text>
          <View style={styles.buttons}>
            <Pressable
              onPress={() => {
                haptic.tap();
                router.push('/give-sprout');
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Give a sprout</Text>
            </Pressable>
            {Platform.OS !== 'web' ? (
              <Pressable
                onPress={() => {
                  haptic.tap();
                  router.push('/scan');
                }}
                accessibilityRole="button"
                accessibilityLabel="Scan a sprout someone's giving you"
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryText}>Scan a sprout</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {waiting.length ? (
          <View style={styles.section}>
            {waiting.map((c) => (
              <View key={c.card.id} style={styles.waitRow}>
                <Sprout kind={c.card.kind} stage={0} size={36} still />
                <Text style={styles.waitText}>
                  A sprout from {c.card.name}. {claimLine(c)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.grid}>
          {sprouts.garden.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => {
                haptic.select();
                setOpen(s);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${nameOf(s)}, ${fromLine(s)}. ${s.shown === 'seedling' && s.growth ? growthLine(s.growth) : STAGE_NAMES[s.stage]}.`}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              <Sprout kind={s.shown} stage={s.stage} size={78} />
              <Text style={styles.tileName} numberOfLines={1}>
                {nameOf(s).replace(/ sprout$/, '')}
              </Text>
              <Text style={styles.tileFrom} numberOfLines={1}>
                {fromLine(s)}
              </Text>
              {s.stage < 3 && s.growth ? (
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${Math.round(((s.stage + s.growth.toNext) / 3) * 100)}%` }]} />
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>{GROW_TIPS[0]} Sprouts you give help yours grow too.</Text>

        <View style={styles.section}>
          <Text style={styles.h2}>
            Kinds · {collected} of {kinds.length}
          </Text>
          <View style={styles.kinds}>
            {kinds.map((k) => {
              const got = sprouts.collected.has(k.id);
              return (
                <View key={k.id} style={styles.kind} accessible accessibilityLabel={got ? `${k.name}, collected. ${k.about}` : `${k.name}, not collected yet. ${k.how}.`}>
                  <Sprout kind={k.id} stage={3} size={52} locked={!got} still={!got} />
                  <Text style={[styles.kindName, !got && styles.dim]} numberOfLines={1}>
                    {k.name.replace(' sprout', '')}
                  </Text>
                  {!got ? (
                    <Text style={styles.kindHow} numberOfLines={2}>
                      {k.how.replace('Grows from ', '')}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {sprouts.gifts.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>Given · {sprouts.gifts.length}</Text>
            {sprouts.gifts.slice(0, GIVEN_SHOWN).map((g) => (
              <View key={g.id} style={styles.givenRow}>
                <Sprout kind={g.kind} stage={g.kind === 'seedling' ? 2 : 3} size={40} still />
                <View style={{ flex: 1 }}>
                  <Text style={styles.givenName}>{kindOf(g.kind).name}</Text>
                  <Text style={[styles.givenState, g.claimedBy ? { color: SPROUT_GREEN } : !g.sent ? styles.amberText : null]}>
                    {g.claimedBy ? `Picked up by ${g.claimedBy.name ?? (g.claimedBy.handle ? `@${g.claimedBy.handle}` : 'someone')}` : g.sent ? 'Not picked up yet' : 'Waiting for signal'} · {day(g.at)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <SproutSheet sprout={open} onClose={() => setOpen(undefined)} />
      {/* A sprout that bloomed since you last looked gets its moment, one at a time. */}
      <BadgeCelebration unlock={bloom && !open ? { kind: 'sprout', sprout: bloom.kind, foundAt: bloom.foundAt } : undefined} onDone={() => bloom && sprouts.bloomShown(bloom.id)} />
    </View>
  );
}

function SproutSheet({ sprout, onClose }: { sprout?: GardenView; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const s = sprout;
  return (
    <Modal visible={!!s} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        {s ? (
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]} onPress={() => {}} accessible={false}>
            <Sprout kind={s.shown} stage={s.stage} size={150} />
            <Text style={styles.sheetName}>{nameOf(s)}</Text>
            <Text style={styles.sub}>
              {fromLine(s)} · {day(s.at)}
            </Text>
            {s.note ? <Text style={styles.note}>“{s.note}”</Text> : null}
            {s.shown !== 'seedling' ? <Text style={styles.body}>{kindOf(s.shown).about}</Text> : null}
            {s.kind === 'seedling' && s.growth && s.stage < 3 ? (
              <>
                <View style={[styles.bar, styles.barWide]}>
                  <View style={[styles.barFill, { width: `${Math.round(((s.stage + s.growth.toNext) / 3) * 100)}%` }]} />
                </View>
                <Text style={styles.growLine}>{growthLine(s.growth)}</Text>
                {s.growth.leaning !== 'seedling' && s.stage >= 1 ? <Text style={styles.body}>Growing into a {kindOf(s.growth.leaning).name}.</Text> : null}
                {GROW_TIPS.map((t) => (
                  <Text key={t} style={styles.tip}>
                    · {t}
                  </Text>
                ))}
              </>
            ) : s.kind === 'seedling' ? (
              <Text style={styles.body}>In bloom. You can give {kindOf(s.shown).name}s now.</Text>
            ) : null}
            <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.secondary, styles.sheetClose, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>Done</Text>
            </Pressable>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim },
  h2: { ...type.headline, color: color.moon },
  body: { ...type.body, color: color.moonDim, textAlign: 'center' },
  hint: { ...type.caption, color: color.moonFaint },
  seedCard: { padding: space.lg, gap: space.md, borderRadius: radius.lg, backgroundColor: 'rgba(110,231,160,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(110,231,160,0.35)' },
  seeds: { ...type.label, color: SPROUT_GREEN },
  buttons: { flexDirection: 'row', gap: space.sm },
  primary: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: '#1E8F4A' },
  primaryText: { ...type.headline, color: color.moon },
  secondary: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  section: { gap: space.sm, marginTop: space.md },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,184,107,0.6)' },
  waitText: { ...type.caption, color: '#FFB86B', flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'flex-start' },
  tile: { width: TILE, alignItems: 'center', paddingVertical: space.sm, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  tileName: { ...type.label, color: color.moon, marginTop: 2 },
  tileFrom: { ...type.caption, color: color.moonFaint },
  bar: { width: 64, height: 4, borderRadius: 2, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  barWide: { width: 200 },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: SPROUT_GREEN },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kind: { width: 74, alignItems: 'center', gap: 2 },
  kindName: { ...type.caption, color: color.moon },
  kindHow: { ...type.caption, fontSize: 10, lineHeight: 12, color: color.moonFaint, textAlign: 'center' },
  dim: { color: color.moonFaint },
  givenRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  givenName: { ...type.label, color: color.moon },
  givenState: { ...type.caption, color: color.moonDim },
  amberText: { color: '#FFB86B' },
  scrim: { flex: 1, backgroundColor: 'rgba(5,4,14,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.nightRaised, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.xl, alignItems: 'center', gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' },
  sheetName: { ...type.title, color: SPROUT_GREEN },
  note: { ...type.headline, color: color.moon, fontStyle: 'italic', textAlign: 'center' },
  growLine: { ...type.label, color: SPROUT_GREEN },
  tip: { ...type.caption, color: color.moonFaint, alignSelf: 'stretch', textAlign: 'center' },
  sheetClose: { flex: 0, alignSelf: 'stretch', marginTop: space.md },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
