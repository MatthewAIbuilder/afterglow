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
  /** Turns round and round about `spinAt` (a portal, a record): over the body, under the eyes and `front`. */
  spin?: ReactNode;
  spinAt?: [number, number];
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

/** A four-point sparkle at (x, y), `r` from the middle to a point. */
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;

// Underground Alchemy's potion: a round flask with a cork, glowing liquid bubbling inside, and sparkles in it, like their logo.
const flask: Draw = (p, f) => {
  const bulb = 'M44.5 31 L55.5 31 L55.5 41.6 A20 20 0 1 1 44.5 41.6 Z';
  const liquid = 'M30.4 56 Q40 53 50 55.6 T69.6 56 A20 20 0 1 1 30.4 56 Z';
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
        {/* Sparkles in the potion, as in their logo. */}
        <Path d={`${sparkle(50, 68, 4)} ${sparkle(44.5, 73.5, 2.6)} ${sparkle(56, 73, 2.2)}`} fill={p.accent} />
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

/** WOOLI's: a real woolly mammoth, side on and shaggy, with great curling tusks and a curled trunk, in falling snow. */
const mammoth: Draw = (p, f) => {
  // Shaggy fringe hanging off its belly and chest.
  const fringe = Array.from({ length: 11 }, (_, i) => {
    const x = 34 + i * 4.6;
    return flame(x, 71, x - 1.2 + (i % 2) * 0.6, 78.5 + (i % 3) * 1.4, 2.4, i % 2 ? 1 : -1);
  }).join(' ');
  return {
    ground: [58, 90, 30],
    back: (
      <G>
        <Ellipse cx={52} cy={52} rx={40} ry={34} fill={p.glow} opacity={0.14} />
        {(
          [
            [14, 18, 1.1],
            [26, 9, 0.8],
            [74, 12, 1],
            [90, 26, 0.8],
            [84, 44, 1.1],
            [12, 40, 0.8],
            [62, 6, 0.7],
          ] as const
        ).map(([x, y, r], i) => (
          <Circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.85} />
        ))}
      </G>
    ),
    // A little tufted tail, flicking.
    pivot: [86, 58],
    sway: (
      <G>
        <Path d="M85 56 Q92 60 91 68" stroke={p.deep} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        <V d={flame(91, 66, 91.5, 73, 2.2, 0.6)} fill={p.deep} f={f} />
      </G>
    ),
    body: (
      <G>
        {/* The far legs, in shadow. */}
        <V d="M45 66 L54 66 L54 85 Q49.5 87 45 85Z" fill={p.deep} f={f} />
        <V d="M74 66 L83 66 L83 84 Q78.5 86 74 84Z" fill={p.deep} f={f} />
        {/* Its body: a high domed head, the back sloping away to the rump. */}
        <V d="M30 44 C29 26 39 16 50 17 C57 17.5 61 22 64.5 26 C78 28 88 42 87.5 60 C87 69 83 73 77 73.5 L40 73.5 C34 73.5 30 68 30 60Z" fill={p.mid} f={f} gloss={[44, 26, 7, 3, -30]} />
        <Path d={fringe} fill={p.deep} />
        {/* Shaggy strands through the coat. */}
        <Path d="M56 30 q2 5 0 10 M64 34 q2.4 6 0 12 M72 38 q2.4 6 0 13 M80 44 q2 6 0 12 M60 48 q2 5 0 10 M70 52 q2 5 0 10 M48 50 q2 5 0 10" stroke={p.deep} strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0.55} />
        {/* A tuft of hair on top of its head. */}
        {(
          [
            [44, 21, 47, 11.5],
            [47.5, 19.5, 52, 11],
            [51, 19.5, 56.5, 13.5],
          ] as const
        ).map(([bx, by, tx, ty], i) => (
          <V key={i} d={flame(bx, by, tx, ty, 1.9, 2.4)} fill={p.deep} f={f} />
        ))}
        {/* Its ear. */}
        <VE cx={51} cy={40} rx={4.6} ry={6} fill={p.deep} f={f} gloss={false} turn={-10} />
        {/* The near legs. */}
        <V d="M35 64 L45 64 L45 86 Q40 88.4 35 86Z" fill={p.mid} f={f} />
        <V d="M66 64 L76 64 L76 85 Q71 87.4 66 85Z" fill={p.mid} f={f} />
        {/* The far tusk, then the trunk curling down, then the near tusk. */}
        <V d="M40.5 57.5 C35 71 23 72.5 19.5 61 C23.5 68 32 67.5 39.5 62Z" fill={p.altDeep} f={f} />
        <Path d="M32.5 50 C27 56 25 66 26.5 76 C27.2 81 31.5 82 32.5 78" stroke={p.deep} strokeWidth={8} fill="none" strokeLinecap="round" />
        <Path d="M32.5 50 C27 56 25 66 26.5 76 C27.2 81 31.5 82 32.5 78" stroke={p.mid} strokeWidth={6.2} fill="none" strokeLinecap="round" />
        <Path d="M27.4 60 l4 0.8 M26.6 64.6 l4 0.6 M26.4 69.2 l4 0.4 M26.6 73.6 l4 0.2" stroke={p.deep} strokeWidth={0.8} strokeLinecap="round" opacity={0.6} />
        <V d="M38 58.5 C31 77 14 77.5 11.5 56 C16 70.5 28.5 70.5 37 64Z" fill={p.alt} f={f} gloss={[22, 71, 3.4, 1, 10]} />
      </G>
    ),
    eyes: {
      box: [35, 35, 7, 7],
      el: <VEye x={38.6} y={38.6} r={2.3} f={f} />,
    },
  };
};

/** EXCISION's: a dinosaur from outer space, roaring with a glowing red eye, a flying saucer hovering over a ruined city behind it, fires at its feet (inspired by their artwork, drawn our own way). */
const dino: Draw = (p, f) => {
  // Teeth along a jaw, from (x0, y0) to (x1, y1), pointing down (1) or up (-1).
  const teeth = (x0: number, y0: number, x1: number, y1: number, n: number, dir: 1 | -1) =>
    Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      return `M${r1(x - 1.1)} ${r1(y)} L${r1(x)} ${r1(y + dir * 2.6)} L${r1(x + 1.1)} ${r1(y)}Z`;
    }).join(' ');
  const fire = (x: number, y: number, s: number) => (
    <G>
      <Path d={flame(x, y, x - s * 0.3, y - s * 2.2, s, -s * 0.4)} fill="#FF5A1F" opacity={0.9} />
      <Path d={flame(x + s * 0.7, y, x + s * 1.1, y - s * 1.6, s * 0.7, s * 0.4)} fill="#FF8A2E" opacity={0.9} />
      <Path d={flame(x, y, x - s * 0.15, y - s * 1.3, s * 0.45, -s * 0.2)} fill="#FFD36B" />
    </G>
  );
  return {
    ground: [58, 90, 28],
    back: (
      <G>
        <Ellipse cx={50} cy={50} rx={42} ry={36} fill={p.glow} opacity={0.16} />
        {/* A ruined city. */}
        <Path d="M8 80 L8 52 L14 52 L14 44 L19 44 L19 60 L24 60 L24 36 L30 32 L30 64 L36 64 L36 50 L42 50 L42 68 L60 68 L60 40 L66 40 L66 30 L70 26 L70 58 L76 58 L76 46 L82 42 L82 60 L88 60 L88 50 L93 50 L93 80Z" fill={p.altDeep} opacity={0.75} />
        {(
          [
            [11, 56],
            [21, 48],
            [27, 40],
            [27, 48],
            [63, 44],
            [68, 34],
            [79, 50],
            [90, 54],
          ] as const
        ).map(([x, y], i) => (
          <Rect key={i} x={x} y={y} width={1.4} height={1.4} fill={p.glow} opacity={0.8} />
        ))}
      </G>
    ),
    // The flying saucer, hovering and tilting.
    pivot: [72, 16],
    sway: (
      <G>
        <Path d="M66 22 L56 46 L84 46 L76 22Z" fill={p.glow} opacity={0.16} />
        <VE cx={72} cy={14.5} rx={5.4} ry={4.2} fill={p.alt} f={f} />
        <VE cx={72} cy={18.5} rx={14} ry={3.8} fill={p.alt} f={f} gloss={false} />
        <Ellipse cx={72} cy={20.2} rx={9} ry={1.6} fill={p.altDeep} />
        {[61, 66.5, 72, 77.5, 83].map((x) => (
          <Circle key={x} cx={x} cy={19} r={0.9} fill={p.accent} />
        ))}
      </G>
    ),
    flicker: (
      <G>
        {fire(13, 86, 5)}
        {fire(85, 84, 4.4)}
        {fire(35, 88, 3.2)}
      </G>
    ),
    body: (
      <G>
        {/* The far leg, in shadow. */}
        <V d="M66 66 L74 66 L73 83 L78 85 Q78 88 75 88 L66 88 Q64 86 67 84Z" fill={p.deep} f={f} />
        {/* Body and tail. */}
        <V d="M40 50 C44 42 58 39 68 43 C78 46 86 45 96 42 C89 51 81 56 73 60 C71 68 65 72 56 72 C46 72 40 64 40 56Z" fill={p.mid} f={f} gloss={[56, 47, 6, 2.4, -10]} />
        {/* Spines down its back. */}
        {(
          [
            [44, 39.5],
            [50, 41.5],
            [56, 40.5],
            [62, 41.5],
            [68, 43],
            [74, 44.5],
            [80, 45],
            [86, 44.2],
          ] as const
        ).map(([x, y], i) => (
          <V key={i} d={flame(x, y + 2, x + 1.2, y - 3.4 + (i > 5 ? 1.4 : 0), 1.8, 0.6)} fill={p.deep} f={f} />
        ))}
        {/* Scales. */}
        <Path d="M50 52 q2 1.4 4 0 M58 50 q2 1.4 4 0 M66 52 q2 1.4 4 0 M54 58 q2 1.4 4 0 M62 58 q2 1.4 4 0 M76 50 q2 1.4 4 0" stroke={p.deep} strokeWidth={0.8} fill="none" opacity={0.6} strokeLinecap="round" />
        {/* The near leg: a heavy thigh, a shin and a clawed foot. */}
        <VE cx={58} cy={63} rx={10} ry={9} fill={p.mid} f={f} />
        <V d="M53 68 L62 68 L60.5 84 L66 86 Q66.5 89 62 89 L51 89 Q49 87 52.5 85Z" fill={p.mid} f={f} />
        <Path d="M51 89 l-1.6 1.2 M55 89 l-1 1.6 M59 89 l-0.6 1.6" stroke={p.light} strokeWidth={0.9} strokeLinecap="round" />
        {/* A little arm. */}
        <Path d="M44 55 Q40 58 38.5 62" stroke={p.deep} strokeWidth={3.4} fill="none" strokeLinecap="round" />
        <Path d="M38.5 62 l-1.6 1 M38.5 62 l-0.4 1.8" stroke={p.light} strokeWidth={0.8} strokeLinecap="round" />
        {/* The mouth, open in a roar. */}
        <Path d="M38 42 L15.5 37.5 L18 46.5 L37 44Z" fill="#3A0A10" />
        <Path d={teeth(17, 37.9, 34, 41.2, 6, 1)} fill="#F6EEDC" />
        <Path d={teeth(19.5, 46.2, 35, 44.2, 5, -1)} fill="#F6EEDC" />
        {/* The lower jaw, dropped open. */}
        <V d="M41 48 L37 44 L18 46.5 C15.5 47 15.5 50 18 50.6 C26 52.6 34 52.6 43 52Z" fill={p.mid} f={f} />
        {/* The head. */}
        <V d="M49 47 C49 36 45 28 37 26.6 C29 25.4 21 28.4 15.5 31.6 C13.4 33 13.4 36.8 15.5 37.5 L38 42 L41 48Z" fill={p.mid} f={f} gloss={[30, 29.5, 5, 1.6, -12]} />
        <Path d="M27 31 Q32 28.4 38 30.6" stroke={p.deep} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Circle cx={17.6} cy={33} r={0.8} fill={p.deep} />
        <Path d="M41 34 q2 1.2 4 0 M42 39 q2 1.2 4 0" stroke={p.deep} strokeWidth={0.8} fill="none" opacity={0.6} strokeLinecap="round" />
      </G>
    ),
    // Its eye, glowing red.
    front: <Glow x={33.4} y={32.6} r={1.5} color={p.accent} />,
  };
};

/** SVDDEN DEATH's (and VOYD's): a bleached stag skull with great antlers, in a dark hooded robe, its eye sockets burning red. */
const stagskull: Draw = (p, f) => {
  const antler = (
    <G>
      <Path d="M41 27 C34 22 28 15 25 4 M34.5 22 L25.5 23.5 M30 16 L21 14 M27 10 L31.5 3.5" stroke={p.deep} strokeWidth={4.2} fill="none" strokeLinecap="round" />
      <Path d="M41 27 C34 22 28 15 25 4 M34.5 22 L25.5 23.5 M30 16 L21 14 M27 10 L31.5 3.5" stroke={p.mid} strokeWidth={2.8} fill="none" strokeLinecap="round" />
      <Path d="M40 25.6 C34 21 29 14.6 26.4 6" stroke={p.light} strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0.7} />
    </G>
  );
  return {
    ground: [50, 94, 24],
    back: <Ellipse cx={50} cy={50} rx={40} ry={38} fill={p.glow} opacity={0.12} />,
    body: (
      <G>
        {/* The robe and its hood. */}
        <V d="M22 94 C22 62 32 34 50 28 C68 34 78 62 78 94Z" fill={p.alt} f={f} />
        <Path d="M30 94 C31 66 38 46 50 40 C62 46 69 66 70 94Z" fill={p.altDeep} />
        {[34, 44, 56, 66].map((x, i) => (
          <Path key={x} d={`M${x} ${74 + (i % 2) * 3} q-1.3 4 0 6 q1.3 -2 0 -6Z`} fill={p.accent} opacity={0.85} />
        ))}
        {both(antler)}
        {/* The skull: a wide brow tapering to a long muzzle. */}
        <V d="M36.5 32 C36.5 24 43 21 50 21 C57 21 63.5 24 63.5 32 C63.5 44 58 58 53 70 Q50 73.5 47 70 C42 58 36.5 44 36.5 32Z" fill={p.light} f={f} gloss={[43, 27, 4.4, 2, -25]} />
        <Ellipse cx={43.4} cy={38} rx={3.8} ry={4.6} fill="#0E0816" transform="rotate(-12 43.4 38)" />
        <Ellipse cx={56.6} cy={38} rx={3.8} ry={4.6} fill="#0E0816" transform="rotate(12 56.6 38)" />
        <Path d="M50 44 L50 62 M46 50 Q50 52 54 50 M47 56 Q50 57.4 53 56" stroke={p.deep} strokeWidth={0.8} fill="none" opacity={0.6} strokeLinecap="round" />
        <Ellipse cx={48.4} cy={66.5} rx={1} ry={1.6} fill="#0E0816" />
        <Ellipse cx={51.6} cy={66.5} rx={1} ry={1.6} fill="#0E0816" />
      </G>
    ),
    flicker: (
      <G>
        <Glow x={43.4} y={38.6} r={1.7} color={p.accent} />
        <Glow x={56.6} y={38.6} r={1.7} color={p.accent} />
      </G>
    ),
    flickerOver: true,
  };
};

/** LIQUID STRANGER's: a big-eyed alien captain at the controls of its ship. */
const captain: Draw = (p, f) => ({
  ground: [50, 92, 30],
  back: (
    <G>
      <Ellipse cx={50} cy={46} rx={40} ry={34} fill={p.glow} opacity={0.12} />
      {sparkles(p.accent, [
        [14, 18, 1.6],
        [86, 14, 1.3],
        [90, 40, 1],
        [10, 44, 1.1],
      ])}
    </G>
  ),
  body: (
    <G>
      {/* Shoulders in a flight suit. */}
      <V d="M26 74 C28 62 38 58 50 58 C62 58 72 62 74 74Z" fill={p.alt} f={f} />
      {/* A thin neck and a great domed head. */}
      <V d="M46 52 L54 52 L53 62 L47 62Z" fill={p.mid} f={f} />
      <V d="M30 34 C30 18 40 10 50 10 C60 10 70 18 70 34 C70 46 60 56 50 58 C40 56 30 46 30 34Z" fill={p.mid} f={f} gloss={[40, 19, 6, 2.6, -28]} />
      {/* The eyes: huge, black, tilted. */}
      <V d="M33 34 C34 28 41 27 46 32 C47 37 43 41 39 40 C35 39.4 32.6 37 33 34Z" fill="#06040C" f={f} gloss={[38, 31, 2.4, 1, -20]} />
      <V d="M67 34 C66 28 59 27 54 32 C53 37 57 41 61 40 C65 39.4 67.4 37 67 34Z" fill="#06040C" f={f} gloss={[58, 31, 2.4, 1, 20]} />
      <Path d="M47 50 Q50 51.4 53 50" stroke={p.deep} strokeWidth={0.9} fill="none" strokeLinecap="round" />
    </G>
  ),
  front: (
    <G>
      {/* The dashboard. */}
      <V d="M14 70 L86 70 L92 90 L8 90Z" fill={p.altDeep} f={f} />
      <Path d="M14 70 L86 70 L88 75 L12 75Z" fill={p.alt} />
      <Rect x={40} y={78} width={20} height={8} rx={1.4} fill={p.accent} opacity={0.35} />
      <Path d="M42 84 L46 80 L49 83 L53 79 L58 82" stroke={p.accent} strokeWidth={0.9} fill="none" />
      {/* Hands on the controls. */}
      <VE cx={30} cy={71} rx={5} ry={3.2} fill={p.mid} f={f} />
      <VE cx={70} cy={71} rx={5} ry={3.2} fill={p.mid} f={f} />
    </G>
  ),
  flicker: (
    <G>
      {(
        [
          [18, 81, '#FF4A5E'],
          [24, 85, p.accent],
          [30, 81, '#FFD24A'],
          [70, 81, p.accent],
          [76, 85, '#FF4A5E'],
          [82, 81, '#7AFF8A'],
        ] as const
      ).map(([x, y, c], i) => (
        <Glow key={i} x={x} y={y} r={1.2} color={c} />
      ))}
    </G>
  ),
  flickerOver: true,
});

/** KAI WACHI's: a cyber-gladiator, chrome helmet crested in neon, a glowing T-shaped visor. */
const gladiator: Draw = (p, f) => ({
  ground: [50, 94, 28],
  back: <Ellipse cx={50} cy={50} rx={40} ry={36} fill={p.glow} opacity={0.12} />,
  body: (
    <G>
      {/* Pauldrons and chest plate. */}
      {both(<V d="M20 78 C18 66 24 58 34 58 L40 60 L38 76 C32 80 25 81 20 78Z" fill={p.mid} f={f} gloss={[27, 63, 3.5, 1.5, -20]} />)}
      <V d="M34 60 L66 60 L64 88 Q50 94 36 88Z" fill={p.deep} f={f} />
      <Path d="M40 66 L50 72 L60 66 M42 76 L50 81 L58 76" stroke={p.accent} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      {/* The crest: a tall neon ridge. */}
      <V d="M42 20 C40 8 46 2 50 2 C54 2 60 8 58 20Z" fill={p.alt} f={f} />
      {[44, 47, 50, 53, 56].map((x) => (
        <Path key={x} d={`M${x} 18 L${x} 6`} stroke={p.altDeep} strokeWidth={0.7} opacity={0.6} />
      ))}
      {/* The helmet: rounded, with cheek guards. */}
      <V d="M30 40 C30 24 39 16 50 16 C61 16 70 24 70 40 L68 58 L58 62 L58 50 L42 50 L42 62 L32 58Z" fill={p.light} f={f} gloss={[40, 24, 6, 2.6, -28]} />
      <Path d="M30.5 36 L69.5 36" stroke={p.mid} strokeWidth={1.4} />
      {/* The T-shaped visor, dark. */}
      <Path d="M35 39 L65 39 L65 45 L54 45 L54 58 L46 58 L46 45 L35 45Z" fill="#06040C" />
    </G>
  ),
  flicker: (
    <G>
      <Path d="M36.5 41 L63.5 41 L63.5 43.4 L52.4 43.4 L52.4 56 L47.6 56 L47.6 43.4 L36.5 43.4Z" fill={p.accent} />
      <Path d="M35 39 L65 39 L65 45 L54 45 L54 58 L46 58 L46 45 L35 45Z" fill={p.accent} opacity={0.25} transform="translate(50 46) scale(1.15) translate(-50 -46)" />
    </G>
  ),
  flickerOver: true,
});

