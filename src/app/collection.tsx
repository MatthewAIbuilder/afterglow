import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { CHARMS, PATTERNS } from '../features/kandi/kandi';
import { CharmIcon, KandiBracelet } from '../features/kandi/KandiBracelet';
import { artistLook, shinyLook, stickerLook } from '../features/sprouts/artistLook';
import { Collectible } from '../features/sprouts/Collectible';
import { collection, type CollectionSet } from '../features/sprouts/collection';
import { Sprout } from '../features/sprouts/Sprout';
import { kindOf, type SproutKind } from '../features/sprouts/sprouts';
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useFinds } from '../state/finds';
import { useKandi } from '../state/kandi';
import { useSprouts } from '../state/sprouts';
import { color, glowA, radius, space, type } from '../theme/tokens';

const TILE = 68;

/**
 * Your collection: every set there is (sprout kinds, hand-made artist
 * collectibles, sound creatures, stickers, kandi beads and charms), what
 * you have and, as silhouettes, what's still out there and how to find it.
 */
export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const sprouts = useSprouts();
  const catalog = useCatalog();
  const { finds } = useFinds();
  const kandi = useKandi();
  const owned = useMemo(() => new Map(sprouts.artists.map((a) => [a.artistId, a])), [sprouts.artists]);
  const book = useMemo(
    () =>
      collection({
        kinds: sprouts.collected,
        artists: sprouts.artists,
        catalogArtists: catalog.artists,
        lookOf: (id) => {
          const a = catalog.artist(id);
          return a ? artistLook(a) : undefined;
        },
        stickers: new Set(finds.filter((f) => f.state === 'found').map((f) => f.creature)),
        kandi: kandi.received,
      }),
    [sprouts.collected, sprouts.artists, catalog, finds, kandi.received],
  );
  const pct = book.total ? Math.round((book.have / book.total) * 100) : 0;

  const tile = (s: CollectionSet, key: string, have: boolean) => {
    switch (s.id) {
      case 'kinds': {
        const k = kindOf(key as SproutKind);
        return { el: <Sprout kind={k.id} stage={3} size={TILE} locked={!have} still />, name: have ? k.short : '?', label: have ? k.name : t('A sprout kind you haven’t found: {how}', { how: k.how.toLowerCase() }) };
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
        return { el: <Collectible look={look} size={TILE} locked={!have} still />, name: have ? look.name.replace(/^The /, '') : '?', label: have ? look.name : t('One still to find') };
      }
      case 'beads': {
        const p = PATTERNS.find((x) => x.id === key)!;
        return { el: <View style={!have && styles.dim}><KandiBracelet word="" beads={p.id} size={TILE} /></View>, name: p.name, label: have ? p.name : t('{pattern} beads: not given to you yet', { pattern: p.name }) };
      }
      case 'charms': {
        const c = CHARMS.find((x) => x.id === key)!;
        return { el: <View style={[styles.charmTile, !have && styles.dim]}><CharmIcon id={c.id} size={40} /></View>, name: c.name, label: have ? c.name : t('The {charm} charm: not given to you yet', { charm: c.name }) };
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
          </View>
        </View>
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
                      disabled={!shown.open}
                      onPress={() => {
                        haptic.select();
                        shown.open?.();
                      }}
                      accessibilityRole={shown.open ? 'button' : 'image'}
                      accessibilityLabel={shown.label}
                      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                    >
                      <View style={!i.have && styles.locked}>{shown.el}</View>
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
    </View>
  );
}

/** The share of everything you've found, as a ring of light. */
function Ring({ pct }: { pct: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <View style={styles.ring}>
      <Svg width={104} height={104} viewBox="0 0 104 104">
        <Defs>
          <LinearGradient id="collRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#B99CFF" />
            <Stop offset="0.5" stopColor="#FF8AD8" />
            <Stop offset="1" stopColor="#8AFFD0" />
          </LinearGradient>
        </Defs>
        <Circle cx={52} cy={52} r={r} stroke={glowA(0.15)} strokeWidth={9} fill="none" />
        <Circle cx={52} cy={52} r={r} stroke="url(#collRing)" strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 52 52)" />
      </Svg>
      <Text style={styles.pct}>{`${pct}%`}</Text>
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
  ring: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  pct: { ...type.title, color: color.moon, position: 'absolute', fontVariant: ['tabular-nums'] },
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
});
