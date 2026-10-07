import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { BadgeCelebration } from '../features/profile/BadgeCelebration';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import type { Artist } from '../data/models';
import { SPROUT_GREEN } from '../features/sprouts/look';
import { claimLine } from '../features/sprouts/outbox';
import { Sprout } from '../features/sprouts/Sprout';
import { SproutOf } from '../features/sprouts/SproutOf';
import { ArtistSproutSheet, ArtistSproutsSection, type GivenArtistSprout } from '../features/sprouts/ArtistSproutsSection';
import { type ArtistSprout, TIER_AT, tierLabel, toNextTier } from '../features/sprouts/artistSprouts';
import { TIER_COLOR } from '../features/sprouts/Collectible';
import { GardenScene, type SceneResident } from '../features/sprouts/GardenScene';
import { FindsSection } from '../features/finds/FindsSection';
import { artistLook } from '../features/sprouts/artistLook';
import { useCatalog } from '../state/catalog';
import { gardenLine, GROW_TIPS, growthLine, kindOf, seedsLine, SPROUT_KINDS, sproutName, STAGE_NAMES, STARTER_ID, type GardenView } from '../features/sprouts/sprouts';
import { LOCALE, t } from '../i18n';
import { haptic } from '../lib/haptics';
import { useNow } from '../lib/useNow';
import { useSocial } from '../state/social';
import { useSprouts } from '../state/sprouts';
import { type ReceivedKandi, useKandi } from '../state/kandi';
import { KandiLine } from '../features/kandi/KandiLine';
import { KandiBracelet } from '../features/kandi/KandiBracelet';
import { showAlert } from '../lib/dialog';
import { color, radius, space, type } from '../theme/tokens';

const GIVEN_SHOWN = 12;
/** A sprout or collectible that arrived this recently glows in the garden. */
const FRESH_MS = 60 * 60 * 1000;
/** How big each stands in the garden: by stage for a sprout, by level for a collectible. */
const STAGE_SIZE = [64, 74, 84, 94] as const;
const TIER_SIZE = [78, 83, 88, 94] as const;
const ARTIST_PREFIX = 'artist:';
const CONTENT_MAX = 640;

const day = (at: number) => new Date(at).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
/** Who gave it: their name or @handle, if known. */
const giverOf = (s: GardenView) => s.name ?? (s.handle ? `@${s.handle}` : undefined);
const fromLine = (s: GardenView) => {
  if (s.id === STARTER_ID) return t('Your first sprout');
  if (s.foundAt) return t('Found at {place}', { place: s.foundAt });
  const who = giverOf(s);
  return who !== undefined ? t('from {name}', { name: who }) : t('from someone');
};
const nameOf = (s: GardenView) => (s.shown === 'seedling' ? t('Sprout') : kindOf(s.shown).name);

/**
 * Your garden: every sprout you've been given (and your first one), growing
 * with what you do, and every artist collectible you've earned or been given,
 * living in a night meadow you can rearrange (GardenScene); the kinds you've
 * collected; seeds to give; and the sprouts you've given and who picked them up.
 */
