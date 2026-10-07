import { router } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { CHARMS, PATTERNS } from '../features/kandi/kandi';
import { CharmIcon, KandiBracelet } from '../features/kandi/KandiBracelet';
import { artistLook, shinyLook, stickerLook } from '../features/sprouts/artistLook';
import { Collectible } from '../features/sprouts/Collectible';
import type { CollectionSet } from '../features/sprouts/collection';
import { Sprout } from '../features/sprouts/Sprout';
import { SproutCard } from '../features/sprouts/CollectibleCard';
import { HoloTilt } from '../features/sprouts/HoloTilt';
import { DECOR } from '../features/sprouts/decor';
import { DecorIcon } from '../features/sprouts/DecorSky';
import { kindOf, type SproutKind } from '../features/sprouts/sprouts';
import { t, tn } from '../i18n';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useSprouts } from '../state/sprouts';
import { useMyCollection } from '../features/sprouts/useMyCollection';
import { useSocial } from '../state/social';
import { StoryPreview } from '../features/sprouts/StoryShare';
import { CollectionStory, Ring } from '../features/sprouts/CollectionStory';
import { color, glowA, radius, space, type } from '../theme/tokens';

const TILE = 68;
/** One you have, opened big. */
const DETAIL = 220;

/**
 * Your collection: every set there is (sprout kinds, hand-made artist
 * collectibles, sound creatures, stickers, kandi beads and charms), what
 * you have and, as silhouettes, what's still out there and how to find it.
 */
