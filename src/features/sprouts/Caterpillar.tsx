import { type ReactNode, useEffect, useId } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { MOVES_FROM } from "./Collectible";
import { blinkOf, CLOCK_MS, paceOf, sine } from "./motion";
import type { Driven } from "./Sprout";
import type { Stage } from "./sprouts";

/**
 * The caterpillar, as it grows: a little caterpillar on a leaf, then a
 * bigger one munching a bite out of it, then a cocoon hanging from a twig,
 * then a butterfly (who flutters about the garden: GardenScene does the
 * hopping). A caterpillar inches and blinks, the cocoon sways on its thread,
 * the butterfly flaps its wings, all on the garden's clock (or its own),
 * still with reduced motion or `still`. Hidden from screen readers (the
 * label around it says what it is).
 */
type Colors = {
  body: string;
  bodyDeep: string;
  belly: string;
  spot: string;
  leaf: string;
  leafDeep: string;
  vein: string;
  cocoon: string;
  cocoonDeep: string;
  twig: string;
  wing: string;
  wingDeep: string;
  wingLow: string;
  wingSpot: string;
  eye: string;
  cheek: string;
};
const COLORS: Colors = {
  body: "#9BE36A",
  bodyDeep: "#3F9A3A",
  belly: "#D8F7A8",
  spot: "#FFC94A",
  leaf: "#6CCB5A",
  leafDeep: "#2F7F35",
  vein: "#B8EE9C",
  cocoon: "#C9E38A",
  cocoonDeep: "#6E9A3A",
  twig: "#6A4A34",
  wing: "#B48CFF",
  wingDeep: "#6A44D8",
  wingLow: "#FF8AC8",
  wingSpot: "#FFD58A",
  eye: "#1E2A14",
  cheek: "#FF8A80",
};
const GREYS: Colors = {
  body: "#8A88A0",
  bodyDeep: "#5A5870",
  belly: "#A8A6BC",
  spot: "#9A98B0",
  leaf: "#6A687E",
  leafDeep: "#4A4860",
  vein: "#8A88A0",
  cocoon: "#8A88A0",
  cocoonDeep: "#5A5870",
  twig: "#4A4860",
  wing: "#8A88A0",
  wingDeep: "#5A5870",
  wingLow: "#7C7A92",
  wingSpot: "#A8A6BC",
  eye: "#3A3850",
  cheek: "#8A88A0",
};

/** The caterpillar's segments, tail to head: centre and radius (stage 0 small and flat, stage 1 longer with an arch). */
const SEGMENTS = [
  [
    [36, 82, 4.6],
    [43, 81, 5],
    [50, 80.5, 5.2],
    [57, 80, 5.4],
  ],
  [
    [26, 80, 5.6],
    [34, 77, 6],
    [42, 72.5, 6.4],
    [50, 71, 6.6],
    [58, 73, 6.6],
    [66, 76.5, 6.8],
  ],
] as const;

