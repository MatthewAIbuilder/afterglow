import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Artist } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { color, radius, space, type } from '../../theme/tokens';
import { artistLook, foldName, SIGNATURE_NAMES } from './artistLook';
import { type ArtistSprout, artistGardenLine, tierLabel, tierLine } from './artistSprouts';
import { Sprout } from './Sprout';

const TILE = 104;
const day = (t: number) => (t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/** Artist sprouts someone gave you: the artist and who from. */
export type GivenArtistSprout = { id: string; artist: { id: string; name: string }; from: string; at: number };

/**
 * The garden's artist sprouts: one for every artist you've filmed, levelled
 * up by filming them more (bronze, silver, gold), and the ones friends gave
 * you. With none yet, a few signature sprouts as grey silhouettes to aim for.
 */
export function ArtistSproutsSection({ earned, given, canGive }: { earned: ArtistSprout[]; given: GivenArtistSprout[]; canGive: boolean }) {
  const catalog = useCatalog();
  const [open, setOpen] = useState<{ artist: Artist; sprout?: ArtistSprout; given?: GivenArtistSprout }>();
  // A few signature sprouts from artists on Afterglow, to show what's out there.
  const teasers = useMemo(() => {
    const byName = new Map(catalog.artists.map((a) => [foldName(a.name), a]));
    return SIGNATURE_NAMES.map((n) => byName.get(n)).filter((a): a is Artist => !!a).slice(0, 4);
  }, [catalog]);
  const nameOf = (id: string, fallback?: string) => catalog.artist(id)?.name ?? fallback ?? 'An artist';

  return (
    <View style={styles.section}>
      <Text style={styles.h2} accessibilityRole="header">
        Artist sprouts{earned.length || given.length ? ` · ${earned.length + given.length}` : ''}
      </Text>
      <Text style={styles.sub}>{artistGardenLine(earned)}</Text>
      {earned.length || given.length ? (
        <View style={styles.grid}>
          {earned.map((s) => {
            const artist = catalog.artist(s.artistId);
            if (!artist) return null;
            return (
              <Pressable
                key={s.artistId}
                onPress={() => {
                  haptic.select();
                  setOpen({ artist, sprout: s });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${artist.name} sprout, ${tierLabel(s)}.`}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              >
                <Sprout artist={artistLook(artist)} tier={s.tier} stage={3} size={78} />
                <Text style={styles.tileName} numberOfLines={1}>
                  {artist.name}
                </Text>
                <Text style={styles.tileSub} numberOfLines={1}>
                  {tierLabel(s)}
                </Text>
              </Pressable>
            );
          })}
          {given.map((g) => {
            const artist = catalog.artist(g.artist.id) ?? ({ id: g.artist.id, name: g.artist.name, sound: {} } as Artist);
            return (
              <Pressable
                key={g.id}
                onPress={() => {
                  haptic.select();
                  setOpen({ artist, given: g });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${nameOf(g.artist.id, g.artist.name)} sprout, from ${g.from}.`}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              >
                <Sprout artist={artistLook(artist)} stage={3} size={78} />
                <Text style={styles.tileName} numberOfLines={1}>
                  {nameOf(g.artist.id, g.artist.name)}
                </Text>
                <Text style={styles.tileSub} numberOfLines={1}>
                  from {g.from}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : teasers.length ? (
        <View style={styles.teasers}>
          {teasers.map((a) => {
            const look = artistLook(a);
            return (
              <View key={a.id} style={styles.teaser} accessible accessibilityLabel={`${a.name}: ${look.theme.toLowerCase()}. Film their set to grow it.`}>
                <Sprout artist={look} stage={3} size={56} locked still />
                <Text style={styles.teaserName} numberOfLines={1}>
                  {a.name}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
      <ArtistSproutSheet open={open} canGive={canGive} onClose={() => setOpen(undefined)} />
    </View>
  );
}

function ArtistSproutSheet({ open, canGive, onClose }: { open?: { artist: Artist; sprout?: ArtistSprout; given?: GivenArtistSprout }; canGive: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const a = open?.artist;
  const s = open?.sprout;
  const look = a ? artistLook(a) : undefined;
  return (
    <Modal visible={!!open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        {a && look ? (
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]} onPress={() => {}} accessible={false}>
            <Sprout artist={look} tier={s?.tier ?? 0} stage={3} size={160} />
            <Text style={[styles.sheetName, { color: look.accent }]}>{a.name} sprout</Text>
            <Text style={styles.body}>{look.theme}.</Text>
            {s ? (
              <>
                <Text style={styles.label}>{tierLabel(s)}</Text>
                <Text style={styles.body}>
                  {tierLine(s.videos)}.{s.firstAt ? ` First filmed ${day(s.firstAt)}.` : ''}
                </Text>
              </>
            ) : open?.given ? (
              <Text style={styles.body}>
                From {open.given.from} · {day(open.given.at)}
              </Text>
            ) : null}
            <View style={styles.buttons}>
              {s && canGive ? (
                <Pressable
                  onPress={() => {
                    haptic.tap();
                    onClose();
                    router.push({ pathname: '/give-sprout', params: { artist: a.id } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Give someone a ${a.name} sprout`}
                  style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryText}>Give one</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  haptic.tap();
                  onClose();
                  router.push({ pathname: '/artist/[id]', params: { id: a.id } });
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryText}>See {a.name}</Text>
              </Pressable>
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, marginTop: space.md },
  h2: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: TILE, alignItems: 'center', paddingVertical: space.sm, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  tileName: { ...type.label, color: color.moon, marginTop: 2 },
  tileSub: { ...type.caption, color: color.moonFaint },
  teasers: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  teaser: { width: 74, alignItems: 'center', gap: 2 },
  teaserName: { ...type.caption, fontSize: 10, color: color.moonFaint },
  scrim: { flex: 1, backgroundColor: 'rgba(5,4,14,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.nightRaised, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.xl, alignItems: 'center', gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' },
  sheetName: { ...type.title, textAlign: 'center' },
  label: { ...type.label, color: color.moon },
  body: { ...type.body, color: color.moonDim, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginTop: space.md },
  primary: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: '#1E8F4A' },
  primaryText: { ...type.headline, color: color.moon },
  secondary: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
