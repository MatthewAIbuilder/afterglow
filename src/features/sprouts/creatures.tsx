import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import type { ArtistLook, Creature, Palette } from './artistLook';

/**
 * The drawings for artist collectibles, each in a 100 × 100 box on a dark
 * round tile (Collectible.tsx draws the tile and moves the parts). Every
 * colour comes from the palette, so a locked one turns to a grey figure.
 */

/** Gradients made from the palette (Collectible.tsx defines them). */
export type Fills = {
  /** The body, light at the top to deep at the bottom. */
  body: string;
  /** The body, lit from the top left (round shapes). */
  round: string;
  /** The second colour, top to bottom. */
  alt: string;
  /** An eye's white, glowing. */
  white: string;
  /** A glowing iris: the accent into the second colour. */
  iris: string;
  /** Holographic, corner to corner. */
  holo: string;
  /** Vinyl overlays, laid over any shape's own colour: shade (bottom right), highlight (top left), bounce light off the tile, a glossy spot. */
  shade: string;
  hi: string;
  rim: string;
  spec: string;
  /** A glossy dark eye. */
  ball: string;
  /** A soft shadow (where parts meet, or on the floor). */
  ao: string;
};

/** A drawing in layers, so parts can move on their own. */
export type Art = {
  /** Behind everything, still. */
  back?: ReactNode;
  /** Rocks gently around `pivot` (or flaps its width, for wings). */
  sway?: ReactNode;
  pivot?: [number, number];
  flap?: boolean;
  /** Flickers like a flame. Behind the body unless `flickerOver`. */
  flicker?: ReactNode;
  flickerOver?: boolean;
  body: ReactNode;
  /** Blinks: squashes to a line inside `box` (x, y, w, h) now and then. */
  eyes?: { box: [number, number, number, number]; el: ReactNode };
  /** Over everything, still. */
  front?: ReactNode;
  /** Its shadow on the floor: centre x, y and half its width (null: it floats with none). */
  ground?: [number, number, number] | null;
};

export const INK = '#140E22';
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A flame, feather, horn or tentacle: rounded at its base (`bx`, `by`),
 * pointed at its tip, `w` wide, its tip curving `bend` to one side.
 */
export function flame(bx: number, by: number, tx: number, ty: number, w: number, bend = 0) {
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const at = (t: number, s: number) => {
    const off = s + bend * t * t;
    return `${r1(bx + dx * t + nx * off)} ${r1(by + dy * t + ny * off)}`;
  };
  return `M${at(1, 0)} C${at(0.6, w)} ${at(-0.05, w * 0.95)} ${at(-0.12, 0)} C${at(-0.05, -w * 0.95)} ${at(0.6, -w)} ${at(1, 0)}Z`;
}

/** A four-pointed sparkle. */
export function star(x: number, y: number, s: number) {
  const k = s * 0.28;
  return `M${x} ${y - s} Q${x + k} ${y - k} ${x + s} ${y} Q${x + k} ${y + k} ${x} ${y + s} Q${x - k} ${y + k} ${x - s} ${y} Q${x - k} ${y - k} ${x} ${y - s}Z`;
}

// ---- Vinyl ---------------------------------------------------------------
// Every part is a solid colour with the same light laid over it, so the
// whole figure reads as one glossy designer toy under one studio light.

/** A part of any shape: its colour, then shade, bounce light and highlight, and a glossy spot if given (x, y, rx, ry, turn). */
export function V({ d, fill, f, gloss, opacity }: { d: string; fill: string; f: Fills; gloss?: [number, number, number, number, number?]; opacity?: number }) {
  return (
    <G opacity={opacity}>
      <Path d={d} fill={fill} />
      <Path d={d} fill={f.shade} />
      <Path d={d} fill={f.rim} />
      <Path d={d} fill={f.hi} />
      {gloss ? <Ellipse cx={gloss[0]} cy={gloss[1]} rx={gloss[2]} ry={gloss[3]} fill={f.spec} transform={`rotate(${gloss[4] ?? -28} ${gloss[0]} ${gloss[1]})`} /> : null}
    </G>
  );
}

/** A rounded part: an ellipse with the same light, and its glossy spot where the light hits. */
export function VE({ cx, cy, rx, ry, fill, f, turn = 0, gloss = true, opacity }: { cx: number; cy: number; rx: number; ry: number; fill: string; f: Fills; turn?: number; gloss?: boolean; opacity?: number }) {
  const t = turn ? `rotate(${turn} ${cx} ${cy})` : undefined;
  return (
    <G opacity={opacity}>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} transform={t} />
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={f.shade} transform={t} />
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={f.rim} transform={t} />
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={f.hi} transform={t} />
      {gloss ? <Ellipse cx={cx - rx * 0.34} cy={cy - ry * 0.48} rx={rx * 0.36} ry={ry * 0.19} fill={f.spec} transform={`rotate(-28 ${cx - rx * 0.34} ${cy - ry * 0.48})`} /> : null}
    </G>
  );
}

/** A soft shadow where one part sits on another. */
export const Shadow = ({ cx, cy, rx, ry, f, opacity = 0.7 }: { cx: number; cy: number; rx: number; ry: number; f: Fills; opacity?: number }) => <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={f.ao} opacity={opacity} />;

/** A designer-toy eye: a glossy dark dome, maybe a coloured iris, a big window catchlight, a small one, and a glint along the bottom. */
export function VEye({ x, y, r, f, iris, ry }: { x: number; y: number; r: number; f: Fills; iris?: string; ry?: number }) {
  const h = ry ?? r;
  return (
    <G>
      <Ellipse cx={x} cy={y} rx={r} ry={h} fill={f.ball} />
      {iris ? (
        <G>
          <Ellipse cx={x} cy={y + h * 0.08} rx={r * 0.7} ry={h * 0.7} fill={iris} opacity={0.95} />
          <Ellipse cx={x} cy={y + h * 0.08} rx={r * 0.7} ry={h * 0.7} fill={f.shade} />
          <Ellipse cx={x} cy={y + h * 0.1} rx={r * 0.38} ry={h * 0.4} fill="#06040C" />
        </G>
      ) : null}
      <Ellipse cx={x - r * 0.3} cy={y - h * 0.34} rx={r * 0.34} ry={h * 0.26} fill="#FFFFFF" transform={`rotate(-20 ${x - r * 0.3} ${y - h * 0.34})`} />
      <Circle cx={x + r * 0.36} cy={y + h * 0.3} r={r * 0.13} fill="#FFFFFF" opacity={0.85} />
      <Path d={`M${r1(x - r * 0.55)} ${r1(y + h * 0.5)} Q${x} ${r1(y + h * 0.86)} ${r1(x + r * 0.55)} ${r1(y + h * 0.5)}`} stroke="#FFFFFF" strokeWidth={r * 0.12} opacity={0.22} fill="none" strokeLinecap="round" />
    </G>
  );
}

/**
 * A glossy round tube along a curve (start, bend, end), thick at the start
 * and thin at the end, like a toy's tentacle, tail or arm: a dark edge, its
 * colour and a highlight line along the top.
 */
export function Tube({ path, from, to, fill, edge, light = '#FFFFFF', steps = 10 }: { path: [number, number, number, number, number, number]; from: number; to: number; fill: string; edge: string; light?: string; steps?: number }) {
  const [x0, y0, cx, cy, x1, y1] = path;
  const at = (t: number): [number, number] => [r1((1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1), r1((1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1)];
  const segs = Array.from({ length: steps }, (_, i) => {
    const [ax, ay] = at(i / steps);
    const [bx, by] = at((i + 1) / steps);
    return { ax, ay, bx, by, w: from + (to - from) * (i / (steps - 1)) };
  });
  return (
    <G>
      {segs.map((g, i) => (
        <Line key={`e${i}`} x1={g.ax + 0.5} y1={g.ay + 0.7} x2={g.bx + 0.5} y2={g.by + 0.7} stroke={edge} strokeWidth={g.w + 1.2} strokeLinecap="round" opacity={0.55} />
      ))}
      {segs.map((g, i) => (
        <Line key={`b${i}`} x1={g.ax} y1={g.ay} x2={g.bx} y2={g.by} stroke={fill} strokeWidth={g.w} strokeLinecap="round" />
      ))}
      {segs.slice(0, -1).map((g, i) => (
        <Line key={`h${i}`} x1={g.ax - g.w * 0.2} y1={g.ay - g.w * 0.22} x2={g.bx - g.w * 0.2} y2={g.by - g.w * 0.22} stroke={light} strokeWidth={g.w * 0.28} strokeLinecap="round" opacity={0.45} />
      ))}
    </G>
  );
}

/** Points along a `Tube`'s curve, for suckers and spots. */
export function onTube(path: [number, number, number, number, number, number], t: number): [number, number] {
  const [x0, y0, cx, cy, x1, y1] = path;
  return [r1((1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1), r1((1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1)];
}

/** A point along a `flame` (t from base 0 to tip 1), for suckers, scales and stripes. */
export function along(bx: number, by: number, tx: number, ty: number, bend: number, t: number, side = 0): [number, number] {
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const off = side + bend * t * t;
  return [r1(bx + dx * t + nx * off), r1(by + dy * t + ny * off)];
}

/** A glowing eye: a soft halo, the colour, a bright core. */
function Glow({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r * 2} fill={color} opacity={0.22} />
      <Circle cx={x} cy={y} r={r} fill={color} />
      <Circle cx={x} cy={y} r={r * 0.45} fill="#FFFFFF" opacity={0.9} />
    </G>
  );
}

/**
 * The same drawing with its vinyl light turned the other way round: shading
 * gradients follow the shape, so a mirrored part would be lit from the top
 * right. Its shade, highlight and rim fills swap to their mirrored twins
 * (`<name>m`, which Collectible.tsx defines), so both halves are lit from the
 * top left. Works through parts drawn with V, VE, Tube (their `f`) and plain
 * shapes alike.
 */
const FLIPPED = /_(vs|vh|vr)\)$/;
const flipFill = (fill: string) => fill.replace(FLIPPED, '_$1m)');
function relight(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return node;
  const props = node.props as { f?: Fills; fill?: unknown; children?: ReactNode };
  const next: Record<string, unknown> = {};
  if (props.f && typeof props.f === 'object') next.f = { ...props.f, shade: flipFill(props.f.shade), hi: flipFill(props.f.hi), rim: flipFill(props.f.rim) };
  if (typeof props.fill === 'string' && FLIPPED.test(props.fill)) next.fill = flipFill(props.fill);
  if (props.children !== undefined) next.children = Children.map(props.children, relight);
  return Object.keys(next).length ? cloneElement(node, next) : node;
}

/** Its mirror image across the middle, lit from the same side. */
const mirror = (node: ReactNode) => <G transform="translate(100 0) scale(-1 1)">{relight(node)}</G>;
const both = (node: ReactNode) => (
  <G>
    {node}
    {mirror(node)}
  </G>
);

const sparkles = (color: string, at: [number, number, number][]) => (
  <G>
    {at.map(([x, y, s], i) => (
      <Path key={i} d={star(x, y, s)} fill={i % 2 ? '#FFFFFF' : color} opacity={i % 2 ? 0.75 : 0.95} />
    ))}
  </G>
);

type Draw = (p: Palette, f: Fills, extra?: ArtistLook['extra']) => Art;

const eye: Draw = (p, f) => {
  // Each tentacle: from under the body, bending out, curling at the tip.
  const tentacles: [number, number, number, number, number, number][] = [
    [36, 60, 18, 64, 19, 84],
    [42, 65, 26, 78, 31, 91],
    [47, 67, 39, 82, 45, 94],
    [53, 67, 61, 82, 55, 94],
    [58, 65, 74, 78, 69, 91],
    [64, 60, 82, 64, 81, 84],
  ];
  return {
    ground: [50, 92, 26],
    back: (
      <G>
        {[-150, -122, -94, -66, -38].map((a, i) => {
          const c = Math.cos((a * Math.PI) / 180);
          const s = Math.sin((a * Math.PI) / 180);
          const len = i === 2 ? 38 : 35;
          return <V key={a} d={flame(50 + c * 22, 45 + s * 22, 50 + c * len, 45 + s * len, 4.4, i < 2 ? -2 : i > 2 ? 2 : 0)} fill={p.alt} f={f} />;
        })}
      </G>
    ),
    sway: (
      <G>
        {tentacles.map((path, i) => (
          <G key={i}>
            <Tube path={path} from={8} to={2.4} fill={p.mid} edge={p.deep} light={p.light} />
            {[0.35, 0.55, 0.74].map((t) => {
              const [x, y] = onTube(path, t);
              return <Circle key={t} cx={x + (i < 3 ? 1.3 : -1.3)} cy={y + 0.6} r={1.25 - t * 0.6} fill={p.light} opacity={0.9} />;
            })}
          </G>
        ))}
      </G>
    ),
    pivot: [50, 60],
    body: (
      <G>
        <VE cx={50} cy={45} rx={27} ry={26} fill={p.mid} f={f} gloss={false} />
        {/* The socket: a soft dip the eye sits in. */}
        <Shadow cx={50} cy={47} rx={22} ry={21} f={f} opacity={0.8} />
        <Ellipse cx={36} cy={28} rx={7} ry={3.4} fill={f.spec} opacity={0.75} transform="rotate(-35 36 28)" />
      </G>
    ),
    eyes: {
      box: [28, 22, 44, 46],
      el: (
        <G>
          <Circle cx={50} cy={45} r={19.5} fill={f.white} />
          <Circle cx={50} cy={45} r={19.5} fill={f.shade} />
          <Circle cx={50} cy={46} r={12.5} fill={f.iris} />
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i * 22.5 * Math.PI) / 180;
            return <Line key={i} x1={50 + Math.cos(a) * 5} y1={46 + Math.sin(a) * 5} x2={50 + Math.cos(a) * 12} y2={46 + Math.sin(a) * 12} stroke={p.altDeep} strokeWidth={0.6} opacity={0.45} />;
          })}
          <Circle cx={50} cy={46} r={12.5} fill="none" stroke={p.altDeep} strokeWidth={1.2} opacity={0.8} />
          <Ellipse cx={50} cy={46} rx={3.6} ry={9.2} fill="#06040C" />
          <Ellipse cx={42.5} cy={37.5} rx={5} ry={3.6} fill="#FFFFFF" transform="rotate(-25 42.5 37.5)" />
          <Circle cx={57.5} cy={52} r={1.7} fill="#FFFFFF" opacity={0.8} />
          <Path d="M37 52 Q50 63 63 52" stroke={p.accent} strokeWidth={1.2} opacity={0.35} fill="none" strokeLinecap="round" />
        </G>
      ),
    },
    front: (
      <G>
        {/* Heavy lids, top and bottom: a little sleepy, a little menacing. */}
        <V d="M28.5 40 C31 24 69 24 71.5 40 C64 31 36 31 28.5 40Z" fill={p.mid} f={f} />
      </G>
    ),
  };
};

