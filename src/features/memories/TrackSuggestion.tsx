import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { haptic } from '../../lib/haptics';
import { canFindTracks, findTrack } from '../../lib/shazam';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import type { Track } from './track';
import { TrackLine } from './TrackLine';

/**
 * "Track" on the tagging sheet: Shazam listens to the video (on the phone; only
 * a signature of the sound goes to Apple) and suggests the song. Nothing is
 * kept until you tap Add it; Not it hides the suggestion. Once kept, the song
 * shows on the video wherever it's shared. When the song's artist is on
 * Afterglow and nobody is tagged yet, it offers them as who was playing.
 * Renders nothing where Shazam can't run (Expo Go, Android, the website)
 * unless the video already has a track.
 */
export function TrackSuggestion({
  uri,
  track,
  onChange,
  headingStyle,
  artistToTag,
  onTagArtist,
}: {
  /** The video on this phone (`file://`), for Shazam to listen to. */
  uri?: string;
  /** The track kept so far. */
  track?: Track;
  onChange: (track: Track | undefined) => void;
  headingStyle: StyleProp<TextStyle>;
  /** The song's artist, when they're on Afterglow and nobody is tagged as playing yet. */
  artistToTag?: { id: string; name: string };
  onTagArtist?: (id: string) => void;
}) {
  const able = canFindTracks();
  // What Shazam said, and for which video (until it answers for this one, it's still listening).
  const [search, setSearch] = useState<{ uri: string; found?: Track } | undefined>();
  const [dismissed, setDismissed] = useState(false);
  const listen = able && !!uri && uri.startsWith('file:') && !track;

  useEffect(() => {
    if (!listen || !uri) return;
    let live = true;
    void findTrack(uri).then((r) => {
      if (live) setSearch({ uri, found: r.found });
    });
    return () => {
      live = false;
    };
  }, [listen, uri, setSearch]);

  const here = search?.uri === uri ? search : undefined;
  const listening = listen && !here;
  const suggestion = !track && !dismissed && here?.found ? here.found : undefined;
  if (!track && !(able && uri)) return null;

  return (
    <>
      <Text style={headingStyle}>{t('Track')}</Text>
      <View style={styles.body}>
        {track ? (
          <>
            <TrackLine track={track} style={styles.kept} />
            <View style={styles.links}>
              {artistToTag && onTagArtist ? (
                <Pressable
                  onPress={() => {
                    haptic.select();
                    onTagArtist(artistToTag.id);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>{t('{artist} was playing', { artist: artistToTag.name })}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  haptic.select();
                  onChange(undefined);
                  setDismissed(true);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('Remove the track')}
              >
                <Text style={styles.linkQuiet}>{t('Remove')}</Text>
              </Pressable>
            </View>
          </>
        ) : suggestion ? (
          <View style={styles.card}>
            <Text style={styles.cardKicker}>{t('Shazam hears')}</Text>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {suggestion.title}
            </Text>
            <Text style={styles.cardArtist} numberOfLines={1}>
              {suggestion.artist}
            </Text>
            <View style={styles.cardActions}>
              <Pressable
                onPress={() => {
                  haptic.tap();
                  onChange(suggestion);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Add {title} by {artist} as the track', { title: suggestion.title, artist: suggestion.artist })}
                style={({ pressed }) => [styles.add, pressed && styles.pressed]}
              >
                <Text style={styles.addText}>{t('Add it')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic.select();
                  setDismissed(true);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.not, pressed && styles.pressed]}
              >
                <Text style={styles.notText}>{t('Not it')}</Text>
              </Pressable>
            </View>
          </View>
        ) : listening ? (
          <View style={styles.listening}>
            <ActivityIndicator size="small" color={color.glow} />
            <Text style={styles.quiet}>{t('Listening for the track…')}</Text>
          </View>
        ) : here && !dismissed ? (
          <Text style={styles.quiet}>{t('Shazam didn’t recognise the track. Unreleased IDs and edits often aren’t known yet.')}</Text>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl },
  kept: { marginTop: 0 },
  links: { flexDirection: 'row', gap: space.xl, paddingTop: space.sm },
  link: { ...type.label, color: color.glow },
  linkQuiet: { ...type.label, color: color.moonDim },
  card: {
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: glowA(0.1),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  cardKicker: { ...type.caption, color: color.glow, textTransform: 'uppercase', letterSpacing: 1 },
  cardTitle: { ...type.headline, color: color.moon, marginTop: space.xs },
  cardArtist: { ...type.body, color: color.moonDim, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  add: { minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: color.glow, alignItems: 'center', justifyContent: 'center' },
  addText: { ...type.label, color: color.night },
  not: {
    minHeight: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  notText: { ...type.label, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  listening: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  quiet: { ...type.caption, color: color.moonDim, paddingVertical: space.sm },
});