export function CaterpillarSprout({
  stage = 3,
  size = 80,
  still = size < MOVES_FROM,
  locked,
  scene,
  driven,
}: {
  stage?: Stage;
  size?: number;
  still?: boolean;
  locked?: boolean;
  scene?: boolean;
  driven?: Driven;
}) {
  const reduce = useReducedMotion();
  const moving = !reduce && !still;
  const ownClock = useSharedValue(0);
  const clock = driven?.clock ?? ownClock;
  const hasClock = !!driven;
  const running = moving && (driven ? driven.running : true);
  const pace = driven?.pace ?? paceOf("caterpillar");
  const { phase, sway: swayC, blink: blinkC } = pace;
  useEffect(() => {
    if (!moving || hasClock) return;
    ownClock.set(
      withRepeat(
        withTiming(1, { duration: CLOCK_MS, easing: Easing.linear }),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(ownClock);
      ownClock.set(0);
    };
  }, [moving, hasClock, ownClock]);
  // A caterpillar inches along (a little stretch and squeeze), a cocoon sways, a butterfly's wings flap.
  const bodyStyle = useAnimatedStyle(() => {
    const s = running ? sine(clock.get(), swayC, phase) : 0;
    return { transform: [{ scaleX: 1 + s * 0.04 }, { scaleY: 1 - s * 0.03 }] };
  });
  const swingStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${(running ? sine(clock.get(), swayC, phase) : 0) * 7}deg` },
    ],
  }));
  const flapStyle = useAnimatedStyle(() => {
    const f = running ? sine(clock.get(), 60, phase) : 0;
    return { transform: [{ scaleX: 0.72 + 0.28 * Math.abs(f) }] };
  });
  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          (running ? sine(clock.get(), swayC * 2, phase) : 0) * size * 0.025,
      },
    ],
  }));
  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: running ? blinkOf(clock.get(), blinkC, phase) : 1 }],
  }));

  const c = locked ? GREYS : COLORS;
  const id = `cp-${stage}-${locked ? "g" : "c"}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const grown = stage === 3 && !locked;

  const defs = (
    <Defs>
      <RadialGradient id={`aura-${id}`} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor={COLORS.wing} stopOpacity={0.42} />
        <Stop offset="0.6" stopColor={COLORS.wingLow} stopOpacity={0.12} />
        <Stop offset="1" stopColor={COLORS.wingLow} stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id={`body-${id}`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={c.body} />
        <Stop offset="1" stopColor={c.bodyDeep} />
      </LinearGradient>
      <LinearGradient id={`leaf-${id}`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={c.leaf} />
        <Stop offset="1" stopColor={c.leafDeep} />
      </LinearGradient>
      <LinearGradient id={`cocoon-${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
        <Stop offset="0" stopColor={c.cocoon} />
        <Stop offset="1" stopColor={c.cocoonDeep} />
      </LinearGradient>
      <LinearGradient id={`wing-${id}`} x1="0.5" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={c.wing} />
        <Stop offset="1" stopColor={c.wingDeep} />
      </LinearGradient>
      <LinearGradient id={`low-${id}`} x1="0.5" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={c.wingLow} />
        <Stop offset="1" stopColor={c.wingDeep} />
      </LinearGradient>
    </Defs>
  );

  const back = (
    <G>
      {grown ? (
        <Circle cx={50} cy={52} r={46} fill={`url(#aura-${id})`} />
      ) : null}
      {scene ? null : (
        <Ellipse
          cx={50}
          cy={95}
          rx={stage === 3 ? 16 : 24}
          ry={3.2}
          fill="rgba(0,0,0,0.32)"
        />
      )}
    </G>
  );

  const at = (v: number) => (v / 100) * size;
  const box = { width: size, height: size };
  const layer = (node: ReactNode) => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {defs}
      {node}
    </Svg>
  );
  const fill = { position: "absolute" as const, width: size, height: size };

  // A face: two eyes (blinking) and, on a caterpillar, rosy cheeks and a smile.
  const eyesAt = (x: number, y: number, dx: number, r: number) => (
    <G>
      <Circle cx={x - dx} cy={y} r={r} fill={c.eye} />
      <Circle cx={x + dx} cy={y} r={r} fill={c.eye} />
      {!locked ? (
        <Circle cx={x - dx - 0.5} cy={y - 0.6} r={r * 0.32} fill="#FFFFFF" />
      ) : null}
      {!locked ? (
        <Circle cx={x + dx - 0.5} cy={y - 0.6} r={r * 0.32} fill="#FFFFFF" />
      ) : null}
    </G>
  );

  let picture: ReactNode;
  let body: ReactNode = null;
  let eyes: ReactNode = null;
  let eyeY = 0;

  if (stage <= 1) {
    const segs = SEGMENTS[stage === 1 ? 1 : 0];
    const [hx, hy, hr] = segs[segs.length - 1];
    const headR = hr + (stage === 1 ? 1.8 : 1.4);
    const headX = hx + hr * 0.9;
    const headY = hy - hr * 0.5;
    eyeY = headY - 1;
    const leaf =
      stage === 0 ? (
        <G>
          <Path
            d="M18 90 Q34 76 58 80 Q76 82 84 90 Q62 98 40 96 Q26 95 18 90 Z"
            fill={`url(#leaf-${id})`}
          />
          <Path
            d="M22 90 Q50 87 80 90"
            stroke={c.vein}
            strokeWidth={1}
            opacity={0.6}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      ) : (
        <G>
          {/* A bite out of its leaf. */}
          <Path
            d="M10 92 Q24 78 52 82 Q70 84 80 86 Q82 82 86 84 Q84 88 88 90 Q90 92 92 93 Q66 100 38 98 Q20 97 10 92 Z"
            fill={`url(#leaf-${id})`}
          />
          <Path
            d="M14 92 Q50 88 86 92"
            stroke={c.vein}
            strokeWidth={1.1}
            opacity={0.6}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      );
    body = (
      <G>
        {segs.map(([x, y, r], i) => (
          <G key={i}>
            <Circle cx={x} cy={y} r={r} fill={`url(#body-${id})`} />
            <Ellipse
              cx={x}
              cy={y + r * 0.45}
              rx={r * 0.7}
              ry={r * 0.35}
              fill={c.belly}
              opacity={0.55}
            />
            {i % 2 === 1 && !locked ? (
              <Circle cx={x} cy={y - r * 0.45} r={r * 0.24} fill={c.spot} />
            ) : null}
            <Ellipse
              cx={x}
              cy={y + r * 0.95}
              rx={1.4}
              ry={1.1}
              fill={c.bodyDeep}
            />
          </G>
        ))}
        {/* Antennae and the head. */}
        <Path
          d={`M${headX - 2} ${headY - headR + 1} Q${headX - 4} ${headY - headR - 5} ${headX - 6} ${headY - headR - 6}`}
          stroke={c.bodyDeep}
          strokeWidth={1.3}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={`M${headX + 2} ${headY - headR + 1} Q${headX + 4} ${headY - headR - 5} ${headX + 6} ${headY - headR - 6}`}
          stroke={c.bodyDeep}
          strokeWidth={1.3}
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx={headX - 6} cy={headY - headR - 6} r={1.6} fill={c.spot} />
        <Circle cx={headX + 6} cy={headY - headR - 6} r={1.6} fill={c.spot} />
        <Circle cx={headX} cy={headY} r={headR} fill={`url(#body-${id})`} />
        {!locked ? (
          <Ellipse
            cx={headX - headR * 0.55}
            cy={headY + headR * 0.35}
            rx={2.2}
            ry={1.4}
            fill={c.cheek}
            opacity={0.55}
          />
        ) : null}
        {!locked ? (
          <Ellipse
            cx={headX + headR * 0.55}
            cy={headY + headR * 0.35}
            rx={2.2}
            ry={1.4}
            fill={c.cheek}
            opacity={0.55}
          />
        ) : null}
        <Path
          d={`M${headX - 2.2} ${headY + headR * 0.4} Q${headX} ${headY + headR * 0.62} ${headX + 2.2} ${headY + headR * 0.4}`}
          stroke={c.eye}
          strokeWidth={1}
          fill="none"
          strokeLinecap="round"
        />
      </G>
    );
    eyes = eyesAt(headX, eyeY, stage === 1 ? 3 : 2.6, stage === 1 ? 1.6 : 1.4);
    picture = (
      <G>
        {back}
        {leaf}
        {body}
        {eyes}
      </G>
    );
    if (moving) {
      return (
        <View
          style={box}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <View style={fill}>
            {layer(
              <G>
                {back}
                {leaf}
              </G>,
            )}
          </View>
          <Animated.View
            style={[
              fill,
              { transformOrigin: [at(segs[0][0]), at(90), 0] },
              bodyStyle,
            ]}
          >
            <View style={fill}>{layer(body)}</View>
            <Animated.View
              style={[
                fill,
                { transformOrigin: [size / 2, at(eyeY), 0] },
                eyeStyle,
              ]}
            >
              {layer(eyes)}
            </Animated.View>
          </Animated.View>
        </View>
      );
    }
  } else if (stage === 2) {
    // A cocoon hanging from a twig on a silk thread, a sleepy face peeking out.
    const twig = (
      <G>
        <Path
          d="M16 16 Q50 11 84 17"
          stroke={c.twig}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M66 15 Q72 8 80 7"
          stroke={c.twig}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
        />
        <Ellipse cx={81} cy={7} rx={4} ry={2.2} fill={c.leaf} />
      </G>
    );
    const cocoon = (
      <G>
        <Path
          d="M50 14 L50 24"
          stroke="#F4F2EA"
          strokeWidth={1.1}
          opacity={0.8}
        />
        <Path
          d="M50 24 Q66 32 64 56 Q62 78 50 86 Q38 78 36 56 Q34 32 50 24 Z"
          fill={`url(#cocoon-${id})`}
        />
        <Path
          d="M38.5 42 Q50 46 61.5 42 M37 56 Q50 60 63 56 M39 70 Q50 74 61 70"
          stroke={c.cocoonDeep}
          strokeWidth={1.1}
          opacity={0.55}
          fill="none"
          strokeLinecap="round"
        />
        {!locked ? (
          <Path
            d="M42 32 Q40 44 41 52"
            stroke="#FFFFFF"
            strokeWidth={2}
            opacity={0.3}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
        {!locked ? <Circle cx={56} cy={36} r={1.4} fill={c.spot} /> : null}
        {!locked ? <Circle cx={47} cy={64} r={1.2} fill={c.spot} /> : null}
        {/* Asleep: closed eyes and a little smile. */}
        <Path
          d="M44.5 50 Q46.5 52 48.5 50 M51.5 50 Q53.5 52 55.5 50"
          stroke={c.eye}
          strokeWidth={1.1}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M48 55 Q50 56.5 52 55"
          stroke={c.eye}
          strokeWidth={0.9}
          fill="none"
          strokeLinecap="round"
        />
      </G>
    );
    picture = (
      <G>
        {back}
        {cocoon}
        {twig}
      </G>
    );
    if (moving) {
      return (
        <View
          style={box}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <View style={fill}>{layer(back)}</View>
          <Animated.View
            style={[
              fill,
              { transformOrigin: [size / 2, at(14), 0] },
              swingStyle,
            ]}
          >
            {layer(cocoon)}
          </Animated.View>
          <View style={fill}>{layer(twig)}</View>
        </View>
      );
    }
  } else {
    // The butterfly: purple upper wings with gold spots, pink lower wings, a little face.
    eyeY = 33;
    const wing = (side: -1 | 1) => {
      const x = (v: number) => 50 + side * v;
      return (
        <G key={side}>
          <Path
            d={`M${x(2)} 48 Q${x(14)} 18 ${x(36)} 20 Q${x(46)} 24 ${x(40)} 40 Q${x(34)} 52 ${x(2)} 54 Z`}
            fill={`url(#wing-${id})`}
          />
          <Path
            d={`M${x(2)} 56 Q${x(30)} 54 ${x(34)} 68 Q${x(34)} 82 ${x(20)} 82 Q${x(8)} 80 ${x(2)} 62 Z`}
            fill={`url(#low-${id})`}
          />
          <Circle cx={x(30)} cy={30} r={4} fill={c.wingSpot} opacity={0.9} />
          <Circle cx={x(21)} cy={40} r={2.4} fill={c.wingSpot} opacity={0.75} />
          <Circle
            cx={x(22)}
            cy={70}
            r={3}
            fill="#FFFFFF"
            opacity={locked ? 0.2 : 0.45}
          />
          <Path
            d={`M${x(6)} 47 Q${x(20)} 34 ${x(34)} 26`}
            stroke="#FFFFFF"
            strokeWidth={1}
            opacity={0.25}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      );
    };
    const wings = (
      <G>
        {wing(-1)}
        {wing(1)}
      </G>
    );
    body = (
      <G>
        <Ellipse cx={50} cy={58} rx={4.2} ry={20} fill={`url(#body-${id})`} />
        <Path
          d="M46.6 52 L53.4 52 M46.2 59 L53.8 59 M46.6 66 L53.4 66"
          stroke={c.bodyDeep}
          strokeWidth={1}
          opacity={0.6}
        />
        <Path
          d="M48 30 Q44 20 38 16 M52 30 Q56 20 62 16"
          stroke={c.bodyDeep}
          strokeWidth={1.3}
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx={38} cy={16} r={2} fill={c.wingSpot} />
        <Circle cx={62} cy={16} r={2} fill={c.wingSpot} />
        <Circle cx={50} cy={35} r={7} fill={`url(#body-${id})`} />
        {!locked ? (
          <Ellipse
            cx={45.6}
            cy={37.4}
            rx={1.8}
            ry={1.1}
            fill={c.cheek}
            opacity={0.6}
          />
        ) : null}
        {!locked ? (
          <Ellipse
            cx={54.4}
            cy={37.4}
            rx={1.8}
            ry={1.1}
            fill={c.cheek}
            opacity={0.6}
          />
        ) : null}
        <Path
          d="M48 38.4 Q50 40 52 38.4"
          stroke={c.eye}
          strokeWidth={0.9}
          fill="none"
          strokeLinecap="round"
        />
      </G>
    );
    eyes = eyesAt(50, eyeY, 2.8, 1.5);
    picture = (
      <G>
        {back}
        {wings}
        {body}
        {eyes}
      </G>
    );
    if (moving) {
      return (
        <View
          style={box}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <View style={fill}>{layer(back)}</View>
          <Animated.View style={[fill, floatStyle]}>
            <Animated.View
              style={[
                fill,
                { transformOrigin: [size / 2, at(52), 0] },
                flapStyle,
              ]}
            >
              {layer(wings)}
            </Animated.View>
            <View style={fill}>{layer(body)}</View>
            <Animated.View
              style={[
                fill,
                { transformOrigin: [size / 2, at(eyeY), 0] },
                eyeStyle,
              ]}
            >
              {layer(eyes)}
            </Animated.View>
          </Animated.View>
        </View>
      );
    }
  }

  return (
    <View
      style={box}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {defs}
        {picture}
      </Svg>
    </View>
  );
}
