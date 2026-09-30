import { useState } from 'react';
import { PageTitle } from '../../components/PageTitle';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { FestivalPage } from '../../features/festivals/FestivalPage';
import { lineupChoices } from '../../features/festivals/going';
import { festivalShelf, isMany } from '../../features/festivals/shelves';
import { useLoves } from '../../state/useLoves';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * Your lineup: the festival page for the festival you're going to (your plan
 * and the full lineup), one tap from anywhere. Going to several: switch
 * between them. Going to none yet: every festival, with a nudge to pick.
 */
export default function LineupScreen() {
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
      {festivals.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsWrap}>
          {festivals.map((f) => {
            const on = f.id === festival.id;
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
                <Text style={[styles.chipText, on && { color: color.moon }]}>{f.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {!yours && (
        <Text style={styles.nudge}>Tap “I’m going” on a festival and this tab becomes your lineup for it.</Text>
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
  chips: { paddingHorizontal: space.xl, gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipOn: { backgroundColor: 'rgba(169,124,255,0.22)', borderColor: 'rgba(169,124,255,0.45)' },
  chipText: { ...type.label, color: color.moonDim },
  nudge: { ...type.caption, color: color.moonFaint, marginTop: space.md, paddingHorizontal: space.xl },
});
