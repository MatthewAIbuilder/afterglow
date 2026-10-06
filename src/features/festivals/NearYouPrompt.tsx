import { Linking, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useNearby } from '../../state/nearby';
import { color, radius, space, type, glowA } from '../../theme/tokens';

/**
 * "Festivals near you": an offer on the Festivals tab to use your location.
 * Nothing is asked until you tap, and the answer stays on this phone.
 */
export function NearYouPrompt({ style, title = 'Festivals near you' }: { style?: StyleProp<ViewStyle>; title?: string } = {}) {
  const { status, turnOn } = useNearby();
  const web = Platform.OS === 'web';
  const denied = status === 'denied';
  const body = denied
    ? web
      ? 'Location is blocked for this site. Allow it in your browser’s settings, then try again.'
      : 'Location is off for Afterglow. Allow it in Settings, then try again.'
    : status === 'failed'
      ? 'Couldn’t find where you are just now. Try again in a moment.'
      : 'See what’s within reach, nearest first. Your location stays on this device.';
  const locating = status === 'locating';

  return (
    <View style={[styles.card, style]} accessibilityRole="summary">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            haptic.tap();
            void turnOn();
          }}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel={locating ? 'Finding you' : denied || status === 'failed' ? 'Try again' : 'Use my location'}
          accessibilityState={{ busy: locating }}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={styles.buttonText}>{locating ? 'Finding you…' : denied || status === 'failed' ? 'Try again' : 'Use my location'}</Text>
        </Pressable>
        {denied && !web && (
          <Pressable
            onPress={() => {
              haptic.select();
              void Linking.openSettings().catch(() => {});
            }}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            hitSlop={8}
          >
            <Text style={styles.link}>Open Settings</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.lg,
    marginBottom: space.xl,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  title: { ...type.headline, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.lg },
  button: {
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.5),
  },
  buttonText: { ...type.label, color: color.moon },
  link: { ...type.label, color: color.glow },
});
