import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { color: string; size?: number; filled?: boolean };

/** A video camera: the way into the camera page. */
export function CameraIcon({ color, size = 20 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={6.5} width={12.5} height={11} rx={2.6} stroke={color} strokeWidth={1.7} />
      <Path d="M15.5 10.5 20.5 7.6v8.8l-5-2.9" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  );
}

/** Two arrows chasing each other: switch between the front and back camera. */
export function FlipIcon({ color, size = 22 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 10a7 7 0 0 1 12.4-3.4M19 14a7 7 0 0 1-12.4 3.4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M17.8 3.6v3.4h-3.4M6.2 20.4V17h3.4" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** A lightning bolt: the torch, filled when on. */
export function TorchIcon({ color, size = 20, filled }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

/** A stack of photos: choose a video you already have. */
export function PhotosIcon({ color, size = 22 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={6} width={14} height={13.5} rx={2.4} stroke={color} strokeWidth={1.7} />
      <Path d="M7 3.5h11a2.5 2.5 0 0 1 2.5 2.5v10" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Circle cx={8.3} cy={10.4} r={1.3} fill={color} />
      <Path d="m4 17.5 4.2-3.8 3 2.6 2.2-1.8 4 3.2" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}
