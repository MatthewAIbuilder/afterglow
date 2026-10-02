import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { PlusIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useSocial } from '../../state/social';
import { color, space, type } from '../../theme/tokens';
import { firstName } from './together';
import { clock, updatePlace, type Story } from './updates';

/** The row's height, so Discover can keep its videos clear of it. */
export const STORIES_H = 92;
const FACE = 58;

/**
 * Your crew, along the top of Discover like stories: you first (check in,
 * or what's still waiting for signal), then each crewmate with something
 * from the last day and a half, glowing when it's new to you. Under each
 * face, the time it happened, never when it arrived.
 */
export function CrewStories() {
  const { crewCount, stories, outbox, profileOf } = useCrewUpdates();
  const social = useSocial();
  const catalog = useCatalog();
  if (!crewCount) return null;
  const me = social.profile;
  const waiting = outbox.length;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.wrap}>
      <Pressable
        onPress={() => {
          haptic.select();
          router.push('/check-in');
        }}
        accessibilityRole="button"
        accessibilityLabel={waiting ? `Check in with your crew. ${waiting} ${waiting === 1 ? 'update is' : 'updates are'} waiting for signal` : 'Check in with your crew'}
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
      >
        <View style={[styles.ring, waiting ? styles.ringWaiting : styles.ringYou]}>
          <PersonAvatar name={me?.displayName} url={me?.avatarUrl} size={FACE} />
        </View>
        <View style={styles.plus}>
          <PlusIcon color={color.night} size={12} />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {waiting ? 'Waiting…' : 'Check in'}
        </Text>
      </Pressable>

      {stories.map((s) => (
        <StoryFace key={s.uid} story={s} name={profileOf(s.uid)?.displayName} url={profileOf(s.uid)?.avatarUrl} artist={(id) => catalog.artist(id)?.name} />
      ))}

      {!stories.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText} numberOfLines={2}>
            Your crew’s videos and check-ins show up here, with when they happened.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function StoryFace({ story, name, url, artist }: { story: Story; name?: string; url?: string; artist: (id: string) => string | undefined }) {
  const u = story.latest;
  const place = updatePlace(u, u.artistId ? artist(u.artistId) : undefined);
  const who = name ? firstName(name) : 'Crewmate';
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/crew-story', params: { uid: story.uid } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${who}, ${u.lost ? 'can’t find the crew,' : u.kind === 'reply' ? 'replied to you' : 'updated'} ${clock(u.at)}${place ? `, ${place}` : ''}${u.note ? `, “${u.note}”` : ''}${story.fresh ? '. New' : ''}`}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      {story.fresh ? (
        <LinearGradient colors={u.lost ? ['#FFB86B', '#FF7E5F', '#FFB86B'] : ['#A97CFF', '#FF7EB6', '#FFB86B']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.ringGlow}>
          <View style={styles.ringGap}>
            <PersonAvatar name={name} url={url} size={FACE} />
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.ring, styles.ringSeen]}>
          <PersonAvatar name={name} url={url} size={FACE} />
        </View>
      )}
      {u.kind === 'checkin' ? <View style={styles.badge} /> : null}
      <Text style={[styles.name, story.fresh && styles.nameFresh]} numberOfLines={1}>
        {who}
      </Text>
      <Text style={styles.time} numberOfLines={1}>
        {clock(u.at)}
      </Text>
    </Pressable>
  );
}

const RING = FACE + 8;
const styles = StyleSheet.create({
  wrap: { flexGrow: 0 },
  row: { paddingHorizontal: space.lg, gap: space.md, alignItems: 'flex-start' },
  item: { width: RING + 4, alignItems: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  ring: { width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  ringYou: { borderColor: 'rgba(255,255,255,0.18)' },
  ringWaiting: { borderColor: 'rgba(255,184,107,0.7)', borderStyle: 'dashed' },
  ringSeen: { borderColor: 'rgba(255,255,255,0.18)' },
  ringGlow: { width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center' },
  ringGap: { width: RING - 5, height: RING - 5, borderRadius: (RING - 5) / 2, backgroundColor: color.night, alignItems: 'center', justifyContent: 'center' },
  plus: {
    position: 'absolute',
    top: RING - 20,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.glow,
    borderWidth: 2,
    borderColor: color.night,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: RING - 14, right: 4, width: 12, height: 12, borderRadius: 6, backgroundColor: '#7FD8A4', borderWidth: 2, borderColor: color.night },
  name: { ...type.caption, color: color.moonDim, marginTop: 4, maxWidth: RING + 8, textAlign: 'center' },
  nameFresh: { color: color.moon, fontWeight: '600' },
  time: { fontSize: 10, lineHeight: 12, color: color.moonFaint, fontVariant: ['tabular-nums'] },
  empty: { justifyContent: 'center', height: RING, maxWidth: 220 },
  emptyText: { ...type.caption, color: color.moonDim },
});
