import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageFeedback } from '../components/PageFeedback';
import { PageTitle } from '../components/PageTitle';
import { seenByFestival, seenFromMemories, timesSeen, VERDICT_LABEL, type SeenFestival } from '../features/seen/seen';
import { datesLine } from '../features/festivals/format';
import { showActionSheet } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useMemories } from '../state/memories';
import { useSetsSeen } from '../state/setsSeen';
import { color, radius, space, type } from '../theme/tokens';
import { t, tn } from '../i18n';

/**
 * Sets you've seen: every set you were at, festival by festival, with how it
 * was, plus the ones you filmed. Kept on this phone.
 */
export default function SeenScreen() {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const { memories } = useMemories();
  const { sets, loaded, unmark } = useSetsSeen();
  const groups = useMemo(() => seenByFestival(sets, seenFromMemories(memories)), [sets, memories]);
  const most = useMemo(() => timesSeen(groups).filter((a) => a.times > 1).slice(0, 5), [groups]);
  const total = groups.reduce((n, g) => n + g.sets.length, 0);
  const artists = new Set(groups.flatMap((g) => g.sets.map((s) => s.artistId))).size;

  return (
    <View style={styles.root}>
      <PageTitle title={t('Sets you’ve seen')} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('Sets you’ve seen')}</Text>
        {total ? (
          <Text style={styles.sub}>
            {[tn(total, '{n} set', '{n} sets'), tn(artists, '{n} artist', '{n} artists'), tn(groups.length, '{n} festival', '{n} festivals')].join(' · ')}
          </Text>
        ) : (
          <Text style={styles.sub}>{t('Every set you were at, and how it was. Kept only on this phone.')}</Text>
        )}

        {most.length ? (
          <View style={styles.most}>
            <Text style={styles.label}>{t('Seen the most')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mostRow}>
              {most.map((m) => {
                const a = catalog.artist(m.artistId);
                if (!a) return null;
                return (
                  <Pressable
                    key={m.artistId}
                    onPress={() => {
                      haptic.select();
                      router.push({ pathname: '/artist/[id]', params: { id: a.id } });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={tn(m.times, '{artist}, seen {n} time', '{artist}, seen {n} times', { artist: a.name })}
                    style={({ pressed }) => [styles.mostItem, pressed && { opacity: 0.7 }]}
                  >
                    <ArtistAvatar artist={a} size={56} />
                    <Text style={styles.mostName} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text style={styles.mostTimes}>{t('×{n}', { n: m.times })}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {groups.map((g) => (
          <FestivalGroup key={g.festivalId} group={g} onForget={(festivalId, artistId, day) => unmark(festivalId, artistId, day)} />
        ))}

        {loaded && !total ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('Nothing here yet')}</Text>
            <Text style={styles.emptyText}>{t('At a festival, Afterglow asks how each set on your plan was when it ends. Sets you film show up here too.')}</Text>
          </View>
        ) : null}
        <PageFeedback />
      </ScrollView>
    </View>
  );
}

function FestivalGroup({ group, onForget }: { group: SeenFestival; onForget: (festivalId: string, artistId: string, day?: string) => void }) {
  const catalog = useCatalog();
  const festival = catalog.festival(group.festivalId);
  return (
    <View style={styles.group}>
      <Pressable
        onPress={() => {
          if (!festival) return;
          haptic.select();
          router.push({ pathname: '/festival/[id]', params: { id: festival.id } });
        }}
        accessibilityRole={festival ? 'button' : undefined}
        style={({ pressed }) => [pressed && festival && { opacity: 0.7 }]}
      >
        <Text style={styles.festival}>{festival?.name ?? t('A festival')}</Text>
        <Text style={styles.festivalMeta}>
          {[festival ? datesLine(festival) : undefined, tn(group.sets.length, '{n} set', '{n} sets')].filter(Boolean).join(' · ')}
        </Text>
      </Pressable>
      {group.sets.map((s) => {
        const a = catalog.artist(s.artistId);
        if (!a) return null;
        const bits = [s.verdict ? VERDICT_LABEL[s.verdict] : undefined, s.day ? t(s.day) : undefined, s.filmed ? t('Filmed') : undefined].filter(Boolean);
        return (
          <Pressable
            key={`${s.artistId}:${s.day ?? ''}`}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/artist/[id]', params: { id: a.id, festival: group.festivalId } });
            }}
            onLongPress={
              s.filmed && !s.verdict
                ? undefined
                : () => {
                    haptic.select();
                    showActionSheet({ title: a.name, options: [t('I wasn’t there'), t('Cancel')], cancelButtonIndex: 1, destructiveButtonIndex: 0 }, (i) => {
                      if (i === 0) onForget(s.festivalId, s.artistId, s.day);
                    });
                  }
            }
            accessibilityRole="button"
            accessibilityLabel={`${a.name}${bits.length ? `, ${bits.join(', ')}` : ''}`}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <ArtistAvatar artist={a} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {a.name}
              </Text>
              {bits.length ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {bits.join(' · ')}
                </Text>
              ) : null}
            </View>
            {s.verdict === 'unreal' ? <View style={styles.glowDot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640, gap: space.md },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim },
  label: { ...type.label, color: color.moonDim },
  most: { gap: space.sm, marginTop: space.md },
  mostRow: { gap: space.lg },
  mostItem: { alignItems: 'center', width: 76, gap: 4 },
  mostName: { ...type.caption, color: color.moon, textAlign: 'center' },
  mostTimes: { ...type.caption, color: color.glow, fontVariant: ['tabular-nums'] },
  group: {
    marginTop: space.lg,
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  festival: { ...type.headline, color: color.moon },
  festivalMeta: { ...type.caption, color: color.moonDim, marginTop: 2, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  name: { ...type.label, color: color.moon },
  meta: { ...type.caption, color: color.moonDim, marginTop: 1 },
  glowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.glow, shadowColor: color.glow, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  empty: { marginTop: space.lg, gap: space.xs },
  emptyTitle: { ...type.headline, color: color.moon },
  emptyText: { ...type.body, color: color.moonDim },
});
