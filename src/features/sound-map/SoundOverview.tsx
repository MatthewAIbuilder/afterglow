import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { ChevronIcon } from '../../components/TabIcons';
import { SOUND_LABEL, type SoundTag } from '../../data/models';
import type { Artist } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import type { SoundShare } from '../taste/lean';
import { SOUND_COLOR, withAlpha } from './colors';
import { t } from '../../i18n';
import { artistsIn, closeTo, nextSounds, otherSounds, SOUND_GUIDE, type SoundTip, soundTips } from './guide';

/**
 * My Sound's overview, under your sound's summary: every sound as a tile in a grid (the user, 2026-10-18: "instead
 * of being very elongated down the page… a grid… if you click on one, you can see all the nitty gritty"). Yours
 * first, with how much of your sound each is; then the ones close to yours to try next; then the rest. A tap
 * opens that sound's own page (`/sound-guide/[tag]`: what it feels like, what to listen for, your best matches,
 * the festivals with the most of it). Tips for finding your sound fold into one row. The bubble map is one tap away.
 */
export function SoundOverview({
  shares,
  artists,
  taste,
  shaped,
  canConnect,
  hasFestivals,
  onOpenMap,
}: {
  shares: readonly SoundShare[];
  artists: readonly Artist[];
  taste: Record<string, number>;
  /** Kept for the caller: whether a sound has enough clips to watch is shown on its own page now. */
  watchable?: ReadonlySet<SoundTag>;
  shaped: boolean;
  canConnect: boolean;
  hasFestivals: boolean;
  onOpenMap: () => void;
}) {
  const yours = shares.slice(0, 3).map((s) => s.tag);
  const next = nextSounds(yours);
  const rest = otherSounds([...yours, ...next]);
  const [tipsOpen, setTipsOpen] = useState(false);
  const tips = soundTips({ shaped, canConnect, hasFestivals });
  const tile = (tag: SoundTag, kicker?: string) => (
    <SoundTile key={tag} tag={tag} kicker={kicker} share={shares.find((x) => x.tag === tag)} faces={artistsIn(tag, artists, taste, 3)} />
  );

  return (
    <View style={styles.wrap}>
      {yours.length ? (
        <Section
          title={shaped ? t('Your sounds') : t('Where you might start')}
          sub={shaped ? t('Tap a sound to see everything about it.') : t('A first guess. Like, skip and rate and these become yours.')}
        >
          <View style={styles.grid}>{yours.map((tag) => tile(tag))}</View>
        </Section>
      ) : null}

      <Section title={t('Sounds to try next')} sub={t('Close to yours, so there’s a good chance you’ll love them.')}>
        <View style={styles.grid}>{next.map((tag) => tile(tag, closeTo(tag, yours)))}</View>
      </Section>

      <Section title={t('Every sound')}>
        <View style={styles.grid}>{rest.map((tag) => tile(tag))}</View>
      </Section>

      <Pressable
        onPress={() => {
          haptic.select();
          setTipsOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: tipsOpen }}
        style={({ pressed }) => [styles.tipsHead, pressed && styles.pressed]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.h2}>{t('Find your sound faster')}</Text>
          <Text style={styles.sub}>{tipsOpen ? t('A few quick ways to teach your map.') : t('{n} quick ways to teach your map', { n: tips.length })}</Text>
        </View>
        <ChevronIcon color={color.moonFaint} size={11} direction={tipsOpen ? 'up' : 'down'} />
      </Pressable>
      {tipsOpen ? (
        <View style={styles.tips}>
          {tips.map((tip, i) => (
            <Tip key={tip.id} tip={tip} last={i === tips.length - 1} onOpenMap={onOpenMap} />
          ))}
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          haptic.tap();
          onOpenMap();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('Open your bubble map')}
        style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}
      >
        <Text style={styles.mapButtonText}>{t('Open your bubble map')}</Text>
      </Pressable>
    </View>
  );
}

