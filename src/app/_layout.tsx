import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PlanProvider } from '../state/plan';
import { ReactionsProvider } from '../state/reactions';
import { color } from '../theme/tokens';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.night }}>
      <ReactionsProvider>
      <PlanProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.night } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="artist/[id]" />
        <Stack.Screen name="festival/[id]" />
        <Stack.Screen name="poster/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
      </PlanProvider>
      </ReactionsProvider>
    </GestureHandlerRootView>
  );
}
