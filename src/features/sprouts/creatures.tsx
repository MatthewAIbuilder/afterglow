import type { ReactNode } from 'react';
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

/** A cute dark eye with two catchlights. */
function Dot({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={INK} />
      <Circle cx={x - r * 0.35} cy={y - r * 0.38} r={r * 0.36} fill="#FFFFFF" />
      <Circle cx={x + r * 0.36} cy={y + r * 0.32} r={r * 0.16} fill="#FFFFFF" opacity={0.8} />
    </G>
  );
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

/** Its mirror image across the middle. */
const mirror = (node: ReactNode) => <G transform="translate(100 0) scale(-1 1)">{node}</G>;
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

const eye: Draw = (p, f) => ({
  // Tentacles wriggle below; little spines ring the top.
  back: (
    <G>
      {[-155, -125, -90, -55, -25].map((a) => {
        const c = Math.cos((a * Math.PI) / 180);
        const s = Math.sin((a * Math.PI) / 180);
        return <Path key={a} d={flame(50 + c * 23, 44 + s * 23, 50 + c * 34, 44 + s * 34, 3.6)} fill={p.deep} />;
      })}
    </G>
  ),
  sway: (
    <G>
      {(
        [
          [34, 60, 20, 80, -7],
          [40, 64, 32, 90, -6],
          [47, 66, 45, 93, 4],
          [53, 66, 57, 93, -4],
          [60, 64, 68, 90, 6],
          [66, 60, 80, 80, 7],
        ] as const
      ).map(([bx, by, tx, ty, b], i) => (
        <G key={i}>
          <Path d={flame(bx, by, tx, ty, 5, b)} fill={f.body} stroke={p.deep} strokeWidth={0.9} />
          <Path d={flame(bx, by + 2, bx + (tx - bx) * 0.7, by + (ty - by) * 0.7, 1.4, b * 0.5)} fill={p.light} opacity={0.45} />
        </G>
      ))}
    </G>
  ),
  pivot: [50, 58],
  body: (
    <G>
      <Circle cx={50} cy={44} r={27} fill={f.round} stroke={p.deep} strokeWidth={1.4} />
      <Path d="M28 44 Q50 54 72 44" stroke={p.deep} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Path d="M30 33 Q36 22 47 19" stroke="#FFFFFF" strokeWidth={2} opacity={0.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [27, 21, 46, 46],
    el: (
      <G>
        <Circle cx={50} cy={44} r={21} fill={f.white} />
        <Circle cx={50} cy={44} r={13} fill={f.iris} />
        {[0, 30, 60, 90, 120, 150].map((a) => {
          const c = Math.cos((a * Math.PI) / 180);
          const s = Math.sin((a * Math.PI) / 180);
          return <Line key={a} x1={50 - c * 12} y1={44 - s * 12} x2={50 + c * 12} y2={44 + s * 12} stroke={p.altDeep} strokeWidth={0.5} opacity={0.5} />;
        })}
        <Ellipse cx={50} cy={44} rx={3.8} ry={9.5} fill={INK} />
        <Circle cx={43.5} cy={37} r={3.8} fill="#FFFFFF" opacity={0.92} />
        <Circle cx={56.5} cy={51} r={1.6} fill="#FFFFFF" opacity={0.6} />
      </G>
    ),
  },
});

const phoenix: Draw = (p, f) => {
  const wing = (
    <G>
      {(
        [
          [16, 16, 8, -5],
          [10, 30, 7.5, -4],
          [12, 44, 6.5, -3],
          [20, 56, 5.5, -2],
        ] as const
      ).map(([tx, ty, w, b], i) => (
        <G key={i}>
          <Path d={flame(45, 52, tx, ty, w, b)} fill={f.alt} />
          <Path d={flame(45, 52, 45 + (tx - 45) * 0.75, 52 + (ty - 52) * 0.75, w * 0.45, b * 0.6)} fill={p.light} opacity={0.7} />
        </G>
      ))}
    </G>
  );
  return {
    flicker: (
      <G>
        {both(wing)}
        {(
          [
            [50, 93, 6, 0],
            [38, 89, 5, 3],
            [62, 89, 5, -3],
          ] as const
        ).map(([tx, ty, w, b], i) => (
          <G key={i}>
            <Path d={flame(50, 64, tx, ty, w, b)} fill={f.alt} />
            <Path d={flame(50, 64, 50 + (tx - 50) * 0.7, 64 + (ty - 64) * 0.7, w * 0.4, b * 0.5)} fill={p.light} opacity={0.75} />
          </G>
        ))}
      </G>
    ),
    body: (
      <G>
        {[-14, 0, 14].map((a) => (
          <Path key={a} d={flame(50, 31, 50 + a * 0.5, 13 + Math.abs(a) * 0.3, 2.6, a * 0.12)} fill={f.alt} />
        ))}
        <Path d={flame(50, 70, 50, 36, 10.5)} fill={f.body} />
        <Ellipse cx={47} cy={56} rx={3.2} ry={7} fill="#FFFFFF" opacity={0.35} />
        <Circle cx={50} cy={37} r={9} fill={f.round} />
        <Path d="M47.2 41 L52.8 41 L50 46.5Z" fill={p.accent} />
      </G>
    ),
    eyes: {
      box: [42, 32, 16, 9],
      el: (
        <G>
          <Dot x={46.2} y={36.6} r={1.9} />
          <Dot x={53.8} y={36.6} r={1.9} />
        </G>
      ),
    },
  };
};

const lion: Draw = (p, f) => ({
  sway: (
    <G>
      {Array.from({ length: 16 }, (_, i) => {
        const a = ((i * 22.5 - 90) * Math.PI) / 180;
        return <Path key={i} d={flame(50 + Math.cos(a) * 12, 52 + Math.sin(a) * 12, 50 + Math.cos(a) * 35, 52 + Math.sin(a) * 34, 7, i % 2 ? 4 : -4)} fill={f.alt} />;
      })}
      {Array.from({ length: 16 }, (_, i) => {
        const a = ((i * 22.5 - 78.75) * Math.PI) / 180;
        return <Path key={i} d={flame(50 + Math.cos(a) * 12, 52 + Math.sin(a) * 12, 50 + Math.cos(a) * 28, 52 + Math.sin(a) * 27, 5, i % 2 ? -3 : 3)} fill={p.alt} />;
      })}
    </G>
  ),
  pivot: [50, 52],
  body: (
    <G>
      <Circle cx={37} cy={36} r={6} fill={f.round} />
      <Circle cx={63} cy={36} r={6} fill={f.round} />
      <Circle cx={37} cy={36} r={3} fill={p.deep} />
      <Circle cx={63} cy={36} r={3} fill={p.deep} />
      <Ellipse cx={50} cy={53} rx={17} ry={18} fill={f.round} />
      <Ellipse cx={45.5} cy={61} rx={6} ry={4.8} fill={p.light} />
      <Ellipse cx={54.5} cy={61} rx={6} ry={4.8} fill={p.light} />
      <Ellipse cx={50} cy={66} rx={4} ry={2.8} fill={p.light} />
      <Path d="M45.5 56 Q50 54 54.5 56 Q52.4 60.4 50 61 Q47.6 60.4 45.5 56Z" fill={p.deep} />
      <Path d="M50 61 L50 63 M46.5 64 Q48.5 65.5 50 63 Q51.5 65.5 53.5 64" stroke={p.deep} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      {[43, 41.5, 57, 58.5].map((x, i) => (
        <Circle key={i} cx={x} cy={i % 2 ? 63.5 : 61} r={0.6} fill={p.deep} />
      ))}
    </G>
  ),
  eyes: {
    box: [37, 44, 26, 10],
    el: (
      <G>
        {[43, 57].map((x) => (
          <G key={x}>
            <Path d={`M${x - 4.2} ${49} Q${x} ${45.2} ${x + 4.2} ${49} Q${x} ${52} ${x - 4.2} ${49}Z`} fill={p.accent} />
            <Ellipse cx={x} cy={49} rx={1.2} ry={2.3} fill={INK} />
            <Circle cx={x - 1} cy={48} r={0.7} fill="#FFFFFF" />
          </G>
        ))}
      </G>
    ),
  },
});

const ghost: Draw = (p, f, extra) => ({
  flicker: sparkles(p.accent, [
    [20, 36, 2.6],
    [80, 30, 2],
    [78, 70, 2.4],
  ]),
  flickerOver: true,
  back: (
    <G>
      <Ellipse cx={26} cy={58} rx={6} ry={3.6} fill={p.mid} transform="rotate(-35 26 58)" />
      <Ellipse cx={74} cy={58} rx={6} ry={3.6} fill={p.mid} transform="rotate(35 74 58)" />
    </G>
  ),
  body: (
    <G>
      <Path d="M28 52 C28 31 38 22 50 22 C62 22 72 31 72 52 L72 79 Q66.5 88 61 79 Q55.5 88 50 79 Q44.5 88 39 79 Q33.5 88 28 79Z" fill={f.body} />
      <Path d="M34 36 Q38 27 47 25" stroke="#FFFFFF" strokeWidth={2.2} opacity={0.6} fill="none" strokeLinecap="round" />
      {extra === 'fangs' ? (
        <G>
          <Path d="M39 56 Q50 67 61 56 Q50 61 39 56Z" fill={INK} />
          <Path d="M43.5 58.4 L45 62 L46.5 59.4Z M53.5 59.4 L55 62 L56.5 58.4Z" fill="#FFFFFF" />
        </G>
      ) : (
        <Ellipse cx={50} cy={58} rx={3} ry={3.6} fill={INK} />
      )}
    </G>
  ),
  eyes: {
    box: [33, 37, 34, 16],
    el: (
      <G>
        <Ellipse cx={41} cy={45} rx={5} ry={6.5} fill={INK} />
        <Ellipse cx={59} cy={45} rx={5} ry={6.5} fill={INK} />
        <Glow x={41} y={46} r={1.8} color={p.accent} />
        <Glow x={59} y={46} r={1.8} color={p.accent} />
      </G>
    ),
  },
});

const pumpkin: Draw = (p, f) => {
  const face = 'M37 53 L43.5 45 L48 54Z M52 54 L56.5 45 L63 53Z M48 60.5 L50 57.5 L52 60.5Z M35 63 Q50 77 65 63 L61 65 L58 62 L54.5 66 L50 63 L45.5 66 L42 62 L39 65Z';
  return {
    back: <Path d="M53 33 C60 26 68 28 66 34 C64 38 60 34 63 32" stroke={p.altDeep} strokeWidth={1.6} fill="none" strokeLinecap="round" />,
    body: (
      <G>
        <Path d="M47.5 39 Q46 31 49.5 26 Q53.5 27.5 54 31 Q52.5 35 53 39Z" fill={f.alt} />
        <Path d={flame(53, 33, 66, 27, 4, -2)} fill={p.alt} />
        {(
          [
            [35, 13.5],
            [65, 13.5],
            [43, 12.5],
            [57, 12.5],
            [50, 11],
          ] as const
        ).map(([cx, rx]) => (
          <Ellipse key={cx} cx={cx} cy={60} rx={rx} ry={cx === 50 ? 22 : 20} fill={f.body} stroke={p.deep} strokeWidth={0.8} strokeOpacity={0.7} />
        ))}
        <Path d="M38 45 Q42 41 47 41" stroke="#FFFFFF" strokeWidth={1.6} opacity={0.45} fill="none" strokeLinecap="round" />
        <Path d={face} fill={p.altDeep} opacity={0.9} />
      </G>
    ),
    flicker: (
      <G>
        <Path d={face} fill={p.accent} />
        <Path d="M38.5 52 L43.5 47 L46 52.5Z M54 52.5 L56.5 47 L61.5 52Z" fill="#FFFFFF" opacity={0.7} />
      </G>
    ),
    flickerOver: true,
  };
};

const sheep: Draw = (p, f) => ({
  back: (
    <G>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return <Circle key={i} cx={50 + Math.cos(a) * 21} cy={54 + Math.sin(a) * 20} r={9.5} fill={f.round} stroke={p.deep} strokeWidth={0.7} strokeOpacity={0.5} />;
      })}
      <Circle cx={50} cy={54} r={23} fill={p.light} />
    </G>
  ),
  body: (
    <G>
      {both(<Path d="M38 45 C27 40 21 52 29 57 C35 60 37 51 32 51" stroke={p.deep} strokeWidth={4.4} fill="none" strokeLinecap="round" />)}
      {both(<Ellipse cx={37} cy={53} rx={6} ry={2.8} fill={p.alt} transform="rotate(22 37 53)" />)}
      <Ellipse cx={50} cy={57} rx={11} ry={13} fill={f.alt} />
      {[45, 50, 55].map((x, i) => (
        <Circle key={x} cx={x} cy={i === 1 ? 40 : 42} r={5.2} fill={p.light} />
      ))}
      <Circle cx={42.5} cy={62} r={2} fill={p.accent} opacity={0.45} />
      <Circle cx={57.5} cy={62} r={2} fill={p.accent} opacity={0.45} />
      <Path d="M47.5 63.5 Q50 65.5 52.5 63.5" stroke="#FFFFFF" strokeWidth={1.1} opacity={0.75} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 49, 20, 10],
    el: (
      <G>
        <Circle cx={45.5} cy={54} r={3} fill="#FFFFFF" />
        <Circle cx={54.5} cy={54} r={3} fill="#FFFFFF" />
        <Dot x={46} y={54.5} r={1.8} />
        <Dot x={55} y={54.5} r={1.8} />
      </G>
    ),
  },
});