export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const sprouts = useSprouts();
  const catalog = useCatalog();
  const owned = useMemo(() => new Map(sprouts.artists.map((a) => [a.artistId, a])), [sprouts.artists]);
  const { book, ready: allRead, haveKeys, fresh, seen: seenList, saveSeen } = useMyCollection();
  const pct = book.total ? Math.round((book.have / book.total) * 100) : 0;
  const social = useSocial();
  const handle = social.profile?.handle;
  // What's new since you last looked (nothing, the first time); all of it counts as seen once you leave.
  const leaving = useRef({ allRead, seenList, haveKeys, saveSeen });
  useEffect(() => {
    leaving.current = { allRead, seenList, haveKeys, saveSeen };
  });
  useEffect(
    () => () => {
      const l = leaving.current;
      if (l.allRead) l.saveSeen([...(l.seenList ?? []), ...l.haveKeys]);
    },
    [],
  );
  const [story, setStory] = useState(false);
  // One you have, opened big.
  const [detail, setDetail] = useState<{ el: ReactNode; title: string; body?: string }>();
  // The best of what you have, for the picture: shiny first, then the highest level, hand-made before sound.
  const best = useMemo(
    () =>
      [...sprouts.artists]
        .map((a) => ({ a, artist: catalog.artist(a.artistId) }))
        .filter((x) => !!x.artist)
        .map((x) => ({ ...x, look: artistLook(x.artist!) }))
        .sort((x, y) => Number(!!y.a.shiny) - Number(!!x.a.shiny) || y.a.tier - x.a.tier || Number(y.look.signature) - Number(x.look.signature) || y.a.videos - x.a.videos)
        .slice(0, 5),
    [sprouts.artists, catalog],
  );

  const tile = (s: CollectionSet, key: string, have: boolean) => {
    switch (s.id) {
      case 'kinds': {
        const k = kindOf(key as SproutKind);
        return {
          el: <Sprout kind={k.id} stage={3} size={TILE} locked={!have} still />,
          name: have ? k.short : '?',
          label: have ? k.name : t('A sprout kind you haven’t found: {how}', { how: k.how.toLowerCase() }),
          detail: have
            ? {
                el: (
                  <HoloTilt width={DETAIL} height={Math.round(DETAIL * 1.4)}>
                    <SproutCard kind={k.id} line={k.how} width={DETAIL} />
                  </HoloTilt>
                ),
                title: k.name,
              }
            : undefined,
        };
      }
      case 'signatures': {
        const a = catalog.artist(key);
        if (!a) return undefined;
        const mine = owned.get(key);
        const look = artistLook(a);
        return {
          el: <Collectible look={mine?.shiny ? shinyLook(look) : look} shiny={!!mine?.shiny} tier={mine?.tier ?? 0} size={TILE} locked={!mine} still />,
          name: a.name,
          label: mine ? t('{name}, from {artist}', { name: look.name, artist: a.name }) : t('Not yet: film {artist}’s set', { artist: a.name }),
          open: () => router.push({ pathname: '/artist/[id]', params: { id: a.id } }),
        };
      }
      case 'sounds':
      case 'stickers': {
        const look = stickerLook(key);
        if (!look) return undefined;
        return {
          el: <Collectible look={look} size={TILE} locked={!have} still />,
          name: have ? look.name.replace(/^The /, '') : '?',
          label: have ? look.name : t('One still to find'),
          detail: have ? { el: <Collectible look={look} size={DETAIL} />, title: look.name, body: `${look.theme}.` } : undefined,
        };
      }
      case 'beads': {
        const p = PATTERNS.find((x) => x.id === key)!;
        return {
          el: <View style={!have && styles.dim}><KandiBracelet word="" beads={p.id} size={TILE} /></View>,
          name: p.name,
          label: have ? p.name : t('{pattern} beads: not given to you yet', { pattern: p.name }),
          detail: have ? { el: <KandiBracelet word={p.name.toUpperCase().slice(0, 12)} beads={p.id} size={DETAIL} />, title: t('{pattern} beads', { pattern: p.name }) } : undefined,
        };
      }
      case 'decor': {
        const d = DECOR.find((x) => x.id === key)!;
        return {
          el: <View style={!have && styles.dim}><DecorIcon id={d.id} size={TILE} /></View>,
          name: d.name,
          label: have ? d.name : t('{name}: {how}', { name: d.name, how: d.how }),
          detail: have ? { el: <DecorIcon id={d.id} size={DETAIL * 0.8} />, title: d.name, body: t('Earned: {how}. It hangs in your garden’s sky.', { how: d.how.toLowerCase() }) } : undefined,
        };
      }
      case 'charms': {
        const c = CHARMS.find((x) => x.id === key)!;
        return {
          el: <View style={[styles.charmTile, !have && styles.dim]}><CharmIcon id={c.id} size={40} /></View>,
          name: c.name,
          label: have ? c.name : t('The {charm} charm: not given to you yet', { charm: c.name }),
          detail: have ? { el: <CharmIcon id={c.id} size={DETAIL * 0.6} />, title: t('The {charm} charm', { charm: c.name }) } : undefined,
        };
      }
    }
  };

  return (
    <View style={styles.root}>
      <PageTitle title={t('Your collection')} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.title} accessibilityRole="header">
          {t('Your collection')}
        </Text>
        <View style={styles.hero} accessible accessibilityLabel={t('{pct} percent collected: {have} of {total}', { pct, have: book.have, total: book.total })}>
          <Ring pct={pct} />
          <View style={styles.heroText}>
            <Text style={styles.big}>{t('{have} of {total}', { have: book.have, total: book.total })}</Text>
            <Text style={styles.sub}>{t('found across every set')}</Text>
            {book.shiny ? <Text style={styles.shiny}>{t('✦ {n} shiny', { n: book.shiny })}</Text> : null}
            {fresh.size ? <Text style={styles.newLine}>{tn(fresh.size, '{n} new since you last looked', '{n} new since you last looked')}</Text> : null}
          </View>
        </View>
        {book.have ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              setStory(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Share your collection as a picture')}
            style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
          >
            <Text style={styles.shareText}>{t('Share my collection')}</Text>
          </Pressable>
        ) : null}
        {book.sets.map((s) => (
          <View key={s.id} style={styles.set}>
            <View style={styles.setHead}>
              <Text style={styles.setTitle}>{s.title}</Text>
              <Text style={[styles.count, s.have === s.total && styles.done]}>{`${s.have}/${s.total}`}</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${s.total ? (s.have / s.total) * 100 : 0}%` }]} />
            </View>
            <Text style={styles.how}>{s.have === s.total ? t('Complete.') : s.how}</Text>
            <View style={styles.grid}>
              {[...s.items]
                .sort((a, b) => Number(b.have) - Number(a.have))
                .map((i) => {
                  const shown = tile(s, i.key, i.have);
                  if (!shown) return null;
                  return (
                    <Pressable
                      key={i.key}
                      disabled={!shown.open && !shown.detail}
                      onPress={() => {
                        haptic.select();
                        if (shown.open) shown.open();
                        else if (shown.detail) setDetail(shown.detail);
                      }}
                      accessibilityRole={shown.open || shown.detail ? 'button' : 'image'}
                      accessibilityLabel={shown.label}
                      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                    >
                      <View style={!i.have && styles.locked}>{shown.el}</View>
                      {fresh.has(`${s.id}:${i.key}`) ? <Text style={styles.newTag}>{t('New')}</Text> : null}
                      <Text style={[styles.tileName, !i.have && styles.tileNameOff]} numberOfLines={1}>
                        {shown.name}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          </View>
        ))}
      </ScrollView>
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(undefined)}>
        <Pressable style={styles.scrim} onPress={() => setDetail(undefined)} accessibilityRole="button" accessibilityLabel={t('Close')}>
          {detail ? (
            <View style={styles.detail}>
              {detail.el}
              <Text style={styles.detailTitle}>{detail.title}</Text>
              {detail.body ? <Text style={styles.detailBody}>{detail.body}</Text> : null}
              <Pressable onPress={() => setDetail(undefined)} accessibilityRole="button" style={({ pressed }) => [styles.detailDone, pressed && styles.pressed]}>
                <Text style={styles.shareText}>{t('Done')}</Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Modal>
      {story ? (
        <StoryPreview
          title={t('My Afterglow collection')}
          tint="#2A1A5E"
          glow="#B99CFF"
          headline={handle ? t('@{handle}’s collection', { handle }) : t('My Afterglow collection')}
          sub={book.shiny ? t('{have} of {total} found · {n} shiny', { have: book.have, total: book.total, n: book.shiny }) : t('{have} of {total} found', { have: book.have, total: book.total })}
          onClose={() => setStory(false)}
        >
          {(w) => <CollectionStory width={w} pct={pct} best={best} sets={book.sets} />}
        </StoryPreview>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { ...type.largeTitle, color: color.moon },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  heroText: { flex: 1, gap: 2 },
  big: { ...type.title, color: color.moon, fontVariant: ['tabular-nums'] },
  sub: { ...type.body, color: color.moonDim },
  shiny: { ...type.label, color: '#FFE58A', marginTop: space.xs },
  set: { gap: space.xs },
  setHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  setTitle: { ...type.headline, color: color.moon },
  count: { ...type.label, color: color.moonDim, fontVariant: ['tabular-nums'] },
  done: { color: '#8AFFD0' },
  bar: { height: 4, borderRadius: 2, backgroundColor: glowA(0.12), overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: color.glow },
  how: { ...type.caption, color: color.moonFaint },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  tile: { width: TILE + 8, alignItems: 'center', gap: 2 },
  tileName: { ...type.caption, fontSize: 10, color: color.moonDim, textAlign: 'center' },
  tileNameOff: { color: color.moonFaint },
  charmTile: { width: TILE, height: TILE, borderRadius: TILE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass },
  dim: { opacity: 0.22 },
  locked: { opacity: 0.6 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  newTag: { position: 'absolute', top: 0, right: 0, ...type.caption, fontSize: 10, fontWeight: '700', color: color.night, backgroundColor: '#FFE58A', paddingHorizontal: 6, borderRadius: radius.pill, overflow: 'hidden' },
  newLine: { ...type.label, color: '#FFE58A', marginTop: space.xs },
  scrim: { flex: 1, backgroundColor: 'rgba(5,4,14,0.86)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  detail: { alignItems: 'center', gap: space.sm, maxWidth: 360 },
  detailTitle: { ...type.title, color: color.moon, textAlign: 'center', marginTop: space.md },
  detailBody: { ...type.body, color: color.moonDim, textAlign: 'center' },
  detailDone: { marginTop: space.lg, paddingHorizontal: space.xxl, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  shareBtn: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  shareText: { ...type.headline, color: color.moon },
});
