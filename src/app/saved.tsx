import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { artistColors } from '../components/ArtistAvatar';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { NightSky } from '../components/NightSky';
import { BookmarkIcon, ChevronIcon } from '../components/TabIcons';
import type { Clip } from '../data/types';
import { HeartIcon, PlayIcon, SaveIcon } from '../features/discover/icons';
import { listedClips, openedWith, yourClips } from '../features/discover/saved';
import { playableSource, posterUrl } from '../features/discover/youtube';
import { formatDuration } from '../features/festivals/format';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useClipPool } from '../state/community';
import { useReactions } from '../state/reactions';
import { color, radius, space, type, nightA, pageColumn } from '../theme/tokens';
import { goBack } from '../lib/nav';
import { shownClipTitle } from '../features/community/clips';
import { t, tc } from '../i18n';
import { EmptyState } from '../components/EmptyState';

type Shelf = 'saved' | 'liked';

/** Your clips: saved to watch again, and liked. Tap one to play it in Discover. */
export default function YourClipsScreen() {
  const insets = useSafeAreaInsets();
  // The catalogue's clips and the videos from the crowd you liked.
  const { clips } = useClipPool();
  const { reactions } = useReactions();
  // What was here when you arrived stays listed, so unsaving or unliking can be undone.
  const [opened] = useState(() => openedWith(yourClips(clips, reactions)));
  const listed = useMemo(() => listedClips(clips, opened, reactions), [clips, opened, reactions]);
  const empty = listed.saved.length + listed.liked.length === 0;

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={[pageColumn, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pad}>
          <Text style={styles.title}>{t('Your clips')}</Text>
          <Text style={styles.meta}>{t('What you saved to watch again, and what you liked.')}</Text>
        </View>

        <View style={[styles.pad, styles.list]}>
          {empty ? (
            <EmptyState icon={<BookmarkIcon color={color.moon} size={24} />}>
              {t('Nothing here yet. Tap Save or Like on a clip in Discover and it will wait for you here.')}
            </EmptyState>
          ) : null}
          {listed.saved.length > 0 && <Text style={styles.section}>{tc('shelf', 'Saved')}</Text>}
          {listed.saved.map((c) => (
            <ClipRow key={c.id} clip={c} shelf="saved" />
          ))}
          {listed.liked.length > 0 && (
            <Text style={[styles.section, listed.saved.length > 0 && styles.sectionGap]}>{tc('shelf', 'Liked')}</Text>
          )}
          {listed.liked.map((c) => (
            <ClipRow key={c.id} clip={c} shelf="liked" />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label={t('Back')} onPress={() => goBack()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

function ClipRow({ clip, shelf }: { clip: Clip; shelf: Shelf }) {
  const catalog = useCatalog();
  const { get, toggleSaved, setLiked } = useReactions();
  const reaction = get(clip.id);
  const on = shelf === 'saved' ? reaction.saved : reaction.liked;
  const artist = catalog.artist(clip.artistId);
  const festival = catalog.festival(clip.festivalId);
  const source = playableSource(clip);
  // A video from the crowd: its own still, and who filmed it.
  const crowd = clip.source?.provider === 'community' ? clip.source : undefined;
  // An artist's SoundCloud page: their photo, or the page's picture.
  const page = clip.source?.provider === 'soundcloud' ? clip.source : undefined;
  const still = source ? posterUrl(source) : (crowd?.thumbUrl ?? (page ? (artist?.imageUrl ?? page.image) : undefined));
  const [deep, bright] = artistColors(clip.artistId, artist?.color);
  const name = artist?.name ?? t('Unknown artist');
  const title = shownClipTitle(clip.title);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          haptic.select();
          // Back to the Discover already open underneath (not a second copy on top), playing this clip.
          router.dismissTo({ pathname: '/', params: { clip: clip.id } });
        }}
        accessibilityRole="button"
        accessibilityLabel={t('Play {artist}, {title}', { artist: name, title })}
        style={({ pressed }) => [styles.open, pressed && { opacity: 0.6 }]}
      >
        <View style={styles.thumb}>
          <LinearGradient colors={[bright, deep]} style={StyleSheet.absoluteFill} />
          {still ? <Image source={{ uri: still }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
          <View style={styles.play}>
            <PlayIcon color={color.moon} size={16} />
          </View>
        </View>
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.clipTitle} numberOfLines={1}>
            {crowd ? `${title} · @${crowd.handle}` : title}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            {page ? (festival?.name ?? t('Their uploads')) : `${festival ? `${festival.name}, ` : ''}${formatDuration(clip.durationSec)}`}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => {
          if (on) haptic.select();
          else haptic.tap();
          if (shelf === 'saved') toggleSaved(clip.id);
          else setLiked(clip.id, !on);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={
          shelf === 'saved'
            ? on
              ? t('Remove {artist} from saved', { artist: name })
              : t('Save {artist} again', { artist: name })
            : on
              ? t('Unlike {artist}', { artist: name })
              : t('Like {artist} again', { artist: name })
        }
        hitSlop={10}
        style={({ pressed }) => [styles.toggle, pressed && { transform: [{ scale: 0.9 }] }]}
      >
        {shelf === 'saved' ? (
          <SaveIcon color={on ? color.glow : color.moonDim} filled={on} size={22} />
        ) : (
          <HeartIcon color={on ? color.glow : color.moonDim} filled={on} size={22} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs },
  list: { marginTop: space.xl },
  section: {
    ...type.label,
    color: color.moonFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: space.xs,
  },
  sectionGap: { marginTop: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  thumb: {
    width: 96,
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: nightA(0.55),
  },
  text: { flex: 1 },
  name: { ...type.headline, color: color.moon },
  clipTitle: { ...type.caption, color: color.moon, marginTop: 2 },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  toggle: { padding: space.xs },
});