const twin: Draw = (p, f) => ({
  back: (
    <G>
      {(
        [
          [14, 38, 6],
          [13, 50, 5.5],
          [18, 61, 5],
        ] as const
      ).map(([tx, ty, w], i) => (
        <Path key={i} d={flame(36, 54, tx, ty, w, -3)} fill={p.light} stroke={p.deep} strokeWidth={0.6} strokeOpacity={0.6} />
      ))}
      <Path d="M63 48 L87 36 L85 55 Q81 51 78 57 Q74 52 71 59 Q68 55 64 60Z" fill={p.altDeep} stroke={p.alt} strokeWidth={0.8} />
      <Path d="M64 66 C76 70 79 78 72 84" stroke={p.altDeep} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Path d="M68.5 84.5 L73 80.5 L74.5 86Z" fill={p.altDeep} />
      <Path d={flame(60, 38, 67, 24, 3.6, 3)} fill={p.alt} />
    </G>
  ),
  body: (
    <G>
      <Path d="M50 35 A19 19 0 0 0 50 73Z" fill={f.round} />
      <Path d="M50 35 A19 19 0 0 1 50 73Z" fill={f.alt} />
      <Path d="M38 44 Q41 38 47 37" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.6} fill="none" strokeLinecap="round" />
      <Path d="M43.5 61 Q50 66.5 56.5 61" stroke={INK} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M54 62.4 L55 65.4 L56.2 61.8Z" fill="#FFFFFF" />
    </G>
  ),
  flicker: <Ellipse cx={44} cy={28} rx={11} ry={3.4} fill="none" stroke={p.accent} strokeWidth={2.6} />,
  flickerOver: true,
  eyes: {
    box: [38, 49, 24, 10],
    el: (
      <G>
        <Dot x={43.5} y={54} r={2.6} />
        <Dot x={56.5} y={54} r={2.6} />
      </G>
    ),
  },
});

const astronaut: Draw = (p, f) => ({
  flicker: (
    <G>
      {sparkles(p.accent, [
        [20, 28, 2.6],
        [80, 24, 2],
        [80, 70, 2.4],
        [21, 72, 1.8],
      ])}
      <Glow x={66} y={19} r={2.6} color={p.accent} />
    </G>
  ),
  flickerOver: true,
  body: (
    <G>
      <Line x1={61} y1={29} x2={66} y2={20} stroke={p.deep} strokeWidth={1.6} />
      <Ellipse cx={34} cy={72} rx={4.5} ry={7.5} fill={f.body} transform="rotate(25 34 72)" />
      <Ellipse cx={66} cy={72} rx={4.5} ry={7.5} fill={f.body} transform="rotate(-25 66 72)" />
      <Rect x={37} y={62} width={26} height={21} rx={9} fill={f.body} />
      <Circle cx={50} cy={71} r={2.6} fill={p.accent} />
      <Circle cx={50} cy={46} r={21} fill={f.round} stroke={p.deep} strokeWidth={1.4} />
      <Ellipse cx={50} cy={48} rx={15.5} ry={12.5} fill={f.alt} />
      <Path d="M39 43 Q42 37.5 48 36.5" stroke="#FFFFFF" strokeWidth={2.2} opacity={0.75} fill="none" strokeLinecap="round" />
      <Circle cx={60} cy={41} r={1.1} fill="#FFFFFF" opacity={0.7} />
      <Path d="M47.5 54 Q50 56 52.5 54" stroke={p.accent} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [40, 44, 20, 10],
    el: (
      <G>
        <Ellipse cx={44.5} cy={49} rx={2.3} ry={3} fill={p.accent} />
        <Ellipse cx={55.5} cy={49} rx={2.3} ry={3} fill={p.accent} />
        <Circle cx={44} cy={48} r={0.9} fill="#FFFFFF" />
        <Circle cx={55} cy={48} r={0.9} fill="#FFFFFF" />
      </G>
    ),
  },
});

