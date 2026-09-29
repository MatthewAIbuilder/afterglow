import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { color: string; size?: number };

/** Discover: stacked vertical cards, a nod to the swipe feed. */
export function DiscoverIcon({ color, size = 24 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="6.5" y="3" width="11" height="15" rx="3" stroke={color} strokeWidth={1.7} />
      <Path d="M9 21h6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M11 8.2v4.6l3.6-2.3L11 8.2z" fill={color} />
    </Svg>
  );
}

/** My Sound: a small constellation of bubbles. */
export function SoundIcon({ color, size = 24 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9.5" cy="10" r="5.5" stroke={color} strokeWidth={1.7} />
      <Circle cx="17.5" cy="15.5" r="3.2" stroke={color} strokeWidth={1.7} />
      <Circle cx="17" cy="5.5" r="1.8" fill={color} />
      <Circle cx="7" cy="19" r="1.6" fill={color} />
    </Svg>
  );
}

/** Festivals: a ticket stub. */
export function FestivalsIcon({ color, size = 24 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 7.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1V10a2 2 0 0 0 0 4v2.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V14a2 2 0 0 0 0-4z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M14.5 7v2M14.5 11v2M14.5 15v2" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

const CHEVRON = { right: 'M9 5l7 7-7 7', left: 'M15 5l-7 7 7 7', up: 'M5 15l7-7 7 7' } as const;

export function ChevronIcon({ color, size = 16, direction = 'right' }: P & { direction?: keyof typeof CHEVRON }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={CHEVRON[direction]}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CloseIcon({ color, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({ color, size = 16 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The iOS share glyph: a box with an arrow leaving it. */
export function ShareIcon({ color, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.5v11M8 7.5l4-4 4 4" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.5 10.5H7a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

export function SearchIcon({ color, size = 16 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
