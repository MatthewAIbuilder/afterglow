import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { color, glowA, space, type } from '../../theme/tokens';
import { type ArtistLook, shinyLook } from './artistLook';
import type { ArtistSprout } from './artistSprouts';
import { Collectible } from './Collectible';
import type { CollectionSet } from './collection';

/** The share of everything you've found, as a ring of light. */
export function Ring({ pct, size = 104 }: { pct: number; size?: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const id = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={[styles.ring, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 104 104">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#B99CFF" />
            <Stop offset="0.5" stopColor="#FF8AD8" />
            <Stop offset="1" stopColor="#8AFFD0" />
          </LinearGradient>
        </Defs>
        <Circle cx={52} cy={52} r={r} stroke={glowA(0.15)} strokeWidth={9} fill="none" />
        <Circle cx={52} cy={52} r={r} stroke={`url(#${id})`} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 52 52)" />
      </Svg>
      <Text style={[styles.pct, size !== 104 && { fontSize: size * 0.23, lineHeight: size * 0.28 }]}>{`${pct}%`}</Text>
    </View>
  );
}

/**
 * Your collection as it goes out in a picture: the ring, your best few
 * collectibles (shiny first, then the highest level), and a bar per set.
 */
export function CollectionStory({ width: w, pct, best, sets }: { width: number; pct: number; best: readonly { a: ArtistSprout; look: ArtistLook }[]; sets: readonly CollectionSet[] }) {
  return (
    <View style={[styles.story, { width: w - 2 * space.lg, gap: w * 0.04 }]}>
      <Ring pct={pct} size={Math.round(w * 0.4)} />
      {best.length ? (
        <View style={styles.storyBest}>
          {best.map(({ a, look }) => (
            <Collectible key={a.artistId} look={a.shiny ? shinyLook(look) : look} shiny={!!a.shiny} tier={a.tier} size={Math.round(w * 0.15)} still />
          ))}
        </View>
      ) : null}
      <View style={styles.storySets}>
        {sets.map((x) => (
          <View key={x.id} style={styles.storyRow}>
            <Text style={[styles.storySet, { fontSize: Math.max(10, w * 0.034) }]} numberOfLines={1}>
              {x.title}
            </Text>
            <View style={styles.storyBar}>
              <View style={[styles.fill, x.have === x.total && styles.fillDone, { width: `${x.total ? (x.have / x.total) * 100 : 0}%` }]} />
            </View>
            <Text style={[styles.storyCount, { fontSize: Math.max(10, w * 0.032) }]}>{`${x.have}/${x.total}`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  pct: { ...type.title, color: color.moon, position: 'absolute', fontVariant: ['tabular-nums'] },
  story: { alignItems: 'center' },
  storyBest: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4 },
  storySets: { alignSelf: 'stretch', gap: 6 },
  storyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  storySet: { ...type.caption, color: color.moon, width: '42%' },
  storyBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: glowA(0.15), overflow: 'hidden' },
  storyCount: { ...type.caption, color: color.moonDim, width: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
  fill: { height: 4, borderRadius: 2, backgroundColor: color.glow },
  fillDone: { backgroundColor: '#8AFFD0' },
});
