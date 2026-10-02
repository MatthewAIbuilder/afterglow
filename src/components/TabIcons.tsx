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

/** Lineup: a short running order, one line bolder. */
export function LineupIcon({ color, size = 24 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 6h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M7 11h10M8.5 15.5h7M10 20h4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

/** Profile: a head and shoulders. */
export function ProfileIcon({ color, size = 24 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8.5" r="3.8" stroke={color} strokeWidth={1.7} />
      <Path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

/** Notifications: a bell. */
export function BellIcon({ color, size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M10 20.5a2 2 0 0 0 4 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

/** A sound breakdown: three ranked bars. */
export function BarsIcon({ color, size = 14 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M4 12h11M4 18h6" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

/** A two-by-two grid of rounded squares: the tile view. */
export function GridIcon({ color, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="4" width="7" height="7" rx="2" stroke={color} strokeWidth={1.8} />
      <Rect x="13" y="4" width="7" height="7" rx="2" stroke={color} strokeWidth={1.8} />
      <Rect x="4" y="13" width="7" height="7" rx="2" stroke={color} strokeWidth={1.8} />
      <Rect x="13" y="13" width="7" height="7" rx="2" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

/** Stacked wide cards: the list view. */
export function ListIcon({ color, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="4.5" width="16" height="6" rx="2" stroke={color} strokeWidth={1.8} />
      <Rect x="4" y="13.5" width="16" height="6" rx="2" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

const CHEVRON = { right: 'M9 5l7 7-7 7', left: 'M15 5l-7 7 7 7', up: 'M5 15l7-7 7 7', down: 'M5 9l7 7 7-7' } as const;

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

export function PlusIcon({ color, size = 16 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
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

/** A calendar page. */
export function CalendarIcon({ color, size = 16 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5z" stroke={color} strokeWidth={1.9} />
      <Path d="M4 10h16M8.5 3v4M15.5 3v4" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

/** Three lines: a menu (settings and more). */
export function MenuIcon({ color, size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M4 12h16M4 17h16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/** A grid of tiles: videos. */
export function TilesIcon({ color, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

/** A bookmark: saved things. */
export function BookmarkIcon({ color, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6.5 4h11v16l-5.5-4-5.5 4z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

/** Three dots: more options. */
export function MoreIcon({ color, size = 18 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={5.5} cy={12} r={1.7} fill={color} />
      <Circle cx={12} cy={12} r={1.7} fill={color} />
      <Circle cx={18.5} cy={12} r={1.7} fill={color} />
    </Svg>
  );
}

/** Two people: friends. */
export function PeopleIcon({ color, size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.4} stroke={color} strokeWidth={1.7} />
      <Path d="M2.8 19.5c.6-3.3 3.1-5.3 6.2-5.3s5.6 2 6.2 5.3" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Circle cx={16.6} cy={9} r={2.7} stroke={color} strokeWidth={1.6} />
      <Path d="M16.9 14.4c2.3.2 3.9 1.8 4.4 4.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
