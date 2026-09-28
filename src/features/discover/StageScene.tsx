import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinear, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { artistColors } from '../../components/ArtistAvatar';
import { color } from '../../theme/tokens';

type Props = {
  artistId: string;
  bpm: number;
  width: number;
  height: number;
  /** Milliseconds of playback. Frozen when paused, so the whole scene freezes. */
  clock: SharedValue<number>;
  reduceMotion: boolean;
};

/**
 * Placeholder "live set": a stage at night, drawn in code. Light beams sweep,
 * the stage glow pulses on the beat, a crowd stands in silhouette. Each artist
 * gets their own colours. Replaced by real footage when a clip has a video.
 */
function StageSceneBase({ artistId, bpm, width, height, clock, reduceMotion }: Props) {
  const [deep, bright] = artistColors(artistId);
  const beat = 60000 / bpm;

  // Deterministic beam layout per artist.
  const beams = useMemo(() => {
    const rng = { seed: [...artistId].reduce((h, c) => (h * 33 + c.charCodeAt(0)) % 10007, 17) };
    const rand = () => ((rng.seed = (rng.seed * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 5 }, (_, i) => ({
      x: width * (0.12 + (i / 4) * 0.76),
      speed: 0.00035 + rand() * 0.0004,
      phase: rand() * Math.PI * 2,
      swing: 14 + rand() * 12,
      tint: i % 2 === 0 ? bright : '#FFFFFF',
      strength: i % 2 === 0 ? 0.32 : 0.14,
    }));
  }, [artistId, width, bright]);

  const crowd = useMemo(() => crowdPath(width, height, artistId), [width, height, artistId]);

  const pulseStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0.7 };
    const phase = (clock.value % beat) / beat;
    const hit = Math.exp(-phase * 5);
    return { opacity: 0.45 + 0.55 * hit, transform: [{ scale: 1 + 0.08 * hit }] };
  });

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: color.night }]} pointerEvents="none">
      <LinearGradient colors={['#05040C', deep, '#07060F']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />

      {beams.map((b, i) => (
        <Beam key={i} gid={`beam-${artistId}-${i}`} {...b} height={height} clock={clock} reduceMotion={reduceMotion} />
      ))}

      <Animated.View style={[styles.stageGlow, { top: height * 0.5, width, height: height * 0.5 }, pulseStyle]}>
        <Svg width={width} height={height * 0.5}>
          <Defs>
            <RadialGradient id={`stage-${artistId}`} cx="50%" cy="62%" rx="70%" ry="45%">
              <Stop offset="0" stopColor={bright} stopOpacity="0.85" />
              <Stop offset="0.45" stopColor={bright} stopOpacity="0.25" />
              <Stop offset="1" stopColor={bright} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#stage-${artistId})`} />
        </Svg>
      </Animated.View>

      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={crowd} fill="#040309" />
      </Svg>
    </View>
  );
}

export const StageScene = memo(StageSceneBase);

type BeamProps = {
  gid: string;
  x: number;
  height: number;
  speed: number;
  phase: number;
  swing: number;
  tint: string;
  strength: number;
  clock: SharedValue<number>;
  reduceMotion: boolean;
};

const BEAM_W = 180;

function Beam({ gid, x, height, speed, phase, swing, tint, strength, clock, reduceMotion }: BeamProps) {
  const style = useAnimatedStyle(() => {
    const angle = reduceMotion ? Math.sin(phase) * swing : Math.sin(clock.value * speed + phase) * swing;
    return { transform: [{ rotate: `${angle}deg` }] };
  });
  const h = height * 1.05;
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: x - BEAM_W / 2, top: -8, width: BEAM_W, height: h, transformOrigin: 'top' },
        style,
      ]}
    >
      <Svg width={BEAM_W} height={h}>
        <Defs>
          <SvgLinear id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tint} stopOpacity={strength} />
            <Stop offset="0.8" stopColor={tint} stopOpacity="0" />
          </SvgLinear>
        </Defs>
        <Polygon points={`${BEAM_W / 2 - 3},0 ${BEAM_W / 2 + 3},0 ${BEAM_W},${h} 0,${h}`} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

/** A row of heads and raised hands along the bottom of the frame. */
function crowdPath(width: number, height: number, key: string) {
  let seed = [...key].reduce((h, c) => (h * 17 + c.charCodeAt(0)) % 9973, 5);
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const base = height * 0.86;
  let d = `M0 ${height} L0 ${base}`;
  let x = 0;
  while (x < width) {
    const w = 26 + rand() * 18;
    const top = base - 10 - rand() * 22;
    d += ` Q${x + w / 2} ${top - 14} ${x + w} ${base - rand() * 6}`;
    if (rand() > 0.72) {
      // A raised arm.
      const ax = x + w * 0.6;
      const ah = 50 + rand() * 50;
      d += ` L${ax} ${base - 8} L${ax + 3} ${base - ah} L${ax + 9} ${base - ah - 2} L${ax + 8} ${base - 8}`;
    }
    x += w;
  }
  d += ` L${width} ${height} Z`;
  return d;
}

const styles = StyleSheet.create({
  stageGlow: { position: 'absolute', left: 0 },
});
