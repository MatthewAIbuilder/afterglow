import { router } from 'expo-router';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Artist } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { color, radius, space, type } from '../../theme/tokens';
import { artistLook, foldName, SIGNATURE_NAMES } from './artistLook';
import { type ArtistSprout, artistGardenLine, tierLabel, tierLine } from './artistSprouts';
import { Sprout } from './Sprout';

const day = (t: number) => (t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/** Artist collectibles someone gave you: the artist and who from. */
export type GivenArtistSprout = { id: string; artist: { id: string; name: string }; from: string; at: number };

/**
 * The garden's artist collectibles: one for every artist you've filmed,
 * levelled up by filming them more (bronze, silver, gold), and the ones
 * friends gave you. They live in the garden scene above; this is the count
 * and, with none yet, a few hand-made ones as grey figures to aim for.
 */
export function ArtistSproutsSection({ earned, given }: { earned: ArtistSprout[]; given: GivenArtistSprout[] }) {
  const catalog = useCatalog();
  // A few hand-made collectibles from artists on Afterglow, to show what's out there.
  const teasers = useMemo(() => {
    const byName = new Map(catalog.artists.map((a) => [foldName(a.name), a]));
    return SIGNATURE_NAMES.map((n) => byName.get(n)).filter((a): a is Artist => !!a).slice(0, 4);
  }, [catalog]);

  return (
    <View style={styles.section}>
      <Text style={styles.h2} accessibilityRole="header">
        Artist collectibles{earned.length || given.length ? ` · ${earned.length + given.length}` : ''}
      </Text>
      <Text style={styles.sub}>{earned.length || given.length ? `${artistGardenLine(earned)}${given.length ? ` · ${given.length} from friends` : ''}. They live in your garden above.` : artistGardenLine(earned)}</Text>
      {!earned.length && !given.length && teasers.length ? (
        <View style={styles.teasers}>
          {teasers.map((a) => {
            const look = artistLook(a);
            return (
              <View key={a.id} style={styles.teaser} accessible accessibilityLabel={`${a.name}: ${look.name}, ${look.theme.toLowerCase()}. Film their set to earn it.`}>
                <Sprout artist={look} stage={3} size={56} locked still />
                <Text style={styles.teaserName} numberOfLines={1}>
                  {a.name}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** An artist collectible's sheet: the creature, its level or who gave it, and ways to give one or see the artist. */
export function ArtistSproutSheet({ open, canGive, onClose }: { open?: { artist: Artist; sprout?: ArtistSprout; given?: GivenArtistSprout }; canGive: boolean; onClose: () => void }) {
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
            <Text style={[styles.sheetName, { color: look.accent }]}>{look.name}</Text>
            <Text style={styles.label}>{a.name}</Text>
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
                  accessibilityLabel={`Give someone a ${a.name} collectible`}
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