const rabbit: Draw = (p, f) => ({
  sway: (
    <G>
      <Ellipse cx={41} cy={27} rx={6.5} ry={17} fill={f.round} transform="rotate(-12 41 27)" />
      <Ellipse cx={41} cy={28} rx={3.2} ry={12.5} fill={p.alt} transform="rotate(-12 41 28)" />
      <Ellipse cx={59} cy={27} rx={6.5} ry={17} fill={f.round} transform="rotate(14 59 27)" />
      <Ellipse cx={59} cy={28} rx={3.2} ry={12.5} fill={p.alt} transform="rotate(14 59 28)" />
    </G>
  ),
  pivot: [50, 44],
  body: (
    <G>
      <Ellipse cx={50} cy={57} rx={19} ry={17} fill={f.round} />
      <Path d="M36 50 Q38 44 44 42" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.7} fill="none" strokeLinecap="round" />
      <Circle cx={40} cy={63} r={3} fill={p.alt} opacity={0.6} />
      <Circle cx={60} cy={63} r={3} fill={p.alt} opacity={0.6} />
      <Path d="M48 59.5 Q50 58 52 59.5 Q50 62.5 48 59.5Z" fill={p.altDeep} />
      <Path d="M50 61.5 L50 63.5 M47.5 64.5 Q49 66 50 63.5 Q51 66 52.5 64.5" stroke={p.deep} strokeWidth={1} fill="none" strokeLinecap="round" />
      {both(<Path d="M36 60 L28 58 M36 62.5 L28 63.5" stroke={p.deep} strokeWidth={0.6} opacity={0.6} />)}
    </G>
  ),
  eyes: {
    box: [37, 47, 26, 12],
    el: (
      <G>
        <Dot x={43} y={53} r={3.8} />
        <Dot x={57} y={53} r={3.8} />
      </G>
    ),
  },
  front: (
    <G>
      <Path d="M58 74 Q62 80 67 77" stroke={p.accent} strokeWidth={1} fill="none" />
      <Rect x={69} y={67} width={2.6} height={3} rx={0.8} fill={p.accent} />
      <Circle cx={70.3} cy={76} r={7} fill="#FFF6E0" stroke={p.accent} strokeWidth={2} />
      <Path d="M70.3 76 L70.3 71.6 M70.3 76 L73.6 77.6" stroke={INK} strokeWidth={0.9} strokeLinecap="round" />
    </G>
  ),
});

const spirit: Draw = (p, f) => ({
  sway: (
    <G>
      {(
        [
          [31, 37, 11],
          [69, 36, 11],
          [42, 27, 12],
          [58, 26, 12],
          [50, 34, 13],
        ] as const
      ).map(([x, y, r]) => (
        <G key={x}>
          <Circle cx={x} cy={y} r={r} fill={f.alt} />
          <Circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.35} fill={p.alt} opacity={0.6} />
        </G>
      ))}
    </G>
  ),
  pivot: [50, 44],
  body: (
    <G>
      <Ellipse cx={50} cy={80} rx={9} ry={6} fill={f.round} />
      <Ellipse cx={50} cy={59} rx={15.5} ry={17} fill={f.round} />
      <Path d="M39 52 Q41 46 46 44" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.6} fill="none" strokeLinecap="round" />
      <Ellipse cx={49} cy={66} rx={2.2} ry={2.8} fill={INK} />
    </G>
  ),
  eyes: {
    box: [38, 49, 24, 12],
    el: (
      <G>
        <Circle cx={44} cy={55} r={3.4} fill={INK} />
        <Circle cx={56} cy={56} r={3} fill={INK} />
      </G>
    ),
  },
  flicker: (
    <G>
      {(
        [
          [22, 58],
          [78, 62],
          [74, 18],
          [25, 20],
          [84, 42],
        ] as const
      ).map(([x, y]) => (
        <Glow key={x} x={x} y={y} r={1.4} color={p.accent} />
      ))}
    </G>
  ),
  flickerOver: true,
});

const crystal: Draw = (p, f) => ({
  back: <Ellipse cx={50} cy={52} rx={33} ry={8} fill="none" stroke={p.accent} strokeWidth={1} opacity={0.5} transform="rotate(-14 50 52)" />,
  body: (
    <G>
      <Path d="M50 15 L67 38 L50 85 L33 38Z" fill={f.holo} />
      <Path d="M50 15 L33 38 L50 44Z" fill="#FFFFFF" opacity={0.5} />
      <Path d="M50 15 L67 38 L50 44Z" fill="#FFFFFF" opacity={0.18} />
      <Path d="M33 38 L50 85 L50 44Z" fill={p.alt} opacity={0.25} />
      <Path d="M67 38 L50 85 L50 44Z" fill={p.altDeep} opacity={0.3} />
      <Path d="M50 15 L67 38 L50 85 L33 38Z M33 38 L50 44 L67 38 M50 15 L50 44 L50 85" fill="none" stroke="#FFFFFF" strokeWidth={0.8} opacity={0.65} strokeLinejoin="round" />
      <Path d="M47.5 58 Q50 60 52.5 58" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [41, 49, 18, 8],
    el: (
      <G>
        <Dot x={45.5} y={53} r={2.2} />
        <Dot x={54.5} y={53} r={2.2} />
      </G>
    ),
  },
  flicker: sparkles(p.accent, [
    [22, 30, 3],
    [78, 24, 2.4],
    [80, 66, 2.8],
    [20, 68, 2],
  ]),
  flickerOver: true,
});

const skull: Draw = (p, f) => ({
  body: (
    <G>
      <Path d="M30 46 C30 30 40 22 50 22 C60 22 70 30 70 46 C70 54 66 58 63 60 L63 68 C63 72 60 75 56 75 L44 75 C40 75 37 72 37 68 L37 60 C34 58 30 54 30 46Z" fill={f.round} />
      <Path d="M35 38 Q38 29 46 26" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.6} fill="none" strokeLinecap="round" />
      <Ellipse cx={41} cy={47} rx={6.5} ry={7} fill={INK} />
      <Ellipse cx={59} cy={47} rx={6.5} ry={7} fill={INK} />
      <Path d="M48 59 L50 55 L52 59 Q50 60.4 48 59Z" fill={INK} />
      <Path d="M38 67 L62 67 M44 64 L44 75 M48 65 L48 75 M52 65 L52 75 M56 64 L56 75" stroke={p.deep} strokeWidth={1} />
      <Path d="M57 23 L54.5 29 L58 32.5 L56 37" stroke={p.deep} strokeWidth={1.1} fill="none" />
      <Path d="M53 26 L58.5 27.5 M53.5 31 L59 31.5 M54 35 L59 35.5" stroke={p.deep} strokeWidth={0.9} />
      <Rect x={27} y={50} width={4} height={6} rx={1} fill={p.deep} />
      <Rect x={69} y={50} width={4} height={6} rx={1} fill={p.deep} />
    </G>
  ),
  flicker: (
    <G>
      <Glow x={41} y={48} r={2.6} color={p.accent} />
      <Glow x={59} y={48} r={2.6} color={p.accent} />
    </G>
  ),
  flickerOver: true,
});