/** ILLENIUM's: a phoenix rising through a starry night, its wings raised high in flame, a white-hot ember at its heart and a long streaming tail. */
const phoenix: Draw = (p, f) => {
  // Wing feathers fanning up and out from the shoulder: tip x, y, width, curl.
  const feathers: [number, number, number, number][] = [
    [25, 4, 7, -10],
    [18, 9, 8.5, -10],
    [9, 20, 8.5, -9],
    [4, 33, 8, -7],
    [6, 45, 7, -5],
    [13, 55, 6, -3],
    [23, 61, 5, -1],
  ];
  const wing = (
    <G>
      {feathers.map(([tx, ty, w, b], i) => (
        <G key={i}>
          <V d={flame(44, 50, tx, ty, w, b)} fill={p.altDeep} f={f} />
          <V d={flame(44, 50, 44 + (tx - 44) * 0.86, 50 + (ty - 50) * 0.86, w * 0.68, b * 0.84)} fill={p.mid} f={f} />
          <Path d={flame(44, 50, 44 + (tx - 44) * 0.7, 50 + (ty - 50) * 0.7, w * 0.4, b * 0.6)} fill={p.alt} opacity={0.95} />
          <Path d={flame(44, 50, 44 + (tx - 44) * 0.46, 50 + (ty - 50) * 0.46, w * 0.18, b * 0.36)} fill={p.light} opacity={0.9} />
        </G>
      ))}
    </G>
  );
  // The tail: long streamers trailing down, the outer ones curling away.
  const tail: [number, number, number, number][] = [
    [50, 99, 6.5, 0],
    [40, 97, 5, 7],
    [60, 97, 5, -7],
    [29, 91, 4.2, 10],
    [71, 91, 4.2, -10],
  ];
  return {
    ground: [50, 96, 14],
    back: (
      <G>
        {/* The night it rises through: a cool blue haze with stars. */}
        <Ellipse cx={50} cy={50} rx={44} ry={42} fill="#3B5FA8" opacity={0.28} />
        <Ellipse cx={50} cy={44} rx={30} ry={28} fill={p.glow} opacity={0.14} />
        {sparkles('#BFD6FF', [
          [12, 14, 1.6],
          [86, 18, 1.3],
          [90, 62, 1.5],
          [9, 70, 1.2],
          [78, 84, 1],
          [22, 86, 1],
        ])}
      </G>
    ),
    flap: true,
    pivot: [50, 52],
    sway: both(wing),
    flicker: (
      <G>
        {tail.map(([tx, ty, w, b], i) => (
          <G key={i}>
            <V d={flame(50, 66, tx, ty, w, b)} fill={p.altDeep} f={f} />
            <V d={flame(50, 66, 50 + (tx - 50) * 0.8, 66 + (ty - 66) * 0.8, w * 0.6, b * 0.72)} fill={p.mid} f={f} />
            <Path d={flame(50, 66, 50 + (tx - 50) * 0.56, 66 + (ty - 66) * 0.56, w * 0.28, b * 0.42)} fill={p.alt} opacity={0.95} />
          </G>
        ))}
        {/* Embers drifting off it. */}
        {(
          [
            [27, 24, 1],
            [74, 22, 0.9],
            [35, 80, 0.8],
            [67, 79, 0.9],
            [50, 18, 0.7],
          ] as const
        ).map(([x, y, r], i) => (
          <Glow key={i} x={x} y={y} r={r} color={p.accent} />
        ))}
      </G>
    ),
    body: (
      <G>
        {/* A crest of three plumes swept back. */}
        {(
          [
            [-9, 11, 2.6, -3],
            [0, 6, 3.2, 3],
            [9, 11, 2.6, 4],
          ] as const
        ).map(([dx, ty, w, b], i) => (
          <G key={i}>
            <V d={flame(50, 31, 50 + dx, ty, w, b)} fill={p.altDeep} f={f} />
            <Path d={flame(50, 31, 50 + dx * 0.8, 31 - (31 - ty) * 0.75, w * 0.45, b * 0.6)} fill={p.alt} />
          </G>
        ))}
        {/* A slim, tapering body. */}
        <V d="M50 44 C60 46 61.5 58 57 66 C55 70 52 73 50 74 C48 73 45 70 43 66 C38.5 58 40 46 50 44Z" fill={p.mid} f={f} gloss={[45.5, 52, 2.4, 4.5]} />
        <Path d="M50 50 C55 52 55.5 61 52.5 67 C51.5 69 50.6 70 50 70.5 C49.4 70 48.5 69 47.5 67 C44.5 61 45 52 50 50Z" fill={p.alt} opacity={0.85} />
        <Path d="M46.4 58 q3.6 2 7.2 0 M46.8 62.4 q3.2 1.8 6.4 0 M47.6 66.4 q2.4 1.4 4.8 0" stroke={p.altDeep} strokeWidth={0.7} fill="none" opacity={0.55} />
        {/* The ember at its heart. */}
        <Glow x={50} y={56} r={2.2} color={p.accent} />
        <Shadow cx={50} cy={45} rx={8.5} ry={2.6} f={f} opacity={0.45} />
        <VE cx={50} cy={36} rx={9.6} ry={9.2} fill={p.mid} f={f} />
        {/* A hooked golden beak. */}
        <V d="M46.6 40.4 Q50 38.6 53.4 40.4 Q53 44.6 50 48.4 Q49.4 46 48.2 44.4 Q47 42.8 46.6 40.4Z" fill={p.accent} f={f} />
        <Circle cx={43.8} cy={40.6} r={1.6} fill={p.altDeep} opacity={0.4} />
        <Circle cx={56.2} cy={40.6} r={1.6} fill={p.altDeep} opacity={0.4} />
      </G>
    ),
    eyes: {
      box: [40, 30, 20, 10],
      el: (
        <G>
          <VEye x={45.8} y={35.4} r={2.4} f={f} />
          <VEye x={54.2} y={35.4} r={2.4} f={f} />
        </G>
      ),
    },
  };
};

const lion: Draw = (p, f) => ({
  ground: [50, 89, 24],
  sway: (
    <G>
      {Array.from({ length: 15 }, (_, i) => {
        const a = ((i * 24 - 90) * Math.PI) / 180;
        return <VE key={i} cx={50 + Math.cos(a) * 25} cy={53 + Math.sin(a) * 24} rx={10} ry={10} fill={p.altDeep} f={f} gloss={false} />;
      })}
      {Array.from({ length: 15 }, (_, i) => {
        const a = ((i * 24 - 78) * Math.PI) / 180;
        return <VE key={i} cx={50 + Math.cos(a) * 20} cy={53 + Math.sin(a) * 19.5} rx={9} ry={9} fill={p.alt} f={f} gloss={i % 3 === 0} />;
      })}
      {Array.from({ length: 10 }, (_, i) => {
        const a = ((i * 36 - 70) * Math.PI) / 180;
        const x = 50 + Math.cos(a) * 25;
        const y = 53 + Math.sin(a) * 24.5;
        return <Path key={i} d={`M${r1(x - 2.5)} ${r1(y)} q2.5 -3 5 0`} stroke={p.light} strokeWidth={0.9} opacity={0.45} fill="none" strokeLinecap="round" />;
      })}
    </G>
  ),
  pivot: [50, 53],
  body: (
    <G>
      <Shadow cx={50} cy={56} rx={21} ry={21} f={f} opacity={0.6} />
      <VE cx={36.5} cy={37} rx={6.4} ry={6} fill={p.mid} f={f} />
      <VE cx={63.5} cy={37} rx={6.4} ry={6} fill={p.mid} f={f} />
      <Circle cx={36.5} cy={37.5} r={3.2} fill={p.deep} opacity={0.8} />
      <Circle cx={63.5} cy={37.5} r={3.2} fill={p.deep} opacity={0.8} />
      <VE cx={50} cy={53} rx={17.5} ry={18} fill={p.mid} f={f} />
      <Shadow cx={50} cy={64} rx={11} ry={5} f={f} opacity={0.35} />
      <VE cx={45.3} cy={61.5} rx={6.2} ry={5} fill={p.light} f={f} gloss={false} />
      <VE cx={54.7} cy={61.5} rx={6.2} ry={5} fill={p.light} f={f} gloss={false} />
      <VE cx={50} cy={66.5} rx={4.2} ry={2.8} fill={p.light} f={f} gloss={false} />
      <V d="M45 56 Q50 53.6 55 56 Q53 60.8 50 61.4 Q47 60.8 45 56Z" fill={p.deep} f={f} gloss={[48, 56.2, 1.8, 0.8, -10]} />
      <Path d="M50 61.4 L50 63.4 M46.6 64.4 Q48.6 66 50 63.4 Q51.4 66 53.4 64.4" stroke={p.deep} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      {[42.6, 41.2, 57.4, 58.8].map((x, i) => (
        <Circle key={i} cx={x} cy={i % 2 ? 64 : 61.6} r={0.65} fill={p.deep} opacity={0.8} />
      ))}
    </G>
  ),
  eyes: {
    box: [37, 44, 26, 11],
    el: (
      <G>
        <VEye x={43} y={49.5} r={3.4} ry={3} f={f} iris={p.accent} />
        <VEye x={57} y={49.5} r={3.4} ry={3} f={f} iris={p.accent} />
      </G>
    ),
  },
});

const ghost: Draw = (p, f, extra) => ({
  ground: [50, 92, 16],
  flicker: sparkles(p.accent, [
    [19, 34, 2.6],
    [81, 28, 2],
    [79, 70, 2.4],
  ]),
  flickerOver: true,
  back: (
    <G>
      <VE cx={25.5} cy={57} rx={6.4} ry={4} fill={p.mid} f={f} turn={-35} />
      <VE cx={74.5} cy={57} rx={6.4} ry={4} fill={p.mid} f={f} turn={35} />
    </G>
  ),
  body: (
    <G>
      <V d="M27 52 C27 30 37 20 50 20 C63 20 73 30 73 52 L73 77 Q73 82 69.5 82 Q66 82 64.5 78.5 Q62 84 57.5 82 Q54 80.5 52.5 79 Q50 84.5 47.5 82.5 Q45.5 80.5 43 79 Q40 84 36 82 Q33.5 80.5 32 78.5 Q30 82 28.5 81 Q27 80 27 77Z" fill={p.light} f={f} gloss={[39, 30, 7, 3.6, -32]} />
      <Shadow cx={50} cy={80} rx={20} ry={3} f={f} opacity={0.35} />
      <Circle cx={38} cy={55} r={2.6} fill={p.alt} opacity={0.35} />
      <Circle cx={62} cy={55} r={2.6} fill={p.alt} opacity={0.35} />
      {extra === 'fangs' ? (
        <G>
          <Path d="M39.5 56 Q50 67.5 60.5 56 Q50 61.5 39.5 56Z" fill="#14081E" />
          <Path d="M43.6 58.4 L45 62.4 L46.6 59.4Z M53.4 59.4 L55 62.4 L56.4 58.4Z" fill="#FFFFFF" />
        </G>
      ) : (
        <G>
          <Ellipse cx={50} cy={59} rx={3.2} ry={3.9} fill="#14081E" />
          <Ellipse cx={49.2} cy={57.6} rx={1.1} ry={0.7} fill="#FFFFFF" opacity={0.5} />
        </G>
      )}
    </G>
  ),
  eyes: {
    box: [32, 36, 36, 18],
    el: (
      <G>
        <VEye x={41} y={45} r={5.4} ry={6.6} f={f} iris={p.accent} />
        <VEye x={59} y={45} r={5.4} ry={6.6} f={f} iris={p.accent} />
      </G>
    ),
  },
});

const pumpkin: Draw = (p, f) => {
  const face = 'M36.5 53 L43.5 44.5 L48.2 54Z M51.8 54 L56.5 44.5 L63.5 53Z M48 60.5 L50 57.2 L52 60.5Z M34 63 Q50 78 66 63 L61.5 65.4 L58.4 62.4 L54.6 66.6 L50 63.4 L45.4 66.6 L41.6 62.4 L38.5 65.4Z';
  return {
    ground: [50, 85, 25],
    back: <Path d="M53 33 C60 25 69 27 67 34 C65 38 60.5 34.5 63.5 32" stroke={p.altDeep} strokeWidth={1.8} fill="none" strokeLinecap="round" />,
    body: (
      <G>
        <V d="M47 40 Q45.5 31 49.5 25.5 Q54 27 54.5 31 Q52.6 35.5 53.6 40Z" fill={p.altDeep} f={f} />
        <V d={flame(53.5, 33, 67, 26.5, 4.4, -2.5)} fill={p.alt} f={f} />
        <VE cx={34.5} cy={61} rx={14} ry={19.5} fill={p.deep} f={f} gloss={false} />
        <VE cx={65.5} cy={61} rx={14} ry={19.5} fill={p.deep} f={f} gloss={false} />
        <VE cx={42.5} cy={60.5} rx={13} ry={21} fill={p.mid} f={f} gloss={false} />
        <VE cx={57.5} cy={60.5} rx={13} ry={21} fill={p.mid} f={f} gloss={false} />
        <VE cx={50} cy={60} rx={11} ry={22} fill={p.mid} f={f} gloss={false} />
        <Ellipse cx={40} cy={45} rx={6} ry={2.6} fill={f.spec} transform="rotate(-25 40 45)" />
        <Path d={face} fill="#3A1204" />
      </G>
    ),
    flicker: (
      <G>
        <Path d={face} fill={p.accent} />
        <Path d="M38.5 52 L43.5 47 L46 52.5Z M54 52.5 L56.5 47 L61.5 52Z M38 64.5 Q50 74 62 64.5" fill="#FFFFFF" opacity={0.65} />
        <Ellipse cx={50} cy={58} rx={18} ry={12} fill={p.accent} opacity={0.12} />
      </G>
    ),
    flickerOver: true,
  };
};

const sheep: Draw = (p, f) => ({
  ground: [50, 87, 25],
  back: (
    <G>
      {Array.from({ length: 13 }, (_, i) => {
        const a = ((i * 360) / 13) * (Math.PI / 180);
        return <VE key={i} cx={50 + Math.cos(a) * 22} cy={55 + Math.sin(a) * 20.5} rx={9.6} ry={9.2} fill={p.mid} f={f} gloss={i % 4 === 3} />;
      })}
      <VE cx={50} cy={55} rx={23} ry={21} fill={p.light} f={f} gloss={false} />
      {[
        [36, 46],
        [64, 46],
        [37, 66],
        [63, 66],
        [50, 72],
      ].map(([x, y], i) => (
        <Path key={i} d={`M${x - 3} ${y} q3 -3.4 6 0`} stroke={p.deep} strokeWidth={0.8} opacity={0.35} fill="none" strokeLinecap="round" />
      ))}
    </G>
  ),
  body: (
    <G>
      {both(<Tube path={[39, 45, 24, 38, 27, 56]} from={6} to={3.4} fill={p.deep} edge={p.altDeep} light={p.light} steps={8} />)}
      {both(<VE cx={36.5} cy={54} rx={6.2} ry={2.9} fill={p.alt} f={f} turn={22} gloss={false} />)}
      <VE cx={50} cy={58} rx={11.5} ry={13.5} fill={p.alt} f={f} />
      {[44.5, 50, 55.5].map((x, i) => (
        <VE key={x} cx={x} cy={i === 1 ? 41 : 43} rx={5.4} ry={5} fill={p.light} f={f} gloss={false} />
      ))}
      <Circle cx={42.6} cy={63} r={2.1} fill={p.accent} opacity={0.4} />
      <Circle cx={57.4} cy={63} r={2.1} fill={p.accent} opacity={0.4} />
      <Path d="M47.5 64.5 Q50 66.6 52.5 64.5" stroke="#FFFFFF" strokeWidth={1.1} opacity={0.8} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [39, 49, 22, 11],
    el: (
      <G>
        <VEye x={45.4} y={54.6} r={3.1} f={f} />
        <VEye x={54.6} y={54.6} r={3.1} f={f} />
      </G>
    ),
  },
});

