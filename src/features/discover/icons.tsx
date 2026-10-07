import Svg, { Path } from 'react-native-svg';

type P = { color: string; size?: number; filled?: boolean };

export function HeartIcon({ color, size = 30, filled }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SaveIcon({ color, size = 30, filled }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6.5 4.5h11v16l-5.5-4-5.5 4z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Not for me: a thumb pointing down. */
export function ThumbDownIcon({ color, size = 28 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.5 13.5V3.5H6.6a1.8 1.8 0 0 0-1.78 1.53l-1.25 7.8A1.8 1.8 0 0 0 5.35 14.9H10v3.6a2.6 2.6 0 0 0 2.6 2.6l3.9-7.6z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M16.5 3.5h2.4a1.6 1.6 0 0 1 1.6 1.6v6.8a1.6 1.6 0 0 1-1.6 1.6h-2.4" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  );
}

export function PlayIcon({ color, size = 44 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5.5v13l10.5-6.5z" fill={color} />
    </Svg>
  );
}
