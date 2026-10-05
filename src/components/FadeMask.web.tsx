import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { fadeCss } from './fadeStops';

/** The website's FadeMask (see FadeMask.tsx): a CSS mask, which browsers draw natively. */
export function FadeMask({ top = 0, bottom = 1, style, children }: { top?: number; bottom?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const mask = fadeCss(top, bottom);
  // maskImage isn't in React Native's style types; react-native-web passes it on (and prefixes it for Safari).
  return <View style={[style, { maskImage: mask } as unknown as ViewStyle]}>{children}</View>;
}
