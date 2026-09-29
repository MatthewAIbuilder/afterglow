import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon } from '../../components/TabIcons';
import type { Artist, Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { groupFestivals } from '../../features/festivals/going';
import { countdown } from '../../features/festivals/when';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';

const LOVE = 0.8;

export default function FestivalsScreen() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { taste } = useTaste();
  const { festivals } = useCatalog();
  const { going } = useGoing();
  const today = useToday();
  const groups = groupFestivals(festivals, going, today);

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: tabSpace + space.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Festivals</Text>
          <Text style={styles.subtitle}>Lineups ranked by your sound.</Text>
        </View>
        {groups.going.length > 0 && <Text style={styles.section}>Going</Text>}
        {groups.going.map((f) => (
          <FestivalCard key={f.id} festival={f} taste={taste} />
        ))}
        {groups.going.length > 0 && groups.others.length > 0 && <Text style={styles.section}>More festivals</Text>}
        {groups.others.map((f) => (
          <FestivalCard key={f.id} festival={f} taste={taste} />
        ))}
      </ScrollView>
    </View>
  );
}

function FestivalCard({ festival, taste }: { festival: Festival; taste: Record<string, number> }) {
  const { artist: artistById } = useCatalog();
  const ranked = festival.lineup
    .map((id) => artistById(id))
    .filter((a): a is Artist => !!a)
    .sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0));
  const loved = ranked.filter((a) => (taste[a.id] ?? 0) >= LOVE).length;
  const timesOut = !!festival.sets?.length;
  const today = useToday();
  const soon = countdown(festival, today);

  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push(`/festival/${festival.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${festival.name}, ${festival.dates}`}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }], opacity: 0.9 }]}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{festival.name}</Text>
          <Text style={styles.meta}>
            {festival.dates}, {festival.location}
          </Text>
        </View>
        <ChevronIcon color={color.moonFaint} />
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.faces}>
          {ranked.slice(0, 4).map((a, i) => (
            <View key={a.id} style={[styles.face, { marginLeft: i === 0 ? 0 : -12, zIndex: 10 - i }]}>
              <ArtistAvatar artist={a} size={38} />
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.loved}>
            {loved > 0 ? `${loved} of ${ranked.length} artists you'll love` : `${ranked.length} artists`}
          </Text>
          <Text style={[styles.status, timesOut && { color: color.glow }]}>
            {soon ? `${soon} · ` : ''}
            {timesOut ? 'Set times are out' : 'Set times not announced yet'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  header: { paddingHorizontal: space.xl, marginBottom: space.xl },
  title: { ...type.largeTitle, color: color.moon },
  subtitle: { ...type.body, color: color.moonDim, marginTop: space.xs },
  section: { ...type.label, color: color.moonFaint, paddingHorizontal: space.xl, marginBottom: space.md, textTransform: 'uppercase', letterSpacing: 0.8 },
  card: {
    marginHorizontal: space.lg,
    marginBottom: space.lg,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  name: { ...type.title, color: color.moon },
  meta: { ...type.body, color: color.moonDim, marginTop: 2 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', marginTop: space.xl, gap: space.lg },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 20, borderWidth: 2, borderColor: color.night },
  loved: { ...type.label, color: color.moon },
  status: { ...type.caption, color: color.moonDim, marginTop: 2 },
});
