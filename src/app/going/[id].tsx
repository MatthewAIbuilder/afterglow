import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon } from '../../components/TabIcons';
import { PersonRow } from '../../features/social/PersonRow';
import { useGoers } from '../../features/social/useGoers';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { color, space, type } from '../../theme/tokens';

/**
 * Who's going to a festival: people you follow, then others on Afterglow,
 * with Follow beside each. Only people who show the festivals they're going
 * to on their profile appear.
 */
export default function GoingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const festival = useCatalog().festival(id);
  const goers = useGoers(id);

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl, gap: space.md }}>
        <Text style={styles.title} accessibilityRole="header">
          Who’s going
        </Text>
        {festival ? <Text style={styles.meta}>{festival.name}</Text> : null}
        {!social.user ? (
          <Text style={styles.quiet}>Sign in to see who else is going.</Text>
        ) : !goers ? (
          <ActivityIndicator color={color.glow} />
        ) : (
          <>
            {goers.friends.length ? <Text style={styles.section}>People you follow</Text> : null}
            {goers.friends.map((p) => (
              <PersonRow key={p.uid} profile={p} follow />
            ))}
            {goers.others.length ? <Text style={styles.section}>{goers.friends.length ? 'Also going' : 'Going'}</Text> : null}
            {goers.others.map((p) => (
              <PersonRow key={p.uid} profile={p} follow />
            ))}
            {!goers.friends.length && !goers.others.length ? <Text style={styles.quiet}>No one else shows this festival on their profile yet.</Text> : null}
            <Text style={styles.note}>Only people who show the festivals they’re going to on their profile appear here.</Text>
          </>
        )}
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => router.back()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  meta: { ...type.body, color: color.moonDim, marginTop: -space.sm },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.lg },
  quiet: { ...type.body, color: color.moonDim },
  note: { ...type.caption, color: color.moonFaint, marginTop: space.xl },
});