/** PORTER ROBINSON's: a soft pastel cube floating in a dream, pixels drifting off it. */
const dreamcube: Draw = (p, f) => ({
  ground: [50, 92, 16],
  back: (
    <G>
      <Ellipse cx={50} cy={48} rx={38} ry={34} fill={p.glow} opacity={0.16} />
      {sparkles('#FFFFFF', [
        [16, 20, 1.6],
        [84, 24, 1.4],
        [12, 66, 1.1],
        [88, 70, 1.2],
      ])}
    </G>
  ),
  pivot: [50, 50],
  sway: (
    <G>
      {(
        [
          [18, 40, 3.2, p.alt],
          [80, 46, 2.8, p.mid],
          [24, 76, 2.4, p.mid],
          [76, 78, 3, p.alt],
          [70, 14, 2.2, p.alt],
          [30, 12, 2, p.mid],
        ] as const
      ).map(([x, y, s, c], i) => (
        <Rect key={i} x={x} y={y} width={s} height={s} fill={c} opacity={0.9} />
      ))}
    </G>
  ),
  body: (
    <G>
      {/* An isometric cube: top, left and right faces. */}
      <V d="M50 18 L76 31 L50 44 L24 31Z" fill={p.light} f={f} gloss={[44, 27, 6, 2, -10]} />
      <V d="M24 31 L50 44 L50 78 L24 65Z" fill={p.mid} f={f} />
      <V d="M76 31 L50 44 L50 78 L76 65Z" fill={p.alt} f={f} />
      <Path d="M50 44 L50 78" stroke="#FFFFFF" strokeWidth={0.8} opacity={0.7} />
      <Circle cx={31} cy={60} r={2.2} fill="#FF8AB8" opacity={0.6} />
      <Circle cx={45} cy={67} r={2.2} fill="#FF8AB8" opacity={0.6} />
      <Path d="M35.5 61.5 Q38 64.6 40.5 63" stroke={p.deep} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [29, 48, 18, 10],
    el: (
      <G>
        <VEye x={33} y={53} r={2.4} f={f} />
        <VEye x={43} y={58} r={2.4} f={f} />
      </G>
    ),
  },
});

/** SAID THE SKY's: a paper plane gliding over soft pink and blue clouds. */
const paperplane: Draw = (p, f) => ({
  ground: [50, 92, 18],
  back: (
    <G>
      <Ellipse cx={50} cy={50} rx={40} ry={34} fill={p.glow} opacity={0.14} />
      {(
        [
          [20, 78, 13, 8, p.altDeep],
          [34, 72, 12, 10, p.alt],
          [50, 78, 14, 9, p.altDeep],
          [66, 72, 12, 10, p.alt],
          [80, 78, 12, 8, p.altDeep],
          [27, 84, 12, 6, p.alt],
          [72, 84, 12, 6, p.alt],
          [82, 22, 7, 4, p.alt],
          [16, 30, 6, 3.5, p.altDeep],
        ] as const
      ).map(([cx, cy, rx, ry, c], i) => (
        <VE key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={c} f={f} gloss={false} opacity={0.9} />
      ))}
    </G>
  ),
  pivot: [50, 48],
  sway: (
    <G transform="translate(50 46) scale(1.3) translate(-54 -46)">
      {/* Its trail. */}
      <Path d="M10 58 Q22 66 30 56" stroke="#FFFFFF" strokeWidth={1.1} fill="none" strokeDasharray="2 3" strokeLinecap="round" opacity={0.8} />
      {/* The folds: far wing, keel, near wing. */}
      <V d="M30 54 L84 30 L52 50Z" fill={p.deep} f={f} />
      <V d="M52 50 L84 30 L56 62Z" fill={p.mid} f={f} />
      <V d="M30 54 L84 30 L56 58 L48 52Z" fill={p.light} f={f} gloss={[58, 44, 7, 1.6, -24]} />
      <Path d="M48 52 L84 30" stroke={p.deep} strokeWidth={0.7} opacity={0.6} />
    </G>
  ),
  body: <G />,
});

