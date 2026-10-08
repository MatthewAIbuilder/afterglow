/**
 * The app's colour themes: each one retunes the night, the glow and the
 * lights in the sky, everywhere at once. Plain data, read by `tokens.ts` as
 * the app starts (which theme, and who may use it, live in
 * `features/themes/themes.ts`).
 */
export type Palette = {
  /** The background. */
  night: string;
  /** Sheets and raised surfaces. */
  nightRaised: string;
  /** The accent: matches, active states, links. */
  glow: string;
  /** Buttons and deeper accents. */
  glowDeep: string;
  /** The big light in the sky, top right. */
  haze: string;
  /** The counter-light, bottom left. */
  dusk: string;
  /** A faint warm stage light, bottom right. */
  stage: string;
};

export const THEME_IDS = [
  'afterglow',
  'aurora',
  'pride',
  'moonlight',
  'nebula',
  'laser',
  'synthwave',
  'ocean',
  'firefly',
  'bass',
  'lava',
  'prism',
  'panda',
  'frog',
  'toes',
  'daisy',
  'gnome',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'afterglow';

export const PALETTES: Record<ThemeId, Palette> = {
  afterglow: { night: '#0A0918', nightRaised: '#121026', glow: '#A97CFF', glowDeep: '#6B3FE0', haze: '#3A2380', dusk: '#1C2A6B', stage: '#FF7AC6' },
  aurora: { night: '#05121A', nightRaised: '#0B1D26', glow: '#4FF0B4', glowDeep: '#16956E', haze: '#0E5A55', dusk: '#1B3A7A', stage: '#7C6BFF' },
  moonlight: { night: '#080A12', nightRaised: '#10141F', glow: '#C9DCFF', glowDeep: '#5A70B8', haze: '#263552', dusk: '#1B2340', stage: '#E8E4FF' },
  nebula: { night: '#110818', nightRaised: '#1B0F25', glow: '#FF7EB6', glowDeep: '#B8306F', haze: '#4A1A5E', dusk: '#23206E', stage: '#7CA8FF' },
  laser: { night: '#07090B', nightRaised: '#10141A', glow: '#C6FF3D', glowDeep: '#5E9414', haze: '#1E3A2A', dusk: '#102A3A', stage: '#3DE0FF' },
  synthwave: { night: '#12061F', nightRaised: '#1C0C2C', glow: '#FF4FA0', glowDeep: '#B01E66', haze: '#4B1259', dusk: '#3A1A6E', stage: '#FFB86B' },
  ocean: { night: '#031020', nightRaised: '#0A1A2E', glow: '#4FC6F0', glowDeep: '#1A72AA', haze: '#0E3A6A', dusk: '#0E2A4A', stage: '#7CFFE0' },
  firefly: { night: '#0D0B07', nightRaised: '#17140D', glow: '#FFD36B', glowDeep: '#A8741A', haze: '#4A3510', dusk: '#1D2A20', stage: '#FF9F5B' },
  bass: { night: '#060A1C', nightRaised: '#0E1430', glow: '#6E96FF', glowDeep: '#3050D0', haze: '#1C2C7A', dusk: '#2A1A6A', stage: '#A97CFF' },
  lava: { night: '#150707', nightRaised: '#210D0C', glow: '#FF7A45', glowDeep: '#B8381A', haze: '#5A1A14', dusk: '#3A1236', stage: '#FFC46B' },
  prism: { night: '#0C0B18', nightRaised: '#151428', glow: '#F5A3FF', glowDeep: '#9050D0', haze: '#2C3A6A', dusk: '#164A4A', stage: '#FFE38A' },
  panda: { night: '#120E1C', nightRaised: '#1C1729', glow: '#FF9EC7', glowDeep: '#C04F86', haze: '#3C2A4E', dusk: '#1F3A2C', stage: '#8AD48C' },
  frog: { night: '#04130C', nightRaised: '#0A1F15', glow: '#7CE38B', glowDeep: '#2A8C42', haze: '#12452A', dusk: '#0E3236', stage: '#D9FF6B' },
  toes: { night: '#160C17', nightRaised: '#221322', glow: '#FFB38A', glowDeep: '#C25A40', haze: '#4A1E3A', dusk: '#2A1A50', stage: '#FF9EC7' },
  pride: { night: '#0B0816', nightRaised: '#16112A', glow: '#FF6FB5', glowDeep: '#C2338F', haze: '#5A1E8C', dusk: '#0F4A7A', stage: '#FFD93B' },
  // Gnome garden: a mossy night, toadstool red, lantern gold.
  gnome: { night: '#0A120C', nightRaised: '#131D15', glow: '#FF6B5A', glowDeep: '#B8332A', haze: '#2A3A1E', dusk: '#1A2A3A', stage: '#FFC95A' },
  daisy: { night: '#0E0620', nightRaised: '#190B31', glow: '#FF6AD5', glowDeep: '#B5289E', haze: '#4E1A86', dusk: '#123A8C', stage: '#FFE14D' },
};

/**
 * The six festival lights, the same in every theme: rose, tangerine, gold,
 * mint, sky and violet. Each festival and club show wears one (its date block,
 * a wash across its card); bright enough to carry night-coloured text.
 */
export const SPECTRUM = ['#FF6F91', '#FF9A5C', '#FFD166', '#5FE3A1', '#5BB8FF', '#B48CFF'] as const;

/**
 * The Pride theme's colours: the rainbow flag, red to violet, then the
 * progress stripes (trans pink, blue and white; brown and black, drawn here
 * as a deep umber so it shows on the night). Bright enough to glow on the night.
 */
export const RAINBOW = ['#FF3B5C', '#FF8C2B', '#FFD93B', '#3EDC81', '#3B9BFF', '#A35BFF'] as const;
export const PROGRESS = ['#F5A9C8', '#6FCFF5', '#FFFFFF', '#9A6A3E', '#3A2A22'] as const;

/**
 * Where the Pride sky's six lights sit (centre x, y, then size, as shares of
 * the screen): round the edges, red at the top left running down to yellow,
 * across to green and up to violet, so each colour glows on its own and the
 * middle stays dark for reading.
 */
export const PRIDE_LIGHTS: readonly { x: number; y: number; rx: number; ry: number }[] = [
  { x: 0.0, y: 0.04, rx: 0.5, ry: 0.22 },
  { x: -0.02, y: 0.48, rx: 0.36, ry: 0.22 },
  { x: 0.08, y: 0.98, rx: 0.5, ry: 0.2 },
  { x: 0.92, y: 0.98, rx: 0.5, ry: 0.2 },
  { x: 1.02, y: 0.5, rx: 0.36, ry: 0.22 },
  { x: 1.0, y: 0.04, rx: 0.5, ry: 0.22 },
];

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);

/** "#RRGGBB" at an opacity, as an rgba() string. */
export function rgbaOf(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
