import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FirstRun } from '../features/welcome/FirstRun';
import { CatalogProvider } from '../state/catalog';
import { GoingProvider } from '../state/going';
import { NoticesProvider } from '../state/notices';
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
      <NoticesProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.night } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="artist/[id]" />
        <Stack.Screen name="festival/[id]" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="tune/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="discover-focus"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 32,
            contentStyle: { backgroundColor: color.nightRaised },
          }}
        />
        <Stack.Screen name="poster/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="welcome" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
      </Stack>
      <FirstRun />
      </NoticesProvider>
      </SeenProvider>
      </GoingProvider>
      </PlanProvider>
      </RatingsProvider>
      </ReactionsProvider>
      </CatalogProvider>
    </GestureHandlerRootView>
  );
}