export default function GardenScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const sprouts = useSprouts();
  const social = useSocial();
  const now = useNow().getTime();
  const [open, setOpen] = useState<GardenView>();
  const kandi = useKandi();
  const [openKandi, setOpenKandi] = useState<ReceivedKandi>();
  const [openArtist, setOpenArtist] = useState<{ artist: Artist; sprout?: ArtistSprout; given?: GivenArtistSprout }>();
  // The garden moves only while this screen is showing; the page doesn't scroll while something's carried.
  const [focused, setFocused] = useState(false);
  const [carrying, setCarrying] = useState(false);
  const { refresh } = sprouts;
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void refresh();
      return () => setFocused(false);
    }, [refresh, setFocused]),
  );
  const catalog = useCatalog();
  const waiting = sprouts.claims.filter((c) => c.state === 'waiting');
  const bloom = sprouts.newBlooms[0];
  // After blooms, a new or levelled-up artist sprout gets its moment.
  const fresh = bloom ? undefined : sprouts.newArtists[0];
  const freshArtist = fresh ? catalog.artist(fresh.artistId) : undefined;
  const plain = sprouts.garden.filter((g) => !g.artist);
  const givenArtists: GivenArtistSprout[] = sprouts.garden.flatMap((g) => (g.artist ? [{ id: g.id, artist: g.artist, from: g.id === STARTER_ID || g.foundAt ? fromLine(g) : (giverOf(g) ?? t('someone')), at: g.at }] : []));
  const kinds = SPROUT_KINDS.filter((k) => k.id !== 'seedling');
  const collected = kinds.filter((k) => sprouts.collected.has(k.id)).length;
  const artistOf = (a: { id: string; name: string }): Artist => catalog.artist(a.id) ?? ({ id: a.id, name: a.name, sound: {} } as Artist);

  // Everyone in the garden: your sprouts (newest first), then your artist collectibles, then the ones friends gave you.
  const residents: SceneResident[] = [
    ...plain.map((s) => ({
      id: s.id,
      name: kindOf(s.shown).short,
      label: t('{name}, {from}. {growth}.', { name: nameOf(s), from: fromLine(s), growth: s.shown === 'seedling' && s.growth ? growthLine(s.growth) : STAGE_NAMES[s.stage] }),
      size: STAGE_SIZE[s.stage],
      bar: s.stage < 3 && s.growth ? { at: (s.stage + s.growth.toNext) / 3, color: SPROUT_GREEN } : undefined,
      fresh: sprouts.newBlooms.some((b) => b.id === s.id) || (s.id !== STARTER_ID && s.at > now - FRESH_MS),
      look: { kind: s.shown, stage: s.stage },
    })),
    ...sprouts.artists.flatMap((a) => {
      const artist = catalog.artist(a.artistId);
      if (!artist) return [];
      const next = toNextTier(a.videos);
      return [
        {
          id: `${ARTIST_PREFIX}${a.artistId}`,
          name: artist.name,
          label: t('{artist} collectible, {tier}.', { artist: artist.name, tier: tierLabel(a) }),
          size: TIER_SIZE[a.tier],
          bar: { at: next ? (a.videos - TIER_AT[a.tier]) / (TIER_AT[next.tier] - TIER_AT[a.tier]) : 1, color: TIER_COLOR[next ? next.tier : 3] },
          fresh: sprouts.newArtists.some((n) => n.artistId === a.artistId),
          look: { artist: artistLook(artist), tier: a.tier },
        },
      ];
    }),
    ...givenArtists.map((g) => {
      const artist = artistOf(g.artist);
      return { id: g.id, name: artist.name, label: t('{artist} collectible, from {name}.', { artist: artist.name, name: g.from }), size: TIER_SIZE[0], fresh: g.at > now - FRESH_MS, look: { artist: artistLook(artist), tier: 0 as const } };
    }),
  ];
  const openResident = (id: string) => {
    const s = plain.find((p) => p.id === id);
    if (s) return setOpen(s);
    if (id.startsWith(ARTIST_PREFIX)) {
      const a = sprouts.artists.find((x) => `${ARTIST_PREFIX}${x.artistId}` === id);
      const artist = a ? catalog.artist(a.artistId) : undefined;
      if (a && artist) setOpenArtist({ artist, sprout: a });
      return;
    }
    const g = givenArtists.find((x) => x.id === id);
    if (g) setOpenArtist({ artist: artistOf(g.artist), given: g });
  };

  return (
    <View style={styles.root}>
      <PageTitle title={t('Your garden')} />
      <NightSky />
      <PageActions />
      <ScrollView scrollEnabled={!carrying} contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.title} accessibilityRole="header">
          {t('Your garden')}
        </Text>
        <Text style={styles.sub}>{gardenLine(plain)}</Text>

        <View style={styles.seedCard}>
          <Text style={styles.seeds}>{seedsLine(sprouts.seeds, sprouts.festivalDay)}</Text>
          <View style={styles.buttons}>
            <Pressable
              onPress={() => {
                haptic.tap();
                router.push('/give-sprout');
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>{t('Give a sprout')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic.tap();
                router.push('/kandi-make');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Make kandi for a friend')}
              style={({ pressed }) => [styles.kandi, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>{t('Make kandi')}</Text>
            </Pressable>
            {Platform.OS !== 'web' ? (
              <Pressable
                onPress={() => {
                  haptic.tap();
                  router.push('/scan');
                }}
                accessibilityRole="button"
                accessibilityLabel={t("Scan a sprout someone's giving you")}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryText}>{t('Scan a sprout')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {waiting.length ? (
          <View style={styles.section}>
            {waiting.map((c) => (
              <View key={c.card.id} style={styles.waitRow}>
                <SproutOf kind={c.card.kind} artist={c.card.artist} stage={0} size={36} still />
                <Text style={styles.waitText}>
                  {c.card.artist
                    ? t('A {artist} collectible from {name}. {status}', { artist: c.card.artist.name, name: c.card.name, status: claimLine(c) })
                    : t('A sprout from {name}. {status}', { name: c.card.name, status: claimLine(c) })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <GardenScene
          residents={residents}
          account={social.user?.uid ?? 'guest'}
          width={Math.min(CONTENT_MAX, windowWidth) - 2 * space.xl}
          focused={focused}
          ready={sprouts.hydrated}
          onOpen={openResident}
          onCarrying={setCarrying}
        />
        <Text style={styles.hint}>{GROW_TIPS[0]} {t('Sprouts you give help yours grow too.')} {t('Hold one to move it.')}</Text>
        {/* Kandi friends left here. */}
        <KandiLine items={kandi.received.map((k) => ({ key: k.id, word: k.word, beads: k.beads, from: k.fromHandle }))} onOpen={(id) => setOpenKandi(kandi.received.find((k) => k.id === id))} />
        {social.profile ? (
          <View style={styles.showRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.showTitle}>{t('Show my garden on my profile')}</Text>
              <Text style={styles.hint}>{t('Friends can visit and make your sprouts dance. Only who lives here shows, never notes.')}</Text>
            </View>
            <Switch
              value={sprouts.gardenShown}
              onValueChange={(on) => {
                haptic.select();
                sprouts.setGardenShown(on);
              }}
              accessibilityLabel={t('Show my garden on my profile')}
              trackColor={{ true: SPROUT_GREEN, false: 'rgba(255,255,255,0.15)' }}
            />
          </View>
        ) : null}

        <FindsSection />
        <ArtistSproutsSection earned={sprouts.artists} given={givenArtists} />

        <View style={styles.section}>
          <Text style={styles.h2}>
            {t('Kinds · {n} of {total}', { n: collected, total: kinds.length })}
          </Text>
          <View style={styles.kinds}>
            {kinds.map((k) => {
              const got = sprouts.collected.has(k.id);
              return (
                <View key={k.id} style={styles.kind} accessible accessibilityLabel={got ? t('{name}, collected. {about}', { name: k.name, about: k.about }) : t('{name}, not collected yet. {how}.', { name: k.name, how: k.how })}>
                  <Sprout kind={k.id} stage={3} size={52} locked={!got} still={!got} />
                  <Text style={[styles.kindName, !got && styles.dim]} numberOfLines={1}>
                    {k.short}
                  </Text>
                  {!got ? (
                    <Text style={styles.kindHow} numberOfLines={2}>
                      {k.grows}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {sprouts.gifts.length ? (
          <View style={styles.section}>
            <Text style={styles.h2}>{t('Given · {n}', { n: sprouts.gifts.length })}</Text>
            {sprouts.gifts.slice(0, GIVEN_SHOWN).map((g) => (
              <View key={g.id} style={styles.givenRow}>
                <SproutOf kind={g.kind} artist={g.artist} stage={g.kind === 'seedling' ? 2 : 3} size={40} still />
                <View style={{ flex: 1 }}>
                  <Text style={styles.givenName}>{sproutName(g)}</Text>
                  <Text style={[styles.givenState, g.claimedBy ? { color: SPROUT_GREEN } : !g.sent ? styles.amberText : null]}>
                    {g.claimedBy
                      ? g.claimedBy.name != null || g.claimedBy.handle
                        ? t('Picked up by {name}', { name: g.claimedBy.name ?? `@${g.claimedBy.handle}` })
                        : t('Picked up by someone')
                      : g.sent
                        ? t('Not picked up yet')
                        : g.failed
                          ? t('Couldn’t be sent, so your seed is back')
                          : t('Waiting for signal')}{' '}
                    · {day(g.at)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <KandiSheet kandi={openKandi} onClose={() => setOpenKandi(undefined)} onRemove={(id) => void kandi.remove(id).then((ok) => ok && setOpenKandi(undefined))} />
      <SproutSheet sprout={open} onClose={() => setOpen(undefined)} />
      <ArtistSproutSheet open={openArtist} canGive={sprouts.ready} onClose={() => setOpenArtist(undefined)} />
      {/* A sprout that bloomed since you last looked gets its moment, one at a time. */}
      <BadgeCelebration
        id={bloom?.id ?? (fresh ? `artist:${fresh.artistId}:${fresh.tier}` : undefined)}
        unlock={
          open || openArtist
            ? undefined
            : bloom
              ? { kind: 'sprout', sprout: bloom.kind, foundAt: bloom.foundAt }
              : fresh && freshArtist
                ? { kind: 'artistSprout', name: freshArtist.name, look: artistLook(freshArtist), tier: fresh.tier, videos: fresh.videos }
                : undefined
        }
        onDone={() => {
          if (bloom) sprouts.bloomShown(bloom.id);
          else if (fresh) sprouts.artistShown(fresh);
        }}
      />
    </View>
  );
}

function KandiSheet({ kandi: k, onClose, onRemove }: { kandi?: ReceivedKandi; onClose: () => void; onRemove: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!k} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close')}>
        {k ? (
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]} onPress={() => {}} accessible={false}>
            <KandiBracelet word={k.word} beads={k.beads} size={220} label={t('A kandi bracelet spelling {word}', { word: k.word })} />
            <Text style={styles.sub}>
              {k.fromHandle ? t('from {name}', { name: `@${k.fromHandle}` }) : t('from someone')} · {day(Date.parse(k.createdAt))}
            </Text>
            {k.note ? <Text style={styles.note}>“{k.note}”</Text> : null}
            <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.secondary, styles.sheetClose, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>{t('Done')}</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                showAlert(t('Take this kandi out of your garden?'), t('It’s gone for good, and nobody visiting sees it any more.'), [
                  { text: t('Keep it'), style: 'cancel' },
                  { text: t('Take it out'), style: 'destructive', onPress: () => onRemove(k.id) },
                ])
              }
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.removeKandi}>{t('Take it out of my garden')}</Text>
            </Pressable>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

function SproutSheet({ sprout, onClose }: { sprout?: GardenView; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const s = sprout;
  return (
    <Modal visible={!!s} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close')}>
        {s ? (
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]} onPress={() => {}} accessible={false}>
            <Sprout kind={s.shown} stage={s.stage} size={150} />
            <Text style={styles.sheetName}>{nameOf(s)}</Text>
            <Text style={styles.sub}>
              {fromLine(s)} · {day(s.at)}
            </Text>
            {s.note ? <Text style={styles.note}>“{s.note}”</Text> : null}
            {s.shown !== 'seedling' ? <Text style={styles.body}>{kindOf(s.shown).about}</Text> : null}
            {s.kind === 'seedling' && s.growth && s.stage < 3 ? (
              <>
                <View style={[styles.bar, styles.barWide]}>
                  <View style={[styles.barFill, { width: `${Math.round(((s.stage + s.growth.toNext) / 3) * 100)}%` }]} />
                </View>
                <Text style={styles.growLine}>{growthLine(s.growth)}</Text>
                {s.growth.leaning !== 'seedling' && s.stage >= 1 ? <Text style={styles.body}>{t('Growing into a {sprout}.', { sprout: kindOf(s.growth.leaning).name })}</Text> : null}
                {GROW_TIPS.map((tip) => (
                  <Text key={tip} style={styles.tip}>
                    · {tip}
                  </Text>
                ))}
              </>
            ) : s.kind === 'seedling' ? (
              <Text style={styles.body}>{t('In bloom. You can give {name}s now.', { name: kindOf(s.shown).name })}</Text>
            ) : null}
            <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.secondary, styles.sheetClose, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>{t('Done')}</Text>
            </Pressable>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  removeKandi: { ...type.label, color: color.moonDim, textAlign: 'center', marginTop: space.sm },
  showRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  showTitle: { ...type.headline, color: color.moon },
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, gap: space.md, maxWidth: CONTENT_MAX, width: '100%', alignSelf: 'center' },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim },
  h2: { ...type.headline, color: color.moon },
  body: { ...type.body, color: color.moonDim, textAlign: 'center' },
  hint: { ...type.caption, color: color.moonFaint },
  seedCard: { padding: space.lg, gap: space.md, borderRadius: radius.lg, backgroundColor: 'rgba(110,231,160,0.08)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(110,231,160,0.35)' },
  seeds: { ...type.label, color: SPROUT_GREEN },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kandi: { flex: 1, minWidth: 130, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  primary: { flex: 1, minWidth: 130, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: '#1E8F4A' },
  primaryText: { ...type.headline, color: color.moon },
  secondary: { flex: 1, minWidth: 130, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  secondaryText: { ...type.headline, color: color.moon },
  section: { gap: space.sm, marginTop: space.md },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,184,107,0.6)' },
  waitText: { ...type.caption, color: '#FFB86B', flex: 1 },
  bar: { width: 64, height: 4, borderRadius: 2, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  barWide: { width: 200 },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: SPROUT_GREEN },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kind: { width: 74, alignItems: 'center', gap: 2 },
  kindName: { ...type.caption, color: color.moon },
  kindHow: { ...type.caption, fontSize: 10, lineHeight: 12, color: color.moonFaint, textAlign: 'center' },
  dim: { color: color.moonFaint },
  givenRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  givenName: { ...type.label, color: color.moon },
  givenState: { ...type.caption, color: color.moonDim },
  amberText: { color: '#FFB86B' },
  scrim: { flex: 1, backgroundColor: 'rgba(5,4,14,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.nightRaised, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.xl, alignItems: 'center', gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' },
  sheetName: { ...type.title, color: SPROUT_GREEN },
  note: { ...type.headline, color: color.moon, fontStyle: 'italic', textAlign: 'center' },
  growLine: { ...type.label, color: SPROUT_GREEN },
  tip: { ...type.caption, color: color.moonFaint, alignSelf: 'stretch', textAlign: 'center' },
  sheetClose: { flex: 0, alignSelf: 'stretch', marginTop: space.md },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
