import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CatalogProvider } from '../state/catalog';
import { GoingProvider } from '../state/going';
import { PlanProvider } from '../state/plan';
import { RatingsProvider } from '../state/ratings';
import { ReactionsProvider } from '../state/reactions';
import { SeenProvider } from '../state/seen';
import { color } from '../theme/tokens';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.night }}>
      <CatalogProvider>
      <ReactionsProvider>
      <RatingsProvider>
      <PlanProvider>
      <GoingProvider>
      <SeenProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.night } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="artist/[id]" />
        <Stack.Screen name="festival/[id]" />
        <Stack.Screen name="tune/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="poster/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
      </SeenProvider>
      </GoingProvider>
      </PlanProvider>
      </RatingsProvider>
      </ReactionsProvider>
      </CatalogProvider>
    </GestureHandlerRootView>
  );
}