const serpent: Draw = (p, f) => ({
  body: (
    <G>
      <Ellipse cx={50} cy={79} rx={23} ry={7} fill={f.body} stroke={p.deep} strokeWidth={0.8} />
      <Ellipse cx={50} cy={71.5} rx={17.5} ry={6} fill={f.body} stroke={p.deep} strokeWidth={0.8} />
      <Path d="M60 70 C72 62 62 52 50 48" stroke={p.mid} strokeWidth={9} fill="none" strokeLinecap="round" />
      <Path d="M60 70 C72 62 62 52 50 48" stroke={p.alt} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} strokeDasharray="2 1.4" />
      <Path d="M50 26 C38 26 33 40 37 50 C40 56 45 58 50 58 C55 58 60 56 63 50 C67 40 62 26 50 26Z" fill={f.body} stroke={p.deep} strokeWidth={0.8} />
      <Ellipse cx={50} cy={46} rx={6} ry={9} fill={p.alt} opacity={0.55} />
      <Path d="M46 42 Q50 40 54 42 M45.5 47 Q50 45 54.5 47 M46 52 Q50 50 54 52" stroke={p.altDeep} strokeWidth={0.8} fill="none" opacity={0.7} />
      <Ellipse cx={50} cy={31} rx={9} ry={7} fill={f.round} />
      <Path d="M44 27.5 Q47 25 51 25" stroke="#FFFFFF" strokeWidth={1.4} opacity={0.6} fill="none" strokeLinecap="round" />
    </G>
  ),
  flicker: <Path d="M50 36.5 L50 41 M50 41 L48 44 M50 41 L52 44" stroke={p.accent} strokeWidth={1.3} fill="none" strokeLinecap="round" />,
  flickerOver: true,
  eyes: {
    box: [41, 27, 18, 7],
    el: (
      <G>
        {[45.5, 54.5].map((x) => (
          <G key={x}>
            <Ellipse cx={x} cy={30.5} rx={2.4} ry={2.1} fill={p.alt} />
            <Ellipse cx={x} cy={30.5} rx={0.7} ry={1.8} fill={INK} />
          </G>
        ))}
      </G>
    ),
  },
});

const alien: Draw = (p, f) => ({
  body: (
    <G>
      <Line x1={42} y1={26} x2={35} y2={14} stroke={p.deep} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={58} y1={26} x2={65} y2={14} stroke={p.deep} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M44 72 L56 72 L58 84 Q50 87 42 84Z" fill={f.body} />
      <Path d="M50 22 C66 22 74 34 72 46 C70 60 58 74 50 76 C42 74 30 60 28 46 C26 34 34 22 50 22Z" fill={f.round} />
      <Path d="M34 36 Q38 27 47 25" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.55} fill="none" strokeLinecap="round" />
      <Path d="M47 65 Q50 67 53 65" stroke={p.deep} strokeWidth={1.2} fill="none" strokeLinecap="round" />
    </G>
  ),
  flicker: (
    <G>
      <Glow x={35} y={13} r={2.8} color={p.accent} />
      <Glow x={65} y={13} r={2.8} color={p.accent} />
    </G>
  ),
  flickerOver: true,
  eyes: {
    box: [31, 39, 38, 17],
    el: (
      <G>
        {both(
          <G>
            <Path d="M32.5 46 C34.5 39.5 44 39.5 47.5 47.5 C45 54 36.5 54.5 32.5 46Z" fill={f.alt} />
            <Ellipse cx={39.5} cy={44.5} rx={2} ry={1.3} fill="#FFFFFF" opacity={0.9} />
            <Circle cx={43} cy={49} r={0.9} fill={p.accent} />
          </G>,
        )}
      </G>
    ),
  },
});

const monster: Draw = (p, f) => {
  let d = '';
  for (let i = 0; i < 18; i++) {
    const a0 = (i * 20 * Math.PI) / 180;
    const a1 = ((i * 20 + 10) * Math.PI) / 180;
    const a2 = ((i + 1) * 20 * Math.PI) / 180;
    const pt = (a: number, r: number) => `${r1(50 + Math.cos(a) * r)} ${r1(57 + Math.sin(a) * r * 0.92)}`;
    d += `${i ? '' : `M${pt(a0, 21)}`} Q${pt(a1, 25)} ${pt(a2, 21)}`;
  }
  return {
    back: (
      <G>
        <Path d={flame(40, 39, 33, 23, 3.6, -2)} fill={p.light} />
        <Path d={flame(60, 39, 67, 23, 3.6, 2)} fill={p.light} />
        <Ellipse cx={42} cy={79} rx={5.5} ry={3.4} fill={p.deep} />
        <Ellipse cx={58} cy={79} rx={5.5} ry={3.4} fill={p.deep} />
      </G>
    ),
    body: (
      <G>
        <Path d={`${d}Z`} fill={f.round} />
        <Path d="M36 46 Q39 40 45 38" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.55} fill="none" strokeLinecap="round" />
        <Path d="M41 63 Q50 72 59 63 Q50 67 41 63Z" fill={INK} />
        <Path d="M44 64.5 L45.4 67.6 L46.8 65.4Z M53.2 65.4 L54.6 67.6 L56 64.5Z" fill="#FFFFFF" />
      </G>
    ),
    eyes: {
      box: [36, 46, 28, 13],
      el: (
        <G>
          <Circle cx={43} cy={52.5} r={5} fill="#FFFFFF" />
          <Circle cx={57} cy={52.5} r={5} fill="#FFFFFF" />
          <Dot x={43.6} y={53} r={3} />
          <Dot x={56.4} y={53} r={3} />
        </G>
      ),
    },
    front: (
      <G>
        {Array.from({ length: 5 }, (_, i) => {
          const a = ((i * 72 - 90) * Math.PI) / 180;
          return <Circle key={i} cx={64 + Math.cos(a) * 3.6} cy={36 + Math.sin(a) * 3.6} r={3.1} fill={p.alt} />;
        })}
        <Circle cx={64} cy={36} r={2.1} fill={p.accent} />
      </G>
    ),
  };
};

const sloth: Draw = (p, f) => ({
  back: (
    <G>
      <Path d="M14 28 Q50 21 86 30" stroke={p.altDeep} strokeWidth={5} fill="none" strokeLinecap="round" />
      {(
        [
          [24, 26, 17, 16, -2],
          [31, 25, 35, 15, 2],
          [70, 26, 74, 16, 2],
          [79, 28, 86, 20, -2],
        ] as const
      ).map(([bx, by, tx, ty, b], i) => (
        <Path key={i} d={flame(bx, by, tx, ty, 3, b)} fill={p.alt} />
      ))}
    </G>
  ),
  body: (
    <G>
      <Path d="M42 54 C37 44 37 34 40 26" stroke={p.mid} strokeWidth={6.5} fill="none" strokeLinecap="round" />
      <Path d="M58 54 C63 44 63 34 60 26" stroke={p.mid} strokeWidth={6.5} fill="none" strokeLinecap="round" />
      <Path d="M37.5 24 Q39 21 41 24 M58.5 24 Q60 21 62 24" stroke={p.deep} strokeWidth={1.2} fill="none" />
      <Ellipse cx={50} cy={66} rx={15} ry={16} fill={f.round} />
      <Ellipse cx={50} cy={70} rx={8} ry={9} fill={p.light} opacity={0.45} />
      <Circle cx={50} cy={50} r={13} fill={f.round} />
      <Ellipse cx={50} cy={52} rx={10} ry={8} fill={p.light} />
      <Ellipse cx={44.5} cy={50.5} rx={4.6} ry={3} fill={p.deep} transform="rotate(18 44.5 50.5)" />
      <Ellipse cx={55.5} cy={50.5} rx={4.6} ry={3} fill={p.deep} transform="rotate(-18 55.5 50.5)" />
      <Ellipse cx={50} cy={55} rx={2.1} ry={1.4} fill={p.accent} />
      <Path d="M47 57.5 Q50 60 53 57.5" stroke={p.accent} strokeWidth={1} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [41, 47, 18, 7],
    el: (
      <G>
        <Dot x={45} y={50.8} r={1.6} />
        <Dot x={55} y={50.8} r={1.6} />
      </G>
    ),
  },
});

const reaper: Draw = (p, f) => ({
  back: <Path d="M64 15 A11 11 0 1 0 81 30 A9 9 0 0 1 64 15Z" fill={p.alt} opacity={0.9} />,
  body: (
    <G>
      <Path d="M50 24 C38 24 32 36 32 48 C32 60 28 72 24 82 L32 79 L37 84 L43 79 L50 85 L57 79 L63 84 L68 79 L76 82 C72 72 68 60 68 48 C68 36 62 24 50 24Z" fill={f.body} />
      <Path d="M50 34 C41 34 38 42 38 49 C38 56 43 60 50 60 C57 60 62 56 62 49 C62 42 59 34 50 34Z" fill={INK} stroke={p.light} strokeWidth={1.2} strokeOpacity={0.6} />
      <Path d="M38 66 Q44 70 50 66 Q56 70 62 66" stroke={p.light} strokeWidth={0.9} opacity={0.35} fill="none" />
    </G>
  ),
  eyes: {
    box: [40, 45, 20, 9],
    el: (
      <G>
        <Glow x={45} y={49.5} r={2.2} color={p.accent} />
        <Glow x={55} y={49.5} r={2.2} color={p.accent} />
      </G>
    ),
  },
});