const twin: Draw = (p, f) => ({
  ground: [50, 85, 18],
  back: (
    <G>
      {(
        [
          [13, 37, 7],
          [11, 50, 6.5],
          [16, 62, 5.5],
        ] as const
      ).map(([tx, ty, w], i) => (
        <V key={i} d={flame(36, 54, tx, ty, w, -4)} fill={p.light} f={f} />
      ))}
      <V d="M63 48 L88 35 L86 55.5 Q81.5 51 78.5 57.5 Q74.5 52 71 59.5 Q67.5 55 63.5 60.5Z" fill={p.altDeep} f={f} />
      <Path d="M66 49 L84 39 M66 52 L80 55 M66 50.5 L74 57" stroke={p.alt} strokeWidth={0.7} opacity={0.6} />
      <Tube path={[64, 67, 80, 70, 72, 84]} from={2.6} to={1.8} fill={p.altDeep} edge="#000000" light={p.alt} steps={8} />
      <V d="M68.5 85 L73.5 80.6 L75.2 86.4Z" fill={p.altDeep} f={f} />
      <V d={flame(60, 38, 67.5, 23.5, 4, 3)} fill={p.alt} f={f} />
    </G>
  ),
  body: (
    <G>
      <V d="M50 34.5 A19.5 19.5 0 0 0 50 73.5Z" fill={p.mid} f={f} />
      <V d="M50 34.5 A19.5 19.5 0 0 1 50 73.5Z" fill={p.alt} f={f} />
      <Ellipse cx={42} cy={41} rx={5} ry={2.4} fill={f.spec} transform="rotate(-30 42 41)" />
      <Path d="M43.5 61.5 Q50 67 56.5 61.5" stroke="#14081E" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M54 62.6 L55 65.6 L56.2 62Z" fill="#FFFFFF" />
      <Circle cx={41} cy={60} r={2} fill={p.accent} opacity={0.35} />
    </G>
  ),
  flicker: (
    <G>
      <Ellipse cx={44} cy={27.5} rx={11.5} ry={3.6} fill="none" stroke={p.accent} strokeWidth={5} opacity={0.25} />
      <Ellipse cx={44} cy={27.5} rx={11.5} ry={3.6} fill="none" stroke={p.accent} strokeWidth={2.6} />
      <Path d="M35 26 Q40 24.4 46 24.4" stroke="#FFFFFF" strokeWidth={1} opacity={0.8} fill="none" strokeLinecap="round" />
    </G>
  ),
  flickerOver: true,
  eyes: {
    box: [37, 48, 26, 12],
    el: (
      <G>
        <VEye x={43.5} y={54} r={2.9} f={f} />
        <VEye x={56.5} y={54} r={2.9} f={f} iris={p.alt} />
      </G>
    ),
  },
});

const astronaut: Draw = (p, f) => ({
  ground: [50, 88, 20],
  flicker: (
    <G>
      {sparkles(p.accent, [
        [19, 27, 2.6],
        [81, 23, 2],
        [81, 70, 2.4],
        [20, 71, 1.8],
      ])}
      <Glow x={66.5} y={18.5} r={2.6} color={p.accent} />
    </G>
  ),
  flickerOver: true,
  body: (
    <G>
      <Line x1={61} y1={29} x2={66.5} y2={19.5} stroke={p.deep} strokeWidth={1.8} strokeLinecap="round" />
      <VE cx={33.5} cy={72} rx={4.8} ry={8} fill={p.light} f={f} turn={25} gloss={false} />
      <VE cx={66.5} cy={72} rx={4.8} ry={8} fill={p.light} f={f} turn={-25} gloss={false} />
      <V d="M37 70 Q37 62 45 62 L55 62 Q63 62 63 70 L63 77 Q63 85 55 85 L45 85 Q37 85 37 77Z" fill={p.light} f={f} gloss={[42, 65.5, 3, 1.4, -20]} />
      <Rect x={44} y={68} width={12} height={8} rx={2.4} fill={p.mid} />
      <Circle cx={47.5} cy={72} r={1.6} fill={p.accent} />
      <Circle cx={52.5} cy={72} r={1.6} fill={p.altDeep} />
      <Shadow cx={50} cy={64} rx={13} ry={3.4} f={f} opacity={0.6} />
      <VE cx={50} cy={45} rx={21.5} ry={21} fill={p.light} f={f} gloss={false} />
      <Circle cx={50} cy={45} r={21} fill="none" stroke={p.mid} strokeWidth={1.4} opacity={0.8} />
      <V d="M34 47 Q34 35 50 35 Q66 35 66 47 Q66 59 50 59 Q34 59 34 47Z" fill={p.alt} f={f} />
      <Path d="M37.5 44 Q39.5 38 47 37" stroke="#FFFFFF" strokeWidth={2.6} opacity={0.75} fill="none" strokeLinecap="round" />
      <Circle cx={60.5} cy={40.5} r={1.3} fill="#FFFFFF" opacity={0.7} />
      <Path d="M47.5 53.5 Q50 55.6 52.5 53.5" stroke={p.accent} strokeWidth={1.3} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 43, 20, 11],
    el: (
      <G>
        <Ellipse cx={44.5} cy={48.5} rx={2.6} ry={3.3} fill={p.accent} />
        <Ellipse cx={55.5} cy={48.5} rx={2.6} ry={3.3} fill={p.accent} />
        <Ellipse cx={44.5} cy={48.5} rx={4.6} ry={5.2} fill={p.accent} opacity={0.2} />
        <Ellipse cx={55.5} cy={48.5} rx={4.6} ry={5.2} fill={p.accent} opacity={0.2} />
        <Circle cx={43.8} cy={47.2} r={1} fill="#FFFFFF" />
        <Circle cx={54.8} cy={47.2} r={1} fill="#FFFFFF" />
      </G>
    ),
  },
});

const rabbit: Draw = (p, f) => ({
  ground: [50, 82, 21],
  sway: (
    <G>
      <VE cx={41} cy={27} rx={6.8} ry={17.5} fill={p.light} f={f} turn={-12} />
      <VE cx={41} cy={29} rx={3.4} ry={12.5} fill={p.alt} f={f} turn={-12} gloss={false} />
      <VE cx={59} cy={27} rx={6.8} ry={17.5} fill={p.light} f={f} turn={14} />
      <VE cx={59} cy={29} rx={3.4} ry={12.5} fill={p.alt} f={f} turn={14} gloss={false} />
    </G>
  ),
  pivot: [50, 44],
  body: (
    <G>
      <Shadow cx={50} cy={44} rx={13} ry={3.6} f={f} opacity={0.5} />
      <VE cx={50} cy={58} rx={19.5} ry={17.5} fill={p.light} f={f} />
      <VE cx={40.5} cy={64} rx={6.6} ry={4.6} fill={p.light} f={f} gloss={false} />
      <VE cx={59.5} cy={64} rx={6.6} ry={4.6} fill={p.light} f={f} gloss={false} />
      <Circle cx={39.5} cy={63} r={3} fill={p.alt} opacity={0.55} />
      <Circle cx={60.5} cy={63} r={3} fill={p.alt} opacity={0.55} />
      <V d="M47.6 60 Q50 58.2 52.4 60 Q50 63.4 47.6 60Z" fill={p.altDeep} f={f} />
      <Path d="M50 62.4 L50 64.4 M47.4 65.4 Q49 67 50 64.4 Q51 67 52.6 65.4" stroke={p.deep} strokeWidth={1} fill="none" strokeLinecap="round" />
      {both(<Path d="M35.5 61 L27 59 M35.5 63.5 L27 64.5" stroke={p.deep} strokeWidth={0.6} opacity={0.6} />)}
    </G>
  ),
  eyes: {
    box: [36, 47, 28, 13],
    el: (
      <G>
        <VEye x={43} y={53.5} r={4.2} f={f} />
        <VEye x={57} y={53.5} r={4.2} f={f} />
      </G>
    ),
  },
  front: (
    <G>
      <Path d="M58 75 Q62 81 66.5 78" stroke={p.accent} strokeWidth={1.1} fill="none" />
      <V d="M69 67 L71.6 67 L71.6 70 L69 70Z" fill={p.accent} f={f} />
      <VE cx={70.3} cy={76} rx={7.4} ry={7.4} fill={p.accent} f={f} />
      <Circle cx={70.3} cy={76} r={5.4} fill="#FFF8E8" />
      <Path d="M70.3 76 L70.3 72 M70.3 76 L73.4 77.6" stroke={INK} strokeWidth={0.9} strokeLinecap="round" />
      <Ellipse cx={68} cy={73.4} rx={2} ry={1} fill="#FFFFFF" opacity={0.8} transform="rotate(-30 68 73.4)" />
    </G>
  ),
});

const spirit: Draw = (p, f) => ({
  ground: [50, 87, 14],
  sway: (
    <G>
      {(
        [
          [30, 38, 11.5, p.altDeep],
          [70, 37, 11.5, p.altDeep],
          [41, 27, 12.5, p.altDeep],
          [59, 26, 12.5, p.altDeep],
          [36, 33, 10, p.alt],
          [64, 32, 10, p.alt],
          [50, 30, 13.5, p.alt],
          [50, 20, 8.5, p.alt],
        ] as const
      ).map(([x, y, r, c], i) => (
        <VE key={i} cx={x} cy={y} rx={r} ry={r * 0.92} fill={c} f={f} gloss={c === p.alt} />
      ))}
      {[
        [33, 26],
        [62, 18],
        [45, 36],
        [69, 30],
      ].map(([x, y], i) => (
        <Path key={i} d={flame(x, y + 4, x + (i % 2 ? 3 : -3), y - 1, 1.8)} fill={p.altDeep} opacity={0.5} />
      ))}
    </G>
  ),
  pivot: [50, 44],
  body: (
    <G>
      <VE cx={50} cy={80} rx={9.5} ry={6.4} fill={p.light} f={f} gloss={false} />
      <VE cx={41} cy={77} rx={2.6} ry={4} fill={p.light} f={f} turn={30} gloss={false} />
      <VE cx={59} cy={77} rx={2.6} ry={4} fill={p.light} f={f} turn={-30} gloss={false} />
      <Shadow cx={50} cy={46} rx={15} ry={4} f={f} opacity={0.65} />
      <VE cx={50} cy={59} rx={16} ry={17.5} fill={p.light} f={f} />
      <Ellipse cx={49} cy={67} rx={2.4} ry={3} fill="#14081E" />
      <Path d="M58 49 L60.5 53 M61 50 L59 52.6" stroke={p.mid} strokeWidth={0.8} opacity={0.5} />
    </G>
  ),
  eyes: {
    box: [37, 49, 26, 13],
    el: (
      <G>
        <Ellipse cx={44} cy={55} rx={3.6} ry={4} fill="#14081E" />
        <Ellipse cx={56} cy={56} rx={3.2} ry={3.6} fill="#14081E" />
        <Circle cx={44.5} cy={56} r={1} fill={p.accent} opacity={0.8} />
        <Circle cx={56.4} cy={57} r={0.9} fill={p.accent} opacity={0.8} />
      </G>
    ),
  },
  flicker: (
    <G>
      {(
        [
          [21, 58],
          [79, 62],
          [77, 16],
          [23, 18],
          [85, 42],
        ] as const
      ).map(([x, y]) => (
        <Glow key={x} x={x} y={y} r={1.5} color={p.accent} />
      ))}
    </G>
  ),
  flickerOver: true,
});

const crystal: Draw = (p, f) => ({
  ground: [50, 92, 12],
  back: <Ellipse cx={50} cy={52} rx={34} ry={8.5} fill="none" stroke={p.accent} strokeWidth={1.2} opacity={0.5} transform="rotate(-14 50 52)" />,
  body: (
    <G>
      <Path d="M50 14 L68 38 L50 86 L32 38Z" fill={f.holo} />
      <Path d="M50 14 L32 38 L44 41Z" fill="#FFFFFF" opacity={0.7} />
      <Path d="M50 14 L44 41 L56 41Z" fill="#FFFFFF" opacity={0.35} />
      <Path d="M50 14 L56 41 L68 38Z" fill="#FFFFFF" opacity={0.15} />
      <Path d="M32 38 L44 41 L50 86Z" fill={p.alt} opacity={0.4} />
      <Path d="M44 41 L56 41 L50 86Z" fill="#FFFFFF" opacity={0.1} />
      <Path d="M56 41 L68 38 L50 86Z" fill={p.altDeep} opacity={0.45} />
      <Path d="M50 14 L68 38 L50 86 L32 38Z M32 38 L44 41 L56 41 L68 38 M50 14 L44 41 L50 86 M50 14 L56 41 L50 86" fill="none" stroke="#FFFFFF" strokeWidth={0.7} opacity={0.75} strokeLinejoin="round" />
      <Path d="M36 37 L47 19" stroke="#FFFFFF" strokeWidth={1.6} opacity={0.85} strokeLinecap="round" />
      <Path d="M53 70 L50 82" stroke="#FFFFFF" strokeWidth={1} opacity={0.6} strokeLinecap="round" />
      <Circle cx={43.5} cy={58} r={1.8} fill={p.alt} opacity={0.6} />
      <Circle cx={56.5} cy={58} r={1.8} fill={p.alt} opacity={0.6} />
      <Path d="M47.5 58.5 Q50 60.5 52.5 58.5" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </G>
  ),
  front: <Path d="M16 53 Q50 66 84 47" stroke={p.accent} strokeWidth={1.2} opacity={0.65} fill="none" strokeLinecap="round" />,
  eyes: {
    box: [40, 49, 20, 9],
    el: (
      <G>
        <VEye x={45.5} y={53.6} r={2.4} f={f} />
        <VEye x={54.5} y={53.6} r={2.4} f={f} />
      </G>
    ),
  },
  flicker: sparkles(p.accent, [
    [21, 29, 3],
    [79, 22, 2.4],
    [81, 67, 2.8],
    [19, 69, 2],
  ]),
  flickerOver: true,
});

const skull: Draw = (p, f) => ({
  ground: [50, 82, 18],
  body: (
    <G>
      <V d="M29 46 C29 29 39 21 50 21 C61 21 71 29 71 46 C71 54 67 58.5 63.5 60.5 L63.5 69 C63.5 73.5 60 76 56 76 L44 76 C40 76 36.5 73.5 36.5 69 L36.5 60.5 C33 58.5 29 54 29 46Z" fill={p.light} f={f} gloss={[39, 30, 6.5, 3, -35]} />
      <V d="M24.5 49 Q24.5 47 26.5 47 L30 47 L30 57 L26.5 57 Q24.5 57 24.5 55Z" fill={p.deep} f={f} />
      <V d="M75.5 49 Q75.5 47 73.5 47 L70 47 L70 57 L73.5 57 Q75.5 57 75.5 55Z" fill={p.deep} f={f} />
      <Ellipse cx={41} cy={47.5} rx={7} ry={7.4} fill="#0E0816" />
      <Ellipse cx={59} cy={47.5} rx={7} ry={7.4} fill="#0E0816" />
      <Path d="M47.8 59.4 L50 55 L52.2 59.4 Q50 61 47.8 59.4Z" fill="#0E0816" />
      <Shadow cx={50} cy={67} rx={13} ry={2.4} f={f} opacity={0.5} />
      {[43.6, 47.8, 52.2, 56.4].map((x) => (
        <V key={x} d={`M${x - 1.9} 66 L${x + 1.9} 66 L${x + 1.7} 72 Q${x} 73.5 ${x - 1.7} 72Z`} fill={p.light} f={f} />
      ))}
      <Path d="M57 22 L54.6 28.5 L58.2 32 L56 37.5" stroke={p.deep} strokeWidth={1.2} fill="none" />
      <Path d="M52.8 25.5 L58.4 27 M53.4 30.5 L59 31.2 M53.8 35 L59.2 35.6" stroke={p.deep} strokeWidth={1} strokeLinecap="round" />
    </G>
  ),
  flicker: (
    <G>
      <Glow x={41} y={48.5} r={2.8} color={p.accent} />
      <Glow x={59} y={48.5} r={2.8} color={p.accent} />
      <Ellipse cx={50} cy={48} rx={20} ry={8} fill={p.accent} opacity={0.08} />
    </G>
  ),
  flickerOver: true,
});

