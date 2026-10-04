import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { ChevronIcon } from '../../components/TabIcons';
import { SOUND_LABEL, type SoundTag } from '../../data/models';
import type { Artist } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { soundFocus } from '../discover/focus';
import type { SoundShare } from '../taste/lean';
import { SOUND_COLOR, withAlpha } from './colors';
import { artistsIn, closeTo, nextSounds, otherSounds, SOUND_GUIDE, type SoundTip, soundTips } from './guide';

/**
 * My Sound's overview, under your sound's summary: the sounds you lean
 * towards (what each feels like, what to listen for, how it differs from its
 * neighbours, your best matches in it and a way to watch it), sounds to try
 * next, tips for finding your sound, and every other sound to read about.
 * The bubble map is one tap away.
 */
export function SoundOverview({
  shares,
  artists,
  taste,
  watchable,
  shaped,
  canConnect,
  hasFestivals,
  onOpenMap,
}: {
  shares: readonly SoundShare[];
  artists: readonly Artist[];
  taste: Record<string, number>;
  /** Sounds with enough clips to watch in Discover. */
  watchable: ReadonlySet<SoundTag>;
  shaped: boolean;
  canConnect: boolean;
  hasFestivals: boolean;
  onOpenMap: () => void;
}) {
  const yours = shares.slice(0, 3).map((s) => s.tag);
  const next = nextSounds(yours);
  const rest = otherSounds([...yours, ...next]);
  const [open, setOpen] = useState<SoundTag | undefined>();
  const tips = soundTips({ shaped, canConnect, hasFestivals });
  const card = (tag: SoundTag, kicker?: string, startOpen = false) => (
    <SoundCard key={tag} tag={tag} kicker={kicker} share={shares.find((s) => s.tag === tag)} artists={artistsIn(tag, artists, taste)} watchable={watchable.has(tag)} startOpen={startOpen} />
  );

  return (
    <View style={styles.wrap}>
      <Section title={shaped ? 'Your sounds' : 'Where you might start'} sub={shaped ? 'What you lean towards, and what makes each one tick.' : 'A first guess. Like, skip and rate and these become yours.'}>
        {yours.map((t, i) => card(t, undefined, i === 0))}
      </Section>

      <Section title="Sounds to try next" sub="Close to yours, so there’s a good chance you’ll love them.">
        {next.map((t) => card(t, closeTo(t, yours)))}
      </Section>

      <Section title="Find your sound faster">
        <View style={styles.tips}>
          {tips.map((tip, i) => (
            <Tip key={tip.id} tip={tip} last={i === tips.length - 1} onOpenMap={onOpenMap} />
          ))}
        </View>
      </Section>

      <Section title="Every sound" sub="Tap one to see what it’s about.">
        <View style={styles.tips}>
          {rest.map((t, i) => (
            <View key={t}>
              <Pressable
                onPress={() => {
                  haptic.select();
                  setOpen(open === t ? undefined : t);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: open === t }}
                accessibilityLabel={`${SOUND_LABEL[t]}: ${SOUND_GUIDE[t].feel}`}
                style={({ pressed }) => [styles.row, i === rest.length - 1 && open !== t && styles.rowLast, pressed && styles.pressed]}
              >
                <Dot tag={t} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{SOUND_LABEL[t]}</Text>
                  <Text style={styles.rowBody} numberOfLines={open === t ? undefined : 1}>
                    {SOUND_GUIDE[t].feel}
                  </Text>
                </View>
                <ChevronIcon color={color.moonFaint} size={11} direction={open === t ? 'up' : 'down'} />
              </Pressable>
              {open === t ? <View style={styles.inline}>{card(t, undefined, true)}</View> : null}
            </View>
          ))}
        </View>
      </Section>

      <Pressable
        onPress={() => {
          haptic.tap();
          onOpenMap();
        }}
        accessibilityRole="button"
        accessibilityLabel="Open your bubble map"
        style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}
      >
        <Text style={styles.mapButtonText}>Open your bubble map</Text>
      </Pressable>
    </View>
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

function SoundCard({ tag, kicker, share, artists, watchable, startOpen }: { tag: SoundTag; kicker?: string; share?: SoundShare; artists: Artist[]; watchable: boolean; startOpen: boolean }) {
  const [more, setMore] = useState(startOpen);
  const g = SOUND_GUIDE[tag];
  const tone = SOUND_COLOR[tag];
  const label = SOUND_LABEL[tag];
  return (
    <View style={[styles.card, { borderColor: withAlpha(tone, 0.28), backgroundColor: withAlpha(tone, 0.06) }]}>
      <View style={styles.cardTop}>
        <Dot tag={tag} size={14} />
        <View style={{ flex: 1 }}>
          {kicker ? <Text style={[styles.kicker, { color: tone }]}>{kicker.toUpperCase()}</Text> : null}
          <Text style={[styles.cardTitle, { color: tone }]}>{label}</Text>
        </View>
        {share ? <Text style={styles.share}>{share.percent}% of your sound</Text> : null}
      </View>
      <Text style={styles.feel}>{g.feel}</Text>
      {more ? (
        <>
          <Text style={styles.label}>Listen for</Text>
          {g.listenFor.map((l) => (
            <View key={l} style={styles.bulletRow}>
              <View style={[styles.bullet, { backgroundColor: tone }]} />
              <Text style={styles.bulletText}>{l}</Text>
            </View>
          ))}
          <Text style={styles.vs}>{g.vs}</Text>
        </>
      ) : (
        <Pressable
          onPress={() => {
            haptic.select();
            setMore(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`How ${label.toLowerCase()} sounds, and how it differs`}
          hitSlop={8}
          style={styles.moreRow}
        >
          <Text style={[styles.moreText, { color: tone }]}>How it sounds</Text>
          <ChevronIcon color={tone} size={10} direction="down" />
        </Pressable>
      )}
      {artists.length || watchable ? (
        <View style={styles.cardBottom}>
          <View style={styles.faces}>
            {artists.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => {
                  haptic.select();
                  router.push({ pathname: '/artist/[id]', params: { id: a.id } });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${a.name}, ${label.toLowerCase()}`}
                hitSlop={4}
              >
                <ArtistAvatar artist={a} size={34} />
              </Pressable>
            ))}
          </View>
          {watchable ? (
            <Pressable
              onPress={() => {
                haptic.tap();
                router.navigate({ pathname: '/', params: { festival: soundFocus(tag) } });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Watch ${label.toLowerCase()} live sets in Discover`}
              style={({ pressed }) => [styles.watch, { borderColor: withAlpha(tone, 0.5), backgroundColor: withAlpha(tone, 0.16) }, pressed && styles.pressed]}
            >
              <Text style={styles.watchText}>Watch</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

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
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, marginBottom: space.xs },
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
  tips: { borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { ...type.label, color: color.moon },
  rowBody: { ...type.caption, color: color.moonDim, marginTop: 2 },
  inline: { paddingHorizontal: space.sm, paddingTop: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  mapButton: { alignSelf: 'center', paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: 'rgba(169,124,255,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(169,124,255,0.45)' },
  mapButtonText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