const jelly: Draw = (p, f) => ({
  sway: (
    <G>
      {[37, 43.5, 50, 56.5, 63].map((x, i) => (
        <Path key={x} d={`M${x} 55 C${x - 4} 63 ${x + 4} 70 ${x} 77 C${x - 3} 82 ${x + 2} 86 ${x - 1} ${i % 2 ? 88 : 91}`} stroke={p.alt} strokeWidth={2} opacity={0.85} fill="none" strokeLinecap="round" />
      ))}
      {[46.5, 53.5].map((x) => (
        <Path key={x} d={`M${x} 56 C${x + 3} 62 ${x - 3} 67 ${x} 74`} stroke={p.light} strokeWidth={3.6} opacity={0.5} fill="none" strokeLinecap="round" />
      ))}
    </G>
  ),
  pivot: [50, 40],
  body: (
    <G>
      <Path d="M26 54 C26 34 38 24 50 24 C62 24 74 34 74 54 Q70 59 66 55 Q62 60 58 55 Q54 60 50 55 Q46 60 42 55 Q38 60 34 55 Q30 59 26 54Z" fill={f.round} opacity={0.95} />
      <Path d="M33 42 Q37 31 47 28" stroke="#FFFFFF" strokeWidth={2.4} opacity={0.6} fill="none" strokeLinecap="round" />
      <Path d="M47.5 51.5 Q50 53.5 52.5 51.5" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <Circle cx={40} cy={50} r={2.2} fill={p.altDeep} opacity={0.5} />
      <Circle cx={60} cy={50} r={2.2} fill={p.altDeep} opacity={0.5} />
    </G>
  ),
  eyes: {
    box: [40, 42, 20, 10],
    el: (
      <G>
        <Dot x={44.5} y={47} r={2.5} />
        <Dot x={55.5} y={47} r={2.5} />
      </G>
    ),
  },
  flicker: (
    <G>
      {(
        [
          [37, 40],
          [63, 38],
          [56, 31],
          [44, 32],
        ] as const
      ).map(([x, y]) => (
        <Glow key={x} x={x} y={y} r={1.2} color={p.accent} />
      ))}
    </G>
  ),
  flickerOver: true,
});

const beast: Draw = (p, f) => ({
  back: (
    <G>
      <Path d={flame(35, 38, 24, 13, 5.5, 7)} fill={f.alt} />
      <Path d={flame(65, 38, 76, 13, 5.5, -7)} fill={f.alt} />
    </G>
  ),
  body: (
    <G>
      {both(
        <G>
          <Path d={flame(28, 58, 17, 63, 4)} fill={p.mid} />
          <Path d={flame(28, 50, 18, 47, 4)} fill={p.mid} />
        </G>,
      )}
      <Path d="M24 52 C24 34 36 28 50 28 C64 28 76 34 76 52 C76 66 66 76 50 76 C34 76 24 66 24 52Z" fill={f.round} />
      <Path d="M31 40 Q36 32 45 31" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.45} fill="none" strokeLinecap="round" />
      <Path d="M32 42 L46 46.5 L50 44.5 L54 46.5 L68 42 L66.5 46.5 L54 50 L46 50 L33.5 46.5Z" fill={p.deep} opacity={0.75} />
      <Path d="M33 60 Q50 74 67 60 Q64 70 50 73 Q36 70 33 60Z" fill={INK} />
      <Path d="M39.5 62.5 L42.5 69.5 L45.5 64.5Z M60.5 62.5 L57.5 69.5 L54.5 64.5Z" fill={p.alt} />
      <Path d="M47 65.5 L48.5 68 L50 65.8 L51.5 68 L53 65.5" stroke={p.alt} strokeWidth={1} fill="none" />
      <Ellipse cx={47} cy={56} rx={1.2} ry={0.8} fill={p.deep} />
      <Ellipse cx={53} cy={56} rx={1.2} ry={0.8} fill={p.deep} />
    </G>
  ),
  eyes: {
    box: [33, 45, 34, 11],
    el: both(
      <G>
        <Path d="M34.5 48.5 L46 51 L44.5 54 Q38 54.5 34.5 48.5Z" fill={p.accent} />
        <Circle cx={41.5} cy={51.6} r={1.2} fill="#FFFFFF" />
      </G>,
    ),
  },
});

const bot: Draw = (p, f) => ({
  body: (
    <G>
      <Line x1={50} y1={26} x2={50} y2={17} stroke={p.deep} strokeWidth={2} />
      <Rect x={24.5} y={38} width={5} height={14} rx={2} fill={p.deep} />
      <Rect x={70.5} y={38} width={5} height={14} rx={2} fill={p.deep} />
      <Rect x={45} y={60} width={10} height={6} fill={p.deep} />
      <Rect x={37} y={64} width={26} height={18} rx={6} fill={f.body} />
      <Circle cx={45} cy={72.5} r={2} fill={p.accent} />
      <Circle cx={55} cy={72.5} r={2} fill={p.light} />
      <Rect x={28} y={25} width={44} height={37} rx={11} fill={f.round} />
      <Path d="M33 32 Q35 28 41 28" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.6} fill="none" strokeLinecap="round" />
      <Rect x={33} y={32} width={34} height={23} rx={7} fill={f.alt} />
      <Path d="M42 49 Q45 46.4 48 49 Q51 51.6 54 49 Q56 47.4 58 48.6" stroke={p.accent} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  flicker: <Glow x={50} y={15} r={3.2} color={p.accent} />,
  flickerOver: true,
  eyes: {
    box: [36, 35, 28, 10],
    el: (
      <G>
        <Rect x={39} y={37.5} width={8} height={6} rx={3} fill={p.accent} />
        <Rect x={53} y={37.5} width={8} height={6} rx={3} fill={p.accent} />
      </G>
    ),
  },
});

const wolf: Draw = (p, f) => ({
  body: (
    <G>
      {both(
        <G>
          <Path d="M29 42 L27 15 L45 29Z" fill={f.body} />
          <Path d="M31.5 37 L30.5 21.5 L40.5 30Z" fill={p.deep} />
        </G>,
      )}
      <Path d="M27 45 C27 32 38 28 50 28 C62 28 73 32 73 45 C73 55 67 61 61 65 L54.5 75 Q50 78 45.5 75 L39 65 C33 61 27 55 27 45Z" fill={f.round} />
      {both(<Path d="M27 47 C30 55 35 59 41 61 L33 62 L36 65 L29 61Z" fill={p.alt} />)}
      <Path d="M42 58 Q50 54 58 58 L54.5 72 Q50 75 45.5 72Z" fill={p.alt} />
      <Ellipse cx={50} cy={70} rx={3.4} ry={2.4} fill={INK} />
      <Path d="M35 37 Q39 31 45 30" stroke="#FFFFFF" strokeWidth={1.6} opacity={0.4} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [35, 42, 30, 10],
    el: both(
      <G>
        <Circle cx={41.5} cy={47} r={4} fill={p.accent} opacity={0.25} />
        <Path d="M36.5 47 Q41.5 43 46 47 Q41.5 50.2 36.5 47Z" fill={p.accent} />
        <Ellipse cx={41.5} cy={47} rx={0.8} ry={1.9} fill={INK} />
      </G>,
    ),
  },
});

const moth: Draw = (p, f) => ({
  sway: (
    <G>
      {both(
        <G>
          <Path d="M48 46 C36 22 16 18 14 33 C12 46 30 52 48 50Z" fill={f.round} stroke={p.deep} strokeWidth={0.7} />
          <Path d="M48 53 C34 56 23 68 29 77 C35 83 46 69 49 57Z" fill={f.body} stroke={p.deep} strokeWidth={0.7} />
          <Path d="M46 47 C38 40 28 34 20 32 M46 49 C38 46 28 44 18 42" stroke={p.light} strokeWidth={0.7} opacity={0.5} fill="none" />
          <Circle cx={27} cy={37} r={4.4} fill={p.alt} />
          <Circle cx={27} cy={37} r={2} fill={p.accent} />
          <Circle cx={35} cy={67} r={2.6} fill={p.alt} opacity={0.85} />
        </G>,
      )}
    </G>
  ),
  pivot: [50, 50],
  flap: true,
  body: (
    <G>
      <Path d={flame(48, 35, 35, 17, 2.6, -4)} fill={p.light} opacity={0.9} />
      <Path d={flame(52, 35, 65, 17, 2.6, 4)} fill={p.light} opacity={0.9} />
      <Ellipse cx={50} cy={56} rx={5} ry={14} fill={p.deep} />
      <Path d="M46 52 L54 52 M45.5 57 L54.5 57 M46 62 L54 62" stroke={p.mid} strokeWidth={1} opacity={0.7} />
      <Circle cx={50} cy={43} r={7} fill={p.light} />
      <Circle cx={50} cy={38.5} r={6} fill={f.round} />
    </G>
  ),
  eyes: {
    box: [44, 34, 12, 8],
    el: (
      <G>
        <Dot x={47.6} y={38.5} r={1.8} />
        <Dot x={52.4} y={38.5} r={1.8} />
      </G>
    ),
  },
  flicker: (
    <G>
      {(
        [
          [20, 58],
          [80, 56],
          [50, 86],
          [64, 22],
        ] as const
      ).map(([x, y]) => (
        <Glow key={x} x={x} y={y} r={1.1} color={p.accent} />
      ))}
    </G>
  ),
  flickerOver: true,
});

