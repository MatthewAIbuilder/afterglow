import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { color } from '../theme/tokens';

/**
 * The shared backdrop: a night sky lit by distant stage lights.
 * Three soft pools of light, kept low so content always leads.
 */
export function NightSky() {
  const { width, height } = useWindowDimensions();
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id="haze" cx="78%" cy="8%" rx="85%" ry="55%">
          <Stop offset="0" stopColor={color.haze} stopOpacity="0.55" />
          <Stop offset="1" stopColor={color.haze} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="dusk" cx="5%" cy="92%" rx="80%" ry="50%">
          <Stop offset="0" stopColor={color.dusk} stopOpacity="0.45" />
          <Stop offset="1" stopColor={color.dusk} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="stage" cx="95%" cy="100%" rx="45%" ry="30%">
          <Stop offset="0" stopColor={color.stage} stopOpacity="0.10" />
          <Stop offset="1" stopColor={color.stage} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={color.night} />
      <Rect width="100%" height="100%" fill="url(#haze)" />
      <Rect width="100%" height="100%" fill="url(#dusk)" />
      <Rect width="100%" height="100%" fill="url(#stage)" />
    </Svg>
  );
}
