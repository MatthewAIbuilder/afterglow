import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DialogHost } from '../components/DialogHost';
import { LikeSync } from '../features/community/LikeSync';
import { OfflineNotice } from '../features/offline/OfflineNotice';
import { ReminderSync } from '../features/notifications/ReminderSync';
import { FirstRun } from '../features/welcome/FirstRun';
import { AutoplayProvider } from '../state/autoplay';
import { CatalogProvider } from '../state/catalog';
import { CommunityProvider } from '../state/community';
import { CrewsProvider } from '../state/crews';
import { FollowedArtistsProvider } from '../state/followedArtists';
import { GoingProvider } from '../state/going';
import { LineupNewsProvider } from '../state/lineupNews';
import { MemoriesProvider } from '../state/memories';
import { MusicConnectionsProvider } from '../state/music';
import { NearbyProvider } from '../state/nearby';
import { NoticesProvider } from '../state/notices';
import { WeekendsProvider } from '../state/weekends';
import { PlanProvider } from '../state/plan';
import { PrepProvider } from '../state/prep';
import { RatingsProvider } from '../state/ratings';
import { ReactionsProvider } from '../state/reactions';
import { SeenProvider } from '../state/seen';
import { SetRemindersProvider } from '../state/setReminders';
import { SocialProvider } from '../state/social';
import { color } from '../theme/tokens';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.night }}>
      <CatalogProvider>
      <NearbyProvider>
      <MusicConnectionsProvider>
      <MemoriesProvider>
      <ReactionsProvider>
      <CommunityProvider>
      <RatingsProvider>
      <FollowedArtistsProvider>
      <PlanProvider>
      <SetRemindersProvider>
      <PrepProvider>
      <GoingProvider>
      <SeenProvider>
      <AutoplayProvider>
      <WeekendsProvider>
      <LineupNewsProvider>
      <SocialProvider>
      <NoticesProvider>
      <CrewsProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.night } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="artist/[id]" />
        <Stack.Screen name="festival/[id]" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="music" />
        <Stack.Screen name="music-auth" options={{ animation: 'none' }} />
        <Stack.Screen name="tune/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="memory-tag" options={{ presentation: 'modal', gestureEnabled: false }} />
        <Stack.Screen name="memories" />
        <Stack.Screen name="memory/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="shared/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="account" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile-edit" />
        <Stack.Screen name="u/[handle]" />
        <Stack.Screen name="people" />
        <Stack.Screen name="search" options={{ animation: 'fade' }} />
        <Stack.Screen name="legal/[doc]" />
        <Stack.Screen name="follows/[handle]" />
        <Stack.Screen name="going/[id]" />
        <Stack.Screen name="crew/[id]" />
        <Stack.Screen name="likes/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plan-card/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recap/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pick-artists" options={{ presentation: 'modal' }} />
        <Stack.Screen name="compare" />
        <Stack.Screen name="prep/[id]" />
        <Stack.Screen name="your-artists" />
        <Stack.Screen name="year/[year]" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="sound-scope"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 32,
            contentStyle: { backgroundColor: color.nightRaised },
          }}
        />
        <Stack.Screen
          name="request"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 32,
            contentStyle: { backgroundColor: color.nightRaised },
          }}
        />
        <Stack.Screen
          name="your-sound"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 32,
            contentStyle: { backgroundColor: color.nightRaised },
          }}
        />
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
      <ReminderSync />
      <LikeSync />
      <OfflineNotice />
      <DialogHost />
      </CrewsProvider>
      </NoticesProvider>
      </SocialProvider>
      </LineupNewsProvider>
      </WeekendsProvider>
      </AutoplayProvider>
      </SeenProvider>
      </GoingProvider>
      </PrepProvider>
      </SetRemindersProvider>
      </PlanProvider>
      </FollowedArtistsProvider>
      </RatingsProvider>
      </CommunityProvider>
      </ReactionsProvider>
      </MemoriesProvider>
      </MusicConnectionsProvider>
      </NearbyProvider>
      </CatalogProvider>
    </GestureHandlerRootView>
  );
}
