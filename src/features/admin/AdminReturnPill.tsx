import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../../lib/haptics';
import { setGuestView, useGuestView } from '../../state/adminView';
import { useSocial } from '../../state/social';
import { useMyOrg } from '../../state/orgs';
import { color, radius, space, type } from '../../theme/tokens';
import { isSupportAccount } from './admin';

/**
 * While the support account looks at the app, a small pill at the top leads
 * back to the dashboard; for an event organizer's account, back to its studio.
 */
export function AdminReturnPill() {
  const { user } = useSocial();
  const { guest } = useGuestView();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const myOrg = useMyOrg(user?.uid);
  const hq = isSupportAccount(user);
  const home = hq ? '/admin' : myOrg ? '/studio' : undefined;
  if (!home || !guest || path === home) return null;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        setGuestView(false);
        router.replace(home);
      }}
      accessibilityRole="button"
      accessibilityLabel={hq ? 'Back to the dashboard' : 'Back to your studio'}
      style={({ pressed }) => [styles.pill, { top: insets.top + 4 }, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.text}>{hq ? '← Dashboard' : '← Studio'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { position: 'absolute', alignSelf: 'center', paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color.glow, zIndex: 50 },
  text: { ...type.label, color: color.night },
});
