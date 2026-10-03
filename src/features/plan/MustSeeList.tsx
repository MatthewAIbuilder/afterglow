import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LayoutAnimationConfig, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { haptic } from '../../lib/haptics';
import { useTaste } from '../../state/taste';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { exploreLine, matchLabel, moreToExplore, TIER_HINT, TIER_LABEL } from './copy';
import { MustSeeToggle } from './MustSeeToggle';
import { EXPLORE_SHOWN, exploreReason, TIER_AT, type Pick, type Tier } from './plan';

const TIERS: Tier[] = ['must-see', 'strong', 'explore'];


/** Before set times: your lineup as a ranked plan in three tiers. */
export function MustSeeList({ festivalId, picks }: { festivalId: string; picks: Pick[] }) {
  const reduceMotion = useReducedMotion();
  const { similarity } = useTaste();
  const groups = TIERS.map((tier) => {
    const all = picks.filter((p) => p.tier === tier);
    const shown = tier === 'explore' ? all.slice(0, EXPLORE_SHOWN) : all;
    return { tier, picks: shown, more: all.length - shown.length };
  }).filter((g) => g.picks.length);

  return (
    <LayoutAnimationConfig skipEntering>
      {groups.map((g) => (
        <View key={g.tier} style={[styles.group, g.tier === 'must-see' && styles.feature]}>
          {g.tier === 'must-see' ? (
            <LinearGradient
              colors={[glowA(0.16), glowA(0)]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          ) : null}
          <Text style={[styles.tier, g.tier === 'must-see' && { color: color.glow }]}>{TIER_LABEL[g.tier]}</Text>
          <Text style={styles.hint}>{TIER_HINT[g.tier]}</Text>
          {g.picks.map((p) => (
            <Animated.View
              key={p.artist.id}
              entering={reduceMotion ? undefined : FadeIn.duration(240)}
              layout={reduceMotion ? undefined : LinearTransition.duration(260)}
            >
              <PickRow
                festivalId={festivalId}
                pick={p}
                rank={picks.indexOf(p) + 1}
                note={
                  p.tier === 'explore'
                    ? exploreLine(exploreReason(p, picks, similarity))
                    : p.pinned && p.match < TIER_AT.mustSee
                      ? 'You starred this one.'
                      : undefined
                }
              />
            </Animated.View>
          ))}
          {g.more > 0 && <Text style={styles.more}>{moreToExplore(g.more)}</Text>}
        </View>
      ))}
    </LayoutAnimationConfig>
  );
}

/** One pick: rank, avatar, name, a short note, match and the must-see star. Opens the artist. */
export function PickRow({
  festivalId,
  pick,
  rank,
  note,
}: {
  festivalId: string;
  pick: Pick;
  rank?: number;
  note?: string;
}) {
  const { artist } = pick;
  const match = matchLabel(pick);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/artist/[id]', params: { id: artist.id, festival: festivalId } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${rank ? `Number ${rank}, ` : ''}${artist.name}, ${
        pick.known ? `${match} match` : 'new to you'
      }${note ? `. ${note}` : ''}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      {rank ? <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text> : null}
      <ArtistAvatar artist={artist} size={44} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {artist.name}
        </Text>
        {note ? (
          <Text style={styles.note} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.match, pick.tier === 'must-see' && pick.known && { color: color.glow }]}>{match}</Text>
      <MustSeeToggle artist={artist} festivalId={festivalId} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: space.lg, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xs },
  feature: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.28),
  },
  tier: { ...type.label, color: color.moon },
  hint: { ...type.caption, color: color.moonFaint, marginTop: 2, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, gap: space.md },
  rank: { ...type.label, color: color.moonFaint, width: 20, fontVariant: ['tabular-nums'] },
  text: { flex: 1 },
  name: { ...type.headline, color: color.moon },
  note: { ...type.caption, color: color.moonDim, marginTop: 2 },
  more: { ...type.caption, color: color.moonFaint, paddingTop: space.xs, paddingBottom: space.md },
  match: { ...type.label, color: color.moonDim, fontVariant: ['tabular-nums'] },
});
