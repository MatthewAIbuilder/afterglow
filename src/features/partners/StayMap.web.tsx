import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { color, radius } from '../../theme/tokens';

/** Stay22's live map or list of places to stay, in a browser frame (Metro picks this on web). Only StayCard uses this. */
export function StayMap({ url, height, label }: { url: string; height: number; label: string }) {
  return (
    <View style={[styles.wrap, { height }]}>
      {createElement('iframe', {
        src: url,
        title: label,
        loading: 'lazy',
        style: { border: 0, width: '100%', height: '100%', background: 'transparent' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.glass },
});
