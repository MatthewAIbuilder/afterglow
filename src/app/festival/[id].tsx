import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistRow } from '../../components/ArtistRow';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon } from '../../components/TabIcons';
import { artistById } from '../../data/artists';
import { describeSet, festivalById, setFor } from '../../data/festivals';
import type { Artist } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';

type Order = 'match' | 'billing';

export default function FestivalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const festival = festivalById(id);
  const insets = useSafeAreaInsets();
  const { taste } = useTaste();
  const [order, setOrder] = useState<Order>('match');

  const lineup = useMemo(() => {
    if (!festival) return [];
    const list = festival.lineup.map((a) => artistById(a)).filter((a): a is Artist => !!a);
    return order === 'match' ? [...list].sort((a, b) => (taste[b.id] ?? 0) - (taste[a.id] ?? 0)) : list;
  }, [festival, order, taste]);

  if (!festival) return null;
  const timesOut = !!festival.sets?.length;

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pad}>
          <Text style={styles.title}>{festival.name}</Text>
          <Text style={styles.meta}>
            {festival.dates}, {festival.location}
          </Text>
        </View>

        {festival.posterImageUrl ? (
          <Pressable
            onPress={() => {
              haptic.select();
              router.push(`/poster/${festival.id}`);
            }}
            accessibilityRole="imagebutton"
            accessibilityLabel="Official lineup poster. Opens full screen."
            style={styles.posterWrap}
          >
            <Image source={{ uri: festival.posterImageUrl }} style={styles.poster} contentFit="cover" transition={250} />
            <View style={styles.posterHint}>
              <Text style={styles.posterHintText}>View poster</Text>
              <ChevronIcon color={color.moon} size={12} />
            </View>
          </Pressable>
        ) : null}

        <View style={[styles.pad, styles.note]}>
          {timesOut ? (
            <>
              <Text style={styles.noteTitle}>Set times are out</Text>
              <Text style={styles.noteBody}>Each artist shows when and where they play.</Text>
            </>
          ) : (
            <>
              <Text style={styles.noteTitle}>{"Set times aren't out yet"}</Text>
              <Text style={styles.noteBody}>
                Festivals usually publish them a week or two before the gates open. Until then, here is the full
                lineup ranked by your match.
              </Text>
            </>
          )}
        </View>

        <View style={[styles.pad, styles.lineupHead]}>
          <Text style={styles.section}>Lineup</Text>
          <Segmented value={order} onChange={setOrder} />
        </View>

        <View style={styles.pad}>
          {lineup.map((a) => {
            const set = setFor(festival, a.id);
            return (
              <ArtistRow key={a.id} artist={a} affinity={taste[a.id] ?? 0} detail={set ? describeSet(festival, set) : undefined} />
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => router.back()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

function Segmented({ value, onChange }: { value: Order; onChange: (o: Order) => void }) {
  const options: { key: Order; label: string }[] = [
    { key: 'match', label: 'For you' },
    { key: 'billing', label: 'Billing' },
  ];
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(o.key);
            }}
            style={[styles.segItem, on && styles.segOn]}
          >
            <Text style={[styles.segText, on && { color: color.moon }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs },
  posterWrap: {
    marginHorizontal: space.lg,
    marginTop: space.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
    aspectRatio: 4 / 5,
    backgroundColor: color.glass,
  },
  poster: { width: '100%', height: '100%' },
  posterHint: {
    position: 'absolute',
    right: space.md,
    bottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10,9,24,0.6)',
  },
  posterHintText: { ...type.caption, color: color.moon },
  note: { marginTop: space.xl },
  noteTitle: { ...type.headline, color: color.moon },
  noteBody: { ...type.body, color: color.moonDim, marginTop: space.xs },
  lineupHead: { marginTop: space.xxl, marginBottom: space.sm, flexDirection: 'row', alignItems: 'center' },
  section: { ...type.title, fontSize: 22, color: color.moon, flex: 1 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: color.glass },
  segItem: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  segOn: { backgroundColor: 'rgba(169,124,255,0.22)' },
  segText: { ...type.caption, color: color.moonDim },
});