const serpent: Draw = (p, f) => {
  const neck: [number, number, number, number, number, number] = [61, 71, 74, 56, 50, 46];
  return {
    ground: [50, 86, 25],
    body: (
      <G>
        <VE cx={50} cy={79} rx={24} ry={7.5} fill={p.mid} f={f} />
        <Path d="M30 80 Q50 85.5 70 80" stroke={p.alt} strokeWidth={1.2} opacity={0.6} fill="none" />
        <Shadow cx={50} cy={75} rx={17} ry={3} f={f} />
        <VE cx={50} cy={71.5} rx={18.5} ry={6.5} fill={p.mid} f={f} />
        <Path d="M35 72 Q50 77 65 72" stroke={p.alt} strokeWidth={1.2} opacity={0.6} fill="none" />
        <Tube path={neck} from={10} to={8} fill={p.mid} edge={p.deep} light={p.light} />
        {[0.2, 0.4, 0.6, 0.8].map((t) => {
          const [x, y] = onTube(neck, t);
          return <Ellipse key={t} cx={x - 1.6} cy={y + 1.2} rx={2.4} ry={1.1} fill={p.alt} opacity={0.8} />;
        })}
        <V d="M50 26 C37.5 26 32.5 40 36.5 50.5 C39.5 56.5 45 58.5 50 58.5 C55 58.5 60.5 56.5 63.5 50.5 C67.5 40 62.5 26 50 26Z" fill={p.mid} f={f} />
        <VE cx={50} cy={45} rx={6.4} ry={10} fill={p.alt} f={f} gloss={false} opacity={0.85} />
        <Path d="M45.5 41 Q50 39 54.5 41 M45 46 Q50 44 55 46 M45.5 51 Q50 49 54.5 51" stroke={p.altDeep} strokeWidth={0.8} fill="none" opacity={0.6} />
        <Path d="M40 37 Q38 44 40 50 M60 37 Q62 44 60 50" stroke={p.deep} strokeWidth={0.9} fill="none" opacity={0.5} />
        <Shadow cx={50} cy={37} rx={9} ry={3} f={f} opacity={0.5} />
        <VE cx={50} cy={31} rx={9.5} ry={7.4} fill={p.mid} f={f} />
        <Circle cx={47.4} cy={34.6} r={0.6} fill={p.deep} />
        <Circle cx={52.6} cy={34.6} r={0.6} fill={p.deep} />
      </G>
    ),
    flicker: <Path d="M50 37.4 L50 42 M50 42 L47.8 45 M50 42 L52.2 45" stroke={p.accent} strokeWidth={1.4} fill="none" strokeLinecap="round" />,
    flickerOver: true,
    eyes: {
      box: [40, 26, 20, 8],
      el: (
        <G>
          {[45.4, 54.6].map((x) => (
            <G key={x}>
              <VEye x={x} y={30} r={2.6} ry={2.3} f={f} iris={p.alt} />
              <Ellipse cx={x} cy={30.3} rx={0.55} ry={1.7} fill="#06040C" />
            </G>
          ))}
        </G>
      ),
    },
  };
};

const alien: Draw = (p, f) => ({
  ground: [50, 89, 14],
  body: (
    <G>
      <Tube path={[42, 26, 37, 20, 35, 14]} from={1.8} to={1.4} fill={p.deep} edge="#000000" light={p.light} steps={6} />
      <Tube path={[58, 26, 63, 20, 65, 14]} from={1.8} to={1.4} fill={p.deep} edge="#000000" light={p.light} steps={6} />
      <V d="M44 72 L56 72 L58.5 85 Q50 88.5 41.5 85Z" fill={p.mid} f={f} />
      <Shadow cx={50} cy={74} rx={8} ry={2.4} f={f} />
      <V d="M50 21 C66.5 21 74.5 33 72.5 46 C70.5 60.5 58 74.5 50 76.5 C42 74.5 29.5 60.5 27.5 46 C25.5 33 33.5 21 50 21Z" fill={p.mid} f={f} gloss={[39, 30, 7, 3.4, -30]} />
      <Path d="M46.6 65 Q50 67 53.4 65" stroke={p.deep} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </G>
  ),
  flicker: (
    <G>
      <Glow x={35} y={13} r={3} color={p.accent} />
      <Glow x={65} y={13} r={3} color={p.accent} />
    </G>
  ),
  flickerOver: true,
  eyes: {
    box: [30, 38, 40, 18],
    el: both(
      <G>
        <Path d="M32 46 C34 39 44.5 39 48 47.5 C45.5 54.5 36.5 55 32 46Z" fill={f.ball} />
        <Path d="M33.5 45.5 C35.5 41.4 42 41.2 45 45" stroke="#FFFFFF" strokeWidth={0.6} opacity={0.3} fill="none" />
        <Ellipse cx={38.6} cy={44} rx={2.6} ry={1.5} fill="#FFFFFF" transform="rotate(-15 38.6 44)" />
        <Circle cx={43.4} cy={49.4} r={0.9} fill={p.accent} />
      </G>,
    ),
  },
});

const monster: Draw = (p, f) => {
  let d = '';
  for (let i = 0; i < 20; i++) {
    const a0 = (i * 18 * Math.PI) / 180;
    const a1 = ((i * 18 + 9) * Math.PI) / 180;
    const a2 = ((i + 1) * 18 * Math.PI) / 180;
    const pt = (a: number, r: number) => `${r1(50 + Math.cos(a) * r)} ${r1(57 + Math.sin(a) * r * 0.92)}`;
    d += `${i ? '' : `M${pt(a0, 21.5)}`} Q${pt(a1, 25)} ${pt(a2, 21.5)}`;
  }
  return {
    ground: [50, 84, 20],
    back: (
      <G>
        <V d={flame(40, 39, 32.5, 22.5, 4, -3)} fill={p.light} f={f} />
        <V d={flame(60, 39, 67.5, 22.5, 4, 3)} fill={p.light} f={f} />
        <VE cx={42} cy={79} rx={6} ry={3.6} fill={p.deep} f={f} />
        <VE cx={58} cy={79} rx={6} ry={3.6} fill={p.deep} f={f} />
      </G>
    ),
    body: (
      <G>
        <V d={`${d}Z`} fill={p.mid} f={f} gloss={[39, 43, 6, 3, -35]} />
        <VE cx={50} cy={67} rx={11} ry={8} fill={p.light} f={f} gloss={false} opacity={0.45} />
        <Path d="M40.5 63 Q50 73 59.5 63 Q50 67.5 40.5 63Z" fill="#14081E" />
        <Path d="M43.6 64.6 L45.2 68 L46.8 65.5Z M53.2 65.5 L54.8 68 L56.4 64.6Z" fill="#FFFFFF" />
        <Circle cx={39} cy={60} r={2.4} fill={p.alt} opacity={0.5} />
        <Circle cx={61} cy={60} r={2.4} fill={p.alt} opacity={0.5} />
      </G>
    ),
    eyes: {
      box: [35, 45, 30, 15],
      el: (
        <G>
          <VE cx={43} cy={52.5} rx={5.4} ry={5.6} fill="#FFFFFF" f={f} gloss={false} />
          <VE cx={57} cy={52.5} rx={5.4} ry={5.6} fill="#FFFFFF" f={f} gloss={false} />
          <VEye x={43.8} y={53.2} r={3.2} f={f} />
          <VEye x={56.2} y={53.2} r={3.2} f={f} />
        </G>
      ),
    },
    front: (
      <G>
        {Array.from({ length: 5 }, (_, i) => {
          const a = ((i * 72 - 90) * Math.PI) / 180;
          return <VE key={i} cx={64 + Math.cos(a) * 3.8} cy={36 + Math.sin(a) * 3.8} rx={3.2} ry={3.2} fill={p.alt} f={f} gloss={false} />;
        })}
        <VE cx={64} cy={36} rx={2.2} ry={2.2} fill={p.accent} f={f} />
      </G>
    ),
  };
};

const sloth: Draw = (p, f) => ({
  ground: [50, 90, 14],
  back: (
    <G>
      <Tube path={[12, 29, 50, 19, 88, 31]} from={6} to={5} fill={p.altDeep} edge="#000000" light={p.alt} steps={12} />
      {(
        [
          [23, 25, 15, 15, -3],
          [30, 24, 34, 13, 3],
          [70, 25, 74, 14, 3],
          [79, 27, 87, 18, -3],
        ] as const
      ).map(([bx, by, tx, ty, b], i) => (
        <V key={i} d={flame(bx, by, tx, ty, 3.4, b)} fill={p.alt} f={f} />
      ))}
    </G>
  ),
  body: (
    <G>
      <Tube path={[42, 56, 35, 40, 40, 26]} from={7} to={6} fill={p.mid} edge={p.deep} light={p.light} />
      <Tube path={[58, 56, 65, 40, 60, 26]} from={7} to={6} fill={p.mid} edge={p.deep} light={p.light} />
      <Path d="M37 23.5 Q39 20.5 41 23.5 M59 23.5 Q61 20.5 63 23.5" stroke="#2E2018" strokeWidth={1.3} fill="none" strokeLinecap="round" />
      <VE cx={50} cy={67} rx={15.5} ry={16.5} fill={p.mid} f={f} />
      <VE cx={50} cy={71} rx={8.5} ry={9.5} fill={p.light} f={f} gloss={false} opacity={0.55} />
      <Shadow cx={50} cy={62} rx={12} ry={3} f={f} opacity={0.5} />
      <VE cx={50} cy={50} rx={13.5} ry={13} fill={p.mid} f={f} />
      <VE cx={50} cy={52} rx={10.4} ry={8.4} fill={p.light} f={f} gloss={false} />
      <V d="M40.4 49 Q44 45.6 48.5 49.4 Q47.4 54 44 54 Q40 53.4 40.4 49Z" fill={p.deep} f={f} />
      <V d="M59.6 49 Q56 45.6 51.5 49.4 Q52.6 54 56 54 Q60 53.4 59.6 49Z" fill={p.deep} f={f} />
      <VE cx={50} cy={55.4} rx={2.3} ry={1.6} fill={p.accent} f={f} />
      <Path d="M47 58 Q50 60.6 53 58" stroke={p.accent} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 46, 20, 9],
    el: (
      <G>
        <VEye x={44.6} y={50.6} r={1.9} f={f} />
        <VEye x={55.4} y={50.6} r={1.9} f={f} />
      </G>
    ),
  },
});

const reaper: Draw = (p, f) => ({
  ground: [50, 87, 26],
  back: (
    <G>
      <V d="M69.7 14.2 A11 11 0 1 0 82.1 29.4 A10 10 0 0 1 69.7 14.2Z" fill={p.alt} f={f} />
    </G>
  ),
  body: (
    <G>
      <V d="M50 23 C37.5 23 31.5 35.5 31.5 48 C31.5 60 27.5 72 23.5 82.5 L31.5 79.5 L37 85 L43 79.5 L50 86 L57 79.5 L63 85 L68.5 79.5 L76.5 82.5 C72.5 72 68.5 60 68.5 48 C68.5 35.5 62.5 23 50 23Z" fill={p.mid} f={f} gloss={[40, 32, 5, 2.4, -40]} />
      <Path d="M40 64 Q38 74 33 80 M60 64 Q62 74 67 80 M50 66 L50 84" stroke={p.deep} strokeWidth={1} opacity={0.45} fill="none" />
      <V d="M50 33 C40.5 33 37.5 41.5 37.5 49 C37.5 56.5 42.5 61 50 61 C57.5 61 62.5 56.5 62.5 49 C62.5 41.5 59.5 33 50 33Z" fill="#06040C" f={f} />
      <Path d="M38.5 47 C38.5 39 43 34 50 34 C57 34 61.5 39 61.5 47" stroke={p.light} strokeWidth={1.4} opacity={0.5} fill="none" />
    </G>
  ),
  eyes: {
    box: [39, 44, 22, 11],
    el: (
      <G>
        <Glow x={45} y={49.5} r={2.4} color={p.accent} />
        <Glow x={55} y={49.5} r={2.4} color={p.accent} />
      </G>
    ),
  },
  flicker: <Ellipse cx={50} cy={50} rx={10} ry={6} fill={p.accent} opacity={0.12} />,
  flickerOver: true,
});

