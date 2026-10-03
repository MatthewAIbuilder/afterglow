import { Redirect, Tabs } from 'expo-router';
import { isSupportAccount } from '../../features/admin/admin';
import { useGuestView } from '../../state/adminView';
import { useSocial } from '../../state/social';
import { GlassTabBar } from '../../components/GlassTabBar';
import { color } from '../../theme/tokens';

export default function TabLayout() {
  // The support account gets its dashboard instead of the app (unless it chose to look at the app).
  const { user } = useSocial();
  const view = useGuestView();
  if (isSupportAccount(user) && view.loaded && !view.guest) return <Redirect href="/admin" />;
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.night } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="festivals" options={{ title: 'Festivals' }} />
      <Tabs.Screen name="sound" options={{ title: 'My Sound' }} />
      <Tabs.Screen name="together" options={{ title: 'Friends' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/* Tonight's plan: only festival mode's tab bar shows it (the full app's plan is on Festivals). */}
      <Tabs.Screen name="lineup" options={{ title: 'Lineup' }} />
    </Tabs>
  );
}
