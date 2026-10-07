import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { toeConstellation } from '../features/toes/toes';
import { useToes } from '../features/toes/useToes';
import { color, spectrum } from '../theme/tokens';

/**
 * The shared backdrop: a night sky lit by distant stage lights.
 * Three soft pools of light, kept low so content always leads. `festive`
 * (the Festivals tab) adds three more in the festival lights, gold, mint and
 * rose, still faint: a festival seen from the car park.
 */
export function NightSky({ festive }: { festive?: boolean } = {}) {
  const { width, height } = useWindowDimensions();
  // For one person only: footprints drawn in faint stars, up in the haze and down in the dusk.
  const toes = useToes();
  const prints = toes ? [toeConstellation(width * 0.82, height * 0.13, 64), toeConstellation(width * 0.14, height * 0.86, 44)] : [];
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
        {festive ? (
          <>
            <RadialGradient id="gold" cx="0%" cy="22%" rx="60%" ry="28%">
              <Stop offset="0" stopColor={spectrum[2]} stopOpacity="0.13" />
              <Stop offset="1" stopColor={spectrum[2]} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="mint" cx="100%" cy="52%" rx="55%" ry="26%">
              <Stop offset="0" stopColor={spectrum[3]} stopOpacity="0.11" />
              <Stop offset="1" stopColor={spectrum[3]} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="rose" cx="10%" cy="70%" rx="60%" ry="30%">
              <Stop offset="0" stopColor={spectrum[0]} stopOpacity="0.12" />
              <Stop offset="1" stopColor={spectrum[0]} stopOpacity="0" />
            </RadialGradient>
          </>
        ) : null}
      </Defs>
      <Rect width="100%" height="100%" fill={color.night} />
      <Rect width="100%" height="100%" fill="url(#haze)" />
      <Rect width="100%" height="100%" fill="url(#dusk)" />
      <Rect width="100%" height="100%" fill="url(#stage)" />
      {festive ? (
        <>
          <Rect width="100%" height="100%" fill="url(#gold)" />
          <Rect width="100%" height="100%" fill="url(#mint)" />
          <Rect width="100%" height="100%" fill="url(#rose)" />
        </>
      ) : null}
      {prints.map((p, i) => [...p.toes, ...p.sole].map((st, j) => <Circle key={`${i}-${j}`} cx={st.x} cy={st.y} r={st.r} fill="#F3F0FF" fillOpacity={j < 5 ? 0.13 : 0.1} />))}
    </Svg>
  );
}
