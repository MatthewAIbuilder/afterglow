import { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { color, radius } from '../../theme/tokens';
import { isStay22Page } from './partners';

/**
 * Stay22's live map or list of places to stay, in a web view. Its own pages
 * stay in place; choosing a place opens the booking site in the browser (or
 * that site's app), never inside Afterglow. Only StayCard uses this.
 */
export function StayMap({ url, height, label }: { url: string; height: number; label: string }) {
  const [loading, setLoading] = useState(true);
  return (
    <View style={[styles.wrap, { height }]} accessibilityLabel={label}>
      <WebView
        testID="stay-map"
        source={{ uri: url }}
        style={styles.web}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        originWhitelist={['https://*']}
        onLoadEnd={() => setLoading(false)}
        onShouldStartLoadWithRequest={(r) => {
          if (r.isTopFrame === false || r.url.startsWith('about:') || isStay22Page(r.url)) return true;
          if (/^https:\/\//i.test(r.url)) Linking.openURL(r.url).catch(() => {});
          return false;
        }}
      />
      {loading ? <ActivityIndicator color={color.glow} style={StyleSheet.absoluteFill} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.glass },
  web: { flex: 1, backgroundColor: 'transparent' },
});