/** ODESZA's: a golden icosahedron, twenty faces glowing. */
const icosa: Draw = (p, f) => {
  const at = (deg: number, r: number) => [r1(50 + Math.cos((deg * Math.PI) / 180) * r), r1(48 + Math.sin((deg * Math.PI) / 180) * r)] as const;
  const H = [270, 330, 30, 90, 150, 210].map((d) => at(d, 32));
  const T: Record<number, readonly [number, number]> = { 330: at(330, 15), 90: at(90, 15), 210: at(210, 15) };
  const tri = (a: readonly number[], b: readonly number[], c: readonly number[]) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${c[0]} ${c[1]}Z`;
  const faces: [string, string][] = [
    [tri(T[330], T[90], T[210]), p.light],
    [tri(H[0], H[1], T[330]), p.light],
    [tri(H[1], H[2], T[330]), p.mid],
    [tri(H[2], H[3], T[90]), p.mid],
    [tri(H[3], H[4], T[90]), p.alt],
    [tri(H[4], H[5], T[210]), p.alt],
    [tri(H[5], H[0], T[210]), p.light],
    [tri(T[330], T[90], H[2]), p.mid],
    [tri(T[90], T[210], H[4]), p.alt],
    [tri(T[210], T[330], H[0]), p.light],
  ];
  return {
    ground: [50, 90, 18],
    back: (
      <G>
        <Circle cx={50} cy={48} r={42} fill={p.glow} opacity={0.12} />
        <Circle cx={50} cy={48} r={36} fill={p.glow} opacity={0.12} />
      </G>
    ),
    body: (
      <G>
        {faces.map(([d, c], i) => (
          <V key={i} d={d} fill={c} f={f} />
        ))}
        <Path d={faces.map(([d]) => d).join(' ')} stroke={p.accent} strokeWidth={0.7} fill="none" strokeLinejoin="round" opacity={0.9} />
      </G>
    ),
    flicker: sparkles('#FFFFFF', [
      [H[0][0], H[0][1], 2.4],
      [T[330][0], T[330][1], 1.6],
      [H[4][0], H[4][1], 1.8],
    ]),
    flickerOver: true,
  };
};

/** A spiral from the middle out (for hypnotic goggles). */
function spiral(cx: number, cy: number, r: number, turns = 3) {
  const n = turns * 16;
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const d = (i / n) * r;
    return `${i ? 'L' : 'M'}${r1(cx + Math.cos(a) * d)} ${r1(cy + Math.sin(a) * d)}`;
  }).join(' ');
}

/** REZZ's: a dark little figure with a fringe, behind huge goggles of glowing red spirals. */
const goggles: Draw = (p, f) => ({
  ground: [50, 92, 24],
  back: <Ellipse cx={50} cy={50} rx={40} ry={36} fill={p.glow} opacity={0.12} />,
  body: (
    <G>
      {/* A dark jacket, high collar. */}
      <V d="M24 92 C24 74 34 64 50 64 C66 64 76 74 76 92Z" fill={p.mid} f={f} />
      <Path d="M42 64 L50 74 L58 64" stroke={p.alt} strokeWidth={1.4} fill="none" />
      {/* Head and long dark hair with a blunt fringe. */}
      <V d="M28 50 C26 30 36 18 50 18 C64 18 74 30 72 50 L74 70 L64 66 L36 66 L26 70Z" fill={p.deep} f={f} />
      <VE cx={50} cy={46} rx={17} ry={18} fill={p.light} f={f} gloss={false} />
      <V d="M32 40 C32 26 40 21 50 21 C60 21 68 26 68 40 L62 36 L56 39 L50 35 L44 39 L38 36Z" fill={p.deep} f={f} gloss={[42, 26, 5, 1.6, -18]} />
      <Path d="M46 60 Q50 61.6 54 60" stroke={p.deep} strokeWidth={1} fill="none" strokeLinecap="round" />
      {/* The goggles. */}
      <Path d="M33 47 L67 47" stroke={p.alt} strokeWidth={2.4} />
      {[39, 61].map((x) => (
        <G key={x}>
          <VE cx={x} cy={48} rx={10} ry={10} fill={p.alt} f={f} />
          <Circle cx={x} cy={48} r={8} fill="#06040C" />
        </G>
      ))}
    </G>
  ),
  flicker: (
    <G>
      {[39, 61].map((x) => (
        <G key={x}>
          <Circle cx={x} cy={48} r={8} fill={p.accent} opacity={0.18} />
          <Path d={spiral(x, 48, 7.2, 3)} stroke={p.accent} strokeWidth={1.1} fill="none" strokeLinecap="round" />
          <Circle cx={x} cy={48} r={1.1} fill="#FFFFFF" />
        </G>
      ))}
    </G>
  ),
  flickerOver: true,
});

/** ERIC PRYDZ's: a ghostly hologram of an astronaut, projected in light above its emitter. */
const hologram: Draw = (p, f) => {
  const lines = Array.from({ length: 16 }, (_, i) => `M26 ${14 + i * 4} L74 ${14 + i * 4}`).join(' ');
  return {
    ground: [50, 92, 22],
    back: <Ellipse cx={50} cy={46} rx={38} ry={36} fill={p.glow} opacity={0.12} />,
    body: (
      <G>
        {/* The emitter and its beam. */}
        <Path d="M38 84 L28 30 L72 30 L62 84Z" fill={p.mid} opacity={0.1} />
        <V d="M30 84 Q50 80 70 84 L67 92 Q50 95 33 92Z" fill={p.alt} f={f} />
        <Ellipse cx={50} cy={84} rx={16} ry={2.6} fill={p.altDeep} />
        <Ellipse cx={50} cy={84} rx={10} ry={1.6} fill={p.mid} />
      </G>
    ),
    flicker: (
      <G opacity={0.85}>
        {/* The astronaut, in light. */}
        <Path d="M36 78 L38 58 C38 52 42 50 50 50 C58 50 62 52 62 58 L64 78 L56 78 L55 68 L45 68 L44 78Z" fill={p.mid} opacity={0.45} />
        <Path d="M38 58 L30 66 M62 58 L70 64" stroke={p.mid} strokeWidth={4.4} strokeLinecap="round" opacity={0.45} />
        <Circle cx={50} cy={36} r={14} fill={p.mid} opacity={0.4} />
        <Path d="M41 34 Q50 27 59 34 Q59 43 50 44 Q41 43 41 34Z" fill={p.light} opacity={0.75} />
        <Rect x={44} y={56} width={12} height={7} rx={1} fill={p.light} opacity={0.5} />
        <Path d={lines} stroke={p.light} strokeWidth={0.5} opacity={0.35} />
        <Path d="M36 78 L38 58 C38 52 42 50 50 50 C58 50 62 52 62 58 L64 78 M36 36 A14 14 0 1 1 64 36 A14 14 0 1 1 36 36" stroke={p.light} strokeWidth={0.8} fill="none" opacity={0.8} />
      </G>
    ),
    flickerOver: true,
  };
};

/** DEADMAU5's: a big round mouse head with huge ears, round glowing eyes and a wide grin. */
const mousehead: Draw = (p, f) => ({
  ground: [50, 92, 24],
  back: <Ellipse cx={50} cy={50} rx={42} ry={38} fill={p.glow} opacity={0.12} />,
  body: (
    <G>
      {both(<VE cx={24} cy={24} rx={15} ry={15} fill={p.mid} f={f} />)}
      <V d="M28 82 C30 74 40 70 50 70 C60 70 70 74 72 82Z" fill={p.alt} f={f} />
      <VE cx={50} cy={52} rx={27} ry={26} fill={p.mid} f={f} />
      {/* The grin. */}
      <V d="M33 60 Q50 64 67 60 Q64 74 50 75 Q36 74 33 60Z" fill="#FFFFFF" f={f} />
      <Path d="M38 61.6 L39 71 M44 62.6 L44.4 74 M50 63 L50 75 M56 62.6 L55.6 74 M62 61.6 L61 71 M34.6 66 Q50 69.6 65.4 66" stroke={p.altDeep} strokeWidth={0.9} fill="none" />
    </G>
  ),
  flicker: (
    <G>
      {[39, 61].map((x) => (
        <G key={x}>
          <Circle cx={x} cy={46} r={8.4} fill={p.accent} opacity={0.2} />
          <Circle cx={x} cy={46} r={7} fill={p.accent} />
          <Circle cx={x + 1} cy={47} r={3.6} fill="#06040C" />
          <Circle cx={x - 1.6} cy={43.6} r={1.6} fill="#FFFFFF" />
        </G>
      ))}
    </G>
  ),
  flickerOver: true,
});

/** MARSHMELLO's: a soft marshmallow with crossed eyes and a big friendly grin. */
const mallow: Draw = (p, f) => ({
  ground: [50, 92, 22],
  back: <Ellipse cx={50} cy={50} rx={40} ry={36} fill={p.glow} opacity={0.14} />,
  body: (
    <G>
      {/* Little feet and arms. */}
      <VE cx={41} cy={88} rx={6} ry={3.6} fill={p.mid} f={f} />
      <VE cx={59} cy={88} rx={6} ry={3.6} fill={p.mid} f={f} />
      {both(<VE cx={25} cy={58} rx={4.6} ry={7} fill={p.mid} f={f} turn={20} />)}
      {/* The marshmallow: a soft cylinder, its top showing. */}
      <V d="M27 30 C27 24 38 20 50 20 C62 20 73 24 73 30 L73 78 C73 84 62 88 50 88 C38 88 27 84 27 78Z" fill={p.light} f={f} gloss={[36, 40, 3.6, 12, 0]} />
      <Ellipse cx={50} cy={30} rx={23} ry={8.6} fill={p.mid} opacity={0.55} />
      <Path d="M27 30 C27 36 38 39 50 39 C62 39 73 36 73 30" stroke={p.deep} strokeWidth={0.8} fill="none" opacity={0.5} />
      {/* Crossed eyes and the grin. */}
      <Path d="M36 48 L44 56 M44 48 L36 56 M56 48 L64 56 M64 48 L56 56" stroke={p.alt} strokeWidth={2.6} strokeLinecap="round" />
      <Path d="M36 63 Q50 64.4 64 63 Q62 75 50 76 Q38 75 36 63Z" fill={p.alt} />
      <Circle cx={34} cy={64} r={2.4} fill={p.accent} opacity={0.55} />
      <Circle cx={66} cy={64} r={2.4} fill={p.accent} opacity={0.55} />
    </G>
  ),
});

/** ALAN WALKER's: a hooded figure, hood pulled low and face masked, only the eyes showing. */
const hooded: Draw = (p, f) => ({
  ground: [50, 94, 26],
  back: <Ellipse cx={50} cy={50} rx={40} ry={36} fill={p.glow} opacity={0.14} />,
  body: (
    <G>
      {/* The hoodie: body and drawstrings. */}
      <V d="M20 94 C20 72 32 62 50 62 C68 62 80 72 80 94Z" fill={p.mid} f={f} />
      <Path d="M45 66 L44 80 M55 66 L56 80" stroke={p.light} strokeWidth={1} strokeLinecap="round" />
      {/* A simple emblem: two chevrons. */}
      <Path d="M42 86 L50 80 L58 86 M45 90 L50 86 L55 90" stroke={p.accent} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* The hood, pulled low. */}
      <V d="M24 58 C22 32 34 14 50 14 C66 14 78 32 76 58 C72 66 62 70 50 70 C38 70 28 66 24 58Z" fill={p.mid} f={f} gloss={[38, 22, 6, 2.4, -28]} />
      <Path d="M32 56 C32 38 40 30 50 30 C60 30 68 38 68 56 C64 62 58 64 50 64 C42 64 36 62 32 56Z" fill={p.deep} />
      {/* The mask, under the eyes. */}
      <V d="M34 48 Q50 44 66 48 L64 58 Q50 65 36 58Z" fill={p.alt} f={f} />
      <Path d="M36 52 Q50 49 64 52" stroke={p.light} strokeWidth={0.5} fill="none" opacity={0.35} />
    </G>
  ),
  flicker: (
    <G>
      <Path d="M39 42 Q43 39.6 47 42 Q43 43.6 39 42Z" fill={p.accent} />
      <Path d="M53 42 Q57 39.6 61 42 Q57 43.6 53 42Z" fill={p.accent} />
      <Ellipse cx={50} cy={42} rx={14} ry={3.4} fill={p.glow} opacity={0.18} />
    </G>
  ),
  flickerOver: true,
});

/** ZEDD's: a glass prism, a beam of white light going in and a rainbow fanning out. */
const prism: Draw = (p, f) => {
  const rainbow = ['#FF3B3B', '#FF9A2E', '#FFE14A', '#4AE07A', '#3AA8FF', '#8A5AFF'];
  return {
    ground: [50, 88, 22],
    back: <Ellipse cx={50} cy={50} rx={42} ry={36} fill={p.glow} opacity={0.12} />,
    flicker: (
      <G>
        <Path d="M4 60 L42 49" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M4 60 L42 49" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.25} />
        {rainbow.map((c, i) => (
          <Path key={c} d={`M60 ${50 + i * 1.6} L97 ${38 + i * 7} L97 ${44 + i * 7} L60 ${51.6 + i * 1.6}Z`} fill={c} opacity={0.9} />
        ))}
      </G>
    ),
    body: (
      <G>
        {/* The prism: a triangle of glass with a bevelled face. */}
        <V d="M50 18 L76 72 L24 72Z" fill={p.mid} f={f} opacity={0.85} />
        <Path d="M50 18 L58 72 L76 72Z" fill={p.deep} opacity={0.35} />
        <Path d="M50 24 L30 68 L44 68Z" fill="#FFFFFF" opacity={0.35} />
        <Path d="M50 18 L76 72 L24 72Z" stroke={p.light} strokeWidth={1.2} fill="none" strokeLinejoin="round" />
        <Path d="M42 49 L60 51" stroke="#FFFFFF" strokeWidth={1.2} opacity={0.8} />
      </G>
    ),
    flickerOver: true,
  };
};

/** SAN HOLO's: a single white bird in flight against a pastel sky. */
const dove: Draw = (p, f) => ({
  ground: [50, 90, 16],
  back: (
    <G>
      <Circle cx={50} cy={48} r={40} fill={p.alt} opacity={0.22} />
      <Circle cx={50} cy={48} r={30} fill={p.altDeep} opacity={0.16} />
    </G>
  ),
  pivot: [50, 50],
  flap: true,
  sway: (
    <G>
      {/* Wings raised, feathers swept back. */}
      {both(
        <G>
          <V d="M48 50 C40 40 30 28 12 20 C20 32 26 40 30 44 C24 44 18 46 14 50 C24 52 36 54 46 56Z" fill={p.light} f={f} />
          <Path d="M44 50 C36 42 28 34 18 26 M42 53 C34 50 26 48 20 48" stroke={p.mid} strokeWidth={0.8} fill="none" opacity={0.8} />
        </G>,
      )}
    </G>
  ),
  body: (
    <G>
      {/* A slim body, tail fanned below, head turned up. */}
      <V d="M44 66 L50 82 L56 66Z" fill={p.mid} f={f} />
      <V d="M50 38 C56 40 58 50 56 60 C55 66 52 70 50 70 C48 70 45 66 44 60 C42 50 44 40 50 38Z" fill={p.light} f={f} gloss={[47, 46, 1.6, 4, 0]} />
      <VE cx={50} cy={36} rx={5.4} ry={5} fill={p.light} f={f} />
      <Path d="M50 32 L54.6 30 L51 34Z" fill={p.accent} />
      <Circle cx={51.4} cy={35} r={0.9} fill={p.deep} />
    </G>
  ),
});

/** STEVE AOKI's: a three-tier birthday cake flying through the air, candles lit. */
const cake: Draw = (p, f) => {
  const drips = (y: number, x0: number, x1: number) =>
    Array.from({ length: Math.round((x1 - x0) / 5) }, (_, i) => {
      const x = x0 + 2.5 + i * 5;
      const h = 2 + (i % 3) * 1.4;
      return `M${x - 1.6} ${y} L${x - 1.6} ${y + h} Q${x} ${y + h + 2} ${x + 1.6} ${y + h} L${x + 1.6} ${y}Z`;
    }).join(' ');
  const sprinkles = ['#FF4A5E', '#4AE07A', '#3AA8FF', '#FFE14A', '#B07AFF'];
  return {
    ground: [50, 92, 22],
    back: (
      <G>
        <Ellipse cx={50} cy={50} rx={40} ry={34} fill={p.glow} opacity={0.14} />
        <Path d="M14 70 L4 74 M16 78 L6 84 M18 62 L8 64" stroke="#FFFFFF" strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
      </G>
    ),
    pivot: [50, 56],
    sway: (
      <G transform="rotate(-8 50 56)">
        {/* Plate, then three tiers, each frosted with drips. */}
        <Ellipse cx={50} cy={84} rx={30} ry={4} fill={p.altDeep} />
        <V d="M24 64 L76 64 L76 82 Q50 86 24 82Z" fill={p.mid} f={f} />
        <V d="M24 64 Q50 60 76 64 L76 67 L24 67Z" fill={p.alt} f={f} />
        <Path d={drips(66.5, 24, 76)} fill={p.alt} />
        <V d="M31 48 L69 48 L69 64 L31 64Z" fill={p.deep} f={f} />
        <V d="M31 48 Q50 45 69 48 L69 51 L31 51Z" fill={p.alt} f={f} />
        <Path d={drips(50.5, 31, 69)} fill={p.alt} />
        <V d="M38 34 L62 34 L62 48 L38 48Z" fill={p.mid} f={f} />
        <V d="M38 34 Q50 32 62 34 L62 37 L38 37Z" fill={p.alt} f={f} />
        <Path d={drips(36.5, 38, 62)} fill={p.alt} />
        {(
          [
            [30, 74],
            [40, 77],
            [52, 72],
            [64, 76],
            [70, 71],
            [36, 58],
            [48, 60],
            [60, 57],
            [44, 43],
            [56, 44],
          ] as const
        ).map(([x, y], i) => (
          <Rect key={i} x={x} y={y} width={2.4} height={0.9} rx={0.45} fill={sprinkles[i % sprinkles.length]} transform={`rotate(${(i * 47) % 180} ${x} ${y})`} />
        ))}
        {/* Candles. */}
        {[43, 50, 57].map((x) => (
          <G key={x}>
            <Rect x={x - 1} y={26} width={2} height={8} fill={x === 50 ? '#7AD0FF' : '#FFD86B'} />
            <Path d={flame(x, 26, x, 20.5, 1.6)} fill={p.accent} />
          </G>
        ))}
      </G>
    ),
    body: <G />,
  };
};

/** TCHAMI's: a gothic stained-glass window, lit from within. */
const stainedglass: Draw = (p, f) => {
  const panes = ['#E0344A', '#3A7AF0', '#3AC07A', '#FFC24A', '#9A5AE8', '#FF8A3A'];
  // The lancet below: two columns of panes under a pointed arch.
  const cells: [number, number, number, number][] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) cells.push([31 + c * 12.7, 46 + r * 10, 12.7, 10]);
  return {
    ground: [50, 94, 24],
    back: <Ellipse cx={50} cy={52} rx={42} ry={40} fill={p.glow} opacity={0.18} />,
    body: (
      <G>
        {/* Stone frame. */}
        <V d="M24 92 L24 40 C24 20 36 8 50 4 C64 8 76 20 76 40 L76 92Z" fill={p.mid} f={f} />
        {/* The glass: a rose window above, panes below. */}
        <Path d="M30 86 L30 44 C30 28 40 16 50 12 C60 16 70 28 70 44 L70 86Z" fill={p.altDeep} />
        {cells.map(([x, y, w, h], i) => (
          <Rect key={i} x={x} y={y} width={w} height={h} fill={panes[(i * 5) % panes.length]} opacity={0.9} />
        ))}
        {Array.from({ length: 8 }, (_, i) => {
          const a0 = (i / 8) * Math.PI * 2;
          const a1 = ((i + 1) / 8) * Math.PI * 2;
          return <Path key={i} d={`M50 30 L${r1(50 + Math.cos(a0) * 12)} ${r1(30 + Math.sin(a0) * 12)} A12 12 0 0 1 ${r1(50 + Math.cos(a1) * 12)} ${r1(30 + Math.sin(a1) * 12)}Z`} fill={panes[i % panes.length]} opacity={0.9} />;
        })}
        <Circle cx={50} cy={30} r={3.4} fill={p.accent} />
        {/* Lead lines. */}
        <Path d="M30 46 L70 46 M30 56 L70 56 M30 66 L70 66 M30 76 L70 76 M43.7 46 L43.7 86 M56.3 46 L56.3 86" stroke={p.deep} strokeWidth={1.4} />
        <Circle cx={50} cy={30} r={12} stroke={p.deep} strokeWidth={1.6} fill="none" />
        <Path d="M50 18 L50 42 M38 30 L62 30 M41.5 21.5 L58.5 38.5 M58.5 21.5 L41.5 38.5" stroke={p.deep} strokeWidth={1} />
        <Path d="M30 86 L30 44 C30 28 40 16 50 12 C60 16 70 28 70 44 L70 86Z" stroke={p.deep} strokeWidth={2} fill="none" />
      </G>
    ),
    flicker: (
      <G>
        <Path d="M30 86 L30 44 C30 28 40 16 50 12 C60 16 70 28 70 44 L70 86Z" fill={p.light} opacity={0.12} />
        <Glow x={50} y={30} r={1.6} color={p.accent} />
      </G>
    ),
    flickerOver: true,
  };
};

/** ATLIENS's: a hooded figure in a chrome mask, eyes burning red, under a flaming red UFO and its beam (inspired by their look and tour art, drawn our own way). */
const chromemask: Draw = (p, f) => ({
  ground: [50, 92, 26],
  back: (
    <G>
      <Ellipse cx={50} cy={50} rx={42} ry={38} fill={p.glow} opacity={0.12} />
      {/* The beam. */}
      <Path d="M42 26 L58 26 L78 90 Q50 96 22 90Z" fill={p.accent} opacity={0.22} />
    </G>
  ),
  // The UFO, tilting as it hovers.
  pivot: [50, 22],
  sway: (
    <G>
      <VE cx={50} cy={18.5} rx={8} ry={5} fill={p.deep} f={f} />
      <VE cx={50} cy={23} rx={24} ry={5} fill={p.deep} f={f} gloss={false} />
      <Ellipse cx={50} cy={24.6} rx={16} ry={2} fill={p.altDeep} />
      {[32, 40, 50, 60, 68].map((x) => (
        <Circle key={x} cx={x} cy={23.2} r={1} fill={p.accent} />
      ))}
    </G>
  ),
  body: (
    <G transform="translate(50 98) scale(0.86) translate(-50 -98)">
      {/* The hoodie, drawstrings hanging. */}
      <V d="M18 92 C18 76 30 66 50 66 C70 66 82 76 82 92 Q50 97 18 92Z" fill={p.alt} f={f} />
      <Path d="M45 70 L44 84 M55 70 L56 84" stroke={p.mid} strokeWidth={0.9} strokeLinecap="round" opacity={0.8} />
      {/* The hood, and the dark inside it. */}
      <V d="M27 58 C25 36 36 22 50 22 C64 22 75 36 73 58 C69 68 60 72 50 72 C40 72 31 68 27 58Z" fill={p.alt} f={f} gloss={[38, 30, 5, 2, -28]} />
      <Path d="M33.5 57 C33.5 40 41 31.5 50 31.5 C59 31.5 66.5 40 66.5 57 C62.5 64 57 67 50 67 C43 67 37.5 64 33.5 57Z" fill={p.altDeep} />
      {/* The chrome mask. */}
      <V d="M38 46 C38 38 43 34 50 34 C57 34 62 38 62 46 C62 56 57 64 50 65.5 C43 64 38 56 38 46Z" fill={p.mid} f={f} gloss={[44, 39, 3.6, 1.8, -30]} />
      <Path d="M40.4 41 Q44 38.6 48 40.6 M59.6 41 Q56 38.6 52 40.6" stroke={p.deep} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      <Path d="M50 44 L48.4 54.4 Q50 55.6 51.6 54.4Z" fill={p.light} opacity={0.7} />
      <Path d="M46 59.4 Q50 60.8 54 59.4" stroke={p.deep} strokeWidth={1} fill="none" strokeLinecap="round" />
      <Path d="M57.6 50 Q59 56 54.6 61.6" stroke={p.light} strokeWidth={1} fill="none" opacity={0.6} strokeLinecap="round" />
      <Ellipse cx={44.6} cy={46} rx={3.2} ry={2.3} fill="#06040C" transform="rotate(10 44.6 46)" />
      <Ellipse cx={55.4} cy={46} rx={3.2} ry={2.3} fill="#06040C" transform="rotate(-10 55.4 46)" />
    </G>
  ),
  flicker: (
    <G>
      {/* Flames licking off the top of the UFO. */}
      {(
        [
          [33, 21, 31, 13, 2.2, -2],
          [40, 19, 39, 10, 2.4, 1],
          [46, 16.5, 45, 8, 2.2, -1],
          [54, 16.5, 55.5, 8.5, 2.2, 1],
          [60, 19, 62, 10.5, 2.4, -1],
          [67, 21, 70, 13.5, 2, 2],
        ] as const
      ).map(([bx, by, tx, ty, w, b], i) => (
        <G key={i}>
          <Path d={flame(bx, by, tx, ty, w, b)} fill={p.accent} />
          <Path d={flame(bx, by, bx + (tx - bx) * 0.6, by + (ty - by) * 0.6, w * 0.5, b * 0.5)} fill="#FFB43A" />
        </G>
      ))}
      <G transform="translate(50 98) scale(0.86) translate(-50 -98)">
        <Glow x={44.6} y={46.2} r={1.6} color={p.accent} />
        <Glow x={55.4} y={46.2} r={1.6} color={p.accent} />
      </G>
    </G>
  ),
  flickerOver: true,
});

/** A sticker: a mirror ball with a happy face, throwing colours round the room. */
const discoball: Draw = (p, f) => {
  // Mirror tiles over the ball, the ones nearer the edge smaller (it's round).
  const tiles: [number, number, number, string][] = [];
  for (let gy = -4; gy <= 4; gy++)
    for (let gx = -4; gx <= 4; gx++) {
      const x = 50 + gx * 6.4;
      const y = 52 + gy * 6.4;
      const d = Math.hypot(x - 50, y - 52);
      // Round, and clear round its face.
      if (d > 26 || (Math.abs(x - 50) < 13 && y > 46 && y < 68)) continue;
      const k = 1 - (d / 30) ** 2;
      const pick = (gx * 3 + gy * 5 + 40) % 7;
      tiles.push([x, y, 5.4 * (0.55 + 0.45 * k), pick === 0 ? p.alt : pick === 3 ? p.altDeep : pick === 5 ? p.accent : pick % 2 ? p.light : p.mid]);
    }
  return {
    ground: [50, 92, 20],
    back: (
      <G>
        <Ellipse cx={50} cy={52} rx={44} ry={42} fill={p.glow} opacity={0.14} />
        {[-60, -20, 20, 60, 120, 160, 200, 240].map((a, i) => {
          const r = (a * Math.PI) / 180;
          return <Path key={a} d={`M50 52 L${r1(50 + Math.cos(r - 0.06) * 48)} ${r1(52 + Math.sin(r - 0.06) * 48)} L${r1(50 + Math.cos(r + 0.06) * 48)} ${r1(52 + Math.sin(r + 0.06) * 48)}Z`} fill={i % 3 === 0 ? p.alt : i % 3 === 1 ? p.altDeep : p.accent} opacity={0.16} />;
        })}
      </G>
    ),
    body: (
      <G>
        <Path d="M50 2 L50 22" stroke={p.deep} strokeWidth={1.6} />
        <V d="M46 22 L54 22 L54 25 L46 25Z" fill={p.deep} f={f} />
        <VE cx={50} cy={52} rx={28} ry={28} fill={p.deep} f={f} gloss={false} />
        {tiles.map(([x, y, sz, c], i) => (
          <Rect key={i} x={r1(x - sz / 2)} y={r1(y - sz / 2)} width={r1(sz)} height={r1(sz)} rx={0.8} fill={c} />
        ))}
        <VE cx={50} cy={52} rx={28} ry={28} fill="rgba(0,0,0,0)" f={f} gloss={false} opacity={0.9} />
        <Ellipse cx={40} cy={38} rx={7} ry={4} fill="#FFFFFF" opacity={0.55} transform="rotate(-30 40 38)" />
        <Path d="M43 61 Q50 67 57 61" stroke={p.light} strokeWidth={2} fill="none" strokeLinecap="round" />
        <Circle cx={36} cy={60} r={2.4} fill={p.alt} opacity={0.6} />
        <Circle cx={64} cy={60} r={2.4} fill={p.alt} opacity={0.6} />
      </G>
    ),
    eyes: {
      box: [38, 48, 24, 9],
      el: (
        <G>
          <VEye x={42.5} y={52.5} r={3.6} f={f} />
          <VEye x={57.5} y={52.5} r={3.6} f={f} />
        </G>
      ),
    },
    flicker: sparkles('#FFFFFF', [
      [20, 30, 2.6],
      [82, 38, 2.2],
      [78, 74, 2.8],
      [22, 72, 2],
    ]),
    flickerOver: true,
  };
};

/** A sticker: a festival totem on a pole, a grinning sign ringed with lights and streamers flying. */
const totem: Draw = (p, f) => ({
  ground: [50, 94, 14],
  back: <Ellipse cx={50} cy={40} rx={38} ry={30} fill={p.glow} opacity={0.14} />,
  pivot: [50, 14],
  sway: (
    <G>
      {(
        [
          [32, 16, 22, 40, p.alt],
          [40, 14, 34, 44, p.altDeep],
          [60, 14, 66, 44, p.alt],
          [68, 16, 78, 40, p.altDeep],
        ] as const
      ).map(([x0, y0, x1, y1, c], i) => (
        <Path key={i} d={`M${x0} ${y0} Q${(x0 + x1) / 2 + (i % 2 ? 4 : -4)} ${(y0 + y1) / 2} ${x1} ${y1}`} stroke={c} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      ))}
    </G>
  ),
  body: (
    <G>
      {/* The pole, taped in stripes. */}
      <V d="M47.6 44 L52.4 44 L52.4 94 L47.6 94Z" fill={p.deep} f={f} />
      {[54, 64, 74, 84].map((y) => (
        <Path key={y} d={`M47.6 ${y} L52.4 ${y + 3}`} stroke={p.altDeep} strokeWidth={1.4} />
      ))}
      {/* The sign. */}
      <V d="M24 18 Q24 12 30 12 L70 12 Q76 12 76 18 L76 40 Q76 46 70 46 L30 46 Q24 46 24 40Z" fill={p.mid} f={f} gloss={[34, 18, 6, 2, -10]} />
      <Path d="M28 16 L72 16 L72 42 L28 42Z" fill="none" stroke={p.light} strokeWidth={0.6} opacity={0.5} strokeDasharray="1.4 2.6" />
      <Path d="M40 34 Q50 42 60 34 Q50 38 40 34Z" fill={p.deep} />
      <Path d="M43 35.2 L57 35.2 L56 37 L44 37Z" fill="#FFFFFF" />
    </G>
  ),
  eyes: {
    box: [36, 21, 28, 10],
    el: (
      <G>
        <VEye x={41} y={26} r={3.8} f={f} />
        <VEye x={59} y={26} r={3.8} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {Array.from({ length: 14 }, (_, i) => {
        const tpos = i / 14;
        const per = 2 * (52 + 34);
        let d = tpos * per;
        let x = 24;
        let y = 12;
        if (d < 52) x = 24 + d;
        else if ((d -= 52) < 34) [x, y] = [76, 12 + d];
        else if ((d -= 34) < 52) [x, y] = [76 - d, 46];
        else [x, y] = [24, 46 - (d - 52)];
        return <Circle key={i} cx={r1(x)} cy={r1(y)} r={1.3} fill={i % 2 ? p.accent : p.altDeep} />;
      })}
    </G>
  ),
  flickerOver: true,
});

/** A sticker: a little tent at the campsite, fairy lights along it and someone peeking out. */
const tent: Draw = (p, f) => ({
  ground: [50, 89, 36],
  back: <Ellipse cx={50} cy={60} rx={42} ry={30} fill={p.glow} opacity={0.14} />,
  body: (
    <G>
      {/* Guy ropes and pegs. */}
      <Path d="M22 80 L8 90 M78 80 L92 90" stroke={p.light} strokeWidth={0.8} opacity={0.7} />
      {/* The tent: two panels, the door flap open. */}
      <V d="M50 22 L84 86 L16 86Z" fill={p.mid} f={f} gloss={[38, 50, 3, 10, 28]} />
      <Path d="M50 22 L84 86 L50 86Z" fill={p.deep} opacity={0.35} />
      <V d="M50 40 L62 86 L38 86Z" fill={p.alt} f={f} />
      <Path d="M50 40 C56 54 66 72 72 86 L62 86Z" fill={p.light} opacity={0.9} />
      <Path d="M50 22 L50 14 M50 14 L58 17 L50 20" stroke={p.deep} strokeWidth={1.2} fill={p.accent} strokeLinejoin="round" />
      {/* Someone peeking out. */}
      <VE cx={48} cy={72} rx={6.6} ry={6} fill={p.altDeep} f={f} gloss={false} />
    </G>
  ),
  eyes: {
    box: [42, 68, 12, 6],
    el: (
      <G>
        <Ellipse cx={45.6} cy={71} rx={1.5} ry={2} fill={p.accent} />
        <Ellipse cx={50.4} cy={71} rx={1.5} ry={2} fill={p.accent} />
      </G>
    ),
  },
  flicker: (
    <G>
      <Path d="M18 82 Q34 62 50 26 Q66 62 82 82" stroke={p.deep} strokeWidth={0.5} fill="none" opacity={0.5} />
      {Array.from({ length: 11 }, (_, i) => {
        const tt = i / 10;
        const x = tt < 0.5 ? 18 + (50 - 18) * (tt * 2) : 50 + (82 - 50) * ((tt - 0.5) * 2);
        const y = tt < 0.5 ? 82 - (82 - 26) * Math.sin(tt * Math.PI) : 82 - (82 - 26) * Math.sin(tt * Math.PI);
        return <Glow key={i} x={r1(x)} y={r1(y + 2)} r={1.1} color={[p.accent, '#FF7EB6', '#7FD3FF'][i % 3]} />;
      })}
    </G>
  ),
  flickerOver: true,
});

/** A sticker: a bent glow stick, glowing, with a grin. */
const glowstick: Draw = (p, f) => {
  const tube = 'M32 82 C30 58 40 46 51 40 C62 34 69 28 66 18';
  return {
    ground: [50, 92, 18],
    back: (
      <G>
        <Ellipse cx={50} cy={50} rx={40} ry={40} fill={p.glow} opacity={0.12} />
        <Path d={tube} stroke={p.glow} strokeWidth={26} fill="none" strokeLinecap="round" opacity={0.16} />
      </G>
    ),
    pivot: [50, 50],
    sway: (
      <G>
        {/* Two glow bracelets spinning round it. */}
        <Ellipse cx={36} cy={66} rx={10} ry={3.4} stroke={p.alt} strokeWidth={2} fill="none" transform="rotate(-20 36 66)" />
        <Ellipse cx={64} cy={26} rx={9} ry={3} stroke={p.altDeep} strokeWidth={2} fill="none" transform="rotate(-30 64 26)" opacity={0.9} />
      </G>
    ),
    body: (
      <G>
        <Path d={tube} stroke={p.deep} strokeWidth={14} fill="none" strokeLinecap="round" />
        <Path d={tube} stroke={p.mid} strokeWidth={11} fill="none" strokeLinecap="round" />
        <Path d={tube} stroke={p.light} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.85} />
        {/* End caps. */}
        <V d="M26.6 80 L37.4 80 L37 88 Q32 90 27 88Z" fill={p.deep} f={f} />
        <V d="M60.6 19 L71.2 16.6 L70 9.6 Q65 8 61.2 10.4Z" fill={p.deep} f={f} />
        <Path d="M42 58 Q47 62 52 57" stroke={p.deep} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      </G>
    ),
    eyes: {
      box: [38, 46, 18, 8],
      el: (
        <G>
          <VEye x={42} y={50} r={2.8} f={f} />
          <VEye x={51.6} y={47} r={2.8} f={f} />
        </G>
      ),
    },
    flicker: sparkles(p.light, [
      [20, 40, 2],
      [82, 52, 2.4],
      [76, 78, 1.8],
    ]),
    flickerOver: true,
  };
};

/** A sticker: a glowing mushroom from the forest stage, spots alight and spores drifting. */
const glowshroom: Draw = (p, f) => ({
  ground: [50, 90, 26],
  back: <Ellipse cx={50} cy={46} rx={42} ry={36} fill={p.glow} opacity={0.16} />,
  body: (
    <G>
      {/* A little one beside it. */}
      <V d="M20 88 L20 78 Q20 76 22 76 L24 76 Q26 76 26 78 L26 88Z" fill={p.alt} f={f} />
      <V d="M13 78 C13 68 33 68 33 78 Q23 81 13 78Z" fill={p.mid} f={f} />
      {/* Its stem and cap. */}
      <V d="M40 88 C40 74 42 62 43 54 L57 54 C58 62 60 74 60 88 Q50 92 40 88Z" fill={p.alt} f={f} gloss={[45, 64, 1.6, 6, 0]} />
      <Path d="M22 50 Q50 62 78 50 Q50 56 22 50Z" fill={p.deep} />
      <V d="M18 50 C18 20 82 20 82 50 Q50 58 18 50Z" fill={p.mid} f={f} gloss={[36, 28, 9, 3, -18]} />
      <Path d="M44 78 Q50 82 56 78" stroke={p.altDeep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [42, 66, 16, 7],
    el: (
      <G>
        <VEye x={45.4} y={70} r={2.6} f={f} />
        <VEye x={54.6} y={70} r={2.6} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {(
        [
          [32, 36, 3.6],
          [50, 30, 4.4],
          [67, 38, 3.4],
          [42, 45, 2.4],
          [60, 46, 2.2],
          [23, 75, 1.8],
        ] as const
      ).map(([x, y, r], i) => (
        <G key={i}>
          <Circle cx={x} cy={y} r={r * 1.8} fill={p.accent} opacity={0.25} />
          <Circle cx={x} cy={y} r={r} fill={p.accent} />
          <Circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.35} fill="#FFFFFF" opacity={0.85} />
        </G>
      ))}
      {sparkles(p.accent, [
        [80, 20, 1.6],
        [16, 26, 1.2],
        [88, 64, 1.4],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** A sticker: a stack of speakers with a face, the tweeters for eyes and the woofer for a mouth, bass rolling out. */
const bassbin: Draw = (p, f) => ({
  ground: [50, 93, 28],
  back: (
    <G>
      <Ellipse cx={50} cy={54} rx={42} ry={38} fill={p.glow} opacity={0.14} />
      {[0, 1, 2].map((i) => (
        <G key={i} opacity={0.5 - i * 0.12}>
          <Path d={`M${18 - i * 6} ${40 - i * 4} Q${10 - i * 6} 56 ${18 - i * 6} ${72 + i * 4}`} stroke={p.accent} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <Path d={`M${82 + i * 6} ${40 - i * 4} Q${90 + i * 6} 56 ${82 + i * 6} ${72 + i * 4}`} stroke={p.accent} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </G>
      ))}
    </G>
  ),
  body: (
    <G>
      <V d="M24 22 Q24 16 30 16 L70 16 Q76 16 76 22 L76 88 Q76 92 72 92 L28 92 Q24 92 24 88Z" fill={p.deep} f={f} gloss={[32, 22, 6, 2, -10]} />
      <Path d="M24 50 L76 50" stroke={p.altDeep} strokeWidth={1.2} />
      {/* The woofer: its mouth. */}
      <VE cx={50} cy={70} rx={17} ry={17} fill={p.alt} f={f} gloss={false} />
      <Circle cx={50} cy={70} r={13} fill={p.mid} />
      <Circle cx={50} cy={70} r={8.4} fill={p.altDeep} />
      <Circle cx={50} cy={70} r={4.4} fill={p.alt} />
      <Ellipse cx={45} cy={64} rx={3} ry={1.6} fill="#FFFFFF" opacity={0.35} transform="rotate(-30 45 64)" />
      {/* Tweeter rims round the eyes. */}
      <Circle cx={39} cy={33} r={8} fill={p.alt} />
      <Circle cx={61} cy={33} r={8} fill={p.alt} />
    </G>
  ),
  eyes: {
    box: [30, 27, 40, 12],
    el: (
      <G>
        <VEye x={39} y={33} r={5.6} f={f} />
        <VEye x={61} y={33} r={5.6} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      <Circle cx={50} cy={70} r={17.5} stroke={p.accent} strokeWidth={1} fill="none" opacity={0.7} />
      <Circle cx={30} cy={86} r={1.2} fill={p.accent} />
    </G>
  ),
  flickerOver: true,
});

/** A sticker: a campfire with a face in its flames, logs crossed, embers rising into the night. */
const campfire: Draw = (p, f) => ({
  ground: [50, 91, 32],
  back: <Ellipse cx={50} cy={56} rx={44} ry={40} fill={p.glow} opacity={0.18} />,
  pivot: [50, 80],
  sway: (
    <G>
      {/* The flames, swaying a little. */}
      <V d="M50 14 C58 26 72 38 71 58 C70 74 60 82 50 82 C40 82 30 74 29 58 C28 44 38 34 42 24 C44 32 46 36 50 38 C50 30 49 22 50 14Z" fill={p.mid} f={f} gloss={[40, 42, 3, 9, -14]} />
      <Path d="M50 36 C57 44 63 52 62 63 C61 73 56 78 50 78 C44 78 39 73 38 63 C37 55 43 49 46 42 C47 47 48 49 50 50 C50 46 49 41 50 36Z" fill={p.light} />
      <Path d="M44 70 Q50 75 56 70" stroke={p.deep} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </G>
  ),
  body: (
    <G>
      {/* Stones round it. */}
      {(
        [
          [22, 86, 6, 4],
          [33, 90, 6.4, 4],
          [46, 92, 6.6, 4],
          [60, 92, 6.6, 4],
          [72, 89, 6.2, 4],
          [81, 84, 5.4, 3.6],
        ] as const
      ).map(([x, y, rx, ry], i) => (
        <VE key={i} cx={x} cy={y} rx={rx} ry={ry} fill={i % 2 ? p.altDeep : p.alt} f={f} gloss={false} />
      ))}
      {/* Two logs, crossed. */}
      <V d="M24 80 L74 70 Q78 70 78 74 Q78 78 74 78 L26 88 Q22 88 22 84 Q22 80 24 80Z" fill={p.alt} f={f} />
      <V d="M28 70 L76 80 Q80 81 79 85 Q78 88 74 87 L26 78 Q22 77 23 73 Q24 70 28 70Z" fill={p.altDeep} f={f} />
      <Circle cx={76} cy={74} r={2.6} fill={p.light} opacity={0.5} />
      <Circle cx={25} cy={74} r={2.6} fill={p.light} opacity={0.4} />
    </G>
  ),
  eyes: {
    box: [41, 58, 18, 8],
    el: (
      <G>
        <VEye x={45} y={62} r={2.8} f={f} />
        <VEye x={55} y={62} r={2.8} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {(
        [
          [34, 20, 1.4],
          [66, 14, 1.2],
          [58, 6, 1],
          [40, 8, 0.9],
          [76, 30, 1.1],
          [22, 34, 1],
        ] as const
      ).map(([x, y, r], i) => (
        <Glow key={i} x={x} y={y} r={r} color={i % 2 ? p.accent : p.mid} />
      ))}
    </G>
  ),
  flickerOver: true,
});

/** A sticker: the main stage, its screen for a face, lasers fanning out over the crowd. */
const mainstage: Draw = (p, f) => ({
  ground: [50, 92, 40],
  back: (
    <G>
      <Ellipse cx={50} cy={52} rx={46} ry={40} fill={p.glow} opacity={0.14} />
    </G>
  ),
  body: (
    <G>
      {/* The truss: an arch of steel. */}
      <V d="M12 88 L12 34 Q12 14 32 14 L68 14 Q88 14 88 34 L88 88 L80 88 L80 36 Q80 22 66 22 L34 22 Q20 22 20 36 L20 88Z" fill={p.mid} f={f} gloss={[30, 18, 8, 2, 0]} />
      {Array.from({ length: 6 }, (_, i) => (
        <Path key={i} d={`M12 ${40 + i * 8} L20 ${44 + i * 8} M80 ${44 + i * 8} L88 ${40 + i * 8}`} stroke={p.deep} strokeWidth={1} />
      ))}
      {/* The screen. */}
      <V d="M26 30 Q26 28 28 28 L72 28 Q74 28 74 30 L74 64 Q74 66 72 66 L28 66 Q26 66 26 64Z" fill={p.alt} f={f} />
      <Path d="M28 30 L72 30 L72 64 L28 64Z" fill={p.deep} opacity={0.55} />
      <Path d="M40 54 Q50 61 60 54" stroke={p.accent} strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* The deck, and the crowd's hands. */}
      <V d="M8 76 L92 76 L90 90 L10 90Z" fill={p.altDeep} f={f} />
      <Path d="M8 76 L92 76" stroke={p.light} strokeWidth={0.8} opacity={0.5} />
      {[18, 30, 44, 58, 70, 82].map((x, i) => (
        <Path key={x} d={`M${x} 94 L${x + (i % 2 ? 2 : -2)} ${84 - (i % 3) * 2}`} stroke={p.altDeep} strokeWidth={3} strokeLinecap="round" />
      ))}
    </G>
  ),
  eyes: {
    box: [36, 38, 28, 10],
    el: (
      <G>
        <VEye x={41} y={44} r={4} f={f} />
        <VEye x={59} y={44} r={4} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* Lights on the truss, beaming down across the screen's edges. */}
      {[
        [26, 22, 8, 74],
        [26, 22, 22, 78],
        [74, 22, 92, 74],
        [74, 22, 78, 78],
        [50, 22, 36, 78],
        [50, 22, 64, 78],
      ].map(([x0, y0, x1, y1], i) => (
        <Path key={i} d={`M${x0} ${y0} L${x1} ${y1}`} stroke={i % 2 ? p.accent : p.light} strokeWidth={0.8} strokeLinecap="round" opacity={0.55} />
      ))}
      {[26, 50, 74].map((x, i) => (
        <G key={x}>
          <Circle cx={x} cy={22} r={3.4} fill={i === 1 ? p.light : p.accent} opacity={0.3} />
          <Circle cx={x} cy={22} r={1.8} fill={i === 1 ? p.light : p.accent} />
        </G>
      ))}
    </G>
  ),
  flickerOver: true,
});

/** A sticker: a bubble with a face, blown from a wand, little bubbles drifting off in rainbow sheen. */
const bubbles: Draw = (p, f) => ({
  ground: [50, 92, 18],
  back: <Ellipse cx={50} cy={46} rx={42} ry={40} fill={p.glow} opacity={0.14} />,
  body: (
    <G>
      {/* The wand. */}
      <Path d="M58 74 L72 92" stroke={p.altDeep} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={54} cy={68} r={8} stroke={p.alt} strokeWidth={3} fill="none" />
      {/* The big bubble. */}
      <Circle cx={46} cy={42} r={30} fill={p.mid} opacity={0.32} />
      <Circle cx={46} cy={42} r={30} stroke={p.light} strokeWidth={1.4} fill="none" opacity={0.9} />
      <Path d="M22 36 A26 26 0 0 1 40 16" stroke="#FFFFFF" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.75} />
      <Path d="M70 50 A26 26 0 0 1 56 68" stroke={p.alt} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.6} />
      <Path d="M64 24 A26 26 0 0 1 72 38" stroke={p.accent} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.7} />
      <Path d="M40 52 Q46 57 52 52" stroke={p.deep} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [36, 38, 20, 8],
    el: (
      <G>
        <VEye x={40} y={42} r={3.2} f={f} />
        <VEye x={52} y={42} r={3.2} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {(
        [
          [80, 20, 6],
          [86, 42, 4],
          [16, 74, 5],
          [26, 88, 3],
          [74, 10, 3],
        ] as const
      ).map(([x, y, r], i) => (
        <G key={i}>
          <Circle cx={x} cy={y} r={r} fill={p.mid} opacity={0.25} stroke={i % 2 ? p.alt : p.light} strokeWidth={0.8} />
          <Circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.25} fill="#FFFFFF" opacity={0.8} />
        </G>
      ))}
    </G>
  ),
  flickerOver: true,
});

/** A sticker: a mixtape, its reels for eyes and a hand-written label, tape spilling out in a loop. */
const mixtape: Draw = (p, f) => ({
  ground: [50, 86, 36],
  back: <Ellipse cx={50} cy={52} rx={44} ry={36} fill={p.glow} opacity={0.14} />,
  body: (
    <G>
      {/* Tape spilling out of the bottom. */}
      <Path d="M30 78 C24 90 40 96 48 88 C54 82 66 90 74 84" stroke={p.altDeep} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      {/* The shell. */}
      <V d="M12 26 Q12 20 18 20 L82 20 Q88 20 88 26 L88 74 Q88 80 82 80 L18 80 Q12 80 12 74Z" fill={p.alt} f={f} gloss={[24, 24, 10, 2, 0]} />
      {/* The label. */}
      <Path d="M18 26 L82 26 L82 62 L18 62Z" fill={p.light} />
      <Path d="M18 30 L82 30" stroke={p.mid} strokeWidth={2.4} />
      <Path d="M18 58 L82 58" stroke={p.accent} strokeWidth={2.4} />
      <Path d="M24 36 Q32 33 40 36" stroke={p.deep} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      {/* The window, with the reels. */}
      <V d="M28 40 Q28 38 30 38 L70 38 Q72 38 72 40 L72 54 Q72 56 70 56 L30 56 Q28 56 28 54Z" fill={p.altDeep} f={f} />
      <Circle cx={38} cy={47} r={6.6} fill={p.deep} />
      <Circle cx={62} cy={47} r={6.6} fill={p.deep} />
      {/* The bottom, with its holes and screws. */}
      <V d="M26 80 L32 68 L68 68 L74 80Z" fill={p.altDeep} f={f} />
      <Circle cx={40} cy={74} r={1.6} fill={p.alt} />
      <Circle cx={60} cy={74} r={1.6} fill={p.alt} />
      {[
        [16, 24],
        [84, 24],
        [16, 76],
        [84, 76],
      ].map(([x, y]) => (
        <Circle key={`${x}${y}`} cx={x} cy={y} r={1.2} fill={p.light} opacity={0.7} />
      ))}
      <Path d="M44 63.6 Q50 66.4 56 63.6" stroke={p.deep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [32, 41, 36, 12],
    el: (
      <G>
        <VEye x={38} y={47} r={4.2} f={f} />
        <VEye x={62} y={47} r={4.2} f={f} />
      </G>
    ),
  },
  flicker: sparkles(p.accent, [
    [8, 14, 2],
    [92, 12, 1.6],
    [90, 88, 1.8],
  ]),
  flickerOver: true,
});

/** A five-pointed star path round (x, y). */
const star5 = (x: number, y: number, r: number, inner = r * 0.45) =>
  `${Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? inner : r;
    return `${i ? 'L' : 'M'}${r1(x + Math.cos(a) * rr)} ${r1(y + Math.sin(a) * rr)}`;
  }).join(' ')}Z`;

/** HARDWELL: the Spaceman — a little astronaut, stars in its visor, a ringed planet behind. */
const spaceman: Draw = (p, f) => ({
  ground: [50, 94, 22],
  back: (
    <G>
      <Ellipse cx={50} cy={50} rx={42} ry={40} fill={p.glow} opacity={0.14} />
      {/* A ringed planet. */}
      <Circle cx={80} cy={20} r={7} fill={p.alt} />
      <Ellipse cx={80} cy={20} rx={12} ry={3} fill="none" stroke={p.glow} strokeWidth={1.2} transform="rotate(-20 80 20)" />
      {/* The backpack. */}
      <V d="M26 58 Q26 54 30 54 L70 54 Q74 54 74 58 L74 82 L26 82Z" fill={p.deep} f={f} />
    </G>
  ),
  body: (
    <G>
      {/* Arms, the suit and its chest panel. */}
      <V d="M33 62 Q22 66 22 78 Q24 82 28 80 Q28 70 35 68Z" fill={p.mid} f={f} />
      <V d="M67 62 Q78 66 78 78 Q76 82 72 80 Q72 70 65 68Z" fill={p.mid} f={f} />
      <V d="M32 90 L32 64 Q32 56 42 56 L58 56 Q68 56 68 64 L68 90 Q68 92 66 92 L34 92 Q32 92 32 90Z" fill={p.mid} f={f} gloss={[38, 64, 3, 8, 0]} />
      <Path d="M41 66 Q41 64 43 64 L57 64 Q59 64 59 66 L59 75 Q59 77 57 77 L43 77 Q41 77 41 75Z" fill={p.deep} />
      <Circle cx={45} cy={70.5} r={1.6} fill={p.accent} />
      <Circle cx={50} cy={70.5} r={1.6} fill={p.glow} />
      <Circle cx={55} cy={70.5} r={1.6} fill={p.light} />
      <Path d="M32 83 L68 83" stroke={p.alt} strokeWidth={3} />
      {/* The helmet, its antenna and the visor. */}
      <Path d="M64 20 L71 11" stroke={p.deep} strokeWidth={1.4} strokeLinecap="round" />
      <VE cx={50} cy={36} rx={23} ry={22} fill={p.light} f={f} />
      <V d="M32 37 C32 25 40 21 50 21 C60 21 68 25 68 37 C68 48 60 52 50 52 C40 52 32 48 32 37Z" fill={p.altDeep} f={f} gloss={[41, 27, 6, 2, -20]} />
      <Path d="M37 31 Q42 24.5 50 23.4" stroke={p.glow} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.7} />
      <Circle cx={60} cy={28} r={0.7} fill={p.light} />
      <Circle cx={38} cy={46} r={0.6} fill={p.light} />
      <Path d="M45 44 Q50 47.6 55 44" stroke={p.glow} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 33, 20, 8],
    el: (
      <G>
        <VEye x={44.5} y={37} r={3} f={f} />
        <VEye x={55.5} y={37} r={3} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      <Glow x={71} y={10} r={1.6} color={p.accent} />
      {sparkles(p.light, [
        [12, 22, 2],
        [16, 62, 1.5],
        [88, 52, 1.8],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** ALOK: the Toucan — a toucan side on, its big beak in sunset colours, palm leaves behind. */
const toucan: Draw = (p, f) => ({
  ground: [46, 93, 22],
  back: (
    <G>
      <Ellipse cx={50} cy={50} rx={42} ry={40} fill={p.glow} opacity={0.14} />
      <Path d="M8 34 C20 20 36 18 44 24 C34 26 22 32 8 34Z M10 46 C18 38 28 36 34 40 C26 42 18 44 10 46Z" fill={p.glow} opacity={0.3} />
      <Path d="M92 66 C84 56 74 54 66 58 C74 60 84 64 92 66Z" fill={p.glow} opacity={0.3} />
    </G>
  ),
  body: (
    <G>
      {/* Tail, body, its bright throat and wing. */}
      <V d="M40 80 L34 94 Q38 96 44 92 L48 82Z" fill={p.mid} f={f} />
      <V d="M34 82 C26 66 28 46 42 38 C56 32 68 42 68 58 C68 74 60 86 48 88 C42 88 37 86 34 82Z" fill={p.mid} f={f} gloss={[42, 48, 4, 8, -20]} />
      <V d="M40 42 C48 38 56 42 57 50 C56 58 48 62 41 58 C37 54 36 46 40 42Z" fill={p.accent} f={f} />
      <V d="M50 52 C62 54 68 66 64 82 C56 78 50 68 50 52Z" fill={p.deep} f={f} />
      <Path d="M44 88 L42 93 M50 88 L52 93" stroke={p.alt} strokeWidth={1.6} strokeLinecap="round" />
      {/* The head, the ring round its eye, and the beak. */}
      <VE cx={44} cy={32} rx={14} ry={13} fill={p.mid} f={f} />
      <Circle cx={48} cy={30} r={5.4} fill={p.glow} />
      <V d="M55 24 C67 16 84 18 92 31 C89 38 76 40 58 39 C54 35 53 28 55 24Z" fill={p.alt} f={f} gloss={[68, 23, 8, 1.6, 8]} />
      <Path d="M84 22 C88 25 91 28 92 31 C89 34 86 36 83 37 C85 32 85 27 84 22Z" fill={p.altDeep} />
      <Path d="M57 33 C69 35 81 34 92 31" stroke={p.altDeep} strokeWidth={1} fill="none" opacity={0.6} />
      <Path d="M60 21.6 C69 18 78 19 84 22" stroke={p.accent} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.7} />
    </G>
  ),
  eyes: { box: [44, 26, 8, 8], el: <VEye x={48} y={30} r={3.2} f={f} /> },
  flicker: sparkles(p.accent, [
    [16, 12, 2],
    [86, 70, 1.6],
    [18, 72, 1.4],
  ]),
  flickerOver: true,
});

/** ALESSO: the Hero — a little hero in a mask, hands on hips, cape in the wind, a star on its chest. */
const hero: Draw = (p, f) => ({
  ground: [50, 93, 22],
  back: <Ellipse cx={50} cy={50} rx={42} ry={40} fill={p.glow} opacity={0.15} />,
  pivot: [50, 52],
  sway: <V d="M36 52 C30 64 24 80 18 90 C32 88 44 90 50 86 C56 90 68 88 82 90 C76 80 70 64 64 52Z" fill={p.alt} f={f} />,
  body: (
    <G>
      {/* Legs and boots. */}
      <V d="M40 78 L40 90 Q40 92 42 92 L47 92 L47 78Z" fill={p.deep} f={f} />
      <V d="M53 78 L53 92 L58 92 Q60 92 60 90 L60 78Z" fill={p.deep} f={f} />
      {/* Arms bent to the hips, the suit, belt and star. */}
      <Path d="M38 57 Q31 62 34 68 M62 57 Q69 62 66 68" stroke={p.mid} strokeWidth={5} fill="none" strokeLinecap="round" />
      <V d="M36 56 Q36 50 42 50 L58 50 Q64 50 64 56 L62 80 L38 80Z" fill={p.mid} f={f} gloss={[42, 56, 3, 6, 0]} />
      <VE cx={34} cy={68} rx={3.4} ry={3.4} fill={p.light} f={f} />
      <VE cx={66} cy={68} rx={3.4} ry={3.4} fill={p.light} f={f} />
      <Path d="M38.4 73 L61.6 73" stroke={p.accent} strokeWidth={2.4} />
      <Path d={star5(50, 61.5, 6)} fill={p.accent} />
      {/* Head, hair and mask. */}
      <VE cx={50} cy={36} rx={13} ry={13} fill={p.light} f={f} />
      <V d="M37 33 C37 22 44 20 50 20 C58 20 64 24 63 33 C58 27 52 26 46 28 C42 29 39 31 37 33Z" fill={p.deep} f={f} />
      <Path d="M37.6 33 Q44 29 50 33 Q56 29 62.4 33 Q62.4 39 56 39 Q52 39 50 36.4 Q48 39 44 39 Q37.6 39 37.6 33Z" fill={p.altDeep} />
      <Path d="M46 43 Q50 46 54 43" stroke={p.deep} strokeWidth={1.3} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 31, 20, 7],
    el: (
      <G>
        <VEye x={44.5} y={34.6} r={2.3} f={f} />
        <VEye x={55.5} y={34.6} r={2.3} f={f} />
      </G>
    ),
  },
  flicker: sparkles(p.accent, [
    [16, 24, 2],
    [84, 20, 1.8],
    [86, 66, 1.5],
  ]),
  flickerOver: true,
});

/** BOOGIE T: the Gumbo pot — a pot of gumbo bubbling away, a crawfish peeking over the rim. */
const gumbo: Draw = (p, f) => ({
  ground: [50, 92, 32],
  back: <Ellipse cx={50} cy={56} rx={42} ry={38} fill={p.glow} opacity={0.15} />,
  body: (
    <G>
      {/* The crawfish, claws up over the rim. */}
      <V d="M50 50 C44 42 41 34 45 29 C47 33 49 35 51 35 C49 31 51 27 55 26 C55 33 54 40 54 50Z" fill={p.altDeep} f={f} />
      <Path d="M62 44 Q66 30 75 22 M58 44 Q60 32 65 23" stroke={p.altDeep} strokeWidth={1} fill="none" strokeLinecap="round" />
      <VE cx={61} cy={48} rx={8} ry={6} fill={p.altDeep} f={f} />
      <Circle cx={58.6} cy={46} r={1} fill={INK} />
      <Circle cx={63.4} cy={46} r={1} fill={INK} />
      {/* Handles, the pot and its rim, the gumbo. */}
      <Path d="M21 58 Q12 58 12 64 Q12 70 21 70 M79 58 Q88 58 88 64 Q88 70 79 70" stroke={p.mid} strokeWidth={3} fill="none" strokeLinecap="round" />
      <V d="M20 52 L80 52 L76 82 Q74 90 64 90 L36 90 Q26 90 24 82Z" fill={p.mid} f={f} gloss={[28, 62, 3, 9, 0]} />
      <VE cx={50} cy={52} rx={32} ry={6} fill={p.mid} f={f} gloss={false} />
      <Ellipse cx={50} cy={52} rx={28} ry={4.2} fill={p.alt} />
      <Circle cx={34} cy={51.4} r={1.6} fill={p.accent} opacity={0.85} />
      <Circle cx={42} cy={53} r={1.1} fill={p.accent} opacity={0.85} />
      <Circle cx={70} cy={52} r={1.3} fill={p.accent} opacity={0.85} />
      <Circle cx={36} cy={74} r={2.4} fill={p.alt} opacity={0.4} />
      <Circle cx={64} cy={74} r={2.4} fill={p.alt} opacity={0.4} />
      <Path d="M45 76 Q50 80 55 76" stroke={p.light} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [37, 64, 26, 8],
    el: (
      <G>
        <VEye x={42} y={68} r={3.2} f={f} />
        <VEye x={58} y={68} r={3.2} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* Steam, and a bubble popping. */}
      <Path d="M30 44 Q26 36 31 30 Q36 24 32 16 M40 42 Q37 36 41 31" stroke={p.light} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.55} />
      <Glow x={36} y={47} r={1.3} color={p.accent} />
      {sparkles(p.accent, [
        [86, 30, 1.8],
        [14, 84, 1.4],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** ADVENTURE CLUB: the Balloon — a hot-air balloon with a smile, its basket ready, drifting past clouds. */
const balloon: Draw = (p, f) => ({
  ground: [50, 96, 16],
  back: (
    <G>
      <Ellipse cx={50} cy={44} rx={42} ry={40} fill={p.glow} opacity={0.14} />
      {/* Clouds drifting by. */}
      <Path d="M8 70 Q8 64 14 64 Q16 58 22 60 Q28 58 28 64 Q32 66 30 70Z" fill={p.light} opacity={0.22} />
      <Path d="M70 84 Q70 80 74 80 Q76 76 80 78 Q86 76 86 80 Q90 82 88 84Z" fill={p.light} opacity={0.18} />
    </G>
  ),
  body: (
    <G>
      {/* The envelope and its stripes. */}
      <V d="M50 8 C72 8 84 24 84 40 C84 56 70 66 60 72 L40 72 C30 66 16 56 16 40 C16 24 28 8 50 8Z" fill={p.mid} f={f} gloss={[32, 22, 6, 9, -30]} />
      <Path d="M50 8 C41 20 39 50 44 72 L56 72 C61 50 59 20 50 8Z" fill={p.alt} opacity={0.95} />
      <Path d="M27 17 C19 32 22 55 34 68 L38 70 C30 54 29 34 33 13Z M73 17 C81 32 78 55 66 68 L62 70 C70 54 71 34 67 13Z" fill={p.alt} opacity={0.95} />
      <Path d="M40 72 L60 72" stroke={p.accent} strokeWidth={3} strokeLinecap="round" />
      {/* Ropes and the basket. */}
      <Path d="M41.6 73 L43.6 82 M58.4 73 L56.4 82" stroke={p.light} strokeWidth={0.8} />
      <V d="M40 82 L60 82 L58 92 Q58 94 56 94 L44 94 Q42 94 42 92Z" fill={p.altDeep} f={f} />
      <Path d="M41 86 L59 86 M41.6 89.6 L58.4 89.6 M46 82 L46.6 94 M54 82 L53.4 94" stroke={p.deep} strokeWidth={0.6} opacity={0.4} />
      <Circle cx={37} cy={50} r={2.6} fill={p.light} opacity={0.35} />
      <Circle cx={63} cy={50} r={2.6} fill={p.light} opacity={0.35} />
      <Path d="M45 51 Q50 55 55 51" stroke={p.deep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [39, 40, 22, 8],
    el: (
      <G>
        <VEye x={43.5} y={44} r={3} f={f} />
        <VEye x={56.5} y={44} r={3} f={f} />
      </G>
    ),
  },
  flicker: sparkles(p.accent, [
    [12, 20, 2],
    [88, 30, 1.6],
    [90, 62, 1.4],
  ]),
  flickerOver: true,
});

/** PEEKABOO: the Peekaboo — a little creature peeking over a speaker, paws on the edge. */
const peeker: Draw = (p, f) => ({
  ground: [50, 93, 36],
  back: <Ellipse cx={50} cy={50} rx={42} ry={40} fill={p.glow} opacity={0.15} />,
  body: (
    <G>
      {/* Ears, then the head peeking up. */}
      <V d="M30 38 C25 27 29 20 36 22 C38 26 39 31 37 38Z" fill={p.mid} f={f} />
      <V d="M70 38 C75 27 71 20 64 22 C62 26 61 31 63 38Z" fill={p.mid} f={f} />
      <Path d="M31.6 34 C29.6 28 31 24 34.4 25" stroke={p.accent} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.6} />
      <Path d="M68.4 34 C70.4 28 69 24 65.6 25" stroke={p.accent} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.6} />
      <VE cx={50} cy={48} rx={22} ry={18} fill={p.mid} f={f} />
      {/* The speaker it hides behind. */}
      <V d="M14 56 L86 56 Q88 56 88 58 L88 92 L12 92 L12 58 Q12 56 14 56Z" fill={p.alt} f={f} />
      <Path d="M14 60.4 L86 60.4" stroke={p.altDeep} strokeWidth={1} />
      {[32, 68].map((x) => (
        <G key={x}>
          <Circle cx={x} cy={76} r={10.4} fill={p.altDeep} />
          <Circle cx={x} cy={76} r={6.4} fill={p.alt} />
          <Circle cx={x} cy={76} r={2.4} fill={p.accent} opacity={0.8} />
        </G>
      ))}
      {/* Paws over the edge. */}
      <VE cx={37} cy={56} rx={5.4} ry={3.6} fill={p.mid} f={f} />
      <VE cx={63} cy={56} rx={5.4} ry={3.6} fill={p.mid} f={f} />
      <Path d="M35 56.4 L35 58.4 M39 56.4 L39 58.4 M61 56.4 L61 58.4 M65 56.4 L65 58.4" stroke={p.deep} strokeWidth={0.7} strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [37, 40, 26, 9],
    el: (
      <G>
        <VEye x={43} y={44.5} r={3.6} f={f} />
        <VEye x={57} y={44.5} r={3.6} f={f} />
      </G>
    ),
  },
  flicker: sparkles(p.accent, [
    [14, 22, 2],
    [86, 18, 1.6],
    [90, 46, 1.4],
  ]),
  flickerOver: true,
});

/** HABSTRAKT: the Croissant — a croissant in a beret, fresh from Paris. */
const croissant: Draw = (p, f) => ({
  ground: [50, 86, 34],
  back: <Ellipse cx={50} cy={60} rx={42} ry={34} fill={p.glow} opacity={0.15} />,
  body: (
    <G>
      {/* Its segments, tips curling down, the middle one plumpest. */}
      <VE cx={19} cy={76} rx={7.6} ry={5.6} fill={p.mid} f={f} turn={-50} gloss={false} />
      <VE cx={81} cy={76} rx={7.6} ry={5.6} fill={p.mid} f={f} turn={50} gloss={false} />
      <VE cx={32} cy={68} rx={11} ry={9} fill={p.mid} f={f} turn={-28} />
      <VE cx={68} cy={68} rx={11} ry={9} fill={p.mid} f={f} turn={28} />
      <VE cx={50} cy={63} rx={15} ry={12} fill={p.mid} f={f} />
      <Path d="M38 58 C44 54 56 54 62 58" stroke={p.light} strokeWidth={1.2} fill="none" opacity={0.6} strokeLinecap="round" />
      {/* The beret. */}
      <V d="M38 54 C35 46 43 41 52 41 C63 41 67 47 63 54 C56 51.6 45 51.6 38 54Z" fill={p.alt} f={f} />
      <Path d="M52 41 L53 37" stroke={p.alt} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={41} cy={67} r={2.2} fill={p.accent} opacity={0.4} />
      <Circle cx={59} cy={67} r={2.2} fill={p.accent} opacity={0.4} />
      <Path d="M46 68 Q50 71 54 68" stroke={p.deep} strokeWidth={1.3} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 58, 20, 8],
    el: (
      <G>
        <VEye x={44.5} y={62.4} r={2.8} f={f} />
        <VEye x={55.5} y={62.4} r={2.8} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* Crumbs, and a little sparkle. */}
      <Circle cx={22} cy={88} r={0.9} fill={p.light} />
      <Circle cx={80} cy={89} r={0.8} fill={p.light} />
      <Circle cx={30} cy={91} r={0.6} fill={p.light} />
      {sparkles(p.accent, [
        [18, 30, 2],
        [84, 36, 1.6],
        [70, 18, 1.4],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** AFROJACK: the Jack-in-the-box — sprung out of its box, a jester's hat with bells. */
const jackbox: Draw = (p, f) => ({
  ground: [50, 93, 30],
  back: <Ellipse cx={50} cy={52} rx={42} ry={40} fill={p.glow} opacity={0.15} />,
  body: (
    <G>
      {/* The open lid, the spring and the box with its crank. */}
      <V d="M24 62 L18 50 L70 50 L76 62Z" fill={p.altDeep} f={f} />
      <Path d="M50 62 L44 59 L56 55 L44 51 L56 47 L50 44" stroke={p.light} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <V d="M24 62 L76 62 L76 90 Q76 92 74 92 L26 92 Q24 92 24 90Z" fill={p.alt} f={f} gloss={[30, 68, 3, 8, 0]} />
      <Path d={`${star5(38, 77, 5)} ${star5(62, 77, 5)}`} fill={p.mid} />
      <Path d="M76 77 L84 77 L84 70" stroke={p.deep} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Circle cx={84} cy={69} r={2.2} fill={p.mid} />
      {/* The jester: face, cheeks and nose, then the hat. */}
      <VE cx={50} cy={34} rx={14} ry={13} fill={p.light} f={f} />
      <Circle cx={41.6} cy={38} r={2.2} fill={p.mid} opacity={0.45} />
      <Circle cx={58.4} cy={38} r={2.2} fill={p.mid} opacity={0.45} />
      <VE cx={50} cy={37} rx={2.4} ry={2.2} fill={p.mid} f={f} />
      <Path d="M45 41 Q50 45 55 41" stroke={p.deep} strokeWidth={1.3} fill="none" strokeLinecap="round" />
      <V d="M36 29 L28 13 L43 22 L50 8 L57 22 L72 13 L64 29 Q50 24 36 29Z" fill={p.mid} f={f} />
      <Path d="M50 8 L57 22 L64 29 Q57 26.6 50 26" fill={p.deep} opacity={0.25} />
    </G>
  ),
  eyes: {
    box: [41, 29, 18, 8],
    el: (
      <G>
        <VEye x={45} y={32.6} r={2.6} f={f} />
        <VEye x={55} y={32.6} r={2.6} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* Bells on the hat. */}
      <Glow x={28} y={13} r={1.8} color={p.accent} />
      <Glow x={50} y={8} r={1.8} color={p.accent} />
      <Glow x={72} y={13} r={1.8} color={p.accent} />
      {sparkles(p.accent, [
        [12, 40, 1.6],
        [90, 44, 1.6],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** ARTBAT: the Bat — a little bat flapping by the moon, fangs and all. */
const bat: Draw = (p, f) => ({
  ground: [50, 90, 16],
  back: (
    <G>
      <Ellipse cx={50} cy={50} rx={42} ry={40} fill={p.glow} opacity={0.15} />
      <Circle cx={76} cy={22} r={9} fill={p.light} opacity={0.22} />
    </G>
  ),
  pivot: [50, 50],
  flap: true,
  sway: (
    <G>
      <V d="M38 46 C28 36 14 34 6 40 C10 44 12 48 12 53 C16 50 20 52 22 57 C26 53 30 55 34 59Z" fill={p.alt} f={f} />
      <V d="M62 46 C72 36 86 34 94 40 C90 44 88 48 88 53 C84 50 80 52 78 57 C74 53 70 55 66 59Z" fill={p.alt} f={f} />
      <Path d="M36 47 L20 42 M36 50 L16 50 M62 47 L80 42 M64 50 L84 50" stroke={p.deep} strokeWidth={0.8} opacity={0.6} strokeLinecap="round" />
    </G>
  ),
  body: (
    <G>
      <V d="M37 42 L35 24 L46 36Z" fill={p.mid} f={f} />
      <V d="M63 42 L65 24 L54 36Z" fill={p.mid} f={f} />
      <Path d="M38.6 38 L37.6 29 L43 35Z M61.4 38 L62.4 29 L57 35Z" fill={p.accent} opacity={0.5} />
      <VE cx={50} cy={54} rx={17} ry={19} fill={p.mid} f={f} />
      <Ellipse cx={50} cy={63} rx={9} ry={8} fill={p.light} opacity={0.18} />
      <Path d="M45 57.4 Q50 60.6 55 57.4" stroke={p.deep} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Path d="M47.2 58.4 L48.2 61.4 L49.2 58.8Z M50.8 58.8 L51.8 61.4 L52.8 58.4Z" fill={p.light} />
      <Path d="M45 72 L44 77 M55 72 L56 77" stroke={p.deep} strokeWidth={1.4} strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [39, 46, 22, 8],
    el: (
      <G>
        <VEye x={44} y={50} r={3.2} f={f} iris={p.accent} />
        <VEye x={56} y={50} r={3.2} f={f} iris={p.accent} />
      </G>
    ),
  },
  flicker: sparkles(p.accent, [
    [14, 18, 1.8],
    [88, 70, 1.6],
    [16, 74, 1.4],
  ]),
  flickerOver: true,
});

/** I HATE MODELS: the Black rose — dark petals edged in red light, thorns on its stem. */
const rose: Draw = (p, f) => ({
  ground: [50, 92, 16],
  back: <Ellipse cx={50} cy={46} rx={40} ry={38} fill={p.glow} opacity={0.16} />,
  body: (
    <G>
      {/* Stem, thorns and a leaf. */}
      <Path d="M50 91 C48 80 52 70 50 58" stroke={p.alt} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M49 82 L45 80 L49 79Z M51 72 L55 70 L51 69Z" fill={p.altDeep} />
      <V d="M50 80 C40 78 34 72 32 64 C40 66 46 72 50 76Z" fill={p.alt} f={f} />
      {/* The bloom, its edges lit. */}
      <V d="M28 40 C26 26 36 18 50 18 C64 18 74 26 72 40 C72 54 62 62 50 62 C38 62 28 54 28 40Z" fill={p.mid} f={f} gloss={[38, 28, 5, 2, -20]} />
      <Path d="M28 40 C26 26 36 18 50 18 C64 18 74 26 72 40 C72 54 62 62 50 62 C38 62 28 54 28 40Z" fill="none" stroke={p.accent} strokeWidth={1} opacity={0.65} />
      <Path d="M36 30 C41 23 59 23 64 30" stroke={p.accent} strokeWidth={1} fill="none" opacity={0.8} strokeLinecap="round" />
      <Path d="M33 42 C33 51 41 57 50 57 C59 57 67 51 67 42" stroke={p.accent} strokeWidth={0.9} fill="none" opacity={0.55} strokeLinecap="round" />
      <Path d="M43 33 C45 28.6 55 28.6 57 33 C57 36.4 53 37.6 50 36" stroke={p.accent} strokeWidth={0.9} fill="none" opacity={0.75} strokeLinecap="round" />
      <Path d="M45 49 Q50 52.4 55 49" stroke={p.accent} strokeWidth={1.3} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 40, 20, 8],
    el: (
      <G>
        <VEye x={44.5} y={44} r={2.7} f={f} />
        <VEye x={55.5} y={44} r={2.7} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* A petal falling. */}
      <Path d="M76 70 C80 66 86 68 84 72 C82 76 76 76 76 70Z" fill={p.accent} opacity={0.8} />
      {sparkles(p.accent, [
        [18, 18, 1.8],
        [84, 24, 1.6],
        [16, 70, 1.4],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** A sticker for the silent disco: a little blob in big headphones, their cups glowing, singing along. */
const silentdisco: Draw = (p, f) => ({
  ground: [50, 90, 26],
  back: <Ellipse cx={50} cy={54} rx={42} ry={38} fill={p.glow} opacity={0.15} />,
  body: (
    <G>
      <VE cx={50} cy={60} rx={24} ry={24} fill={p.mid} f={f} />
      {/* The headphones: the band over its head, a cup either side, lit. */}
      <Path d="M25 56 C25 20 75 20 75 56" stroke={p.alt} strokeWidth={5} fill="none" strokeLinecap="round" />
      <Path d="M30 40 C36 30 64 30 70 40" stroke={p.light} strokeWidth={1} fill="none" opacity={0.35} strokeLinecap="round" />
      <VE cx={25} cy={60} rx={8.4} ry={12.4} fill={p.alt} f={f} />
      <VE cx={75} cy={60} rx={8.4} ry={12.4} fill={p.alt} f={f} />
      <Ellipse cx={23.4} cy={60} rx={4} ry={8} fill={p.accent} opacity={0.85} />
      <Ellipse cx={76.6} cy={60} rx={4} ry={8} fill={p.accent} opacity={0.85} />
      <Circle cx={40} cy={68} r={2.4} fill={p.light} opacity={0.3} />
      <Circle cx={60} cy={68} r={2.4} fill={p.light} opacity={0.3} />
      {/* Singing along. */}
      <Ellipse cx={50} cy={70} rx={3} ry={3.6} fill={p.altDeep} />
    </G>
  ),
  eyes: {
    box: [40, 54, 20, 8],
    el: (
      <G>
        <VEye x={44} y={58} r={3} f={f} />
        <VEye x={56} y={58} r={3} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* The other channel lighting up, and notes only it can hear. */}
      <Ellipse cx={23.4} cy={60} rx={4} ry={8} fill={p.glow} />
      <Ellipse cx={76.6} cy={60} rx={4} ry={8} fill={p.glow} />
      <Path d="M84 30 L84 22 L89 20.6 L89 28" stroke={p.accent} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Circle cx={83} cy={30} r={1.7} fill={p.accent} />
      <Circle cx={88} cy={28.4} r={1.7} fill={p.accent} />
      <Path d="M14 26 L14 19" stroke={p.glow} strokeWidth={1.2} strokeLinecap="round" />
      <Circle cx={13} cy={26.4} r={1.7} fill={p.glow} />
    </G>
  ),
  flickerOver: true,
});

/** A sticker for the shuttle stop: a festival bus head on, headlights for cheeks, its sign lit. */
const shuttle: Draw = (p, f) => ({
  ground: [50, 94, 30],
  back: <Ellipse cx={50} cy={52} rx={42} ry={40} fill={p.glow} opacity={0.14} />,
  body: (
    <G>
      {/* Wheels and mirrors, then the bus. */}
      <V d="M26 84 L36 84 L36 90 Q36 93 33 93 L29 93 Q26 93 26 90Z" fill={p.altDeep} f={f} />
      <V d="M64 84 L74 84 L74 90 Q74 93 71 93 L67 93 Q64 93 64 90Z" fill={p.altDeep} f={f} />
      <Path d="M22 30 L16 30 L16 40 M78 30 L84 30 L84 40" stroke={p.altDeep} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <V d="M22 20 Q22 12 30 12 L70 12 Q78 12 78 20 L78 82 Q78 86 74 86 L26 86 Q22 86 22 82Z" fill={p.mid} f={f} gloss={[28, 30, 3, 9, 0]} />
      {/* The sign, the windscreen, bumper and smile. */}
      <Path d="M34 15 L66 15 Q67.4 15 67.4 16.4 L67.4 19.6 Q67.4 21 66 21 L34 21 Q32.6 21 32.6 19.6 L32.6 16.4 Q32.6 15 34 15Z" fill={p.altDeep} />
      {[40, 45, 50, 55, 60].map((x) => (
        <Circle key={x} cx={x} cy={18} r={1} fill={p.accent} />
      ))}
      <V d="M27 26 L73 26 L71 54 L29 54Z" fill={p.alt} f={f} gloss={[60, 32, 8, 1.4, -30]} />
      <Path d="M52 52 L66 28" stroke={p.light} strokeWidth={1.4} opacity={0.18} />
      <Path d="M30 72 L70 72 Q72 72 72 74 L72 77 Q72 79 70 79 L30 79 Q28 79 28 77 L28 74 Q28 72 30 72Z" fill={p.deep} />
      <VE cx={31} cy={65} rx={4} ry={4} fill={p.light} f={f} />
      <VE cx={69} cy={65} rx={4} ry={4} fill={p.light} f={f} />
      <Path d="M42 61 Q50 67 58 61" stroke={p.deep} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [37, 36, 26, 9],
    el: (
      <G>
        <VEye x={43} y={40.4} r={3.4} f={f} />
        <VEye x={57} y={40.4} r={3.4} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      <Glow x={31} y={65} r={1.6} color={p.light} />
      <Glow x={69} y={65} r={1.6} color={p.light} />
      {sparkles(p.accent, [
        [12, 16, 1.8],
        [90, 60, 1.5],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** A sticker for the chill zone: a sleepy blob in a striped hammock between two posts. */
const hammock: Draw = (p, f) => ({
  ground: [50, 92, 38],
  back: (
    <G>
      <Ellipse cx={50} cy={54} rx={42} ry={36} fill={p.glow} opacity={0.14} />
      {/* The posts and ropes. */}
      <Path d="M14 36 L15 92 M86 36 L85 92" stroke={p.altDeep} strokeWidth={3.4} strokeLinecap="round" />
      <Path d="M14.4 42 L24 55 M85.6 42 L76 55" stroke={p.light} strokeWidth={0.9} opacity={0.7} />
    </G>
  ),
  body: (
    <G>
      {/* Lying back in it. */}
      <VE cx={50} cy={58} rx={17} ry={11} fill={p.mid} f={f} />
      {/* The sling, striped, over its middle. */}
      <V d="M22 54 Q50 88 78 54 Q50 74 22 54Z" fill={p.alt} f={f} />
      <Path d="M30 61 Q50 77 70 61 M36 66.4 Q50 77 64 66.4" stroke={p.light} strokeWidth={1.2} fill="none" opacity={0.6} />
      <Circle cx={40.4} cy={61} r={2} fill={p.alt} opacity={0.45} />
      <Circle cx={59.6} cy={61} r={2} fill={p.alt} opacity={0.45} />
      <Path d="M47 62 Q50 64.4 53 62" stroke={p.deep} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [41, 51, 18, 8],
    el: (
      <G>
        <VEye x={45} y={55.4} r={2.6} f={f} />
        <VEye x={55} y={55.4} r={2.6} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* Zzz. */}
      <Path d="M62 36 L67 36 L62 41 L67 41 M70 26 L74 26 L70 30 L74 30" stroke={p.light} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      {sparkles(p.accent, [
        [24, 18, 1.8],
        [80, 14, 1.5],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** INTERPLANETARY CRIMINAL: the Getaway — a flying saucer, a masked little alien at the controls, its beam on. */
const ufo: Draw = (p, f) => ({
  ground: [50, 94, 24],
  back: (
    <G>
      <Ellipse cx={50} cy={50} rx={42} ry={40} fill={p.glow} opacity={0.14} />
      {/* The tractor beam. */}
      <Path d="M40 68 L32 88 Q50 92 68 88 L60 68Z" fill={p.glow} opacity={0.16} />
    </G>
  ),
  body: (
    <G>
      {/* The pilot: antennae, head and bandit mask. */}
      <Path d="M45 38 L41 29 M55 38 L59 29" stroke={p.alt} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={41} cy={28.4} r={1.8} fill={p.accent} />
      <Circle cx={59} cy={28.4} r={1.8} fill={p.accent} />
      <VE cx={50} cy={46} rx={10.4} ry={10} fill={p.alt} f={f} />
      <Path d="M39.4 43.6 Q50 39.6 60.6 43.6 L60.6 48.6 Q50 45.6 39.4 48.6Z" fill={INK} />
      <Path d="M47 52 Q50 54 53 52" stroke={p.altDeep} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      {/* The glass dome over it. */}
      <Path d="M33 52 C33 32 67 32 67 52Z" fill={p.light} opacity={0.18} />
      <Path d="M37 44 C38 38 42 35 47 34" stroke={p.light} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.6} />
      {/* The saucer, its lights and underside. */}
      <V d="M14 60 C14 52 30 49 50 49 C70 49 86 52 86 60 C86 66 70 70 50 70 C30 70 14 66 14 60Z" fill={p.mid} f={f} gloss={[30, 54, 10, 1.6, 0]} />
      {[24, 37, 50, 63, 76].map((x) => (
        <Circle key={x} cx={x} cy={62} r={2.1} fill={p.accent} />
      ))}
      <VE cx={50} cy={69} rx={14} ry={3} fill={p.deep} f={f} gloss={false} />
    </G>
  ),
  eyes: {
    box: [43, 43, 14, 6],
    el: (
      <G>
        <VEye x={46} y={46} r={2.2} f={f} />
        <VEye x={54} y={46} r={2.2} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {[30.5, 43.5, 56.5, 69.5].map((x) => (
        <Circle key={x} cx={x} cy={63} r={1.5} fill={p.glow} />
      ))}
      {sparkles(p.accent, [
        [14, 18, 2],
        [86, 22, 1.6],
        [88, 84, 1.4],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** TAIKI NULIGHT: the Night light — a little lamp glowing warm, a pull chain, light pooling below. */
const nightlight: Draw = (p, f) => ({
  ground: [50, 89, 20],
  back: (
    <G>
      <Ellipse cx={50} cy={44} rx={42} ry={38} fill={p.glow} opacity={0.22} />
      <Path d="M26 60 L18 84 Q50 92 82 84 L74 60Z" fill={p.glow} opacity={0.12} />
    </G>
  ),
  body: (
    <G>
      {/* Stem and base. */}
      <Path d="M47.4 60 L52.6 60 L52.6 82 L47.4 82Z" fill={p.alt} />
      <VE cx={50} cy={85} rx={16} ry={5} fill={p.alt} f={f} />
      {/* The shade, lit from inside. */}
      <V d="M34 22 L66 22 Q68 22 69 24 L80 58 Q80.6 60 78.6 60 L21.4 60 Q19.4 60 20 58 L31 24 Q32 22 34 22Z" fill={p.mid} f={f} gloss={[34, 30, 3, 10, 18]} />
      <Path d="M20.6 59 L79.4 59" stroke={p.deep} strokeWidth={1.4} opacity={0.5} />
      <Path d="M62 60 L62 72" stroke={p.deep} strokeWidth={0.8} />
      <Circle cx={62} cy={73.2} r={1.4} fill={p.deep} />
      <Circle cx={39} cy={49} r={2.2} fill={p.deep} opacity={0.25} />
      <Circle cx={61} cy={49} r={2.2} fill={p.deep} opacity={0.25} />
      <Path d="M45.6 49 Q50 52.6 54.4 49" stroke={p.deep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 38, 20, 8],
    el: (
      <G>
        <VEye x={44} y={42} r={2.8} f={f} />
        <VEye x={56} y={42} r={2.8} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      <Glow x={50} y={61.4} r={2.2} color={p.light} />
      {sparkles(p.glow, [
        [14, 20, 1.8],
        [86, 16, 1.6],
        [84, 74, 1.4],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** ALLEYCVT: the Alley cat — a cat in a beanie sat by a tagged brick wall. */
const alleycat: Draw = (p, f) => ({
  ground: [50, 92, 26],
  back: (
    <G>
      <Ellipse cx={50} cy={52} rx={42} ry={38} fill={p.glow} opacity={0.12} />
      {/* The wall, its bricks and a tag. */}
      <Path d="M16 30 L84 30 L84 82 Q50 92 16 82Z" fill={p.deep} opacity={0.55} />
      <Path d="M16 42 L84 42 M16 54 L84 54 M16 66 L84 66 M16 78 L84 78 M28 30 L28 42 M50 30 L50 42 M72 30 L72 42 M38 42 L38 54 M62 42 L62 54 M28 54 L28 66 M72 54 L72 66 M22 66 L22 78 M78 66 L78 78" stroke={p.mid} strokeWidth={0.7} opacity={0.35} />
      <Path d="M19 40 C22 33 25 44 28 37 C30 33 32 38 34 35" stroke={p.accent} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.75} />
      <Path d="M80 70 C76 66 72 70 76 74 L80 78 L84 74 C88 70 84 66 80 70Z" fill={p.alt} opacity={0.75} />
    </G>
  ),
  body: (
    <G>
      {/* Tail, body and head. */}
      <Path d="M64 86 C80 88 86 74 78 64" stroke={p.mid} strokeWidth={5} fill="none" strokeLinecap="round" />
      <V d="M34 90 C30 74 34 60 50 58 C66 60 70 74 66 90Z" fill={p.mid} f={f} gloss={[40, 66, 3, 7, 0]} />
      <VE cx={50} cy={44} rx={16} ry={14} fill={p.mid} f={f} />
      {/* The beanie, its band and bobble. */}
      <V d="M33 38 C33 22 67 22 67 38 Q50 33 33 38Z" fill={p.alt} f={f} />
      <Path d="M33.4 37 Q50 32 66.6 37" stroke={p.altDeep} strokeWidth={3} fill="none" />
      <Circle cx={50} cy={23} r={3.4} fill={p.light} />
      {/* Nose, mouth and whiskers. */}
      <Path d="M48.4 49 L51.6 49 L50 51Z" fill={p.alt} />
      <Path d="M47 53 Q48.6 54.6 50 53 Q51.4 54.6 53 53" stroke={p.light} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      <Path d="M38 50 L28 48 M38 52.6 L28 54 M62 50 L72 48 M62 52.6 L72 54" stroke={p.light} strokeWidth={0.6} opacity={0.7} strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 40, 20, 8],
    el: (
      <G>
        <VEye x={44} y={44} r={3} f={f} iris={p.accent} />
        <VEye x={56} y={44} r={3} f={f} iris={p.accent} />
      </G>
    ),
  },
  flicker: sparkles(p.accent, [
    [20, 16, 1.8],
    [82, 18, 1.6],
  ]),
  flickerOver: true,
});

/** JESSICA AUDIFFRED: the Monarch — a monarch butterfly, wings flapping, white dots on their black edges. */
const monarch: Draw = (p, f) => {
  const upper = 'M48 48 C40 30 18 22 12 32 C8 40 18 50 46 54Z';
  const lower = 'M47 56 C30 58 20 68 26 76 C32 82 42 72 48 60Z';
  const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${r1(100 - Number(x))} ${y}`);
  const wing = (d: string, k: string) => (
    <G key={k}>
      <V d={d} fill={p.mid} f={f} />
      <Path d={d} stroke={p.deep} strokeWidth={2} fill="none" strokeLinejoin="round" />
    </G>
  );
  return {
    ground: [50, 92, 14],
    back: <Ellipse cx={50} cy={50} rx={42} ry={40} fill={p.glow} opacity={0.14} />,
    pivot: [50, 52],
    flap: true,
    sway: (
      <G>
        {wing(upper, 'ul')}
        {wing(lower, 'll')}
        {wing(mirror(upper), 'ur')}
        {wing(mirror(lower), 'lr')}
        {/* Veins and the white dots on the edges. */}
        <Path d={`M46 50 L22 32 M46 52 L16 40 M46 58 L30 70 ${mirror('M46 50 L22 32 M46 52 L16 40 M46 58 L30 70')}`} stroke={p.deep} strokeWidth={1} opacity={0.75} />
        {[
          [15, 31],
          [20, 26],
          [12, 38],
          [27, 77],
          [24, 71],
        ].map(([x, y]) => (
          <G key={`${x}${y}`}>
            <Circle cx={x} cy={y} r={0.9} fill={p.accent} />
            <Circle cx={100 - x} cy={y} r={0.9} fill={p.accent} />
          </G>
        ))}
      </G>
    ),
    body: (
      <G>
        <Path d="M47 40 Q42 28 38 25 M53 40 Q58 28 62 25" stroke={p.deep} strokeWidth={1.2} fill="none" strokeLinecap="round" />
        <Circle cx={38} cy={25} r={1.6} fill={p.alt} />
        <Circle cx={62} cy={25} r={1.6} fill={p.alt} />
        <VE cx={50} cy={62} rx={3.8} ry={13} fill={p.deep} f={f} gloss={false} />
        <VE cx={50} cy={45} rx={8.4} ry={7.6} fill={p.alt} f={f} />
        <Path d="M48 48.4 Q50 50 52 48.4" stroke={p.deep} strokeWidth={1} fill="none" strokeLinecap="round" />
      </G>
    ),
    eyes: {
      box: [44, 41, 12, 6],
      el: (
        <G>
          <VEye x={46.8} y={44.4} r={1.9} f={f} />
          <VEye x={53.2} y={44.4} r={1.9} f={f} />
        </G>
      ),
    },
    flicker: sparkles(p.alt, [
      [14, 14, 1.8],
      [86, 86, 1.6],
      [86, 14, 1.4],
    ]),
    flickerOver: true,
  };
};

