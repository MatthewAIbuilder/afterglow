import { router } from 'expo-router';
import { useState } from 'react';
import { PageTitle } from '../../components/PageTitle';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { FestivalPage } from '../../features/festivals/FestivalPage';
import { lineupChoices } from '../../features/festivals/going';
import { dateBlock } from '../../features/festivals/timeline';
import { countdown } from '../../features/festivals/when';
import { festivalShelf, isMany } from '../../features/festivals/shelves';
import { useLoves } from '../../state/useLoves';
import { TonightPlan } from '../../features/festivalMode/TonightPlan';
import { useFestivalMode } from '../../state/festivalMode';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { color, radius, space, type, glowA } from '../../theme/tokens';

/**
 * Your lineup: the festival page for the festival you're going to (your plan
 * and the full lineup), one tap from anywhere. Going to several: switch
 * between them. Going to none yet: every festival, with a nudge to pick.
 */
export default function LineupScreen() {
  // In festival mode the tab is your night, planned for you.
  const { active } = useFestivalMode();
  return active ? <TonightPlan mode={active} /> : <FullLineup />;
}

function FullLineup() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const catalog = useCatalog();
  const { going } = useGoing();
  const today = useToday();
  // With many festivals and none picked, the chips are the short shelf (For you / Coming up).
  const loves = useLoves();
  const shelf = isMany(catalog.festivals) ? festivalShelf(catalog.festivals, going, loves, today).festivals : undefined;
  const { festivals, yours } = lineupChoices(catalog.festivals, going, today, shelf);
  const [picked, setPicked] = useState<string | undefined>();
  const festival = festivals.find((f) => f.id === picked) ?? festivals[0];

  if (!festival) {
    return (
      <View style={styles.root}>
        <PageTitle title="Lineup" />
        <NightSky />
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.kicker}>{yours ? 'Your lineup' : 'Lineups'}</Text>
      {/* Which festival: a card each, with its dates and how long until it. */}
      {festivals.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsWrap}>
          {festivals.map((f) => {
            const on = f.id === festival.id;
            const block = dateBlock(f);
            const soon = countdown(f, today);
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  if (on) return;
                  haptic.select();
                  setPicked(f.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Show the ${f.name} lineup`}
                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.75 }]}
              >
                <Text style={[styles.chipWhen, on && { color: color.glow }]} numberOfLines={1}>
                  {block ? `${block.month} ${block.days}` : 'Dates to come'}
                </Text>
                <Text style={[styles.chipText, on && { color: color.moon }]} numberOfLines={2}>
                  {f.name}
                </Text>
                {soon && soon !== 'Over' ? (
                  <Text style={styles.chipSoon} numberOfLines={1}>
                    {soon}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {!yours && (
        <View style={styles.nudgeCard}>
          <Text style={styles.nudge}>Tap “I’m going” on a festival and this tab becomes your lineup for it.</Text>
          <Pressable
            onPress={() => {
              haptic.select();
              router.navigate('/festivals');
            }}
            accessibilityRole="button"
            accessibilityLabel="Browse festivals"
            style={({ pressed }) => [styles.browse, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.browseText}>Browse festivals</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <PageTitle title="Lineup" />
      <FestivalPage
        key={festival.id}
        festival={festival}
        topSpace={insets.top + space.lg}
        bottomSpace={tabSpace + space.xl}
        above={header}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  header: { marginBottom: space.lg },
  kicker: {
    ...type.label,
    color: color.glow,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: space.xl,
  },
  chipsWrap: { flexGrow: 0, marginTop: space.md },
  chips: { paddingHorizontal: space.lg, gap: space.sm },
  chip: {
    width: 150,
    padding: space.md,
    gap: 2,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipOn: { backgroundColor: glowA(0.18), borderColor: glowA(0.6), borderWidth: 1 },
  chipWhen: { ...type.caption, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: color.moonFaint },
  chipText: { ...type.headline, fontSize: 15, lineHeight: 19, color: color.moonDim },
  chipSoon: { ...type.caption, color: color.moonFaint },
  nudgeCard: {
    marginTop: space.md,
    marginHorizontal: space.lg,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: glowA(0.10),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  nudge: { ...type.body, color: color.moonDim },
  browse: { alignSelf: 'flex-start', paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glow },
  browseText: { ...type.label, color: color.night },
});