const cat: Draw = (p, f, extra) => {
  const crowned = extra === 'crown';
  return {
    back: crowned ? undefined : (
      <G>
        <Line x1={74} y1={12} x2={74} y2={15} stroke={p.light} strokeWidth={0.8} opacity={0.6} />
        <Circle cx={74} cy={22} r={7.5} fill={f.round} />
        <Path d="M66.5 22 L81.5 22 M67.5 18 L80.5 18 M67.5 26 L80.5 26 M74 14.5 L74 29.5 M70 15.5 Q68 22 70 28.5 M78 15.5 Q80 22 78 28.5" stroke={p.deep} strokeWidth={0.5} opacity={0.6} fill="none" />
        <Circle cx={71.5} cy={19} r={1.4} fill="#FFFFFF" opacity={0.9} />
      </G>
    ),
    flicker: crowned
      ? undefined
      : sparkles(p.accent, [
          [62, 14, 2.4],
          [86, 30, 2],
          [64, 33, 1.6],
          [20, 40, 2],
        ]),
    flickerOver: true,
    body: (
      <G>
        {both(
          <G>
            <Path d="M30 42 L32 18 L47 31Z" fill={f.body} />
            <Path d="M33 37 L34 24 L42.5 31Z" fill={p.deep} />
          </G>,
        )}
        <Ellipse cx={50} cy={51} rx={22} ry={19} fill={f.round} />
        <Path d="M33 42 Q37 35 44 33" stroke="#FFFFFF" strokeWidth={1.6} opacity={0.5} fill="none" strokeLinecap="round" />
        <Ellipse cx={46.2} cy={59} rx={4.6} ry={3.6} fill={p.light} />
        <Ellipse cx={53.8} cy={59} rx={4.6} ry={3.6} fill={p.light} />
        <Path d="M48.3 55.5 L51.7 55.5 L50 57.6Z" fill={p.deep} />
        <Path d="M46.5 61 Q48.5 63 50 61 Q51.5 63 53.5 61" stroke={p.deep} strokeWidth={1} fill="none" strokeLinecap="round" />
        {both(<Path d="M40 58 L29 56 M40 60.5 L29 62" stroke={p.light} strokeWidth={0.6} opacity={0.7} />)}
      </G>
    ),
    eyes: crowned
      ? {
          box: [36, 43, 28, 10],
          el: both(
            <G>
              <Path d="M37.5 48 Q42 43.5 46.5 48 Q42 51.5 37.5 48Z" fill={p.accent} />
              <Ellipse cx={42} cy={48} rx={0.9} ry={2.2} fill={INK} />
            </G>,
          ),
        }
      : undefined,
    front: crowned ? (
      <G>
        <Path d="M38 33 L37 21 L44 26.5 L50 18 L56 26.5 L63 21 L62 33Z" fill={p.accent} stroke={p.altDeep} strokeWidth={0.6} />
        <Circle cx={50} cy={28.5} r={1.8} fill={p.altDeep} />
        <Circle cx={43} cy={30} r={1.1} fill="#FFFFFF" opacity={0.8} />
        <Circle cx={57} cy={30} r={1.1} fill="#FFFFFF" opacity={0.8} />
      </G>
    ) : (
      <G>
        {both(<Path d="M30.5 44 Q30.5 41 34 41 L46 41 Q48.5 41 48 44 L46.5 49 Q45.5 52 42 52 L36 52 Q31.5 52 31 48Z" fill={f.alt} />)}
        <Path d="M48 43 Q50 41.5 52 43" stroke={p.alt} strokeWidth={1.4} fill="none" />
        {both(<Path d="M35 49 L41 43 M38.5 50 L43 45.5" stroke={p.accent} strokeWidth={1} opacity={0.75} />)}
      </G>
    ),
  };
};

const owl: Draw = (p, f) => ({
  body: (
    <G>
      <Path d={flame(36, 37, 29, 21, 4, -2)} fill={p.deep} />
      <Path d={flame(64, 37, 71, 21, 4, 2)} fill={p.deep} />
      <Ellipse cx={50} cy={56} rx={21} ry={25} fill={f.body} />
      <Ellipse cx={50} cy={67} rx={12} ry={13} fill={p.alt} opacity={0.9} />
      {[61, 66, 71].map((y) => (
        <Path key={y} d={`M44 ${y} L46 ${y + 2} L48 ${y} M52 ${y} L54 ${y + 2} L56 ${y}`} stroke={p.deep} strokeWidth={0.8} opacity={0.5} fill="none" />
      ))}
      {both(<Path d="M30 50 C26 62 30 74 38 79 C36 69 36 58 34 50Z" fill={p.deep} />)}
      <Path d="M44 81 L44 84 M47 81 L47 84 M53 81 L53 84 M56 81 L56 84" stroke={p.light} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={41} cy={46} r={9} fill={p.alt} />
      <Circle cx={59} cy={46} r={9} fill={p.alt} />
      <Path d="M47.5 52 L52.5 52 L50 57.5Z" fill={p.light} stroke={p.deep} strokeWidth={0.5} />
    </G>
  ),
  eyes: {
    box: [31, 37, 38, 18],
    el: (
      <G>
        {[41, 59].map((x) => (
          <G key={x}>
            <Circle cx={x} cy={46} r={6.2} fill={p.accent} opacity={0.3} />
            <Circle cx={x} cy={46} r={5} fill={p.accent} />
            <Dot x={x} y={46} r={3.3} />
          </G>
        ))}
      </G>
    ),
  },
});

const fox: Draw = (p, f) => ({
  sway: (
    <G>
      <Path d="M58 72 C80 78 90 58 81 44 C79 57 71 63 57 63Z" fill={f.body} />
      <Path d="M81 44 C79 52 76 56 72 59 C78 60 84 54 81 44Z" fill={p.alt} />
    </G>
  ),
  pivot: [58, 68],
  body: (
    <G>
      <Ellipse cx={50} cy={74} rx={12} ry={9} fill={f.body} />
      {both(
        <G>
          <Path d="M32 39 L30 16 L46 28Z" fill={f.body} />
          <Path d="M34 34 L33 22 L41.5 29Z" fill={p.deep} />
        </G>,
      )}
      <Path d="M26 45 C28 33 38 28 50 28 C62 28 72 33 74 45 C72 57 60 67 50 71 C40 67 28 57 26 45Z" fill={f.round} />
      {both(<Path d="M26 45 C32 51 40 53 46 57 C46 63 48 67 50 71 C40 67 28 57 26 45Z" fill={p.alt} />)}
      <Path d="M35 37 Q39 32 45 31" stroke="#FFFFFF" strokeWidth={1.6} opacity={0.45} fill="none" strokeLinecap="round" />
      <Ellipse cx={50} cy={67} rx={3} ry={2.2} fill={INK} />
    </G>
  ),
  eyes: {
    box: [37, 43, 26, 9],
    el: (
      <G>
        <Dot x={42} y={47.5} r={2.9} />
        <Dot x={58} y={47.5} r={2.9} />
      </G>
    ),
  },
});

