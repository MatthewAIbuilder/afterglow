import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { OrgLogo } from './OrgMark';
import { OrgEvents } from './OrgProfileParts';
import type { Org } from './organizers';

/**
 * The Festivals tab for an event organizer's account: its own events (and
 * the EDMTrain ones it claimed), coming up and past, the way to add one, and
 * "See all festivals" for the rest of Afterglow. In English, like the studio.
 */
export function OrgFestivals({ org, onShowAll }: { org: Org; onShowAll: () => void }) {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  return (
    <View style={styles.root}>
      <PageTitle title="Your events" />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: tabSpace + space.xl, gap: space.md }}>
        <View style={styles.head}>
          <OrgLogo org={org} width={170} />
          <Text style={styles.title} accessibilityRole="header">
            Your events
          </Text>
        </View>
        <View style={styles.row}>
          <Pressable
            onPress={() => {
              haptic.select();
              router.push('/studio');
            }}
            accessibilityRole="button"
            accessibilityLabel="Add or edit events in your studio"
            style={({ pressed }) => [styles.button, styles.glow, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Add or edit events</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.select();
              onShowAll();
            }}
            accessibilityRole="button"
            accessibilityLabel="See every festival and show on Afterglow"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>See all festivals</Text>
          </Pressable>
        </View>
        <OrgEvents org={org} own />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  head: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl },
  title: { ...type.largeTitle, color: color.moon },
  row: { flexDirection: 'row', gap: space.sm, marginHorizontal: space.lg },
  button: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  glow: { backgroundColor: glowA(0.2), borderColor: glowA(0.5) },
  buttonText: { ...type.label, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