const jelly: Draw = (p, f) => ({
  ground: [50, 94, 12],
  sway: (
    <G>
      {[37, 43.5, 50, 56.5, 63].map((x, i) => (
        <Tube key={x} path={[x, 55, x + (i % 2 ? 6 : -6), 72, x + (i % 2 ? -2 : 2), i % 2 ? 87 : 91]} from={2.6} to={1.2} fill={p.alt} edge={p.altDeep} light="#FFFFFF" steps={8} />
      ))}
      {[46.5, 53.5].map((x) => (
        <V key={x} d={`M${x - 2.4} 56 C${x + 3} 63 ${x - 3} 68 ${x + 1} 77 C${x - 1} 72 ${x - 6} 64 ${x - 2.4} 56Z`} fill={p.light} f={f} opacity={0.75} />
      ))}
    </G>
  ),
  pivot: [50, 40],
  body: (
    <G>
      <V d="M25 54 C25 33 37.5 23 50 23 C62.5 23 75 33 75 54 Q71 59 67 55.4 Q63 60 58.6 55.6 Q54.4 60 50 55.6 Q45.6 60 41.4 55.6 Q37 60 33 55.4 Q29 59 25 54Z" fill={p.mid} f={f} gloss={[37, 33, 7.4, 3.4, -35]} />
      <Path d="M28 50 C29 36 38 27 50 27" stroke="#FFFFFF" strokeWidth={1} opacity={0.3} fill="none" />
      <Path d="M47.4 51.6 Q50 53.8 52.6 51.6" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <Circle cx={39.5} cy={50} r={2.3} fill={p.altDeep} opacity={0.5} />
      <Circle cx={60.5} cy={50} r={2.3} fill={p.altDeep} opacity={0.5} />
    </G>
  ),
  eyes: {
    box: [39, 41, 22, 11],
    el: (
      <G>
        <VEye x={44.5} y={46.8} r={2.8} f={f} />
        <VEye x={55.5} y={46.8} r={2.8} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {(
        [
          [36, 40],
          [64, 38],
          [57, 30],
          [43, 31],
        ] as const
      ).map(([x, y]) => (
        <Glow key={x} x={x} y={y} r={1.3} color={p.accent} />
      ))}
    </G>
  ),
  flickerOver: true,
});

const beast: Draw = (p, f) => ({
  ground: [50, 85, 25],
  back: (
    <G>
      <V d={flame(35, 39, 23, 12, 6, 8)} fill={p.alt} f={f} />
      <V d={flame(65, 39, 77, 12, 6, -8)} fill={p.alt} f={f} />
      {[0.4, 0.62].map((t) => {
        const [x1, y1] = along(35, 39, 23, 12, 8, t);
        const [x2, y2] = along(65, 39, 77, 12, -8, t);
        return (
          <G key={t}>
            <Path d={`M${x1 - 3} ${y1 + 1} Q${x1} ${y1 + 2.2} ${x1 + 3} ${y1}`} stroke={p.altDeep} strokeWidth={0.8} fill="none" opacity={0.6} />
            <Path d={`M${x2 - 3} ${y2} Q${x2} ${y2 + 2.2} ${x2 + 3} ${y2 + 1}`} stroke={p.altDeep} strokeWidth={0.8} fill="none" opacity={0.6} />
          </G>
        );
      })}
    </G>
  ),
  body: (
    <G>
      {both(
        <G>
          <V d={flame(28, 58, 16, 64, 4.6)} fill={p.mid} f={f} />
          <V d={flame(28, 49, 17, 46, 4.6)} fill={p.mid} f={f} />
        </G>,
      )}
      <V d="M23.5 52 C23.5 33.5 36 27 50 27 C64 27 76.5 33.5 76.5 52 C76.5 67 66 77 50 77 C34 77 23.5 67 23.5 52Z" fill={p.mid} f={f} gloss={[35, 35, 7, 3, -25]} />
      <V d="M31.5 42 L46 46.6 L50 44.2 L54 46.6 L68.5 42 L67 47 L54 50.6 L46 50.6 L33 47Z" fill={p.deep} f={f} />
      <V d="M32.5 60 Q50 75 67.5 60 Q65 71 50 74 Q35 71 32.5 60Z" fill="#100620" f={f} />
      <V d="M39 62.6 L42.4 70.6 L45.6 64.8Z" fill={p.alt} f={f} />
      <V d="M61 62.6 L57.6 70.6 L54.4 64.8Z" fill={p.alt} f={f} />
      <Path d="M46.6 66 L48.3 68.8 L50 66.2 L51.7 68.8 L53.4 66" stroke={p.alt} strokeWidth={1.1} fill="none" strokeLinejoin="round" />
      <Ellipse cx={46.6} cy={56} rx={1.3} ry={0.9} fill={p.deep} />
      <Ellipse cx={53.4} cy={56} rx={1.3} ry={0.9} fill={p.deep} />
    </G>
  ),
  eyes: {
    box: [32, 44, 36, 12],
    el: both(
      <G>
        <Path d="M33.5 48.2 L46.2 50.8 L44.6 54.2 Q37.6 54.8 33.5 48.2Z" fill={p.accent} opacity={0.3} transform="translate(-0.6 -0.4) scale(1.02)" />
        <Path d="M34.5 48.5 L46 51 L44.5 54 Q38 54.5 34.5 48.5Z" fill={p.accent} />
        <Circle cx={41.5} cy={51.6} r={1.3} fill="#FFFFFF" />
      </G>,
    ),
  },
});

const bot: Draw = (p, f) => ({
  ground: [50, 85, 18],
  body: (
    <G>
      <Line x1={50} y1={26} x2={50} y2={17} stroke={p.deep} strokeWidth={2.2} strokeLinecap="round" />
      <V d="M23.5 39.5 Q23.5 37.5 25.5 37.5 L29 37.5 L29 53.5 L25.5 53.5 Q23.5 53.5 23.5 51.5Z" fill={p.deep} f={f} />
      <V d="M76.5 39.5 Q76.5 37.5 74.5 37.5 L71 37.5 L71 53.5 L74.5 53.5 Q76.5 53.5 76.5 51.5Z" fill={p.deep} f={f} />
      <Rect x={45} y={60} width={10} height={6} fill={p.deep} />
      <V d="M37 70 Q37 64 43 64 L57 64 Q63 64 63 70 L63 77 Q63 83 57 83 L43 83 Q37 83 37 77Z" fill={p.mid} f={f} gloss={[42, 66.4, 3, 1.2, -15]} />
      <VE cx={45} cy={73} rx={2.3} ry={2.3} fill={p.accent} f={f} />
      <VE cx={55} cy={73} rx={2.3} ry={2.3} fill={p.light} f={f} />
      <Shadow cx={50} cy={63} rx={14} ry={2.6} f={f} opacity={0.6} />
      <V d="M28 36 Q28 25 39 25 L61 25 Q72 25 72 36 L72 51 Q72 62 61 62 L39 62 Q28 62 28 51Z" fill={p.mid} f={f} gloss={[36, 29.5, 5.5, 2, -10]} />
      <V d="M33 39 Q33 32 40 32 L60 32 Q67 32 67 39 L67 48 Q67 55 60 55 L40 55 Q33 55 33 48Z" fill={p.alt} f={f} />
      <Path d="M35 37.5 Q36 34 40 34" stroke="#FFFFFF" strokeWidth={1} opacity={0.35} fill="none" strokeLinecap="round" />
      <Path d="M42 49 Q45 46.4 48 49 Q51 51.6 54 49 Q56 47.4 58 48.6" stroke={p.accent} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      {[31, 69].map((x) => (
        <Circle key={x} cx={x} cy={58.5} r={0.9} fill={p.light} opacity={0.6} />
      ))}
    </G>
  ),
  flicker: (
    <G>
      <Glow x={50} y={15} r={3.4} color={p.accent} />
      <Path d="M42 49 Q45 46.4 48 49 Q51 51.6 54 49 Q56 47.4 58 48.6" stroke={p.accent} strokeWidth={4} opacity={0.18} fill="none" strokeLinecap="round" />
    </G>
  ),
  flickerOver: true,
  eyes: {
    box: [36, 35, 28, 11],
    el: (
      <G>
        <Rect x={38.6} y={37} width={9} height={6.6} rx={3.3} fill={p.accent} opacity={0.25} />
        <Rect x={52.4} y={37} width={9} height={6.6} rx={3.3} fill={p.accent} opacity={0.25} />
        <Rect x={39.4} y={37.6} width={7.4} height={5.4} rx={2.7} fill={p.accent} />
        <Rect x={53.2} y={37.6} width={7.4} height={5.4} rx={2.7} fill={p.accent} />
        <Rect x={40.6} y={38.4} width={2.6} height={1.4} rx={0.7} fill="#FFFFFF" opacity={0.8} />
        <Rect x={54.4} y={38.4} width={2.6} height={1.4} rx={0.7} fill="#FFFFFF" opacity={0.8} />
      </G>
    ),
  },
});

const wolf: Draw = (p, f) => ({
  ground: [50, 82, 20],
  body: (
    <G>
      {both(
        <G>
          <V d="M28.5 43 L26.5 14.5 L45.5 29Z" fill={p.mid} f={f} />
          <V d="M31.4 37.5 L30.4 21.5 L41 30Z" fill={p.deep} f={f} />
        </G>,
      )}
      <V d="M26.5 45 C26.5 31.5 37.5 27.5 50 27.5 C62.5 27.5 73.5 31.5 73.5 45 C73.5 55 67.5 61.5 61.5 65.5 L55 75.5 Q50 79 45 75.5 L38.5 65.5 C32.5 61.5 26.5 55 26.5 45Z" fill={p.mid} f={f} gloss={[37, 35, 6, 2.6, -25]} />
      {both(<V d="M26.6 47.5 C29.6 55.5 35 59.5 41 61.5 L33 62.6 L36 65.6 L28.6 61.4Z" fill={p.alt} f={f} />)}
      <V d="M41.5 58 Q50 53.5 58.5 58 L55 72.5 Q50 76 45 72.5Z" fill={p.alt} f={f} />
      <VE cx={50} cy={70.4} rx={3.6} ry={2.6} fill="#14081E" f={f} />
      <Path d="M50 73 L50 75" stroke="#14081E" strokeWidth={0.9} />
      <Path d="M44.5 41.5 Q50 39.5 55.5 41.5" stroke={p.deep} strokeWidth={1} opacity={0.5} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [34, 42, 32, 11],
    el: both(
      <G>
        <Circle cx={41.5} cy={47.2} r={4.6} fill={p.accent} opacity={0.22} />
        <Path d="M36.2 47.2 Q41.5 42.8 46.2 47.2 Q41.5 50.6 36.2 47.2Z" fill={p.accent} />
        <Ellipse cx={41.5} cy={47.2} rx={0.85} ry={2} fill="#06040C" />
        <Circle cx={40.2} cy={46.2} r={0.7} fill="#FFFFFF" />
      </G>,
    ),
  },
});

const moth: Draw = (p, f) => ({
  ground: [50, 90, 14],
  sway: (
    <G>
      {both(
        <G>
          <V d="M48 46 C36 21 15 17 13 33 C11 47 30 53 48 50Z" fill={p.mid} f={f} gloss={[24, 27, 5, 2.4, -20]} />
          <Path d="M47 47 C38 40 27 33 18 31 M47 49 C38 46 27 44 16 42 M46 47.6 C40 42 34 36 28 26" stroke={p.light} strokeWidth={0.7} opacity={0.45} fill="none" />
          <VE cx={26} cy={37} rx={5} ry={5} fill={p.alt} f={f} gloss={false} />
          <VE cx={26} cy={37} rx={2.4} ry={2.4} fill={p.accent} f={f} />
          <V d="M48 53 C34 56 23 68 29 77.5 C35 84 46 70 49 57Z" fill={p.deep} f={f} />
          <VE cx={35} cy={67} rx={3} ry={3} fill={p.alt} f={f} gloss={false} opacity={0.9} />
        </G>,
      )}
    </G>
  ),
  pivot: [50, 50],
  flap: true,
  body: (
    <G>
      <V d={flame(48, 35, 34, 16, 3, -5)} fill={p.light} f={f} />
      <V d={flame(52, 35, 66, 16, 3, 5)} fill={p.light} f={f} />
      {[0.35, 0.55, 0.75].map((t) => {
        const [x, y] = along(48, 35, 34, 16, -5, t);
        const [x2, y2] = along(52, 35, 66, 16, 5, t);
        return (
          <G key={t}>
            <Path d={`M${x} ${y} l-2.4 -0.6`} stroke={p.light} strokeWidth={0.6} opacity={0.8} />
            <Path d={`M${x2} ${y2} l2.4 -0.6`} stroke={p.light} strokeWidth={0.6} opacity={0.8} />
          </G>
        );
      })}
      <VE cx={50} cy={57} rx={5.4} ry={14} fill={p.deep} f={f} />
      <Path d="M45.6 52 L54.4 52 M45.2 57 L54.8 57 M45.6 62 L54.4 62" stroke={p.mid} strokeWidth={1.1} opacity={0.7} />
      <VE cx={50} cy={43.5} rx={7.4} ry={6} fill={p.light} f={f} gloss={false} />
      <VE cx={50} cy={38.5} rx={6.4} ry={6} fill={p.mid} f={f} />
    </G>
  ),
  eyes: {
    box: [43, 34, 14, 9],
    el: (
      <G>
        <VEye x={47.5} y={38.4} r={2.1} f={f} />
        <VEye x={52.5} y={38.4} r={2.1} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {(
        [
          [19, 58],
          [81, 56],
          [50, 87],
          [64, 21],
          [34, 84],
        ] as const
      ).map(([x, y]) => (
        <Glow key={x} x={x} y={y} r={1.2} color={p.accent} />
      ))}
    </G>
  ),
  flickerOver: true,
});

const cat: Draw = (p, f, extra) => {
  const crowned = extra === 'crown';
  return {
    ground: [50, 75, 20],
    back: crowned ? undefined : (
      <G>
        <Line x1={74} y1={11} x2={74} y2={15} stroke={p.light} strokeWidth={0.8} opacity={0.6} />
        <Circle cx={74} cy={22} r={8} fill={p.light} />
        {Array.from({ length: 5 }, (_, r) =>
          Array.from({ length: 5 }, (_, c) => {
            const x = 67.2 + c * 3.4;
            const y = 15.2 + r * 3.4;
            const inside = Math.hypot(x + 1.5 - 74, y + 1.5 - 22) < 7.2;
            return inside ? <Rect key={`${r}${c}`} x={x} y={y} width={3} height={3} rx={0.4} fill={(r + c) % 3 === 0 ? '#FFFFFF' : (r + c) % 3 === 1 ? p.mid : p.deep} opacity={0.9} /> : null;
          }),
        )}
        <Circle cx={74} cy={22} r={8} fill={f.shade} />
        <Circle cx={71} cy={19} r={1.6} fill="#FFFFFF" />
      </G>
    ),
    flicker: crowned
      ? undefined
      : (
          <G>
            {sparkles(p.accent, [
              [62, 14, 2.4],
              [87, 31, 2],
              [64, 33, 1.6],
              [20, 40, 2],
            ])}
            <Path d="M70 30 L60 46 M78 30 L86 44" stroke={p.accent} strokeWidth={0.8} opacity={0.35} />
          </G>
        ),
    flickerOver: true,
    body: (
      <G>
        <VE cx={50} cy={72} rx={14} ry={7} fill={p.mid} f={f} gloss={false} />
        {both(
          <G>
            <V d="M29.5 43 L31.5 17 L47.5 30.5Z" fill={p.mid} f={f} />
            <V d="M32.6 37.5 L33.6 23.5 L42.6 31Z" fill={p.deep} f={f} />
          </G>,
        )}
        <VE cx={50} cy={51} rx={22.5} ry={19.5} fill={p.mid} f={f} />
        <Path d="M45 34 L46 39 M50 33 L50 38.5 M55 34 L54 39" stroke={p.deep} strokeWidth={1.4} opacity={0.4} strokeLinecap="round" />
        <VE cx={46} cy={59.4} rx={4.8} ry={3.8} fill={p.light} f={f} gloss={false} />
        <VE cx={54} cy={59.4} rx={4.8} ry={3.8} fill={p.light} f={f} gloss={false} />
        <V d="M48.2 55.6 L51.8 55.6 L50 58Z" fill={p.deep} f={f} />
        <Path d="M46.5 61.4 Q48.5 63.4 50 61.4 Q51.5 63.4 53.5 61.4" stroke={p.deep} strokeWidth={1} fill="none" strokeLinecap="round" />
        {both(<Path d="M40 58.5 L28 56.5 M40 61 L28 62.5" stroke={p.light} strokeWidth={0.6} opacity={0.75} />)}
      </G>
    ),
    eyes: crowned
      ? {
          box: [35, 42, 30, 12],
          el: both(
            <G>
              <Path d="M37 48 Q42 42.8 47 48 Q42 52 37 48Z" fill={f.ball} />
              <Path d="M38.2 48 Q42 44.4 45.8 48 Q42 51 38.2 48Z" fill={p.accent} />
              <Ellipse cx={42} cy={48} rx={0.9} ry={2.4} fill="#06040C" />
              <Circle cx={40.6} cy={46.8} r={0.8} fill="#FFFFFF" />
            </G>,
          ),
        }
      : undefined,
    front: crowned ? (
      <G>
        <V d="M37.5 33 L36.5 20 L44 26 L50 16.5 L56 26 L63.5 20 L62.5 33Z" fill={p.accent} f={f} gloss={[44, 27, 2.4, 1, -20]} />
        <Path d="M37.5 33 L62.5 33" stroke={p.altDeep} strokeWidth={1} opacity={0.6} />
        <VE cx={50} cy={28.4} rx={2} ry={2} fill={p.altDeep} f={f} />
        <VE cx={43} cy={30} rx={1.3} ry={1.3} fill="#FFFFFF" f={f} />
        <VE cx={57} cy={30} rx={1.3} ry={1.3} fill="#FFFFFF" f={f} />
      </G>
    ) : (
      <G>
        {both(<V d="M30 44 Q30 40.6 34 40.6 L46 40.6 Q48.6 40.6 48.2 44 L46.6 49.4 Q45.6 52.6 42 52.6 L36 52.6 Q31.4 52.6 30.8 48.4Z" fill="#14081E" f={f} />)}
        <Path d="M48 43 Q50 41.4 52 43" stroke="#14081E" strokeWidth={1.6} fill="none" />
        {both(<Path d="M34.6 49.6 L41 43 M38.4 50.6 L43.4 45.6" stroke={p.accent} strokeWidth={1.1} opacity={0.85} strokeLinecap="round" />)}
      </G>
    ),
  };
};

const owl: Draw = (p, f) => ({
  ground: [50, 85, 20],
  body: (
    <G>
      <V d={flame(36, 37, 28.5, 20.5, 4.6, -2)} fill={p.deep} f={f} />
      <V d={flame(64, 37, 71.5, 20.5, 4.6, 2)} fill={p.deep} f={f} />
      <VE cx={50} cy={56} rx={21.5} ry={25.5} fill={p.mid} f={f} />
      <VE cx={50} cy={67} rx={12.5} ry={13} fill={p.alt} f={f} gloss={false} />
      {[61, 66, 71].map((y) => (
        <Path key={y} d={`M43.6 ${y} L46 ${y + 2.2} L48.4 ${y} M51.6 ${y} L54 ${y + 2.2} L56.4 ${y}`} stroke={p.deep} strokeWidth={0.9} opacity={0.5} fill="none" strokeLinecap="round" />
      ))}
      {both(<V d="M29.5 50 C25.5 62 29.5 75 38 80 C36 69 36 58 34 50Z" fill={p.deep} f={f} />)}
      <Path d="M43.6 81 L43.6 84.4 M46.8 81 L46.8 84.4 M53.2 81 L53.2 84.4 M56.4 81 L56.4 84.4" stroke={p.light} strokeWidth={1.6} strokeLinecap="round" />
      <VE cx={41} cy={46} rx={9.4} ry={9.4} fill={p.alt} f={f} gloss={false} />
      <VE cx={59} cy={46} rx={9.4} ry={9.4} fill={p.alt} f={f} gloss={false} />
      <V d="M47.4 52 L52.6 52 L50 57.8Z" fill={p.light} f={f} />
    </G>
  ),
  eyes: {
    box: [30, 36, 40, 20],
    el: (
      <G>
        {[41, 59].map((x) => (
          <G key={x}>
            <Circle cx={x} cy={46} r={6.6} fill={p.accent} opacity={0.3} />
            <VEye x={x} y={46} r={5.4} f={f} iris={p.accent} />
          </G>
        ))}
      </G>
    ),
  },
});

const fox: Draw = (p, f) => ({
  ground: [50, 85, 20],
  sway: (
    <G>
      <V d="M58 73 C80 79 91 58 82 43 C80 56 72 63 57 63Z" fill={p.mid} f={f} />
      <V d="M82 43 C80 51.5 77 56 72.5 59 C79 60.5 85.4 54 82 43Z" fill={p.alt} f={f} />
    </G>
  ),
  pivot: [58, 69],
  body: (
    <G>
      <VE cx={50} cy={75} rx={12.5} ry={9.5} fill={p.mid} f={f} />
      <VE cx={50} cy={77} rx={6.4} ry={6} fill={p.alt} f={f} gloss={false} />
      {both(
        <G>
          <V d="M31.5 39 L29.5 15 L46.5 28Z" fill={p.mid} f={f} />
          <V d="M33.8 34 L33 21.5 L41.6 28.6Z" fill={p.deep} f={f} />
        </G>,
      )}
      <Shadow cx={50} cy={68} rx={12} ry={3} f={f} opacity={0.6} />
      <V d="M25.5 45 C27.5 32.5 38 28 50 28 C62 28 72.5 32.5 74.5 45 C72.5 57 60.5 67 50 71.5 C39.5 67 27.5 57 25.5 45Z" fill={p.mid} f={f} gloss={[37, 35, 6, 2.6, -25]} />
      {both(<V d="M25.5 45 C31.5 51 39.5 53 45.6 57 C45.6 63 47.6 67.4 50 71.5 C39.5 67 27.5 57 25.5 45Z" fill={p.alt} f={f} />)}
      <VE cx={50} cy={67.4} rx={3.2} ry={2.4} fill="#14081E" f={f} />
      <Circle cx={38} cy={53.4} r={2.4} fill={p.deep} opacity={0.25} />
      <Circle cx={62} cy={53.4} r={2.4} fill={p.deep} opacity={0.25} />
    </G>
  ),
  eyes: {
    box: [36, 42, 28, 11],
    el: (
      <G>
        <VEye x={42} y={47.5} r={3.3} f={f} />
        <VEye x={58} y={47.5} r={3.3} f={f} />
      </G>
    ),
  },
});

const dragon: Draw = (p, f) => ({
  ground: [50, 82, 22],
  back: (
    <G>
      {both(
        <G>
          <V d="M34 50 L12.5 28 L17.5 43 L10.5 47 L21 53.5 L18.5 60.5 L34 58Z" fill={p.deep} f={f} />
          <Path d="M33 51 L14 31 M33 53 L13 46.6 M33 55.5 L20 58" stroke={p.mid} strokeWidth={0.8} opacity={0.7} />
        </G>,
      )}
      <V d={flame(39, 33, 29.5, 14.5, 4, -3.4)} fill={p.alt} f={f} />
      <V d={flame(61, 33, 70.5, 14.5, 4, 3.4)} fill={p.alt} f={f} />
    </G>
  ),
  body: (
    <G>
      {[44, 50, 56].map((x) => (
        <V key={x} d={flame(x, 28, x, x === 50 ? 17.5 : 20.5, 2.6)} fill={p.alt} f={f} />
      ))}
      <V d="M30 46 C30 31.5 40 25.5 50 25.5 C60 25.5 70 31.5 70 46 C70 52 68 56 66 58 C71 63 69 74 58 75.5 L42 75.5 C31 74 29 63 34 58 C32 56 30 52 30 46Z" fill={p.mid} f={f} gloss={[39, 33, 6.4, 2.6, -25]} />
      <Shadow cx={50} cy={59} rx={14} ry={3} f={f} opacity={0.5} />
      <VE cx={50} cy={65} rx={14.5} ry={8.6} fill={p.light} f={f} gloss={false} />
      <VE cx={45} cy={62.4} rx={1.6} ry={1.1} fill="#14081E" f={f} gloss={false} />
      <VE cx={55} cy={62.4} rx={1.6} ry={1.1} fill="#14081E" f={f} gloss={false} />
      <Path d="M42 69 Q50 72.4 58 69" stroke={p.deep} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      {[
        [36, 50],
        [64, 50],
        [38, 54],
        [62, 54],
      ].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={1} fill={p.deep} opacity={0.35} />
      ))}
    </G>
  ),
  flicker: (
    <G>
      {(
        [
          [73, 62, -2],
          [77, 70, 0],
          [72, 78, 2],
        ] as const
      ).map(([tx, ty, b], i) => (
        <G key={i}>
          <V d={flame(59, 69.5, tx, ty, 3.6, b)} fill={p.mid} f={f} />
          <Path d={flame(59, 69.5, 59 + (tx - 59) * 0.75, 69.5 + (ty - 69.5) * 0.75, 2, b * 0.6)} fill={p.accent} />
        </G>
      ))}
      <Path d={star(84.5, 66, 2.3)} fill={p.accent} />
      <Path d={star(82, 81, 1.7)} fill="#FFFFFF" opacity={0.8} />
    </G>
  ),
  flickerOver: true,
  eyes: {
    box: [35, 39, 30, 13],
    el: (
      <G>
        {[42, 58].map((x) => (
          <G key={x}>
            <VEye x={x} y={45.5} r={3.8} ry={4.2} f={f} iris={p.accent} />
            <Ellipse cx={x} cy={46} rx={0.8} ry={2.8} fill="#06040C" />
          </G>
        ))}
      </G>
    ),
  },
});

