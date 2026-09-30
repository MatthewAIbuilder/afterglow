import { useNetworkState } from 'expo-network';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space, type } from '../../theme/tokens';
import { BACK_ONLINE_MS, isOffline, NOTICE_TEXT, OFFLINE_AFTER_MS, type Notice } from './status';

/**
 * A quiet glass pill near the bottom of the screen when the signal drops
 * (common at festivals): what still works (your plan, lineups, route; all on
 * the phone). "Back online" for a moment when it returns. Never blocks a tap.
 */
export function OfflineNotice() {
  const net = useNetworkState();
  const offline = isOffline(net);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [notice, setNotice] = useState<Notice>();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (offline) {
      const t = setTimeout(() => {
        wasOffline.current = true;
        setNotice('offline');
      }, OFFLINE_AFTER_MS);
      return () => clearTimeout(t);
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    const show = setTimeout(() => setNotice('back'), 0);
    const hide = setTimeout(() => setNotice(undefined), BACK_ONLINE_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [offline]);

  if (!notice) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }]}>
      <Animated.View
        key={notice}
        entering={reduced ? undefined : FadeIn.duration(250)}
        exiting={reduced ? undefined : FadeOut.duration(250)}
        style={[styles.pill, notice === 'back' && styles.back]}
        accessibilityLiveRegion="polite"
        accessibilityRole="text"
      >
        <View style={[styles.dot, notice === 'back' && styles.dotBack]} />
        <Text style={styles.text}>{NOTICE_TEXT[notice]}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(18,16,38,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  back: { borderColor: 'rgba(169,124,255,0.45)' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.moonFaint },
  dotBack: { backgroundColor: color.glow },
  text: { ...type.caption, color: color.moon },
});
