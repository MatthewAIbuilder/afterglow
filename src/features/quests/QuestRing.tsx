import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { color, motion } from '../../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The quest gold. */
export const QUEST_GOLD = '#FFD36E';
export const QUEST_AMBER = '#FF9F5A';

/**
 * A ring that fills as you go: one arc per part (today's three quests) with
 * small gaps, or one smooth arc (`parts` 1) for a level. Grows into place.
 */
export function QuestRing({
  size,
  stroke = 3,
  progress,
  parts = 1,
  done,
  track = 'rgba(243,240,255,0.14)',
}: {
  size: number;
  stroke?: number;
  /** 0 to 1. */
  progress: number;
  parts?: number;
  /** Everything's finished: the ring turns gold all round. */
  done?: boolean;
  track?: string;
}) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = parts > 1 ? Math.min(10, c * 0.04) : 0;
  const seg = c / parts - gap;
  const p = useSharedValue(reduced ? progress : 0);
  useEffect(() => {
    p.set(reduced ? progress : withSpring(progress, motion.gentle));
  }, [progress, p, reduced]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, p.get()))) }));
  // The track: one dash per part, with gaps.
  const dash = parts > 1 ? `${seg} ${gap}` : undefined;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="quest-ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={QUEST_GOLD} />
            <Stop offset="1" stopColor={done ? QUEST_GOLD : QUEST_AMBER} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" strokeDasharray={dash} rotation={-90 + (gap / c) * 180} origin={`${size / 2}, ${size / 2}`} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#quest-ring)"
          strokeWidth={stroke}
          strokeLinecap={parts > 1 ? 'butt' : 'round'}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={arc}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
        {/* The gaps cut through the fill too, so a part reads as a part. */}
        {parts > 1
          ? Array.from({ length: parts }, (_, i) => {
              const a = ((i / parts) * 360 - 90) * (Math.PI / 180);
              const x1 = size / 2 + Math.cos(a) * (r - stroke);
              const y1 = size / 2 + Math.sin(a) * (r - stroke);
              const x2 = size / 2 + Math.cos(a) * (r + stroke);
              const y2 = size / 2 + Math.sin(a) * (r + stroke);
              return <Path key={i} d={`M${x1} ${y1}L${x2} ${y2}`} stroke={color.night} strokeWidth={Math.max(2, gap * 0.6)} />;
            })
          : null}
      </Svg>
    </View>
  );
}

/** A small four-pointed spark: the quests' mark. */
export function SparkIcon({ size = 16, fill = QUEST_GOLD }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5z" fill={fill} />
      <Path d="M19 15.5c.25 1.9 1.1 2.75 3 3-1.9.25-2.75 1.1-3 3-.25-1.9-1.1-2.75-3-3 1.9-.25 2.75-1.1 3-3z" fill={fill} opacity={0.7} />
    </Svg>
  );
}

/** A flame for the streak. */
export function FlameIcon({ size = 16, fill = QUEST_AMBER, lit = true }: { size?: number; fill?: string; lit?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.5c.7 3.4 5.8 6.2 5.8 11.3A5.8 5.8 0 0 1 12 19.6a5.8 5.8 0 0 1-5.8-5.8c0-2.6 1.4-4.3 2.6-5.4.2 1.7 1 2.9 2.2 3.3-.6-3.1.3-6.1 1-9.2z"
        fill={lit ? fill : 'none'}
        stroke={lit ? fill : 'rgba(243,240,255,0.3)'}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {lit ? <Path d="M12 12.4c1.6 1.4 2.6 2.6 2.6 4a2.6 2.6 0 0 1-5.2 0c0-1.4 1-2.6 2.6-4z" fill={QUEST_GOLD} /> : null}
    </Svg>
  );
}

/** A quest's lane as a small mark: a play button for watching, a heart for your taste, a pin for planning. */
export function LaneIcon({ lane, size = 18, fill = QUEST_GOLD }: { lane: 'watch' | 'taste' | 'plan'; size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {lane === 'watch' ? <Path d="M8 5.5v13l10.5-6.5L8 5.5z" fill={fill} strokeLinejoin="round" /> : null}
      {lane === 'taste' ? (
        <Path d="M12 20.3s-7.8-4.6-7.8-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.8 2.5c0 5.6-7.8 10.2-7.8 10.2z" fill={fill} />
      ) : null}
      {lane === 'plan' ? (
        <>
          <Path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" fill={fill} />
          <Circle cx={12} cy={10} r={2.4} fill={color.night} />
        </>
      ) : null}
    </Svg>
  );
}