const dragon: Draw = (p, f) => ({
  back: (
    <G>
      {both(<Path d="M34 50 L13 29 L18 43 L11 47 L21 53 L18 60 L34 58Z" fill={p.deep} stroke={p.mid} strokeWidth={0.8} />)}
      <Path d={flame(39, 33, 30, 15, 3.6, -3)} fill={p.alt} />
      <Path d={flame(61, 33, 70, 15, 3.6, 3)} fill={p.alt} />
    </G>
  ),
  body: (
    <G>
      {[44, 50, 56].map((x) => (
        <Path key={x} d={flame(x, 28, x, x === 50 ? 18 : 20.5, 2.4)} fill={p.alt} />
      ))}
      <Path d="M30 46 C30 32 40 26 50 26 C60 26 70 32 70 46 C70 52 68 56 66 58 C71 63 69 74 58 75 L42 75 C31 74 29 63 34 58 C32 56 30 52 30 46Z" fill={f.round} />
      <Path d="M35 38 Q39 31 46 29" stroke="#FFFFFF" strokeWidth={1.6} opacity={0.45} fill="none" strokeLinecap="round" />
      <Ellipse cx={50} cy={64} rx={14} ry={8} fill={p.light} />
      <Ellipse cx={45} cy={61.5} rx={1.5} ry={1} fill={INK} />
      <Ellipse cx={55} cy={61.5} rx={1.5} ry={1} fill={INK} />
      <Path d="M42 68 Q50 71 58 68" stroke={p.deep} strokeWidth={1} fill="none" strokeLinecap="round" />
    </G>
  ),
  flicker: (
    <G>
      <Path d={flame(58, 69, 80, 74, 4.2, -3)} fill={p.accent} />
      <Path d={flame(59, 69, 74, 72.5, 1.8, -2)} fill="#FFFFFF" opacity={0.75} />
      <Path d={star(84, 66, 2.2)} fill={p.accent} />
      <Path d={star(82, 80, 1.6)} fill="#FFFFFF" opacity={0.8} />
    </G>
  ),
  flickerOver: true,
  eyes: {
    box: [36, 40, 28, 11],
    el: (
      <G>
        {[42, 58].map((x) => (
          <G key={x}>
            <Ellipse cx={x} cy={45.5} rx={3.6} ry={4} fill={p.accent} />
            <Ellipse cx={x} cy={45.5} rx={0.9} ry={3} fill={INK} />
            <Circle cx={x - 1.4} cy={44} r={0.8} fill="#FFFFFF" />
          </G>
        ))}
      </G>
    ),
  },
});

const bear: Draw = (p, f) => ({
  back: <Ellipse cx={50} cy={82} rx={20} ry={10} fill={f.body} />,
  body: (
    <G>
      <Circle cx={32} cy={34} r={7.5} fill={f.round} />
      <Circle cx={68} cy={34} r={7.5} fill={f.round} />
      <Circle cx={32} cy={34} r={3.8} fill={p.deep} />
      <Circle cx={68} cy={34} r={3.8} fill={p.deep} />
      <Ellipse cx={50} cy={51} rx={21} ry={19} fill={f.round} />
      <Path d="M34 41 Q38 35 45 33" stroke="#FFFFFF" strokeWidth={1.6} opacity={0.5} fill="none" strokeLinecap="round" />
      <Ellipse cx={50} cy={59} rx={9} ry={7} fill={p.light} />
      <Ellipse cx={50} cy={56} rx={3.6} ry={2.6} fill={INK} />
      <Circle cx={49} cy={55.2} r={0.9} fill="#FFFFFF" opacity={0.7} />
      <Path d="M50 58.6 L50 60.6 M46.5 61.5 Q50 64.5 53.5 61.5" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [38, 44, 24, 9],
    el: (
      <G>
        <Dot x={43} y={48.5} r={2.4} />
        <Dot x={57} y={48.5} r={2.4} />
      </G>
    ),
  },
  front: (
    <G>
      <Path d="M35 66 Q50 81 65 66" stroke={p.alt} strokeWidth={2.8} fill="none" strokeDasharray="2.6 1.2" />
      <Circle cx={50} cy={76.5} r={4.6} fill={p.alt} stroke={p.altDeep} strokeWidth={1} />
      <Path d={star(50, 76.5, 2.6)} fill={p.accent} />
    </G>
  ),
});

const wisp: Draw = (p, f) => ({
  flicker: (
    <G>
      <Path d={flame(50, 54, 38, 88, 9, 8)} fill={f.body} opacity={0.5} />
      <Path d={flame(50, 58, 44, 84, 4.5, 4)} fill={p.light} opacity={0.4} />
    </G>
  ),
  body: (
    <G>
      <Ellipse cx={39} cy={31} rx={6} ry={3} fill={p.light} opacity={0.55} transform="rotate(-50 39 31)" />
      <Ellipse cx={61} cy={31} rx={6} ry={3} fill={p.light} opacity={0.55} transform="rotate(50 61 31)" />
      <Circle cx={50} cy={48} r={16} fill={f.round} />
      <Path d="M39 42 Q42 36 48 35" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.6} fill="none" strokeLinecap="round" />
      <Path d="M47.5 52.5 Q50 54.5 52.5 52.5" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <Circle cx={42} cy={51} r={1.8} fill={p.altDeep} opacity={0.5} />
      <Circle cx={58} cy={51} r={1.8} fill={p.altDeep} opacity={0.5} />
    </G>
  ),
  eyes: {
    box: [40, 42, 20, 10],
    el: (
      <G>
        <Dot x={45} y={47.5} r={2.3} />
        <Dot x={55} y={47.5} r={2.3} />
      </G>
    ),
  },
  front: sparkles(p.alt, [
    [24, 28, 2.6],
    [76, 26, 2],
    [78, 64, 2.2],
  ]),
});

const ferris: Draw = (p, f) => ({
  back: <Path d="M50 46 L33 88 M50 46 L67 88 M26 88 L74 88" stroke={p.altDeep} strokeWidth={2.6} strokeLinecap="round" fill="none" />,
  sway: (
    <G>
      <Circle cx={50} cy={46} r={28} fill="none" stroke={p.mid} strokeWidth={2.6} />
      <Circle cx={50} cy={46} r={24} fill="none" stroke={p.light} strokeWidth={0.6} opacity={0.6} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        const x = 50 + Math.cos(a) * 28;
        const y = 46 + Math.sin(a) * 28;
        const lx = 50 + Math.cos(a + Math.PI / 8) * 28;
        const ly = 46 + Math.sin(a + Math.PI / 8) * 28;
        return (
          <G key={i}>
            <Line x1={50} y1={46} x2={x} y2={y} stroke={p.light} strokeWidth={0.9} opacity={0.7} />
            <Line x1={x} y1={y} x2={x} y2={y + 3} stroke={p.light} strokeWidth={0.8} />
            <Rect x={x - 3.6} y={y + 2.6} width={7.2} height={6} rx={2} fill={i % 2 ? p.alt : p.accent} />
            <Rect x={x - 2.4} y={y + 3.6} width={4.8} height={2} rx={0.8} fill="#FFFFFF" opacity={0.55} />
            <Circle cx={lx} cy={ly} r={1.2} fill={p.accent} />
          </G>
        );
      })}
    </G>
  ),
  pivot: [50, 46],
  flicker: sparkles(p.accent, [
    [16, 20, 2.4],
    [86, 26, 2],
    [84, 74, 2.2],
  ]),
  flickerOver: true,
  body: (
    <G>
      <Circle cx={50} cy={46} r={10} fill={f.round} stroke={p.deep} strokeWidth={0.8} />
      <Path d="M43.5 42 Q45.5 38.5 49 38" stroke="#FFFFFF" strokeWidth={1.2} opacity={0.6} fill="none" strokeLinecap="round" />
      <Path d="M47.5 49.4 Q50 51.4 52.5 49.4" stroke={INK} strokeWidth={1} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [43, 41, 14, 7],
    el: (
      <G>
        <Dot x={46.6} y={44.6} r={1.7} />
        <Dot x={53.4} y={44.6} r={1.7} />
      </G>
    ),
  },
});

const rail: Draw = (p, f) => ({
  body: (
    <G>
      <Path d="M39 52 L29 31 M61 52 L71 31" stroke={p.mid} strokeWidth={5.5} strokeLinecap="round" />
      <Circle cx={28.5} cy={30} r={3.4} fill={p.mid} />
      <Circle cx={71.5} cy={30} r={3.4} fill={p.mid} />
      <Ellipse cx={50} cy={56} rx={17} ry={16} fill={f.round} />
      <Path d="M38 48 Q41 42 47 41" stroke="#FFFFFF" strokeWidth={1.8} opacity={0.6} fill="none" strokeLinecap="round" />
      <Path d="M45.5 56 Q50 61.5 54.5 56Z" fill={INK} />
      <Circle cx={41} cy={56} r={2.2} fill={p.accent} opacity={0.35} />
      <Circle cx={59} cy={56} r={2.2} fill={p.accent} opacity={0.35} />
    </G>
  ),
  eyes: {
    box: [40, 46, 20, 8],
    el: (
      <G>
        <Dot x={45} y={50} r={2.4} />
        <Dot x={55} y={50} r={2.4} />
      </G>
    ),
  },
  flicker: (
    <G>
      <Path d="M27 31 L21 17 M73 31 L79 17" stroke={p.accent} strokeWidth={7} strokeLinecap="round" opacity={0.25} />
      <Path d="M27 31 L21 17 M73 31 L79 17" stroke={p.accent} strokeWidth={3.2} strokeLinecap="round" />
      <Path d="M26.4 29 L22.4 19.6 M73.6 29 L77.6 19.6" stroke="#FFFFFF" strokeWidth={1} strokeLinecap="round" opacity={0.8} />
    </G>
  ),
  flickerOver: true,
  front: (
    <G>
      <Rect x={22} y={68} width={4.5} height={18} rx={1} fill={p.altDeep} />
      <Rect x={73.5} y={68} width={4.5} height={18} rx={1} fill={p.altDeep} />
      <Rect x={14} y={63} width={72} height={7.5} rx={3.75} fill={f.alt} />
      <Path d="M18 65.4 L82 65.4" stroke="#FFFFFF" strokeWidth={1} opacity={0.6} strokeLinecap="round" />
      <Path d="M27 76 L73 76" stroke={p.altDeep} strokeWidth={2} />
    </G>
  ),
});