/** A sticker for the food court: a food truck with its hatch up, a sign on top, steam rising. */
const foodtruck: Draw = (p, f) => ({
  ground: [50, 92, 36],
  back: <Ellipse cx={50} cy={54} rx={42} ry={38} fill={p.glow} opacity={0.14} />,
  body: (
    <G>
      {/* Wheels, the truck and its cab. */}
      <Circle cx={30} cy={84} r={6} fill={p.altDeep} />
      <Circle cx={70} cy={84} r={6} fill={p.altDeep} />
      <Circle cx={30} cy={84} r={2.4} fill={p.light} opacity={0.6} />
      <Circle cx={70} cy={84} r={2.4} fill={p.light} opacity={0.6} />
      <V d="M14 38 Q14 34 18 34 L82 34 Q86 34 86 38 L86 80 Q86 82 84 82 L16 82 Q14 82 14 80Z" fill={p.mid} f={f} gloss={[22, 42, 3, 8, 0]} />
      {/* The sign on the roof. */}
      <V d="M30 22 Q30 20 32 20 L68 20 Q70 20 70 22 L70 32 Q70 34 68 34 L32 34 Q30 34 30 32Z" fill={p.alt} f={f} />
      <Path d="M36 27 L44 27 M48 27 L64 27" stroke={p.light} strokeWidth={2} strokeLinecap="round" />
      {/* The hatch propped up, the counter and its stripe. */}
      <Path d="M22 44 L78 44 L82 38 L18 38Z" fill={p.deep} opacity={0.5} />
      <Path d="M24 46 L76 46 L76 62 L24 62Z" fill={p.altDeep} />
      <Path d="M22 62 L78 62 L78 66 L22 66Z" fill={p.light} />
      <Path d="M14 72 L86 72" stroke={p.alt} strokeWidth={3} />
      <Circle cx={36} cy={57} r={2.2} fill={p.accent} opacity={0.5} />
      <Circle cx={64} cy={57} r={2.2} fill={p.accent} opacity={0.5} />
      <Path d="M45 57 Q50 61 55 57" stroke={p.light} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [39, 47, 22, 8],
    el: (
      <G>
        <VEye x={43.6} y={51} r={3} f={f} />
        <VEye x={56.4} y={51} r={3} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* Steam off the grill. */}
      <Path d="M72 18 Q69 13 73 9.4 M78 20 Q75 15 79 12" stroke={p.light} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.55} />
      {sparkles(p.accent, [
        [14, 18, 1.8],
        [90, 50, 1.4],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** A sticker for the care tent: a soft tent with a heart on its flag, the flap open and a lantern lit. */
const caretent: Draw = (p, f) => ({
  ground: [50, 92, 36],
  back: <Ellipse cx={50} cy={54} rx={42} ry={38} fill={p.glow} opacity={0.16} />,
  body: (
    <G>
      {/* The flag with its heart. */}
      <Path d="M50 22 L50 8" stroke={p.deep} strokeWidth={1.4} strokeLinecap="round" />
      <V d="M50 8 L66 11 L50 15Z" fill={p.light} f={f} />
      <Path d="M56.6 11.8 C55 10 52.8 11.2 54 12.8 L56.6 14.6 L59.2 12.8 C60.4 11.2 58.2 10 56.6 11.8Z" fill={p.accent} />
      {/* The tent and its open flap. */}
      <V d="M50 20 L86 84 Q87 86 85 86 L15 86 Q13 86 14 84Z" fill={p.mid} f={f} gloss={[38, 44, 3, 12, 28]} />
      <Path d="M50 20 L36 86 L64 86Z" fill={p.alt} />
      <Path d="M50 20 L36 86 Q42 70 50 60Z" fill={p.light} opacity={0.18} />
      {/* A lantern lit inside. */}
      <Circle cx={50} cy={76} r={5} fill={p.accent} opacity={0.25} />
      <VE cx={50} cy={76} rx={2.6} ry={3.4} fill={p.accent} f={f} gloss={false} />
      <Circle cx={36} cy={66} r={2.2} fill={p.accent} opacity={0.4} />
      <Circle cx={64} cy={66} r={2.2} fill={p.accent} opacity={0.4} />
      <Path d="M46 66 Q50 69.6 54 66" stroke={p.deep} strokeWidth={1.3} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [37, 54, 26, 8],
    el: (
      <G>
        <VEye x={41} y={58} r={2.8} f={f} />
        <VEye x={59} y={58} r={2.8} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      <Glow x={50} y={76} r={1.6} color={p.accent} />
      {sparkles(p.accent, [
        [16, 24, 1.8],
        [86, 30, 1.5],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** A sticker for the water station: a drop of water under a tap, sloshing, with drops still falling. */
const refill: Draw = (p, f) => ({
  ground: [50, 90, 28],
  back: (
    <G>
      <Ellipse cx={50} cy={56} rx={42} ry={38} fill={p.glow} opacity={0.16} />
      {/* The tap, with its pipe and handle. */}
      <V d="M24 11 L46 11 Q50 11 50 15 L50 18 L44 18 L44 16.5 L24 16.5 Q22 16.5 22 13.75 Q22 11 24 11Z" fill={p.alt} f={f} gloss={[32, 12.6, 6, 0.9, 0]} />
      <Path d="M43 18 L51 18 L51 20.4 Q51 21.4 50 21.4 L44 21.4 Q43 21.4 43 20.4Z" fill={p.altDeep} />
      <Path d="M34 11 L34 7.4 M29 7.4 L39 7.4" stroke={p.altDeep} strokeWidth={2} strokeLinecap="round" />
    </G>
  ),
  body: (
    <G>
      <V d="M50 20 C58 34 74 46 74 63 C74 78 63 88 50 88 C37 88 26 78 26 63 C26 46 42 34 50 20Z" fill={p.mid} f={f} gloss={[39, 50, 4, 9, -24]} />
      {/* The water inside, sloshing. */}
      <Path d="M28.5 70 Q36 65 43 69 Q50 73 57 69 Q64 65 71.5 70" stroke={p.light} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.6} />
      <Circle cx={60} cy={78} r={1.4} fill={p.light} opacity={0.6} />
      <Circle cx={42} cy={80} r={1} fill={p.light} opacity={0.5} />
      <Circle cx={39} cy={66} r={2.2} fill={p.accent} opacity={0.35} />
      <Circle cx={61} cy={66} r={2.2} fill={p.accent} opacity={0.35} />
      <Path d="M45 66 Q50 70 55 66" stroke={p.deep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 54, 20, 9],
    el: (
      <G>
        <VEye x={44} y={58.5} r={3.2} f={f} />
        <VEye x={56} y={58.5} r={3.2} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* Drops still falling, and the shine on the water. */}
      <Path d="M47 23 Q47 26 48 26 Q49 26 49 23 L48 21.4Z" fill={p.mid} />
      <Path d="M82 52 C84 56 86 58 86 60 C86 62 84 63 82 63 C80 63 78 62 78 60 C78 58 80 56 82 52Z" fill={p.mid} opacity={0.8} />
      <Path d="M17 40 C18.5 43 20 44.5 20 46 C20 47.5 18.5 48.4 17 48.4 C15.5 48.4 14 47.5 14 46 C14 44.5 15.5 43 17 40Z" fill={p.light} opacity={0.8} />
      {sparkles(p.accent, [
        [88, 30, 1.8],
        [12, 72, 1.6],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** A sticker for the charging tent: a battery topping up, its bars filling, a cable curled out to its plug. */
const charger: Draw = (p, f) => ({
  ground: [50, 91, 30],
  back: (
    <G>
      <Ellipse cx={50} cy={54} rx={42} ry={38} fill={p.glow} opacity={0.15} />
      {/* The cable, curled out to its plug. */}
      <Path d="M62 86 C70 94 82 92 82 82 C82 74 72 74 74 66 C75 62 78 60 81 60" stroke={p.altDeep} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <V d="M80 56 L86 56 Q88 56 88 58 L88 62 Q88 64 86 64 L80 64Z" fill={p.alt} f={f} />
      <Path d="M88 58 L91 58 M88 62 L91 62" stroke={p.light} strokeWidth={1.2} strokeLinecap="round" />
    </G>
  ),
  body: (
    <G>
      {/* The cap and the case. */}
      <V d="M42 14 Q42 12 44 12 L56 12 Q58 12 58 14 L58 20 L42 20Z" fill={p.alt} f={f} />
      <V d="M28 24 Q28 18 34 18 L66 18 Q72 18 72 24 L72 84 Q72 90 66 90 L34 90 Q28 90 28 84Z" fill={p.alt} f={f} gloss={[35, 30, 3, 10, 0]} />
      {/* The window with its charge bars. */}
      <Path d="M34 50 Q34 48 36 48 L64 48 Q66 48 66 50 L66 82 Q66 84 64 84 L36 84 Q34 84 34 82Z" fill={p.altDeep} />
      {[76, 67, 58].map((y) => (
        <V key={y} d={`M37 ${y} L63 ${y} L63 ${y + 5.6} L37 ${y + 5.6}Z`} fill={p.mid} f={f} />
      ))}
      <Circle cx={38} cy={41} r={2.2} fill={p.accent} opacity={0.35} />
      <Circle cx={62} cy={41} r={2.2} fill={p.accent} opacity={0.35} />
      <Path d="M45.4 40.6 Q50 44 54.6 40.6" stroke={p.light} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 28, 20, 9],
    el: (
      <G>
        <VEye x={44} y={33} r={3} f={f} />
        <VEye x={56} y={33} r={3} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* The bar still filling, and a bolt of charge. */}
      <Path d="M37 49.6 L63 49.6 L63 55.2 L37 55.2Z" fill={p.mid} opacity={0.85} />
      <Path d="M51.5 49 L46.5 56.5 L50.5 56.5 L48.5 63 L54 54.5 L50 54.5 L52.5 49Z" fill={p.accent} />
      {sparkles(p.accent, [
        [16, 22, 2.2],
        [86, 30, 1.8],
        [14, 70, 1.6],
      ])}
    </G>
  ),
  flickerOver: true,
});

/** A sticker for the dance floor: a rave fan clacked wide open, painted panels and a smile. */
const fan: Draw = (p, f) => {
  const at = (deg: number, r: number) => [r1(50 + Math.cos((deg * Math.PI) / 180) * r), r1(80 + Math.sin((deg * Math.PI) / 180) * r)] as const;
  const PANELS = 10;
  const from = 196;
  const step = (344 - from) / PANELS;
  return {
    ground: [50, 92, 20],
    back: <Ellipse cx={50} cy={50} rx={46} ry={40} fill={p.glow} opacity={0.16} />,
    body: (
      <G>
        <V d={`M50 80 L${at(from, 46).join(' ')} A46 46 0 0 1 ${at(from + step * PANELS, 46).join(' ')}Z`} fill={p.mid} f={f} gloss={[30, 44, 8, 3, -40]} />
        {Array.from({ length: PANELS }, (_, i) => {
          const a0 = from + step * i;
          const a1 = a0 + step;
          return i % 2 ? <Path key={i} d={`M50 80 L${at(a0, 46).join(' ')} A46 46 0 0 1 ${at(a1, 46).join(' ')}Z`} fill={p.alt} opacity={0.85} /> : null;
        })}
        {/* A band of light painted across it. */}
        <Path d={`M${at(from, 33).join(' ')} A33 33 0 0 1 ${at(from + step * PANELS, 33).join(' ')}`} stroke={p.accent} strokeWidth={2.4} fill="none" opacity={0.9} />
        <Path d={`M${at(from, 41).join(' ')} A41 41 0 0 1 ${at(from + step * PANELS, 41).join(' ')}`} stroke={p.light} strokeWidth={1} fill="none" opacity={0.6} />
        {/* Its ribs. */}
        {Array.from({ length: PANELS + 1 }, (_, i) => {
          const [x, y] = at(from + step * i, 46);
          return <Line key={`r${i}`} x1={50} y1={80} x2={x} y2={y} stroke={p.deep} strokeWidth={0.8} opacity={0.5} />;
        })}
        {/* The guards and the rivet at the bottom. */}
        <V d="M48 80 L52 80 L54 92 Q54 94 52 94 L48 94 Q46 94 46 92Z" fill={p.altDeep} f={f} />
        <VE cx={50} cy={80} rx={3.6} ry={3.6} fill={p.accent} f={f} gloss={false} />
        <Circle cx={39} cy={62} r={2.2} fill={p.light} opacity={0.4} />
        <Circle cx={61} cy={62} r={2.2} fill={p.light} opacity={0.4} />
        <Path d="M45.4 62.6 Q50 66.4 54.6 62.6" stroke={p.deep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      </G>
    ),
    eyes: {
      box: [40, 51, 20, 9],
      el: (
        <G>
          <VEye x={44} y={56} r={3} f={f} />
          <VEye x={56} y={56} r={3} f={f} />
        </G>
      ),
    },
    flicker: (
      <G>
        {/* The clack: little lines of sound off its edge. */}
        <Path d="M14 38 L9 35 M15 30 L11 25 M86 38 L91 35 M85 30 L89 25" stroke={p.accent} strokeWidth={1.6} strokeLinecap="round" />
        {sparkles(p.accent, [
          [20, 12, 2],
          [80, 10, 1.8],
          [88, 70, 1.6],
        ])}
      </G>
    ),
    flickerOver: true,
  };
};

/** SKRILLEX: a scary monster (and nice sprites) — a shaggy little beast with horns and a jagged grin, sprites buzzing round it. */
const scarymonster: Draw = (p, f) => ({
  ground: [50, 91, 28],
  back: <Ellipse cx={50} cy={54} rx={44} ry={38} fill={p.glow} opacity={0.16} />,
  pivot: [50, 30],
  sway: (
    <G>
      {/* Horns. */}
      <V d="M30 32 C24 22 24 12 30 6 C30 14 34 22 40 28Z" fill={p.alt} f={f} />
      <V d="M70 32 C76 22 76 12 70 6 C70 14 66 22 60 28Z" fill={p.alt} f={f} />
    </G>
  ),
  body: (
    <G>
      {/* Shaggy body: a jagged fringe all round. */}
      <V
        d="M50 22 L56 18 L60 24 L67 21 L69 28 L77 28 L75 35 L83 39 L77 44 L83 51 L76 54 L80 62 L72 63 L74 71 L66 70 L64 78 L57 74 L50 81 L43 74 L36 78 L34 70 L26 71 L28 63 L20 62 L24 54 L17 51 L23 44 L17 39 L25 35 L23 28 L31 28 L33 21 L40 24 L44 18Z"
        fill={p.mid}
        f={f}
        gloss={[38, 34, 9, 4, -16]}
      />
      <Path d="M50 30 L54 27 L57 32 L63 30 L64 36 L70 37 L66 42 L71 47 L65 50 L67 56 L60 57 L59 63 L53 60 L50 66 L47 60 L41 63 L40 57 L33 56 L35 50 L29 47 L34 42 L30 37 L36 36 L37 30 L43 32 L46 27Z" fill={p.light} opacity={0.22} />
      {/* Little feet. */}
      <VE cx={40} cy={84} rx={7} ry={4} fill={p.deep} f={f} gloss={false} />
      <VE cx={60} cy={84} rx={7} ry={4} fill={p.deep} f={f} gloss={false} />
      {/* The jagged grin. */}
      <Path d="M36 58 Q50 70 64 58 Q50 64 36 58Z" fill={p.altDeep} />
      <Path d="M39 59.6 L42 63 L45 60.8 L48 64 L51 61 L54 64 L57 60.8 L60 63 L62 59.8" stroke="#FFFFFF" strokeWidth={1.4} fill="none" strokeLinejoin="round" />
    </G>
  ),
  eyes: {
    box: [34, 40, 32, 12],
    el: (
      <G>
        <VEye x={41} y={46} r={5} f={f} />
        <VEye x={59} y={46} r={5} f={f} />
        <Path d="M34 38 L46 42 M66 38 L54 42" stroke={p.deep} strokeWidth={2} strokeLinecap="round" />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* Nice sprites: little winged lights. */}
      {(
        [
          [14, 22, 1],
          [86, 18, 1.2],
          [88, 70, 1],
          [12, 76, 0.9],
        ] as const
      ).map(([x, y, s], i) => (
        <G key={i}>
          <Ellipse cx={x - 2.4 * s} cy={y - 1.4 * s} rx={2.4 * s} ry={1.4 * s} fill="#FFFFFF" opacity={0.55} />
          <Ellipse cx={x + 2.4 * s} cy={y - 1.4 * s} rx={2.4 * s} ry={1.4 * s} fill="#FFFFFF" opacity={0.55} />
          <Glow x={x} y={y} r={1.4 * s} color={i % 2 ? p.accent : p.glow} />
        </G>
      ))}
    </G>
  ),
  flickerOver: true,
});

/** RÜFÜS DU SOL: the desert at sunset — a saguaro with a face before a huge low sun, the dunes going violet. */
const desertsun: Draw = (p, f) => ({
  ground: [50, 92, 30],
  back: (
    <G>
      {/* The sun, huge and low, its bands cut by the haze. */}
      <Circle cx={50} cy={58} r={34} fill={p.accent} opacity={0.95} />
      <Circle cx={50} cy={58} r={34} fill={p.glow} opacity={0.35} />
      {[44, 52, 60, 68].map((y, i) => {
        // Each band only across the sun.
        const half = r1(Math.sqrt(34 * 34 - (y - 58) * (y - 58)));
        return <Path key={y} d={`M${r1(50 - half)} ${y} L${r1(50 + half)} ${y}`} stroke={p.deep} strokeWidth={1.4 + i * 0.6} opacity={0.5} />;
      })}
      {/* Dunes, inside the round tile. */}
      <Path d="M9.7 76 C24 68 38 72 50 75 C64 78 78 70 90.3 76 A48 48 0 0 1 9.7 76Z" fill={p.altDeep} />
      <Path d="M18.3 86 C30 80 44 84 58 86 C68 87.4 76 84 81.7 86 A48 48 0 0 1 18.3 86Z" fill={p.deep} />
    </G>
  ),
  body: (
    <G>
      {/* The saguaro: trunk and two arms. */}
      <V d="M43 90 L43 30 Q43 22 50 22 Q57 22 57 30 L57 90Z" fill={p.mid} f={f} gloss={[48, 30, 2, 8, 0]} />
      <V d="M43 58 L36 58 Q30 58 30 52 L30 40 Q30 36 34 36 Q38 36 38 40 L38 50 L43 50Z" fill={p.mid} f={f} />
      <V d="M57 50 L64 50 L64 34 Q64 30 68 30 Q72 30 72 34 L72 50 Q72 58 64 58 L57 58Z" fill={p.mid} f={f} />
      {/* Ribs. */}
      {[46.5, 53.5].map((x) => (
        <Path key={x} d={`M${x} 26 L${x} 88`} stroke={p.alt} strokeWidth={0.8} opacity={0.6} />
      ))}
      {/* A flower on top. */}
      <Circle cx={50} cy={21} r={3} fill={p.light} />
      <Circle cx={50} cy={21} r={1.2} fill={p.accent} />
      <Path d="M45 46 Q50 50 55 46" stroke={p.altDeep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [44, 34, 12, 6],
    el: (
      <G>
        <VEye x={47} y={38} r={2.4} f={f} />
        <VEye x={53} y={38} r={2.4} f={f} />
      </G>
    ),
  },
  flicker: sparkles(p.light, [
    [18, 18, 1.6],
    [82, 14, 1.4],
    [70, 24, 1],
  ]),
  flickerOver: true,
});

/** KASKADE: a wave curling over at sunset, a face in its curl, foam on its crest. */
const wave: Draw = (p, f) => ({
  ground: null,
  back: (
    <G>
      {/* The sky going pink, a sun on the horizon. */}
      <Circle cx={66} cy={46} r={16} fill={p.accent} opacity={0.9} />
      <Circle cx={66} cy={46} r={22} fill={p.accent} opacity={0.18} />
      <Path d="M9.7 76 C26 72 40 74 54 72 C68 70 80 74 90.3 76 A48 48 0 0 1 9.7 76Z" fill={p.deep} />
    </G>
  ),
  body: (
    <G>
      {/* The wave: a body of water rising and curling over to the right. */}
      <V d="M17 84 C19 60 26 34 46 24 C62 17 78 22 82 34 C84 42 78 50 70 48 C64 47 62 40 66 36 C58 34 50 40 48 52 C46 64 54 76 70 82 Q42 92 17 84Z" fill={p.mid} f={f} gloss={[30, 44, 4, 12, 20]} />
      {/* Its inside, darker. */}
      <Path d="M66 36 C58 34 50 40 48 52 C46 62 52 72 62 78 C56 70 54 60 58 50 C60 44 63 40 66 36Z" fill={p.deep} opacity={0.55} />
      {/* Foam along the crest. */}
      <Path d="M46 24 C62 17 78 22 82 34 C84 42 78 50 70 48" stroke={p.light} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      {[
        [56, 20, 2.4],
        [70, 21, 2],
        [80, 28, 2.2],
        [82, 40, 1.6],
        [44, 26, 1.8],
      ].map(([x, y, r]) => (
        <Circle key={`${x}${y}`} cx={x} cy={y} r={r} fill={p.light} />
      ))}
      <Path d="M24 62 Q30 66 36 62" stroke={p.deep} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [22, 48, 18, 8],
    el: (
      <G>
        <VEye x={26} y={52} r={2.8} f={f} />
        <VEye x={35} y={52} r={2.8} f={f} />
      </G>
    ),
  },
  flicker: sparkles(p.light, [
    [86, 58, 1.6],
    [16, 30, 1.4],
    [30, 14, 1.2],
  ]),
  flickerOver: true,
});

/** DAVID GUETTA: a titanium heart, polished chrome with rivets, light glinting off it. */
const titaniumheart: Draw = (p, f) => ({
  ground: [50, 90, 26],
  back: <Ellipse cx={50} cy={50} rx={44} ry={40} fill={p.glow} opacity={0.14} />,
  body: (
    <G>
      <V d="M50 86 C34 74 14 60 14 40 C14 26 24 18 34 18 C42 18 47 22 50 28 C53 22 58 18 66 18 C76 18 86 26 86 40 C86 60 66 74 50 86Z" fill={p.mid} f={f} gloss={[30, 28, 10, 5, -20]} />
      {/* The plates and their seam. */}
      <Path d="M50 28 C48 44 52 62 50 86" stroke={p.deep} strokeWidth={1.2} fill="none" opacity={0.7} />
      <Path d="M20 44 C34 48 66 48 80 44" stroke={p.deep} strokeWidth={1} fill="none" opacity={0.5} />
      {/* A band of reflection. */}
      <Path d="M24 30 C30 24 38 24 42 28" stroke={p.light} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.9} />
      <Path d="M70 64 C66 70 60 74 56 76" stroke={p.light} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.6} />
      {/* Rivets. */}
      {[
        [26, 40],
        [74, 40],
        [36, 62],
        [64, 62],
        [50, 76],
      ].map(([x, y]) => (
        <G key={`${x}${y}`}>
          <Circle cx={x} cy={y} r={1.8} fill={p.alt} />
          <Circle cx={x - 0.5} cy={y - 0.5} r={0.6} fill="#FFFFFF" opacity={0.8} />
        </G>
      ))}
      <Path d="M43 58 Q50 63 57 58" stroke={p.deep} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [38, 44, 24, 10],
    el: (
      <G>
        <VEye x={42.5} y={49} r={3.6} f={f} />
        <VEye x={57.5} y={49} r={3.6} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      <Path d={star(78, 22, 4)} fill="#FFFFFF" />
      <Path d={star(20, 66, 2.6)} fill={p.accent} />
      <Path d={star(84, 72, 2)} fill="#FFFFFF" opacity={0.8} />
    </G>
  ),
  flickerOver: true,
});

/** MEDUZA: a gorgon with a head of little snakes, each with its own eyes, and a look that won't turn you to stone. */
const gorgon: Draw = (p, f) => {
  // The snakes: where each starts on the head and where its head ends up.
  const snakes = [
    [30, 40, 16, 32, 18, 22],
    [36, 31, 28, 18, 34, 13],
    [50, 27, 46, 14, 52, 10],
    [64, 31, 72, 18, 66, 13],
    [70, 40, 84, 32, 82, 22],
    [27, 52, 14, 50, 13, 40],
    [73, 52, 86, 50, 87, 40],
  ] as const;
  return {
    ground: [50, 92, 24],
    back: <Ellipse cx={50} cy={50} rx={44} ry={42} fill={p.glow} opacity={0.14} />,
    pivot: [50, 40],
    sway: (
      <G>
        {snakes.map(([x0, y0, cx, cy, x1, y1], i) => (
          <G key={i}>
            <Path d={`M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`} stroke={p.alt} strokeWidth={6} fill="none" strokeLinecap="round" />
            <Path d={`M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`} stroke={p.light} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeDasharray="2 3" opacity={0.7} />
            <VE cx={x1} cy={y1} rx={4.4} ry={3.6} fill={p.alt} f={f} gloss={false} />
            <Circle cx={x1 - 1.4} cy={y1 - 0.8} r={0.9} fill={p.deep} />
            <Circle cx={x1 + 1.4} cy={y1 - 0.8} r={0.9} fill={p.deep} />
            <Path d={`M${x1} ${r1(y1 + 3)} l-0.8 2 M${x1} ${r1(y1 + 3)} l0.8 2`} stroke={p.accent} strokeWidth={0.6} />
          </G>
        ))}
      </G>
    ),
    body: (
      <G>
        {/* Her face. */}
        <V d="M50 30 C66 30 74 42 74 56 C74 72 64 84 50 84 C36 84 26 72 26 56 C26 42 34 30 50 30Z" fill={p.mid} f={f} gloss={[38, 38, 7, 5, -20]} />
        {/* A gold band across the brow. */}
        <Path d="M28 46 Q50 38 72 46" stroke={p.accent} strokeWidth={2.4} fill="none" />
        <Circle cx={50} cy={41.6} r={2.2} fill={p.light} stroke={p.accent} strokeWidth={0.8} />
        <Path d="M44 68 Q50 72 56 68" stroke={p.deep} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Ellipse cx={36} cy={64} rx={4} ry={2.4} fill="#FF8AB8" opacity={0.35} />
        <Ellipse cx={64} cy={64} rx={4} ry={2.4} fill="#FF8AB8" opacity={0.35} />
      </G>
    ),
    eyes: {
      box: [36, 52, 28, 10],
      el: (
        <G>
          <VEye x={41} y={57} r={4} f={f} />
          <VEye x={59} y={57} r={4} f={f} />
        </G>
      ),
    },
    flicker: sparkles(p.accent, [
      [24, 84, 1.6],
      [80, 82, 1.4],
    ]),
    flickerOver: true,
  };
};

/** NGHTMRE: a night mare — a dark horse with a mane and tail of stars, a crescent moon behind it. */
const nightmare: Draw = (p, f) => ({
  ground: [52, 92, 26],
  back: (
    <G>
      <Path d="M70 14 A16 16 0 1 0 84 40 A12.6 12.6 0 1 1 70 14Z" fill={p.light} opacity={0.9} />
      <Circle cx={74} cy={26} r={22} fill={p.light} opacity={0.08} />
    </G>
  ),
  pivot: [40, 40],
  sway: (
    <G>
      {/* The starry mane flowing back. */}
      <Path d="M44 22 C30 22 20 32 18 46 C16 58 22 70 16 80 C28 76 32 66 32 56 C32 46 38 38 46 34Z" fill={p.alt} opacity={0.95} />
      {[
        [24, 40, 1.4],
        [22, 56, 1.1],
        [20, 72, 1.3],
        [30, 30, 1],
        [28, 64, 0.9],
      ].map(([x, y, r]) => (
        <Path key={`${x}${y}`} d={star(x, y, r * 2)} fill={p.accent} />
      ))}
    </G>
  ),
  body: (
    <G>
      {/* The neck and head, in profile, looking right. */}
      <V d="M34 90 C32 74 34 58 40 46 C44 36 48 28 54 24 L52 16 L58 20 L62 14 L64 24 C70 28 76 34 82 44 C86 50 84 56 78 56 C74 56 70 54 66 52 C62 58 60 66 62 74 C64 82 64 88 62 92Z" fill={p.mid} f={f} gloss={[56, 30, 6, 3, -30]} />
      {/* Muzzle and nostril. */}
      <Path d="M78 44 C82 48 84 52 80 55" stroke={p.deep} strokeWidth={1} fill="none" />
      <Circle cx={80} cy={51} r={1.1} fill={p.deep} />
      <Path d="M70 54 Q74 57 78 55" stroke={p.deep} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [62, 32, 10, 8],
    el: <VEye x={66} y={36} r={3.2} f={f} />,
  },
  flicker: sparkles(p.accent, [
    [18, 24, 1.8],
    [88, 64, 1.4],
    [80, 80, 1.2],
  ]),
  flickerOver: true,
});

/** VINTAGE CULTURE: a gramophone with a face in its horn's bell, a record spinning, notes floating up. */
const gramophone: Draw = (p, f) => ({
  ground: [50, 92, 30],
  back: <Ellipse cx={50} cy={50} rx={44} ry={40} fill={p.glow} opacity={0.14} />,
  body: (
    <G>
      {/* The box and its record. */}
      <V d="M20 74 L80 74 L78 90 L22 90Z" fill={p.alt} f={f} gloss={[30, 78, 8, 2, 0]} />
      <Path d="M22 80 L78 80" stroke={p.altDeep} strokeWidth={0.8} opacity={0.6} />
      <Ellipse cx={42} cy={72} rx={18} ry={4.6} fill={p.deep} />
      <Ellipse cx={42} cy={72} rx={12} ry={3} fill="none" stroke={p.light} strokeWidth={0.4} opacity={0.5} />
      <Ellipse cx={42} cy={72} rx={4} ry={1.2} fill={p.accent} />
      {/* The arm up to the horn. */}
      <Path d="M62 74 L62 60 Q62 54 56 50" stroke={p.accent} strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* The horn: a cone flaring out to a bell that opens towards you, its face inside. */}
      <V d="M58 50 L52 54 L26 36 L50 12Z" fill={p.mid} f={f} />
      <G transform="rotate(-24 38 25)">
        <VE cx={38} cy={25} rx={24} ry={17} fill={p.mid} f={f} gloss={false} />
        <Ellipse cx={38} cy={25} rx={24} ry={17} fill="none" stroke={p.light} strokeWidth={1.2} opacity={0.7} />
        <Ellipse cx={38} cy={26} rx={19} ry={12.6} fill={p.deep} />
        <Ellipse cx={38} cy={27} rx={14} ry={8.6} fill={p.altDeep} opacity={0.7} />
        <Path d="M33 31 Q38 34.6 43 31" stroke={p.light} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      </G>
    </G>
  ),
  eyes: {
    box: [28, 18, 20, 10],
    el: (
      <G>
        <VEye x={32} y={26} r={3} f={f} />
        <VEye x={42} y={22} r={3} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {(
        [
          [76, 20, 0.8],
          [16, 42, 0.8],
          [86, 54, 0.7],
        ] as const
      ).map(([x, y, s], i) => (
        <G key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <Path d="M0 0 L0 -8 L6 -10 L6 -2" stroke={p.accent} strokeWidth={1.4} fill="none" strokeLinejoin="round" />
          <Ellipse cx={-1.6} cy={0.4} rx={2} ry={1.5} fill={p.accent} />
          <Ellipse cx={4.4} cy={-1.6} rx={2} ry={1.5} fill={p.accent} />
        </G>
      ))}
    </G>
  ),
  flickerOver: true,
});

/** ARMIN VAN BUUREN: a trance star, a bright eight-pointed star with rings of light pulsing out from it. */
const trancestar: Draw = (p, f) => ({
  ground: null,
  back: (
    <G>
      {[40, 32, 24].map((r, i) => (
        <Circle key={r} cx={50} cy={50} r={r} fill="none" stroke={i % 2 ? p.alt : p.glow} strokeWidth={1.2} opacity={0.35 + i * 0.1} />
      ))}
    </G>
  ),
  body: (
    <G>
      <V d="M50 12 L57 38 L77 23 L62 43 L88 50 L62 57 L77 77 L57 62 L50 88 L43 62 L23 77 L38 57 L12 50 L38 43 L23 23 L43 38Z" fill={p.mid} f={f} gloss={[44, 30, 6, 6, 0]} />
      <Path d="M50 22 L54 40 L68 32 L60 46 L78 50 L60 54 L68 68 L54 60 L50 78 L46 60 L32 68 L40 54 L22 50 L40 46 L32 32 L46 40Z" fill={p.light} opacity={0.35} />
      <Path d="M44 58 Q50 62 56 58" stroke={p.deep} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 44, 20, 8],
    el: (
      <G>
        <VEye x={44.5} y={48} r={3} f={f} />
        <VEye x={55.5} y={48} r={3} f={f} />
      </G>
    ),
  },
  flicker: sparkles(p.accent, [
    [20, 22, 1.8],
    [80, 20, 1.4],
    [80, 80, 1.6],
    [20, 78, 1.2],
  ]),
  flickerOver: true,
});

/** HEDEX: a hedgehog curled up tight, its spikes lit in neon, bouncing to drum and bass. */
const hedgehog: Draw = (p, f) => {
  // Spikes round its back, from the left side over the top to the right.
  const spikes = Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI * (1.05 + (i / 12) * 0.95);
    return { a, x: 50 + Math.cos(a) * 30, y: 62 + Math.sin(a) * 28, tx: 50 + Math.cos(a) * 44, ty: 62 + Math.sin(a) * 42 };
  });
  return {
    ground: [50, 90, 30],
    back: <Ellipse cx={50} cy={56} rx={44} ry={36} fill={p.glow} opacity={0.14} />,
    body: (
      <G>
        {spikes.map((s, i) => {
          const w = 0.12;
          const l = { x: 50 + Math.cos(s.a - w) * 28, y: 62 + Math.sin(s.a - w) * 26 };
          const r = { x: 50 + Math.cos(s.a + w) * 28, y: 62 + Math.sin(s.a + w) * 26 };
          return <Path key={i} d={`M${r1(l.x)} ${r1(l.y)} L${r1(s.tx)} ${r1(s.ty)} L${r1(r.x)} ${r1(r.y)}Z`} fill={i % 2 ? p.alt : p.altDeep} />;
        })}
        {/* Its round body and pale face. */}
        <V d="M20 66 C20 44 34 34 50 34 C66 34 80 44 80 66 C80 80 68 88 50 88 C32 88 20 80 20 66Z" fill={p.deep} f={f} />
        <V d="M30 70 C30 56 40 48 50 48 C60 48 70 56 70 70 C70 80 62 86 50 86 C38 86 30 80 30 70Z" fill={p.mid} f={f} gloss={[40, 56, 6, 3, -10]} />
        {/* Nose and grin. */}
        <Ellipse cx={50} cy={70} rx={3} ry={2.2} fill={p.deep} />
        <Path d="M45 75 Q50 79 55 75" stroke={p.deep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <Ellipse cx={38} cy={72} rx={3.4} ry={2} fill="#FF8AB8" opacity={0.4} />
        <Ellipse cx={62} cy={72} rx={3.4} ry={2} fill="#FF8AB8" opacity={0.4} />
      </G>
    ),
    eyes: {
      box: [38, 58, 24, 8],
      el: (
        <G>
          <VEye x={42.5} y={62} r={3} f={f} />
          <VEye x={57.5} y={62} r={3} f={f} />
        </G>
      ),
    },
    flicker: (
      <G>
        {spikes
          .filter((_, i) => i % 3 === 1)
          .map((s, i) => (
            <Glow key={i} x={r1(s.tx)} y={r1(s.ty)} r={1.4} color={i % 2 ? p.accent : p.glow} />
          ))}
      </G>
    ),
    flickerOver: true,
  };
};

/** KNOCK2: a little door with a face, a knocker for a nose, light spilling out from round its edges. */
const door: Draw = (p, f) => ({
  ground: [50, 92, 24],
  back: (
    <G>
      <Ellipse cx={50} cy={52} rx={44} ry={40} fill={p.glow} opacity={0.14} />
      {/* Light spilling round the frame. */}
      <Path d="M26 90 L26 30 Q26 10 50 10 Q74 10 74 30 L74 90Z" fill={p.accent} opacity={0.35} />
    </G>
  ),
  body: (
    <G>
      {/* The frame and the door. */}
      <V d="M28 90 L28 32 Q28 14 50 14 Q72 14 72 32 L72 90Z" fill={p.alt} f={f} />
      <V d="M32 90 L32 33 Q32 18 50 18 Q68 18 68 33 L68 90Z" fill={p.mid} f={f} gloss={[38, 26, 4, 10, 0]} />
      {/* Panels. */}
      <Path d="M38 64 L62 64 L62 84 L38 84Z" stroke={p.deep} strokeWidth={1.2} fill="none" opacity={0.6} />
      <Path d="M38 30 Q50 24 62 30 L62 40 L38 40Z" stroke={p.deep} strokeWidth={1.2} fill="none" opacity={0.6} />
      {/* The knocker, for a nose, and a handle. */}
      <Circle cx={50} cy={53} r={4.4} fill="none" stroke={p.accent} strokeWidth={1.8} />
      <Circle cx={50} cy={48.6} r={1.6} fill={p.accent} />
      <Circle cx={63} cy={70} r={1.8} fill={p.accent} />
      <Path d="M44 60 Q50 63 56 60" stroke={p.deep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [38, 42, 24, 8],
    el: (
      <G>
        <VEye x={42.5} y={46} r={3} f={f} />
        <VEye x={57.5} y={46} r={3} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      {/* Knock, knock. */}
      <Path d="M80 40 l6 -4 M82 48 l7 0 M80 56 l6 4" stroke={p.accent} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M20 40 l-6 -4 M18 48 l-7 0 M20 56 l-6 4" stroke={p.accent} strokeWidth={1.6} strokeLinecap="round" />
    </G>
  ),
  flickerOver: true,
});

/** MARTIN GARRIX: the stampede from "Animals" — a little bull charging, head down, neon horns, dust flying. */
const stampede: Draw = (p, f) => ({
  ground: [50, 90, 32],
  back: (
    <G>
      <Ellipse cx={50} cy={54} rx={44} ry={36} fill={p.glow} opacity={0.14} />
      {/* Dust behind it. */}
      {[
        [16, 80, 7],
        [24, 72, 5],
        [12, 68, 4],
      ].map(([x, y, r]) => (
        <Circle key={`${x}${y}`} cx={x} cy={y} r={r} fill={p.light} opacity={0.18} />
      ))}
    </G>
  ),
  body: (
    <G>
      {/* Legs. */}
      {[34, 44, 60, 70].map((x, i) => (
        <V key={x} d={`M${x - 3} 70 L${x + 3} 70 L${x + (i % 2 ? 4 : 2)} 86 L${x - (i % 2 ? 0 : 2)} 86Z`} fill={p.deep} f={f} />
      ))}
      {/* Body and head, lowered to the right. */}
      <V d="M24 54 C24 40 36 34 50 34 C60 34 66 38 70 42 C76 40 84 44 84 54 C84 64 78 70 70 70 L32 72 C26 70 24 62 24 54Z" fill={p.mid} f={f} gloss={[40, 40, 10, 4, -6]} />
      <Path d="M24 52 C18 50 14 54 16 60" stroke={p.deep} strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* Muzzle and ring. */}
      <VE cx={80} cy={60} rx={7} ry={5.4} fill={p.alt} f={f} gloss={false} />
      <Circle cx={80} cy={64} r={3} fill="none" stroke={p.accent} strokeWidth={1.4} />
      <Circle cx={78} cy={59} r={0.9} fill={p.deep} />
      <Circle cx={82.4} cy={59} r={0.9} fill={p.deep} />
      {/* Horns, lit. */}
      <Path d="M66 40 C62 30 64 24 70 22 C68 28 70 34 72 38Z" fill={p.accent} />
      <Path d="M78 42 C82 32 88 30 92 32 C88 34 84 38 82 44Z" fill={p.accent} />
    </G>
  ),
  eyes: {
    box: [66, 44, 14, 8],
    el: (
      <G>
        <VEye x={70} y={48} r={2.6} f={f} />
        <VEye x={77} y={47} r={2.4} f={f} />
      </G>
    ),
  },
  flicker: (
    <G>
      <Glow x={68} y={23} r={1.6} color={p.accent} />
      <Glow x={91} y={32} r={1.6} color={p.accent} />
    </G>
  ),
  flickerOver: true,
});

/** ACRAZE: a boombox with a face, its speakers for eyes, bass rings rolling out of it. */
const boombox: Draw = (p, f) => ({
  ground: [50, 86, 36],
  back: (
    <G>
      <Ellipse cx={50} cy={52} rx={44} ry={36} fill={p.glow} opacity={0.14} />
      {[0, 1].map((i) => (
        <G key={i} opacity={0.5 - i * 0.18}>
          <Path d={`M${10 - i * 5} ${36 - i * 4} Q${4 - i * 5} 56 ${10 - i * 5} ${76 + i * 4}`} stroke={p.accent} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <Path d={`M${90 + i * 5} ${36 - i * 4} Q${96 + i * 5} 56 ${90 + i * 5} ${76 + i * 4}`} stroke={p.accent} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </G>
      ))}
    </G>
  ),
  body: (
    <G>
      {/* The handle. */}
      <Path d="M30 30 L30 22 Q30 18 34 18 L66 18 Q70 18 70 22 L70 30" stroke={p.altDeep} strokeWidth={3.4} fill="none" />
      <V d="M14 34 Q14 28 20 28 L80 28 Q86 28 86 34 L86 74 Q86 80 80 80 L20 80 Q14 80 14 74Z" fill={p.mid} f={f} gloss={[22, 32, 12, 2, 0]} />
      {/* Speakers. */}
      {[32, 68].map((x) => (
        <G key={x}>
          <Circle cx={x} cy={58} r={14} fill={p.altDeep} />
          <Circle cx={x} cy={58} r={10} fill={p.alt} />
          <Circle cx={x} cy={58} r={5} fill={p.deep} />
        </G>
      ))}
      {/* The tape deck and the grin under it. */}
      <Path d="M40 34 L60 34 L60 44 L40 44Z" fill={p.deep} stroke={p.light} strokeWidth={0.6} />
      <Path d="M44 66 Q50 72 56 66" stroke={p.deep} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Circle cx={22} cy={36} r={1.8} fill={p.accent} />
      <Circle cx={78} cy={36} r={1.8} fill={p.light} />
    </G>
  ),
  eyes: {
    box: [26, 50, 48, 16],
    el: (
      <G>
        <VEye x={32} y={58} r={4.2} f={f} />
        <VEye x={68} y={58} r={4.2} f={f} />
      </G>
    ),
  },
  flicker: sparkles(p.light, [
    [50, 10, 1.6],
    [12, 18, 1.2],
    [88, 18, 1.2],
  ]),
  flickerOver: true,
});

/** MAU P: a tulip from Amsterdam, petals closed round its face, a canal-house sky behind. */
const tulip: Draw = (p, f) => ({
  ground: [50, 92, 20],
  back: (
    <G>
      <Ellipse cx={50} cy={46} rx={42} ry={38} fill={p.glow} opacity={0.14} />
      {/* Canal houses on the skyline. */}
      <Path d="M12 78 L12 62 L18 56 L24 62 L24 78Z M26 78 L26 58 L32 50 L38 58 L38 78Z M62 78 L62 56 L68 48 L74 56 L74 78Z M76 78 L76 62 L82 56 L88 62 L88 78Z" fill={p.altDeep} opacity={0.6} />
    </G>
  ),
  body: (
    <G>
      {/* Stem and leaves. */}
      <Path d="M50 90 L50 62" stroke={p.alt} strokeWidth={3.4} strokeLinecap="round" />
      <V d="M50 84 C40 80 34 70 34 60 C42 64 48 72 50 80Z" fill={p.alt} f={f} />
      <V d="M50 80 C60 76 66 66 66 56 C58 60 52 68 50 76Z" fill={p.alt} f={f} />
      {/* The bloom: three petals cupped round. */}
      <V d="M30 30 C30 20 38 16 42 22 C46 16 54 16 58 22 C62 16 70 20 70 30 C70 50 62 62 50 62 C38 62 30 50 30 30Z" fill={p.mid} f={f} gloss={[38, 32, 4, 9, -12]} />
      <Path d="M42 22 C44 34 46 46 50 62 C54 46 56 34 58 22" stroke={p.deep} strokeWidth={1} fill="none" opacity={0.5} />
      <Path d="M44 50 Q50 54 56 50" stroke={p.deep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 36, 20, 8],
    el: (
      <G>
        <VEye x={44.5} y={40} r={2.8} f={f} />
        <VEye x={55.5} y={40} r={2.8} f={f} />
      </G>
    ),
  },
  flicker: sparkles(p.accent, [
    [20, 24, 1.6],
    [82, 22, 1.4],
  ]),
  flickerOver: true,
});

/** A sticker for the loos: a portal potty — door swung open on a swirling portal, someone peeking out of it. */
const portapotty: Draw = (p, f) => {
  // The portal's arms: three spirals from its eye out to its rim.
  const arm = (base: number) =>
    Array.from({ length: 22 }, (_, i) => {
      const t = i / 21;
      const r = 2 + 17 * t;
      const a = base + t * 4.4;
      return `${i ? 'L' : 'M'}${r1(50 + Math.cos(a) * r)} ${r1(58 + Math.sin(a) * r)}`;
    }).join(' ');
  return {
    ground: [50, 92, 32],
    back: (
      <G>
        <Ellipse cx={50} cy={52} rx={44} ry={40} fill={p.glow} opacity={0.16} />
        {/* The portal's light spilling out of the door. */}
        <Ellipse cx={50} cy={86} rx={30} ry={5} fill={p.accent} opacity={0.3} />
      </G>
    ),
    body: (
      <G>
        {/* The cabin and its domed roof with a vent. */}
        <V d="M24 22 L76 22 L76 88 Q76 90 74 90 L26 90 Q24 90 24 88Z" fill={p.mid} f={f} gloss={[28, 30, 6, 10, 0]} />
        <V d="M20 22 Q20 12 50 10 Q80 12 80 22Z" fill={p.light} f={f} />
        <Path d="M42 15 L58 15" stroke={p.deep} strokeWidth={1.4} strokeLinecap="round" opacity={0.6} />
        {/* Ridges down its sides. */}
        {[27, 73].map((x) => (
          <Path key={x} d={`M${x} 26 L${x} 86`} stroke={p.deep} strokeWidth={1} opacity={0.35} />
        ))}
        {/* The doorway: dark, waiting for the portal. */}
        <Path d="M31 30 L69 30 L69 86 L31 86Z" fill={p.altDeep} />
      </G>
    ),
    spinAt: [50, 58],
    spin: (
      <G>
        <Circle cx={50} cy={58} r={19} fill={p.alt} />
        <Circle cx={50} cy={58} r={19} fill={p.accent} opacity={0.25} />
        {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((b, i) => (
          <Path key={i} d={arm(b)} stroke={i === 1 ? p.light : p.accent} strokeWidth={3.2 - i * 0.6} fill="none" strokeLinecap="round" opacity={0.9} />
        ))}
        <Circle cx={50} cy={58} r={5} fill={p.altDeep} opacity={0.7} />
        <Circle cx={50} cy={58} r={19} fill="none" stroke={p.light} strokeWidth={1.2} opacity={0.8} />
      </G>
    ),
    eyes: {
      box: [42, 52, 16, 8],
      el: (
        <G>
          <VEye x={45} y={56} r={2.8} f={f} />
          <VEye x={55} y={56} r={2.8} f={f} />
        </G>
      ),
    },
    front: (
      <G>
        <Path d="M45 63 Q50 66.4 55 63" stroke={p.altDeep} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        {/* The door frame over the portal's edge. */}
        <Path d="M31 30 L69 30 L69 86 L31 86Z" fill="none" stroke={p.deep} strokeWidth={3} strokeLinejoin="round" />
        {/* The door, swung open, its moon cut out. */}
        <V d="M69 30 L86 36 L86 82 L69 86Z" fill={p.mid} f={f} />
        <Path d="M69 30 L86 36 L86 82 L69 86Z" fill={p.deep} opacity={0.25} />
        <Path d="M80 42 A4 4 0 1 0 82 49 A3.1 3.1 0 1 1 80 42Z" fill={p.accent} />
        <Circle cx={73} cy={62} r={1.4} fill={p.light} />
        {/* OCCUPIED, kind of. */}
        <Path d="M42 25.4 L58 25.4" stroke={p.accent} strokeWidth={2.4} strokeLinecap="round" opacity={0.85} />
      </G>
    ),
    flicker: (
      <G>
        {(
          [
            [18, 40, 1.4],
            [16, 66, 1],
            [88, 22, 1.2],
            [50, 4, 0.9],
          ] as const
        ).map(([x, y, r], i) => (
          <Glow key={i} x={x} y={y} r={r} color={i % 2 ? p.accent : p.light} />
        ))}
      </G>
    ),
    flickerOver: true,
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
  mammoth,
  dino,
  stagskull,
  captain,
  gladiator,
  dreamcube,
  paperplane,
  icosa,
  goggles,
  hologram,
  mousehead,
  mallow,
  hooded,
  prism,
  dove,
  cake,
  stainedglass,
  chromemask,
  discoball,
  totem,
  tent,
  glowstick,
  glowshroom,
  bassbin,
  campfire,
  mainstage,
  bubbles,
  mixtape,
  scarymonster,
  desertsun,
  wave,
  titaniumheart,
  gorgon,
  nightmare,
  gramophone,
  trancestar,
  hedgehog,
  door,
  stampede,
  boombox,
  tulip,
  portapotty,
  refill,
  charger,
  fan,
  spaceman,
  toucan,
  hero,
  gumbo,
  balloon,
  peeker,
  ufo,
  nightlight,
  alleycat,
  monarch,
  silentdisco,
  foodtruck,
  caretent,
  shuttle,
  hammock,
  croissant,
  jackbox,
  bat,
  rose,
};
