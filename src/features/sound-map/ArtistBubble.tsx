import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { mixColor } from './colors';
import { ArtistAvatar, artistColors } from '../../components/ArtistAvatar';
import { color, motion, type } from '../../theme/tokens';
import { FULL_LABELS, LABEL_OFFSET, MAX_R, type PlacedArtist } from './layout';
import { OrbGlass, PlanetFace } from './Orb';

type Props = {
  placed: PlacedArtist;
  index: number;
  /** null when nothing is selected */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** A search is on: matches pop out, everyone else fades back. */
  searching?: boolean;
  matched?: boolean;
  /** How far the map's drag is trailing (px, shared by every bubble): bigger bubbles trail further. */
  lagX: SharedValue<number>;
  lagY: SharedValue<number>;
  /** One slow clock for the whole map (0 to 1, repeating): each bubble bobs and sways on it at its own phase. */
  clock: SharedValue<number>;
  /** The map's zoom, and the zoom at which every name shows: smaller names fade in as you zoom in. */
  scale: SharedValue<number>;
  detailAt: number;
  /** You love or like them: a small glowing heart on the bubble. */
  loved?: boolean;
};

const LABEL_W = 150;
const D = MAX_R * 2; // bubbles render at full size and scale down, so size can animate
const GLOW = MAX_R * 2.5;

/** Focus of a search match: bigger than selected (2), so it pops. */
const MATCH = 2.8;

// How the map reshapes when your taste changes: unhurried, one soft overshoot.
const reshape = { damping: 16, stiffness: 70, mass: 1.1 };