const sunrise: Draw = (p, f) => ({
  flicker: (
    <G>
      {Array.from({ length: 9 }, (_, i) => {
        const a = ((-170 + i * 20) * Math.PI) / 180;
        return <Path key={i} d={flame(50 + Math.cos(a) * 23, 62 + Math.sin(a) * 23, 50 + Math.cos(a) * 37, 62 + Math.sin(a) * 37, 3.6)} fill={p.alt} />;
      })}
    </G>
  ),
  body: (
    <G>
      <Circle cx={50} cy={62} r={20} fill={f.round} />
      <Path d="M37 54 Q40 47 47 45" stroke="#FFFFFF" strokeWidth={2} opacity={0.6} fill="none" strokeLinecap="round" />
      <Path d="M46 62 Q50 65.5 54 62" stroke={INK} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Circle cx={41.5} cy={61} r={2.4} fill={p.accent} opacity={0.5} />
      <Circle cx={58.5} cy={61} r={2.4} fill={p.accent} opacity={0.5} />
    </G>
  ),
  eyes: {
    box: [41, 52, 18, 8],
    el: (
      <G>
        <Dot x={44.6} y={56} r={2.2} />
        <Dot x={55.4} y={56} r={2.2} />
      </G>
    ),
  },
  front: (
    <G>
      <Path d="M9.6 72 Q22 64 40 72 Q58 80 76 70 Q85 66 91.4 70 A46 46 0 0 1 9.6 72Z" fill={p.altDeep} opacity={0.75} />
      <Path d="M17 82 Q34 74 56 82 Q72 87 84.9 80 A46 46 0 0 1 17 82Z" fill={p.altDeep} />
    </G>
  ),
});

const lantern: Draw = (p, f) => ({
  back: (
    <G>
      <Path d="M40 31 Q50 15 60 31" stroke={p.alt} strokeWidth={2} fill="none" />
      <Circle cx={50} cy={20} r={2} fill="none" stroke={p.alt} strokeWidth={1.4} />
    </G>
  ),
  flicker: (
    <G>
      <Circle cx={50} cy={60} r={16} fill={p.accent} opacity={0.35} />
      <Path d={flame(50, 68, 50, 52, 5.5)} fill={p.accent} />
      <Path d={flame(50, 68, 50, 58.5, 2.6)} fill="#FFFFFF" />
    </G>
  ),
  body: (
    <G>
      <Path d="M36 35 L64 35 L60 29.5 L40 29.5Z" fill={f.alt} />
      <Rect x={36} y={35} width={28} height={36} rx={9} fill={f.round} opacity={0.55} stroke={p.alt} strokeWidth={1.5} />
      <Path d="M40 41 Q41 38 44 37.5" stroke="#FFFFFF" strokeWidth={1.4} opacity={0.7} fill="none" strokeLinecap="round" />
      <Path d="M38 71 L62 71 L59.5 77 L40.5 77Z" fill={f.alt} />
      <Path d="M47 50.6 Q50 53 53 50.6" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
    </G>
  ),
  eyes: {
    box: [41, 42, 18, 8],
    el: (
      <G>
        <Dot x={44.6} y={46} r={2.1} />
        <Dot x={55.4} y={46} r={2.1} />
      </G>
    ),
  },
  front: (
    <G>
      <Glow x={24} y={60} r={1.3} color={p.accent} />
      <Glow x={77} y={48} r={1.1} color={p.accent} />
      <Glow x={72} y={78} r={1.2} color={p.accent} />
    </G>
  ),
});

const confetti: Draw = (p, f) => {
  const bits: [number, number, number, string][] = [
    [30, 32, 20, p.alt],
    [40, 22, -30, p.accent],
    [50, 15, 10, p.altDeep],
    [60, 23, 40, p.light],
    [70, 31, -15, p.alt],
    [35, 41, 60, p.accent],
    [65, 40, -50, p.altDeep],
    [45, 31, 30, p.light],
    [56, 33, -20, p.alt],
    [24, 22, 15, p.altDeep],
    [77, 20, -35, p.accent],
  ];
  return {
    body: (
      <G>
        <Path d="M34 46 L66 46 L52.5 86 Q50 89.5 47.5 86Z" fill={f.body} />
        <Path d="M44 69 L58.5 67.5 M47 79 L55 78" stroke={p.alt} strokeWidth={2.6} strokeLinecap="round" />
        <Ellipse cx={50} cy={46} rx={16} ry={4} fill={p.light} />
        <Ellipse cx={50} cy={46} rx={12} ry={2.4} fill={p.deep} />
        <Path d="M47 60.5 Q50 63 53 60.5" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />
      </G>
    ),
    eyes: {
      box: [42, 52, 16, 8],
      el: (
        <G>
          <Dot x={45.5} y={56} r={2.1} />
          <Dot x={54.5} y={56} r={2.1} />
        </G>
      ),
    },
    flicker: (
      <G>
        <Path d="M45 44 C40 36 47 32 42 24" stroke={p.accent} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <Path d="M55 44 C60 36 53 30 59 22" stroke={p.alt} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        {bits.map(([x, y, rot, c], i) => (
          <Rect key={i} x={x - 2} y={y - 1.2} width={4} height={2.4} rx={0.6} fill={c} transform={`rotate(${rot} ${x} ${y})`} />
        ))}
      </G>
    ),
    flickerOver: true,
  };
};

const frog: Draw = (p, f) => ({
  body: (
    <G>
      <Circle cx={38} cy={46} r={8} fill={f.round} />
      <Circle cx={62} cy={46} r={8} fill={f.round} />
      <Ellipse cx={50} cy={64} rx={22} ry={17} fill={f.round} />
      <Ellipse cx={50} cy={71} rx={13} ry={9} fill={p.light} opacity={0.7} />
      <Path d="M33 56 Q36 50 42 49" stroke="#FFFFFF" strokeWidth={1.6} opacity={0.5} fill="none" strokeLinecap="round" />
      <Path d="M38 61 Q50 69 62 61" stroke={INK} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Ellipse cx={36} cy={80} rx={6} ry={3} fill={p.mid} />
      <Ellipse cx={64} cy={80} rx={6} ry={3} fill={p.mid} />
    </G>
  ),
  eyes: {
    box: [29, 39, 42, 14],
    el: (
      <G>
        <Circle cx={38} cy={46} r={5.4} fill="#FFFFFF" />
        <Circle cx={62} cy={46} r={5.4} fill="#FFFFFF" />
        <Dot x={38.6} y={46.4} r={3.3} />
        <Dot x={61.4} y={46.4} r={3.3} />
      </G>
    ),
  },
  front: (
    <G>
      <Path d="M67 58 C71.5 64 73.5 67.5 73.5 71 A6.5 6.5 0 0 1 60.5 71 C60.5 67.5 62.5 64 67 58Z" fill={f.alt} stroke={p.altDeep} strokeWidth={0.6} />
      <Ellipse cx={64.6} cy={68.4} rx={1.4} ry={2.4} fill="#FFFFFF" opacity={0.8} />
      <Ellipse cx={60.5} cy={74} rx={3.6} ry={2.6} fill={p.mid} />
      <Ellipse cx={73.5} cy={74} rx={3.6} ry={2.6} fill={p.mid} />
    </G>
  ),
  flicker: (
    <G>
      <Glow x={80} y={52} r={1.2} color={p.alt} />
      <Glow x={22} y={40} r={1} color={p.alt} />
    </G>
  ),
  flickerOver: true,
});

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
};
