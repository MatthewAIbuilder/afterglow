import Svg, { Path } from 'react-native-svg';

type P = { color: string; size?: number; filled?: boolean };

/** Must-see marker. */
export function StarIcon({ color, size = 20, filled }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.8l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Clash marker. */
export function BoltIcon({ color, size = 14 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13.2 2.5L5 13.6h6l-1.2 7.9 8.2-11.1h-6z" fill={color} />
    </Svg>
  );
}