function ArtistBubbleBase({ placed, index, selectedId, onSelect, searching, matched, lagX, lagY, clock, scale, detailAt, loved }: Props) {
  const { artist, affinity, x, y, r } = placed;
  const reduceMotion = useReducedMotion();

  const bloom = useSharedValue(reduceMotion ? 1 : 0);
  const focus = useSharedValue(1);

  // Position and size are animated, so a change in taste glides rather than jumps.
  const px = useSharedValue(x);
  const py = useSharedValue(y);
  const pr = useSharedValue(r);

  useEffect(() => {
    const cfg = reduceMotion ? { duration: 0 } : null;
    px.set(cfg ? x : withSpring(x, reshape));
    py.set(cfg ? y : withSpring(y, reshape));
    pr.set(cfg ? r : withSpring(r, reshape));
  }, [x, y, r, px, py, pr, reduceMotion]);

  // Bigger bubbles are heavier: they trail the drag a little further, so the
  // universe moves like a loose group rather than a flat image.
  const weight = r / MAX_R;
  const reach = 0.55 + weight * 0.7;
  // Each bubble floats at its own phase on the map's one clock (whole turns per loop, so it never jumps).
  const phase = (index * 2.39996) % (Math.PI * 2);
  const still = !!reduceMotion;

  useEffect(() => {
    if (reduceMotion) return;
    // The one orchestrated moment: the universe blooms out from you, strongest matches first.
    bloom.set(withDelay(100 + Math.min(index, 30) * 45, withSpring(1, motion.bloom)));
    // Only on first mount; later changes in rank should not replay the bloom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const isSelected = selectedId === artist.id;
    if (selectedId !== null) {
      focus.set(withSpring(isSelected ? 2 : 0, motion.snappy));
      return;
    }
    // A search match pops: a springy grow past the selected size, with its own glow.
    if (searching) focus.set(matched ? (reduceMotion ? MATCH : withSpring(MATCH, motion.bloom)) : withSpring(0, motion.snappy));
    else focus.set(withSpring(1, motion.snappy));
  }, [selectedId, artist.id, focus, searching, matched, reduceMotion]);

  const anchorStyle = useAnimatedStyle(() => {
    const p = bloom.get();
    const f = focus.get(); // 0 dimmed, 1 normal, 2 selected
    const t = clock.get() * Math.PI * 2;
    const bob = still ? 0 : Math.sin(t * 6 + phase) * 3;
    const sway = still ? 0 : Math.sin(t * 5 + phase * 1.7) * 2.5;
    return {
      opacity: Math.min(1, p) * (f < 1 ? 0.28 + 0.72 * f : 1),
      transform: [
        { translateX: px.get() * p + sway + lagX.get() * reach },
        { translateY: py.get() * p + bob + lagY.get() * reach },
      ],
    };
  });

  const bodyStyle = useAnimatedStyle(() => {
    const f = focus.get();
    const s = (pr.get() / MAX_R) * bloom.get() * (f > 1 ? 1 + 0.07 * (f - 1) : 1);
    return { transform: [{ scale: s }] };
  });

  // The extra glow of a search match.
  const matchGlowStyle = useAnimatedStyle(() => {
    const f = focus.get();
    return { opacity: f > 2 ? Math.min(1, (f - 2) / (MATCH - 2)) : 0 };
  });

  // The heart sits on the bubble's upper right edge, whatever its size.
  const heartStyle = useAnimatedStyle(() => {
    const rr = pr.get() * bloom.get();
    return { opacity: Math.min(1, bloom.get()), transform: [{ translateX: rr * 0.72 - 9 }, { translateY: -rr * 0.72 - 9 }] };
  });

  // index is the bloom order: strongest match first. The strongest always show their name;
  // the rest fade in as you zoom in (or when chosen or found), so the map stays calm from afar.
  const prominent = index < FULL_LABELS;
  // The match shows only once you pick them: the size already says it, and numbers make the universe a chart.
  const showPct = selectedId === artist.id;
  const pinned = prominent || selectedId === artist.id || !!matched;
  const labelStyle = useAnimatedStyle(() => {
    const zoomed = Math.max(0, Math.min(1, (scale.get() - detailAt * 0.85) / (detailAt * 0.15)));
    return {
      opacity: pinned ? 1 : zoomed,
      transform: [{ translateY: pr.get() * bloom.get() + LABEL_OFFSET }],
    };
  });
  const pctStyle = useAnimatedStyle(() => ({ opacity: showPct ? 1 : 0 }));

  const glowStrength = Math.pow(affinity, 3) * 0.75;
  // Their own light when their photo gives them a colour, else the colour of their sound.
  const soundTone = mixColor(artist.sound);
  const glowColor = artist.color ? artistColors(artist.id, artist.color)[1] : soundTone;
  const gid = `g-${artist.id}`;
  const pct = Math.round(affinity * 100);

  return (
    <Animated.View
      style={[styles.anchor, anchorStyle]}
      accessibilityRole="button"
      accessibilityLabel={`${artist.name}, ${pct} percent match`}
      onAccessibilityTap={() => onSelect(artist.id)}
    >
      <Animated.View style={[styles.glow, bodyStyle]} pointerEvents="none">
        <Svg width={GLOW} height={GLOW}>
          <Defs>
            <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
              <Stop offset="0.3" stopColor={glowColor} stopOpacity={glowStrength} />
              <Stop offset="1" stopColor={color.glowDeep} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill={`url(#${gid})`} />
        </Svg>
      </Animated.View>

      {searching ? (
      <Animated.View style={[styles.glow, bodyStyle, matchGlowStyle]} pointerEvents="none">
        <Svg width={GLOW} height={GLOW}>
          <Defs>
            <RadialGradient id={`${gid}-m`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.3" stopColor={color.glow} stopOpacity={0.7} />
              <Stop offset="1" stopColor={color.glowDeep} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill={`url(#${gid}-m)`} />
        </Svg>
      </Animated.View>
      ) : null}

      <Animated.View style={[styles.body, bodyStyle]}>
        {/* The face (their photo, or a planet banded in their sound), then glass over it with an atmosphere in their sound's colour around it (so sounds tell apart at a glance). */}
        <View style={styles.face}>{artist.imageUrl || (artist.members && artist.members.length > 1) ? <ArtistAvatar artist={artist} size={D} /> : <PlanetFace artist={artist} size={D} />}</View>
        <OrbGlass size={D} tone={soundTone} id={artist.id} />
      </Animated.View>

      {loved ? (
        <Animated.View style={[styles.heart, heartStyle]} pointerEvents="none">
          <Svg width={12} height={12} viewBox="0 0 24 24">
            <Path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.2 0 3.6 1.2 5.2 3 1.6-1.8 3-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" fill="#fff" />
          </Svg>
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.label, labelStyle]} pointerEvents="none">
        {/* Quieter labels for smaller bubbles, so the strongest matches lead; the match is still read out, and shown once selected. */}
        <Text style={[styles.name, !prominent && styles.nameSmall]} numberOfLines={1}>
          {artist.name}
        </Text>
        <Animated.Text style={[styles.pct, pctStyle]}>{pct}%</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

export const ArtistBubble = memo(ArtistBubbleBase);

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  glow: { position: 'absolute', left: -GLOW / 2, top: -GLOW / 2, width: GLOW, height: GLOW },
  body: { position: 'absolute', left: -D / 2, top: -D / 2, width: D, height: D },
  face: { width: D, height: D, borderRadius: D / 2, overflow: 'hidden' },
  heart: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glow,
    borderWidth: 1.5,
    borderColor: color.night,
    shadowColor: color.glow,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  label: { position: 'absolute', left: -LABEL_W / 2, top: 0, width: LABEL_W, alignItems: 'center' },
  name: { ...type.label, color: color.moon, textAlign: 'center' },
  nameSmall: { fontSize: 11, lineHeight: 14, color: color.moonDim, fontWeight: '500' },
  pct: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'], marginTop: 1 },
});