const bear: Draw = (p, f) => ({
  ground: [50, 92, 22],
  back: <VE cx={50} cy={82} rx={20.5} ry={10} fill={p.mid} f={f} gloss={false} />,
  body: (
    <G>
      <VE cx={31.5} cy={34} rx={8} ry={8} fill={p.mid} f={f} />
      <VE cx={68.5} cy={34} rx={8} ry={8} fill={p.mid} f={f} />
      <VE cx={31.5} cy={34.4} rx={4} ry={4} fill={p.deep} f={f} gloss={false} />
      <VE cx={68.5} cy={34.4} rx={4} ry={4} fill={p.deep} f={f} gloss={false} />
      <Shadow cx={50} cy={71} rx={16} ry={4} f={f} opacity={0.6} />
      <VE cx={50} cy={51} rx={21.5} ry={19.5} fill={p.mid} f={f} />
      <VE cx={50} cy={59} rx={9.4} ry={7.4} fill={p.light} f={f} gloss={false} />
      <VE cx={50} cy={56} rx={3.8} ry={2.8} fill="#14081E" f={f} />
      <Path d="M50 58.8 L50 60.8 M46.4 61.6 Q50 64.8 53.6 61.6" stroke="#14081E" strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Circle cx={39} cy={58} r={2.4} fill={p.deep} opacity={0.2} />
      <Circle cx={61} cy={58} r={2.4} fill={p.deep} opacity={0.2} />
    </G>
  ),
  eyes: {
    box: [37, 43, 26, 11],
    el: (
      <G>
        <VEye x={43} y={48.5} r={2.6} f={f} />
        <VEye x={57} y={48.5} r={2.6} f={f} />
      </G>
    ),
  },
  front: (
    <G>
      {Array.from({ length: 11 }, (_, i) => {
        const t = i / 10;
        const x = 34 + t * 32;
        const y = 66 + Math.sin(t * Math.PI) * 12;
        return <VE key={i} cx={x} cy={y} rx={1.9} ry={1.5} fill={p.alt} f={f} gloss={false} turn={(t - 0.5) * -60} />;
      })}
      <VE cx={50} cy={79.5} rx={5} ry={5} fill={p.alt} f={f} />
      <Path d={star(50, 79.5, 2.8)} fill={p.altDeep} />
    </G>
  ),
});

const wisp: Draw = (p, f) => ({
  ground: null,
  flicker: (
    <G>
      <Path d={flame(50, 54, 37, 88, 9, 8)} fill={p.mid} opacity={0.45} />
      <Path d={flame(50, 58, 44, 84, 4.5, 4)} fill={p.light} opacity={0.4} />
    </G>
  ),
  body: (
    <G>
      <VE cx={39} cy={31} rx={6} ry={3} fill={p.light} f={f} turn={-50} opacity={0.75} />
      <VE cx={61} cy={31} rx={6} ry={3} fill={p.light} f={f} turn={50} opacity={0.75} />
      <VE cx={50} cy={48} rx={16.5} ry={16.5} fill={p.mid} f={f} />
      <Path d="M47.5 53 Q50 55 52.5 53" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <Circle cx={41.6} cy={51.4} r={2} fill={p.altDeep} opacity={0.5} />
      <Circle cx={58.4} cy={51.4} r={2} fill={p.altDeep} opacity={0.5} />
    </G>
  ),
  eyes: {
    box: [39, 41, 22, 12],
    el: (
      <G>
        <VEye x={45} y={47.5} r={2.6} f={f} />
        <VEye x={55} y={47.5} r={2.6} f={f} />
      </G>
    ),
  },
  front: sparkles(p.alt, [
    [24, 28, 2.6],
    [76, 26, 2],
    [78, 64, 2.2],
  ]),
});

const ferris: Draw = (p, f) => {
  const ring = (r: number, w: number) => `M${50 - r} 45 A${r} ${r} 0 1 0 ${50 + r} 45 A${r} ${r} 0 1 0 ${50 - r} 45Z M${50 - r + w} 45 A${r - w} ${r - w} 0 1 1 ${50 + r - w} 45 A${r - w} ${r - w} 0 1 1 ${50 - r + w} 45Z`;
  return {
    ground: [50, 89, 24],
    back: (
      <G>
        <V d="M48 46 L31 87 L36.5 87 L51 50Z" fill={p.altDeep} f={f} />
        <V d="M52 46 L69 87 L63.5 87 L49 50Z" fill={p.altDeep} f={f} />
        <V d="M24 85.5 Q24 84 26 84 L74 84 Q76 84 76 85.5 L76 88 Q76 89.5 74 89.5 L26 89.5 Q24 89.5 24 88Z" fill={p.altDeep} f={f} />
      </G>
    ),
    sway: (
      <G>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * 45 * Math.PI) / 180;
          return <Line key={i} x1={50} y1={45} x2={50 + Math.cos(a) * 27} y2={45 + Math.sin(a) * 27} stroke={p.light} strokeWidth={1.1} opacity={0.75} />;
        })}
        <V d={ring(29, 3.6)} fill={p.mid} f={f} />
        <Path d={ring(23.5, 0.9)} fill={p.light} opacity={0.5} />
        {Array.from({ length: 16 }, (_, i) => {
          const a = ((i * 22.5 + 11.25) * Math.PI) / 180;
          return <Circle key={i} cx={50 + Math.cos(a) * 27.2} cy={45 + Math.sin(a) * 27.2} r={0.95} fill={p.accent} />;
        })}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * 45 * Math.PI) / 180;
          const x = 50 + Math.cos(a) * 29;
          const y = 45 + Math.sin(a) * 29;
          const c = i % 2 ? p.alt : p.accent;
          return (
            <G key={i}>
              <Line x1={x} y1={y} x2={x} y2={y + 2.6} stroke={p.light} strokeWidth={0.9} />
              <V d={`M${x - 4} ${y + 3.4} Q${x - 4} ${y + 2.2} ${x - 2.6} ${y + 2.2} L${x + 2.6} ${y + 2.2} Q${x + 4} ${y + 2.2} ${x + 4} ${y + 3.4} L${x + 3.4} ${y + 8} Q${x + 3.2} ${y + 9.2} ${x + 2} ${y + 9.2} L${x - 2} ${y + 9.2} Q${x - 3.2} ${y + 9.2} ${x - 3.4} ${y + 8}Z`} fill={c} f={f} gloss={[x - 2, y + 3.6, 1.4, 0.6, 0]} />
              <Rect x={x - 2.6} y={y + 4.3} width={5.2} height={2} rx={0.8} fill="#FFFFFF" opacity={0.6} />
            </G>
          );
        })}
      </G>
    ),
    pivot: [50, 45],
    flicker: sparkles(p.accent, [
      [15, 18, 2.6],
      [86, 24, 2],
      [85, 70, 2.2],
    ]),
    flickerOver: true,
    body: (
      <G>
        <Shadow cx={51} cy={47} rx={11} ry={11} f={f} opacity={0.6} />
        <VE cx={50} cy={45} rx={10.5} ry={10.5} fill={p.mid} f={f} />
        <Circle cx={43.6} cy={48.6} r={1.6} fill={p.alt} opacity={0.5} />
        <Circle cx={56.4} cy={48.6} r={1.6} fill={p.alt} opacity={0.5} />
        <Path d="M47.4 49 Q50 51.6 52.6 49" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      </G>
    ),
    eyes: {
      box: [42, 39, 16, 9],
      el: (
        <G>
          <VEye x={46.5} y={44} r={2.1} f={f} />
          <VEye x={53.5} y={44} r={2.1} f={f} />
        </G>
      ),
    },
  };
};

