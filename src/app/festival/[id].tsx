import { router, useLocalSearchParams } from 'expo-router';
import { PageTitle } from '../../components/PageTitle';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Missing } from '../../components/Missing';
import { PageActions } from '../../components/PageActions';
import { WEB_URL } from '../../config/app';
import { FestivalPage } from '../../features/festivals/FestivalPage';
import { festivalShareText } from '../../features/share/pages';
import { useSendOrShare } from '../../features/messages/useSendOrShare';
import { useCatalog } from '../../state/catalog';
import { useWeekends } from '../../state/weekends';
import { SHARE_PICKS_MAX } from '../../features/messages/shares';
import { haptic } from '../../lib/haptics';
import type { Artist } from '../../data/models';
import { color, radius, space, type, glowA } from '../../theme/tokens';

export default function FestivalScreen() {
  const { id, must } = useLocalSearchParams<{ id: string; must?: string }>();
  const catalog = useCatalog();
  const festival = catalog.festival(id);
  const { forYou } = useWeekends();
  const insets = useSafeAreaInsets();
  const sendOrShare = useSendOrShare();
  if (!festival) return <Missing title="Festival not found" line="This festival isn’t on Afterglow any more, or the link isn’t quite right." />;

  return (
    <View style={styles.root}>
      <PageTitle title={festival.name} />
      <FestivalPage
        festival={festival}
        topSpace={insets.top + 64}
        bottomSpace={insets.bottom + space.xxxl}
        above={<SentPicks artists={picksFrom(must, festival.lineup, catalog.artist)} />}
      />
      <PageActions
        shareLabel={`Share ${festival.name}`}
        onShare={() => sendOrShare({ kind: 'festival', id: festival.id }, festivalShareText(forYou(festival), WEB_URL), festival.name)}
      />
    </View>
  );
}

/** Must-sees in a shared link (`?must=a,b`): the ones on this lineup. */
function picksFrom(must: string | undefined, lineup: readonly string[], artist: (id: string) => Artist | undefined): Artist[] {
  if (!must) return [];
  return must
    .split(',')
    .slice(0, SHARE_PICKS_MAX)
    .filter((a) => lineup.includes(a))
    .map(artist)
    .filter((a): a is Artist => !!a);
}

/** A friend's must-sees, sent as a link: shown first, each one tap from its artist. */
function SentPicks({ artists }: { artists: Artist[] }) {
  if (!artists.length) return null;
  return (
    <View style={styles.picks}>
      <Text style={styles.picksTitle}>Their must-sees</Text>
      <View style={styles.chips}>
        {artists.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/artist/[id]', params: { id: a.id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${a.name}, one of their must-sees`}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Text style={styles.chipText}>★ {a.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  picks: { gap: space.sm, padding: space.md, marginHorizontal: space.xl, marginBottom: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  picksTitle: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: glowA(0.16), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4) },
  chipText: { ...type.label, color: color.moon },
  pressed: { opacity: 0.7 },
});
