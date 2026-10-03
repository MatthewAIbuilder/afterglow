import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../../lib/haptics';
import { setGuestView, useGuestView } from '../../state/adminView';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { isSupportAccount } from './admin';

/** While the support account looks at the app, a small pill at the top leads back to the dashboard. */
export function AdminReturnPill() {
  const { user } = useSocial();
  const { guest } = useGuestView();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  if (!isSupportAccount(user) || !guest || path === '/admin') return null;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        setGuestView(false);
        router.replace('/admin');
      }}
      accessibilityRole="button"
      accessibilityLabel="Back to the dashboard"
      style={({ pressed }) => [styles.pill, { top: insets.top + 4 }, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.text}>← Dashboard</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { position: 'absolute', alignSelf: 'center', paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color.glow, zIndex: 50 },
  text: { ...type.label, color: color.night },
});
