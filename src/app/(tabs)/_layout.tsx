import { Tabs } from 'expo-router';
import { GlassTabBar } from '../../components/GlassTabBar';
import { color } from '../../theme/tokens';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.night } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="sound" options={{ title: 'My Sound' }} />
      <Tabs.Screen name="festivals" options={{ title: 'Festivals' }} />
    </Tabs>
  );
}