const rail: Draw = (p, f) => ({
  ground: [50, 88, 30],
  body: (
    <G>
      <Tube path={[39, 52, 31, 42, 28.5, 30]} from={6.4} to={5.4} fill={p.mid} edge={p.deep} light={p.light} steps={8} />
      <Tube path={[61, 52, 69, 42, 71.5, 30]} from={6.4} to={5.4} fill={p.mid} edge={p.deep} light={p.light} steps={8} />
      <VE cx={28.5} cy={29.5} rx={3.8} ry={3.8} fill={p.mid} f={f} />
      <VE cx={71.5} cy={29.5} rx={3.8} ry={3.8} fill={p.mid} f={f} />
      <VE cx={50} cy={56} rx={17.5} ry={16.5} fill={p.mid} f={f} />
      <V d="M45.4 56 Q50 62 54.6 56Z" fill="#14081E" f={f} />
      <Path d="M47 58.6 Q50 60.6 53 58.6" stroke={p.accent} strokeWidth={1} opacity={0.7} fill="none" />
      <Circle cx={40.6} cy={56} r={2.4} fill={p.accent} opacity={0.35} />
      <Circle cx={59.4} cy={56} r={2.4} fill={p.accent} opacity={0.35} />
    </G>
  ),
  eyes: {
    box: [39, 45, 22, 10],
    el: (
      <G>
        <VEye x={45} y={50} r={2.8} f={f} />
        <VEye x={55} y={50} r={2.8} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      <Path d="M27 30 L20.5 15 M73 30 L79.5 15" stroke={p.accent} strokeWidth={8} strokeLinecap="round" opacity={0.22} />
      <Path d="M27 30 L20.5 15 M73 30 L79.5 15" stroke={p.accent} strokeWidth={3.6} strokeLinecap="round" />
      <Path d="M26.3 27.6 L22 17.6 M73.7 27.6 L78 17.6" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" opacity={0.85} />
    </G>
  ),
  flickerOver: true,
  front: (
    <G>
      <V d="M21.5 68 L26.5 68 L26.5 87 L21.5 87Z" fill={p.altDeep} f={f} />
      <V d="M73.5 68 L78.5 68 L78.5 87 L73.5 87Z" fill={p.altDeep} f={f} />
      <V d="M26.5 75 L73.5 75 L73.5 77.4 L26.5 77.4Z" fill={p.altDeep} f={f} />
      <V d="M17.5 62.5 L82.5 62.5 Q86.5 62.5 86.5 66.5 Q86.5 70.5 82.5 70.5 L17.5 70.5 Q13.5 70.5 13.5 66.5 Q13.5 62.5 17.5 62.5Z" fill={p.alt} f={f} gloss={[30, 64.4, 12, 0.9, 0]} />
    </G>
  ),
});

const sunrise: Draw = (p, f) => ({
  ground: null,
  flicker: (
    <G>
      <Circle cx={50} cy={62} r={30} fill={p.alt} opacity={0.14} />
      {Array.from({ length: 9 }, (_, i) => {
        const a = ((-170 + i * 20) * Math.PI) / 180;
        return <V key={i} d={flame(50 + Math.cos(a) * 23, 62 + Math.sin(a) * 23, 50 + Math.cos(a) * 38, 62 + Math.sin(a) * 38, 4, i % 2 ? 1.5 : -1.5)} fill={p.alt} f={f} />;
      })}
    </G>
  ),
  body: (
    <G>
      <VE cx={50} cy={62} rx={20.5} ry={20.5} fill={p.mid} f={f} />
      <Path d="M46 62.6 Q50 66 54 62.6" stroke={INK} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Circle cx={41.4} cy={61.4} r={2.5} fill={p.accent} opacity={0.5} />
      <Circle cx={58.6} cy={61.4} r={2.5} fill={p.accent} opacity={0.5} />
    </G>
  ),
  eyes: {
    box: [40, 51, 20, 10],
    el: (
      <G>
        <VEye x={44.6} y={56} r={2.4} f={f} />
        <VEye x={55.4} y={56} r={2.4} f={f} />
      </G>
    ),
  },
  front: (
    <G>
      <Path d="M9.6 72 Q22 64 40 72 Q58 80 76 70 Q85 66 91.4 70 A46 46 0 0 1 9.6 72Z" fill={p.altDeep} opacity={0.85} />
      <Path d="M9.6 72 Q22 64 40 72 Q58 80 76 70 Q85 66 91.4 70 A46 46 0 0 1 9.6 72Z" fill={f.rim} />
      <Path d="M17 82 Q34 74 56 82 Q72 87 84.9 80 A46 46 0 0 1 17 82Z" fill={p.altDeep} />
      <Path d="M17 82 Q34 74 56 82 Q72 87 84.9 80 A46 46 0 0 1 17 82Z" fill={f.shade} />
      <Path d="M12 72.6 Q22 65.6 40 73" stroke={p.alt} strokeWidth={0.8} opacity={0.5} fill="none" />
    </G>
  ),
});

const lantern: Draw = (p, f) => ({
  ground: [50, 80, 15],
  back: (
    <G>
      <Path d="M40 31 Q50 14.5 60 31" stroke={p.alt} strokeWidth={2.2} fill="none" />
      <Circle cx={50} cy={19.5} r={2.2} fill="none" stroke={p.alt} strokeWidth={1.6} />
    </G>
  ),
  flicker: (
    <G>
      <Circle cx={50} cy={58} r={22} fill={p.accent} opacity={0.16} />
      <Circle cx={50} cy={60} r={13} fill={p.accent} opacity={0.35} />
      <Path d={flame(50, 68, 50, 51.5, 6)} fill={p.accent} />
      <Path d={flame(50, 68, 50, 58, 2.8)} fill="#FFFFFF" />
    </G>
  ),
  body: (
    <G>
      <V d="M35.5 35 L64.5 35 L60.5 29 L39.5 29Z" fill={p.alt} f={f} />
      <Path d="M36 35 Q36 34 37 34 L63 34 Q64 34 64 35 L64 62 Q64 71 55 71 L45 71 Q36 71 36 62Z" fill={p.mid} opacity={0.35} />
      <Path d="M36 35 Q36 34 37 34 L63 34 Q64 34 64 35 L64 62 Q64 71 55 71 L45 71 Q36 71 36 62Z" fill={f.hi} />
      <Path d="M36 35 Q36 34 37 34 L63 34 Q64 34 64 35 L64 62 Q64 71 55 71 L45 71 Q36 71 36 62Z" fill="none" stroke={p.alt} strokeWidth={1.8} />
      <Path d="M40.5 41 Q41.5 37.5 45 37" stroke="#FFFFFF" strokeWidth={1.6} opacity={0.75} fill="none" strokeLinecap="round" />
      <Path d="M61 40 L61 60" stroke="#FFFFFF" strokeWidth={0.9} opacity={0.35} strokeLinecap="round" />
      <V d="M38 71 L62 71 L59.5 77.5 L40.5 77.5Z" fill={p.alt} f={f} />
      <Path d="M46.8 50.8 Q50 53.2 53.2 50.8" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 41, 20, 10],
    el: (
      <G>
        <VEye x={44.6} y={46} r={2.3} f={f} />
        <VEye x={55.4} y={46} r={2.3} f={f} />
      </G>
    ),
  },
  front: (
    <G>
      <Glow x={23} y={60} r={1.4} color={p.accent} />
      <Glow x={77} y={47} r={1.2} color={p.accent} />
      <Glow x={72} y={79} r={1.3} color={p.accent} />
    </G>
  ),
});

// Underground Alchemy's potion: a round flask with a cork, glowing liquid bubbling inside, and their mark (three circles in a triangle) on the glass.
const flask: Draw = (p, f) => {
  const bulb = 'M44.5 31 L55.5 31 L55.5 41.6 A20 20 0 1 1 44.5 41.6 Z';
  const liquid = 'M30.4 56 Q40 53 50 55.6 T69.6 56 A20 20 0 1 1 30.4 56 Z';
  const mark: [number, number][] = [
    [50, 66.4],
    [46.2, 72.4],
    [53.8, 72.4],
  ];
  return {
    ground: [50, 81.5, 16],
    back: (
      <G>
        {[
          [53, 22, 1.6],
          [47, 16, 1.2],
          [55, 11, 0.9],
        ].map(([x, y, r], i) => (
          <Circle key={i} cx={x} cy={y} r={r} fill={p.accent} opacity={0.55 - i * 0.12} />
        ))}
      </G>
    ),
    flicker: (
      <G>
        <Circle cx={50} cy={62} r={25} fill={p.glow} opacity={0.14} />
        <Circle cx={50} cy={64} r={15} fill={p.accent} opacity={0.16} />
      </G>
    ),
    body: (
      <G>
        {/* The glass, faintly tinted, and the potion inside. */}
        <Path d={bulb} fill={p.light} opacity={0.22} />
        <V d={liquid} fill={p.mid} f={f} gloss={[40, 62, 4.5, 2.2]} />
        <Path d="M30.6 56 Q40 53 50 55.6 T69.4 56" stroke={p.light} strokeWidth={1.1} fill="none" opacity={0.8} strokeLinecap="round" />
        {[
          [38, 70, 1.3],
          [61, 66, 1.1],
          [57, 75, 0.8],
          [42, 62.5, 0.7],
        ].map(([x, y, r], i) => (
          <Circle key={i} cx={x} cy={y} r={r} fill={p.light} opacity={0.75} />
        ))}
        {/* The mark, glowing on the potion. */}
        <Path d={`M${mark[0][0]} ${mark[0][1]} L${mark[1][0]} ${mark[1][1]} L${mark[2][0]} ${mark[2][1]} Z`} stroke={p.accent} strokeWidth={0.9} fill="none" strokeLinejoin="round" />
        {mark.map(([x, y], i) => (
          <Circle key={`m${i}`} cx={x} cy={y} r={1.5} fill={p.deep} stroke={p.accent} strokeWidth={0.8} />
        ))}
        {/* Glass edge, shine and the rim at the neck. */}
        <Path d={bulb} fill={f.hi} />
        <Path d={bulb} fill="none" stroke={p.light} strokeWidth={1.6} opacity={0.9} />
        <Path d="M34.5 51 Q36 45 41.5 42.5" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.75} fill="none" strokeLinecap="round" />
        <Path d="M53.6 33 L53.6 40" stroke="#FFFFFF" strokeWidth={1} opacity={0.5} strokeLinecap="round" />
        <V d="M42.4 29 Q42.4 27.4 44 27.4 L56 27.4 Q57.6 27.4 57.6 29 L57.6 30.6 Q57.6 32.2 56 32.2 L44 32.2 Q42.4 32.2 42.4 30.6 Z" fill={p.light} f={f} />
        {/* The cork. */}
        <V d="M45 18.5 Q45 17 46.5 17 L53.5 17 Q55 17 55 18.5 L54.4 28 L45.6 28 Z" fill={p.alt} f={f} gloss={[47.5, 20.5, 1.4, 2.6, -10]} />
        <Path d="M46 22 L54 22 M45.8 25 L54.2 25" stroke={p.altDeep} strokeWidth={0.6} opacity={0.6} />
        <Path d="M47.2 62.6 Q50 64.8 52.8 62.6" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      </G>
    ),
    eyes: {
      box: [41, 54.5, 18, 8],
      el: (
        <G>
          <VEye x={45} y={58.4} r={2.5} f={f} />
          <VEye x={55} y={58.4} r={2.5} f={f} />
        </G>
      ),
    },
    front: (
      <G>
        <Glow x={24} y={44} r={1.3} color={p.accent} />
        <Glow x={77} y={38} r={1.1} color={p.accent} />
        <Glow x={75} y={78} r={1.2} color={p.glow} />
      </G>
    ),
  };
};

const confetti: Draw = (p, f) => {
  const bits: [number, number, number, string][] = [
    [30, 32, 20, p.alt],
    [40, 22, -30, p.accent],
    [50, 14, 10, p.altDeep],
    [60, 22, 40, p.light],
    [70, 31, -15, p.alt],
    [35, 41, 60, p.accent],
    [65, 40, -50, p.altDeep],
    [45, 30, 30, p.light],
    [56, 33, -20, p.alt],
    [24, 21, 15, p.altDeep],
    [77, 19, -35, p.accent],
  ];
  return {
    ground: [50, 89, 10],
    body: (
      <G>
        <V d="M33.5 46 L66.5 46 L52.6 86.4 Q50 90 47.4 86.4Z" fill={p.mid} f={f} gloss={[41, 52, 3, 7, -20]} />
        <Path d="M43.6 69.4 L58.8 67.6 M46.6 78.6 L55.4 77.6" stroke={p.alt} strokeWidth={3} strokeLinecap="round" />
        <VE cx={50} cy={46} rx={16.5} ry={4.4} fill={p.light} f={f} gloss={false} />
        <Ellipse cx={50} cy={46.2} rx={12.6} ry={2.6} fill={p.deep} />
        <Path d="M47 61 Q50 63.6 53 61" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
        <Circle cx={42.6} cy={59.6} r={1.8} fill={p.alt} opacity={0.6} />
        <Circle cx={57.4} cy={59.6} r={1.8} fill={p.alt} opacity={0.6} />
      </G>
    ),
    eyes: {
      box: [41, 52, 18, 9],
      el: (
        <G>
          <VEye x={45.5} y={56} r={2.3} f={f} />
          <VEye x={54.5} y={56} r={2.3} f={f} />
        </G>
      ),
    },
    flicker: (
      <G>
        <Tube path={[45, 44, 38, 34, 42, 23]} from={1.4} to={1} fill={p.accent} edge={p.altDeep} steps={8} />
        <Tube path={[55, 44, 62, 33, 58, 21]} from={1.4} to={1} fill={p.alt} edge={p.altDeep} steps={8} />
        {bits.map(([x, y, rot, c], i) => (
          <G key={i} transform={`rotate(${rot} ${x} ${y})`}>
            <Rect x={x - 2.2} y={y - 1.3} width={4.4} height={2.6} rx={0.7} fill={c} />
            <Rect x={x - 2.2} y={y - 1.3} width={4.4} height={1.1} rx={0.5} fill="#FFFFFF" opacity={0.45} />
          </G>
        ))}
      </G>
    ),
    flickerOver: true,
  };
};

const frog: Draw = (p, f) => ({
  ground: [50, 83, 25],
  body: (
    <G>
      <VE cx={36} cy={80} rx={6.6} ry={3.2} fill={p.mid} f={f} gloss={false} />
      <VE cx={64} cy={80} rx={6.6} ry={3.2} fill={p.mid} f={f} gloss={false} />
      <VE cx={50} cy={64} rx={22.5} ry={17.5} fill={p.mid} f={f} />
      <VE cx={50} cy={71} rx={13.5} ry={9.4} fill={p.light} f={f} gloss={false} opacity={0.8} />
      <VE cx={37.5} cy={46} rx={8.6} ry={8.4} fill={p.mid} f={f} />
      <VE cx={62.5} cy={46} rx={8.6} ry={8.4} fill={p.mid} f={f} />
      <Path d="M38 61 Q50 69.5 62 61" stroke="#14081E" strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Circle cx={33.5} cy={60} r={2.4} fill={p.deep} opacity={0.25} />
      <Circle cx={66.5} cy={60} r={2.4} fill={p.deep} opacity={0.25} />
      {[
        [40, 72],
        [58, 74],
        [62, 68],
      ].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={1.1} fill={p.deep} opacity={0.25} />
      ))}
    </G>
  ),
  eyes: {
    box: [28, 38, 44, 16],
    el: (
      <G>
        <VE cx={37.5} cy={46} rx={5.8} ry={5.8} fill="#FFFFFF" f={f} gloss={false} />
        <VE cx={62.5} cy={46} rx={5.8} ry={5.8} fill="#FFFFFF" f={f} gloss={false} />
        <VEye x={38.2} y={46.6} r={3.5} f={f} />
        <VEye x={61.8} y={46.6} r={3.5} f={f} />
      </G>
    ),
  },
  front: (
    <G>
      <V d="M67 57.5 C71.6 64 73.8 67.6 73.8 71 A6.8 6.8 0 0 1 60.2 71 C60.2 67.6 62.4 64 67 57.5Z" fill={p.alt} f={f} />
      <Ellipse cx={64.4} cy={68} rx={1.5} ry={2.6} fill="#FFFFFF" opacity={0.85} />
      <VE cx={60.2} cy={74} rx={3.8} ry={2.8} fill={p.mid} f={f} gloss={false} />
      <VE cx={73.8} cy={74} rx={3.8} ry={2.8} fill={p.mid} f={f} gloss={false} />
    </G>
  ),
  flicker: (
    <G>
      <Glow x={80} y={52} r={1.3} color={p.alt} />
      <Glow x={21} y={40} r={1.1} color={p.alt} />
    </G>
  ),
  flickerOver: true,
});

/** Ganja White Night's: a round fellow in an orange jumpsuit, a purple bucket for a head with a glowing mask, white gloves and boots (inspired by their mascot, drawn our own way). */
const wobble: Draw = (p, f) => ({
  ground: [50, 93, 22],
  back: (
    <G>
      {/* Short legs and white boots. */}
      <VE cx={39.5} cy={82} rx={7} ry={9} fill={p.mid} f={f} turn={8} />
      <VE cx={60.5} cy={82} rx={7} ry={9} fill={p.mid} f={f} turn={-8} />
      <VE cx={37.5} cy={90.5} rx={7.5} ry={3.6} fill="#F1F0F6" f={f} turn={-6} />
      <VE cx={62.5} cy={90.5} rx={7.5} ry={3.6} fill="#F1F0F6" f={f} turn={6} />
    </G>
  ),
  sway: (
    <G>
      {/* Arms out, ready to wobble, in white gloves. */}
      <VE cx={24} cy={58} rx={6} ry={11.5} fill={p.mid} f={f} turn={32} />
      <VE cx={76} cy={58} rx={6} ry={11.5} fill={p.mid} f={f} turn={-32} />
      <VE cx={18.5} cy={68} rx={5.4} ry={4.8} fill="#F1F0F6" f={f} />
      <VE cx={81.5} cy={68} rx={5.4} ry={4.8} fill="#F1F0F6" f={f} />
    </G>
  ),
  pivot: [50, 52],
  body: (
    <G>
      <Shadow cx={50} cy={46} rx={13} ry={3.4} f={f} opacity={0.55} />
      {/* The jumpsuit: a big round belly, a crease across the chest, a zip down the middle. */}
      <VE cx={50} cy={62} rx={24.5} ry={22.5} fill={p.mid} f={f} />
      <VE cx={50} cy={68} rx={16} ry={13} fill={p.light} f={f} gloss={false} opacity={0.45} />
      <Path d="M30 51 Q50 44 70 51" stroke={p.deep} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.7} />
      <Path d="M50 46 L50 83" stroke={p.deep} strokeWidth={1.1} fill="none" strokeLinecap="round" opacity={0.6} />
      <Path d="M36 78 Q50 85 64 78" stroke={p.deep} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.45} />
      {/* The bucket head. */}
      <V d="M38.5 22 L61.5 22 L60 44 Q50 47 40 44 Z" fill={p.alt} f={f} gloss={[44, 27, 3.2, 7]} />
      <VE cx={50} cy={22} rx={11.5} ry={3.6} fill={p.altDeep} f={f} gloss={false} />
      <Path d="M39 22.6 Q50 26 61 22.6" stroke={p.alt} strokeWidth={1} fill="none" opacity={0.8} />
    </G>
  ),
  front: (
    <G>
      {/* The glowing mask: two swept wings meeting in the middle. */}
      <Path d="M41.5 29 Q46 27 50 33.5 Q54 27 58.5 29 L57 36.5 Q53.5 34 50 39.5 Q46.5 34 43 36.5 Z" fill={p.accent} opacity={0.35} transform="translate(50 33) scale(1.25) translate(-50 -33)" />
      <Path d="M41.5 29 Q46 27 50 33.5 Q54 27 58.5 29 L57 36.5 Q53.5 34 50 39.5 Q46.5 34 43 36.5 Z" fill={p.accent} />
      <Path d="M44.5 31.5 Q47 31 49 35 M55.5 31.5 Q53 31 51 35" stroke="#FFFFFF" strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0.85} />
      <Glow x={23} y={30} r={1.2} color={p.accent} />
      <Glow x={79} y={36} r={1} color={p.accent} />
    </G>
  ),
});

