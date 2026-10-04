import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { NightSky } from '../components/NightSky';
import { ChevronIcon, PlusIcon } from '../components/TabIcons';
import { whereWhen } from '../features/festivals/format';
import { MemoryTile } from '../features/memories/MemoryTile';
import { clipCount, memoryLine, organizeMemories, UNTAGGED, type MemorySection } from '../features/memories/organize';
import { useAddMemory } from '../features/memories/useAddMemory';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useMemories } from '../state/memories';
import { color, radius, space, type } from '../theme/tokens';
import { goBack } from '../lib/nav';

const TILE = 112;

/**
 * Memories: your own festival videos, the way you remember them, festival by
 * festival, night by night, set by set. Untagged ones sit at the top so
 * they're easy to finish. Everything here is on this phone and private.
 */
export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const { memories, uriOf } = useMemories();
  const add = useAddMemory();
  const lookup = useMemo(() => ({ festival: catalog.festival, artist: catalog.artist }), [catalog]);
  const sections = useMemo(() => organizeMemories(memories, lookup), [memories, lookup]);
  const festivals = sections.filter((s) => s.festival || s.past).length;

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.pad}>
          <Text style={styles.title} accessibilityRole="header">
            Memories
          </Text>
          <Text style={styles.meta}>
            {memories.length
              ? `${clipCount(memories.length)}${festivals ? ` from ${festivals} ${festivals === 1 ? 'festival' : 'festivals'}` : ''}. Private to you.`
              : 'Your own videos from the sets you were at, kept on this phone.'}
          </Text>
        </View>

        {!memories.length ? (
          <View style={[styles.pad, styles.empty]}>
            <Text style={styles.emptyTitle}>Keep the moments</Text>
            <Text style={styles.emptyBody}>
              Press and hold a clip in Discover, or tap below, to record or choose a video. Afterglow guesses who was playing
              from when and where you filmed it.
            </Text>
            <Pressable
              onPress={() => {
                haptic.tap();
                add();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Add a memory</Text>
            </Pressable>
          </View>
        ) : (
          sections.map((s) => <Section key={s.key} section={s} uriOf={uriOf} lookup={lookup} />)
        )}
      </ScrollView>

      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => goBack()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
      {memories.length ? (
        <View style={[styles.add, { top: insets.top + space.sm }]}>
          <GlassCircleButton label="Add a memory" onPress={add}>
            <PlusIcon color={color.moon} size={18} />
          </GlassCircleButton>
        </View>
      ) : null}
    </View>
  );
}

function Section({ section, uriOf, lookup }: { section: MemorySection; uriOf: (n: string) => string; lookup: Parameters<typeof memoryLine>[1] }) {
  const untagged = section.key === UNTAGGED;
  return (
    <View style={styles.section}>
      <View style={styles.pad}>
        <View style={[styles.sectionHead, untagged && styles.sectionHeadQuiet]}>
          {!untagged ? (
            <LinearGradient
              colors={section.past ? ['rgba(242,184,166,0.28)', 'rgba(242,184,166,0)'] : ['rgba(107,63,224,0.35)', 'rgba(107,63,224,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionMeta}>
            {[section.festival ? whereWhen(section.festival) : section.past ? ['Throwback', section.past.city].filter(Boolean).join(' · ') : undefined, clipCount(section.count)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>
      {section.nights.map((n) => (
        <View key={n.key} style={styles.night}>
          {n.title ? <Text style={[styles.pad, styles.nightTitle]}>{n.title}</Text> : null}
          {n.groups.map((g) => (
            <View key={g.key} style={styles.group}>
              {!untagged ? (
                <Pressable
                  disabled={!g.artist}
                  onPress={() => g.artist && router.push({ pathname: '/artist/[id]', params: { id: g.artist.id, festival: section.festival?.id } })}
                  accessibilityRole={g.artist ? 'button' : 'text'}
                  style={[styles.pad, styles.groupHead]}
                >
                  <Text style={[styles.groupTitle, !g.artist && styles.quiet]}>{g.title}</Text>
                  <Text style={styles.groupCount}>{clipCount(g.memories.length)}</Text>
                </Pressable>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
                {g.memories.map((m) => (
                  <MemoryTile
                    key={m.id}
                    memory={m}
                    thumbUri={m.thumb ? uriOf(m.thumb) : undefined}
                    width={TILE}
                    badge={untagged ? 'Tag' : undefined}
                    label={untagged ? `Untagged memory. Tag it` : `Memory: ${memoryLine(m, lookup)}`}
                    onPress={() => (untagged ? router.push({ pathname: '/memory-tag', params: { id: m.id } }) : router.push({ pathname: '/memory/[id]', params: { id: m.id } }))}
                  />
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl },
  back: { position: 'absolute', left: space.lg },
  add: { position: 'absolute', right: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs },
  empty: {
    marginTop: space.xl,
    marginHorizontal: space.xl,
    padding: space.xl,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  emptyTitle: { ...type.title, color: color.moon },
  emptyBody: { ...type.body, color: color.moonDim },
  primary: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(169,124,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.4)',
  },
  primaryText: { ...type.label, color: color.moon },
  section: { marginTop: space.xxl },
  sectionHead: {
    padding: space.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    gap: 2,
  },
  sectionHeadQuiet: { borderColor: 'rgba(169,124,255,0.35)' },
  sectionTitle: { ...type.title, color: color.moon },
  sectionMeta: { ...type.caption, color: color.moonDim },
  night: { marginTop: space.lg },
  nightTitle: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: space.xs },
  group: { marginTop: space.sm },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.sm },
  groupTitle: { ...type.headline, color: color.moon },
  groupCount: { ...type.caption, color: color.moonDim },
  quiet: { color: color.moonDim },
  tiles: { paddingHorizontal: space.xl, gap: space.sm },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