/** One sound in the grid: its light, name, a line on how it feels, how much of your sound it is, and a few faces. */
function SoundTile({ tag, kicker, share, faces }: { tag: SoundTag; kicker?: string; share?: SoundShare; faces: Artist[] }) {
  const tone = SOUND_COLOR[tag];
  const label = SOUND_LABEL[tag];
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/sound-guide/[tag]', params: { tag } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}${share ? `, ${t('{pct}% of your sound', { pct: share.percent })}` : ''}. ${SOUND_GUIDE[tag].feel}`}
      accessibilityHint={t('Opens everything about this sound')}
      style={({ pressed }) => [styles.tile, { borderColor: withAlpha(tone, 0.32), backgroundColor: withAlpha(tone, 0.08) }, pressed && styles.pressed]}
    >
      <View style={styles.tileTop}>
        <Dot tag={tag} size={12} />
        {share ? <Text style={[styles.pct, { color: tone }]}>{`${share.percent}%`}</Text> : null}
      </View>
      <Text style={[styles.tileTitle, { color: tone }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.tileFeel} numberOfLines={3}>
        {SOUND_GUIDE[tag].feel}
      </Text>
      {kicker ? (
        <Text style={styles.tileKicker} numberOfLines={1}>
          {kicker}
        </Text>
      ) : null}
      {faces.length ? (
        <View style={styles.tileFaces}>
          {faces.map((a, i) => (
            <View key={a.id} style={[styles.face, { marginLeft: i === 0 ? 0 : -8, zIndex: 5 - i }]}>
              <ArtistAvatar artist={a} size={26} />
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2} accessibilityRole="header">
        {title}
      </Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      {children}
    </View>
  );
}

/** A sound's colour as a small glowing light. */
const Dot = ({ tag, size = 12 }: { tag: SoundTag; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: SOUND_COLOR[tag], shadowColor: SOUND_COLOR[tag], shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }} />
);

function Tip({ tip, last, onOpenMap }: { tip: SoundTip; last: boolean; onOpenMap: () => void }) {
  const go = () => {
    if (tip.id === 'this-or-that') router.push('/this-or-that');
    else if (tip.id === 'react') router.navigate('/');
    else if (tip.id === 'pick') router.push('/pick-artists');
    else if (tip.id === 'connect') router.push('/music');
    else if (tip.id === 'festival') onOpenMap();
  };
  const inner = (
    <>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{tip.title}</Text>
        <Text style={styles.rowBody}>{tip.body}</Text>
      </View>
      {tip.action ? <ChevronIcon color={color.moonFaint} size={11} /> : null}
    </>
  );
  if (!tip.action)
    return (
      <View style={[styles.row, last && styles.rowLast]} accessible>
        {inner}
      </View>
    );
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        go();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${tip.title}. ${tip.body}`}
      accessibilityHint={tip.action}
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xl, paddingTop: space.lg },
  section: { gap: space.sm },
  h2: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim, marginBottom: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  tile: { width: '48%', padding: space.lg, gap: 6, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, minHeight: 168 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pct: { ...type.headline, fontVariant: ['tabular-nums'] },
  tileTitle: { ...type.headline },
  tileFeel: { ...type.caption, color: color.moonDim },
  tileKicker: { ...type.caption, fontSize: 11, color: color.moonFaint },
  tileFaces: { flexDirection: 'row', marginTop: 'auto', paddingTop: space.sm },
  face: { borderRadius: 14, borderWidth: 2, borderColor: color.night },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  kicker: { ...type.caption, fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  cardTitle: { ...type.headline },
  share: { ...type.caption, color: color.moonDim },
  feel: { ...type.body, color: color.moon },
  label: { ...type.caption, color: color.moonFaint, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: space.xs },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bullet: { width: 5, height: 5, borderRadius: 2.5, opacity: 0.85 },
  bulletText: { ...type.caption, fontSize: 13, color: color.moonDim, flex: 1 },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  moreText: { ...type.label },
  vs: { ...type.caption, fontSize: 13, color: color.moonDim, fontStyle: 'italic', marginTop: space.xs },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  faces: { flexDirection: 'row', gap: 6 },
  watch: { paddingHorizontal: space.lg, paddingVertical: 7, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  watchText: { ...type.label, color: color.moon },
  tips: { borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { ...type.label, color: color.moon },
  rowBody: { ...type.caption, color: color.moonDim, marginTop: 2 },
  inline: { paddingHorizontal: space.sm, paddingTop: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  mapButton: { alignSelf: 'center', paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: glowA(0.18), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.45) },
  mapButtonText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