/** Stitches across a seam: a line with short ticks crossing it. */
function stitches(x1: number, y1: number, x2: number, y2: number, n: number, len: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * len;
  const ny = (dx / l) * len;
  let d = `M${r1(x1)} ${r1(y1)} L${r1(x2)} ${r1(y2)}`;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    d += ` M${r1(x - nx)} ${r1(y - ny)} L${r1(x + nx)} ${r1(y + ny)}`;
  }
  return d;
}

/** LEVEL UP's: a stitched-up teddy, patched paws and ears, one eye sewn shut with an X, one a button (inspired by her bear, drawn our own way). */
const patchbear: Draw = (p, f) => ({
  ground: [50, 93, 23],
  back: (
    <G>
      {/* Sitting: round feet with patched soles. */}
      <VE cx={33} cy={84} rx={10} ry={8} fill={p.mid} f={f} turn={-12} />
      <VE cx={67} cy={84} rx={10} ry={8} fill={p.mid} f={f} turn={12} />
      <VE cx={31.5} cy={85} rx={6.4} ry={5.6} fill={p.alt} f={f} gloss={false} turn={-12} />
      <VE cx={68.5} cy={85} rx={6.4} ry={5.6} fill={p.alt} f={f} gloss={false} turn={12} />
      <Path d={stitches(27, 81, 33, 90, 3, 1.3)} stroke={INK} strokeWidth={0.7} fill="none" opacity={0.75} />
      <Path d={stitches(73, 81, 67, 90, 3, 1.3)} stroke={INK} strokeWidth={0.7} fill="none" opacity={0.75} />
    </G>
  ),
  sway: (
    <G>
      {/* Arms, with purple patched paws. */}
      <VE cx={26.5} cy={62} rx={7} ry={10.5} fill={p.mid} f={f} turn={28} />
      <VE cx={73.5} cy={62} rx={7} ry={10.5} fill={p.mid} f={f} turn={-28} />
      <VE cx={23} cy={67} rx={4.6} ry={5} fill={p.alt} f={f} gloss={false} turn={28} />
      <VE cx={77} cy={67} rx={4.6} ry={5} fill={p.alt} f={f} gloss={false} turn={-28} />
    </G>
  ),
  pivot: [50, 58],
  body: (
    <G>
      {/* The tummy. */}
      <VE cx={50} cy={69} rx={18} ry={16} fill={p.mid} f={f} />
      <VE cx={50} cy={71} rx={11} ry={10} fill={p.light} f={f} gloss={false} opacity={0.45} />
      <Path d={stitches(50, 60, 50, 80, 5, 1.4)} stroke={INK} strokeWidth={0.7} fill="none" opacity={0.6} />
      {/* Ears with purple patches. */}
      <VE cx={31.5} cy={24} rx={8.5} ry={8.5} fill={p.mid} f={f} />
      <VE cx={68.5} cy={24} rx={8.5} ry={8.5} fill={p.mid} f={f} />
      <VE cx={31.5} cy={24.5} rx={4.8} ry={4.8} fill={p.alt} f={f} gloss={false} />
      <VE cx={68.5} cy={24.5} rx={4.8} ry={4.8} fill={p.alt} f={f} gloss={false} />
      <Shadow cx={50} cy={53} rx={14} ry={3.4} f={f} opacity={0.5} />
      {/* The head, stitched down the middle of the brow. */}
      <VE cx={50} cy={37} rx={20.5} ry={17.5} fill={p.mid} f={f} />
      <Path d={stitches(53, 20.5, 53, 34, 4, 1.8)} stroke={INK} strokeWidth={0.85} fill="none" />
      {/* Muzzle, nose and a little frown with fangs. */}
      <VE cx={50} cy={44} rx={8.4} ry={6.6} fill={p.light} f={f} gloss={false} opacity={0.7} />
      <Path d="M46.6 41 L53.4 41 L50 45.2 Z" fill={p.altDeep} stroke={INK} strokeWidth={0.5} strokeLinejoin="round" />
      <Path d="M50 45.2 L50 47 M47.6 49.2 Q50 46.6 52.4 49.2" stroke={INK} strokeWidth={0.8} fill="none" strokeLinecap="round" />
      {/* One eye sewn shut with an X. */}
      <Path d="M38.5 32.5 L44.5 38.5 M44.5 32.5 L38.5 38.5" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [54, 31, 10, 9],
    el: <VEye x={59} y={35.5} r={3.4} f={f} />,
  },
  front: (
    <G>
      <Path d={star(80, 30, 2.4)} fill={p.accent} opacity={0.9} />
      <Path d={star(19, 40, 1.8)} fill={p.accent} opacity={0.75} />
    </G>
  ),
});

/** SULLIVAN KING's: a grinning skull crowned with thorns and roses, its jaw dropped open, thorny vines curling behind and petals falling (inspired by their artwork, drawn our own way). */
const thornskull: Draw = (p, f) => {
  // A thorny vine along a curve (start, control, end), thorns alternating sides.
  const vine = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n: number, w = 2.4) => {
    const at = (t: number) => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1] as const;
    const thorns = Array.from({ length: n }, (_, i) => {
      const t = (i + 0.6) / (n + 0.4);
      const [x, y] = at(t);
      const [x2, y2] = at(Math.min(1, t + 0.02));
      const len = Math.hypot(x2 - x, y2 - y) || 1;
      const side = i % 2 ? 1 : -1;
      const nx = (-(y2 - y) / len) * side;
      const ny = ((x2 - x) / len) * side;
      const tx = (x2 - x) / len;
      const ty = (y2 - y) / len;
      return `M${r1(x - tx * 1.4)} ${r1(y - ty * 1.4)} L${r1(x + nx * 4.2 + tx * 1.4)} ${r1(y + ny * 4.2 + ty * 1.4)} L${r1(x + tx * 1.4)} ${r1(y + ty * 1.4)}Z`;
    }).join(' ');
    return (
      <G>
        <Path d={`M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`} stroke={p.altDeep} strokeWidth={w} fill="none" strokeLinecap="round" />
        <Path d={thorns} fill={p.altDeep} />
      </G>
    );
  };
  // A rose seen from above: a cup of petals curling in to a dark heart.
  const rose = (x: number, y: number, r: number) => (
    <G>
      <VE cx={x} cy={y} rx={r} ry={r * 0.9} fill={p.alt} f={f} gloss={false} />
      <Path d={`M${r1(x - r * 0.75)} ${r1(y + r * 0.1)} Q${x} ${r1(y - r * 0.95)} ${r1(x + r * 0.75)} ${r1(y + r * 0.1)} M${r1(x - r * 0.45)} ${r1(y + r * 0.45)} Q${r1(x + r * 0.15)} ${r1(y + r * 0.7)} ${r1(x + r * 0.55)} ${r1(y + r * 0.2)} M${r1(x - r * 0.3)} ${r1(y - r * 0.1)} Q${x} ${r1(y - r * 0.5)} ${r1(x + r * 0.3)} ${r1(y - r * 0.05)}`} stroke={p.altDeep} strokeWidth={0.7} fill="none" strokeLinecap="round" />
      <Circle cx={r1(x + r * 0.05)} cy={r1(y + r * 0.05)} r={r1(r * 0.22)} fill={p.altDeep} />
    </G>
  );
  const petal = (x: number, y: number, turn: number) => <Path d={`M${x} ${y} q2.2 -2.6 4.2 0 q-2 2.8 -4.2 0Z`} fill={p.alt} opacity={0.95} transform={`rotate(${turn} ${x} ${y})`} />;
  return {
    ground: [50, 90, 20],
    back: (
      <G>
        <Ellipse cx={50} cy={50} rx={36} ry={34} fill={p.glow} opacity={0.1} />
        {vine(14, 84, 10, 50, 30, 22, 7)}
        {vine(88, 78, 94, 46, 72, 18, 7)}
        {vine(20, 30, 40, 8, 64, 12, 6, 2)}
      </G>
    ),
    pivot: [50, 60],
    sway: (
      <G>
        {petal(16, 62, 20)}
        {petal(83, 34, -30)}
        {petal(80, 70, 50)}
        {petal(24, 22, -10)}
      </G>
    ),
    body: (
      <G>
        {/* The lower jaw, dropped open and tipped a little. */}
        <G transform="rotate(7 50 66)">
          <V d="M35 64 C35 76 41 84 50 84 C59 84 65 76 65 64 L61 65 C60.5 73 56 78 50 78 C44 78 39.5 73 39 65Z" fill={p.mid} f={f} gloss={[42, 76, 3, 1.4, 20]} />
          {[42.4, 46.2, 50, 53.8, 57.6].map((x) => (
            <V key={x} d={`M${x - 1.7} 77.6 L${x + 1.7} 77.6 L${x + 1.5} 72.6 Q${x} 71.4 ${x - 1.5} 72.6Z`} fill={p.light} f={f} />
          ))}
        </G>
        {/* The mouth, dark inside. */}
        <Path d="M38 63 Q50 61 62 63 L60 71 Q50 75 40 71Z" fill="#0E0816" />
        {/* The skull. */}
        <V d="M27 43 C27 25 38 16 50 16 C62 16 73 25 73 43 C73 51 69.5 56 66 58.5 L64 66 L36 66 L34 58.5 C30.5 56 27 51 27 43Z" fill={p.light} f={f} gloss={[38, 25, 7, 3.2, -35]} />
        <Ellipse cx={40.5} cy={47} rx={7.2} ry={7.8} fill="#0E0816" />
        <Ellipse cx={59.5} cy={47} rx={7.2} ry={7.8} fill="#0E0816" />
        <Path d="M47.6 58.6 L50 53.6 L52.4 58.6 Q50 60.4 47.6 58.6Z" fill="#0E0816" />
        <Path d="M31 52 Q34 57 37 57.5 M69 52 Q66 57 63 57.5" stroke={p.deep} strokeWidth={0.9} fill="none" opacity={0.6} strokeLinecap="round" />
        <Shadow cx={50} cy={62.4} rx={13} ry={2} f={f} opacity={0.45} />
        {[40.6, 44.4, 48.2, 51.8, 55.6, 59.4].map((x) => (
          <V key={x} d={`M${x - 1.7} 61.4 L${x + 1.7} 61.4 L${x + 1.5} 66.6 Q${x} 67.8 ${x - 1.5} 66.6Z`} fill={p.light} f={f} />
        ))}
        {/* A crack down the brow. */}
        <Path d="M60 18.5 L57.6 24.5 L60.4 27.5 L58.6 31" stroke={p.deep} strokeWidth={0.9} fill="none" strokeLinecap="round" />
        {/* The crown: a twist of thorny vine round the brow, set with roses. */}
        <Shadow cx={50} cy={37.5} rx={23} ry={2.4} f={f} opacity={0.4} />
        {vine(25, 37, 50, 28, 75, 37, 9, 2.2)}
        <Path d="M26 34.5 Q50 31.5 74 34.5" stroke={p.altDeep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        {rose(32.5, 34, 5.4)}
        {rose(50, 30.4, 6.4)}
        {rose(67.5, 34, 5.4)}
      </G>
    ),
    flicker: (
      <G>
        <Glow x={40.5} y={48} r={2.2} color={p.accent} />
        <Glow x={59.5} y={48} r={2.2} color={p.accent} />
      </G>
    ),
    flickerOver: true,
  };
};

/** SLANDER's: an armoured space trooper, its helmet's visor glowing orange, bursting out of hyperspace (inspired by their artwork, drawn our own way). */
const trooper: Draw = (p, f) => {
  // Light streaks rushing out from behind, all round.
  const rays = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2 + (i % 2 ? 0.08 : 0);
    const ri = 30 + (i % 3) * 4;
    const ro = 47 + (i % 4) * 1.5;
    return `M${r1(50 + Math.cos(a) * ri)} ${r1(46 + Math.sin(a) * ri)} L${r1(50 + Math.cos(a) * ro)} ${r1(46 + Math.sin(a) * ro)}`;
  }).join(' ');
  return {
    ground: [50, 93, 21],
    back: (
      <G>
        <Path d={rays} stroke={p.light} strokeWidth={1.4} strokeLinecap="round" opacity={0.55} />
        <Circle cx={50} cy={46} r={30} fill={p.light} opacity={0.08} />
      </G>
    ),
    body: (
      <G>
        {/* Shoulders with gold pads, and the chest plate. */}
        <VE cx={25.5} cy={73} rx={10} ry={9} fill={p.alt} f={f} turn={-20} />
        <VE cx={74.5} cy={73} rx={10} ry={9} fill={p.alt} f={f} turn={20} />
        <V d="M31 66 Q50 60 69 66 L72 92 Q50 96 28 92 Z" fill={p.deep} f={f} gloss={[38, 70, 4, 8]} />
        <V d="M40 74 L60 74 L58 84 L42 84 Z" fill={p.mid} f={f} />
        <Path d="M43 77.5 L57 77.5 M44 81 L56 81" stroke={p.light} strokeWidth={0.9} strokeLinecap="round" opacity={0.6} />
        <Circle cx={50} cy={88} r={1.6} fill={p.accent} />
        <Shadow cx={50} cy={64} rx={13} ry={3} f={f} opacity={0.6} />
        {/* The helmet: rounded, ridged on top, cheek guards. */}
        <VE cx={50} cy={43} rx={19.5} ry={21} fill={p.mid} f={f} />
        <V d="M46 22.5 L54 22.5 L53 33 L47 33 Z" fill={p.light} f={f} opacity={0.85} />
        <VE cx={33} cy={50} rx={5} ry={9} fill={p.deep} f={f} gloss={false} turn={8} />
        <VE cx={67} cy={50} rx={5} ry={9} fill={p.deep} f={f} gloss={false} turn={-8} />
        {/* The dark faceplate around the visor. */}
        <V d="M35 40 Q50 34 65 40 L62 56 Q50 63 38 56 Z" fill={INK} f={f} />
        <Circle cx={50} cy={36.5} r={2.6} fill={p.deep} stroke={p.light} strokeWidth={0.8} />
      </G>
    ),
    front: (
      <G>
        {/* The glowing visor: one wide band swept down to a point in the middle, with a sheen across it. */}
        <Path d="M36.5 43.5 Q50 39.5 63.5 43.5 L61 49.5 Q55 49 50 53.5 Q45 49 39 49.5 Z" fill={p.accent} opacity={0.3} transform="translate(50 47) scale(1.16) translate(-50 -47)" />
        <Path d="M36.5 43.5 Q50 39.5 63.5 43.5 L61 49.5 Q55 49 50 53.5 Q45 49 39 49.5 Z" fill={p.accent} />
        <Path d="M39 45.2 Q50 42.2 61 45.2" stroke="#FFF2C8" strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0.8} />
      </G>
    ),
  };
};

export const DRAW: Record<Creature, Draw> = {
  eye,
  phoenix,
  lion,
  ghost,
  pumpkin,
  sheep,
  twin,
  astronaut,
  rabbit,
  spirit,
  crystal,
  skull,
  serpent,
  alien,
  monster,
  sloth,
  reaper,
  jelly,
  beast,
  bot,
  wolf,
  moth,
  cat,
  owl,
  fox,
  dragon,
  bear,
  wisp,
  ferris,
  rail,
  sunrise,
  lantern,
  confetti,
  frog,
  flask,
  wobble,
  patchbear,
  thornskull,
  trooper,
};
