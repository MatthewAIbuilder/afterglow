import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { fadeStops } from './fadeStops';

/**
 * Fades its children to transparent at the top and/or bottom, so a picture
 * melts into whatever is behind the page (the night sky's haze included)
 * instead of ending at a line. `top` and `bottom` are where, from 0 to 1 down
 * the box, the picture is fully there; outside them it fades out. The website
 * version uses a CSS mask (FadeMask.web.tsx).
 */
export function FadeMask({ top = 0, bottom = 1, style, children }: { top?: number; bottom?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const { colors, locations } = fadeStops(top, bottom);
  return (
    <MaskedView style={style} maskElement={<LinearGradient colors={colors} locations={locations} style={StyleSheet.absoluteFill} />}>
      {children}
    </MaskedView>
  );
}
