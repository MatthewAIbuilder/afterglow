import type { ErrorBoundaryProps } from 'expo-router';
import { CrashScreen } from '../components/CrashScreen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DialogHost } from '../components/DialogHost';
import { LikeSync } from '../features/community/LikeSync';
import { OfflineNotice } from '../features/offline/OfflineNotice';
import { ReminderSync } from '../features/notifications/ReminderSync';
import { TonightLauncher } from '../features/tonight/TonightLauncher';
import { QuestTracker } from '../features/quests/QuestTracker';
import { DailyQuestTracker } from '../features/quests/DailyQuestTracker';
import { LevelSync } from '../features/quests/LevelSync';
import { QuestToast } from '../features/quests/QuestToast';
import { WhatsNewLauncher } from '../features/whatsNew/WhatsNewLauncher';
import { SecretStage } from '../features/secrets/SecretStage';
import { SunriseWatcher } from '../features/secrets/SunriseWatcher';
import { FirstRun } from '../features/welcome/FirstRun';
import { FounderClaim } from '../features/standing/FounderClaim';
import { ActivityPing } from '../features/admin/ActivityPing';
import { SavedAccountSync } from '../features/accounts/SavedAccountSync';
import { LivePatchSync } from '../features/admin/LivePatchSync';
import { ScoutSync } from '../features/setTimes/ScoutSync';
import { AdminReturnPill } from '../features/admin/AdminReturnPill';
import { AutoplayProvider } from '../state/autoplay';
import { CareProvider } from '../state/care';
import { CatalogProvider } from '../state/catalog';
import { ClipFlagsProvider } from '../state/clipFlags';
import { ClipNewsProvider } from '../state/clipNews';
import { CommunityProvider } from '../state/community';
import { CrewsProvider } from '../state/crews';
import { CrewUpdatesProvider } from '../state/crewUpdates';
import { CrewChatProvider } from '../state/crewChat';
import { FestivalModeProvider } from '../state/festivalMode';
import { FriendAddsProvider } from '../state/friendAdds';
import { TasteProvider } from '../state/taste';
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
import { SproutsProvider } from '../state/sprouts';
import { FindsProvider } from '../state/finds';
import { color } from '../theme/tokens';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.night }}>
      <ClipFlagsProvider>
      <CatalogProvider>
      <NearbyProvider>
      <MusicConnectionsProvider>
      <MemoriesProvider>
      <ReactionsProvider>
      <CommunityProvider>
      <RatingsProvider>
      {/* Taste is worked out once, here, for every provider and screen below (Social and Notices use it too). */}
      <TasteProvider>
      <FollowedArtistsProvider>
      <PlanProvider>
      <SetRemindersProvider>
      <PrepProvider>
      <GoingProvider>
      <SeenProvider>
      <AutoplayProvider>
      <CareProvider>
      <WeekendsProvider>
      <LineupNewsProvider>
      <ClipNewsProvider>
      <SocialProvider>
      <SproutsProvider>
      <FindsProvider>
      <NoticesProvider>
      <CrewsProvider>
      <CrewUpdatesProvider>
      <CrewChatProvider>
      <FestivalModeProvider>
      <FriendAddsProvider>
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
        <Stack.Screen name="camera" options={{ animation: 'slide_from_left', gestureEnabled: false }} />
        <Stack.Screen name="memories" />
        <Stack.Screen name="memory/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="shared/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="badge-card/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="admin" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="support" />
        <Stack.Screen name="badge/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="account" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile-edit" />
        <Stack.Screen name="u/[handle]" />
        <Stack.Screen name="people" />
        <Stack.Screen name="search" options={{ animation: 'fade' }} />
        <Stack.Screen name="legal/[doc]" />
        <Stack.Screen name="follows/[handle]" />
        <Stack.Screen name="going/[id]" />
        <Stack.Screen name="crew/[id]" />
        <Stack.Screen name="crew-invite/[id]" />
        <Stack.Screen name="crew-chat/[id]" />
        <Stack.Screen name="festival-week/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="likes/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="comments/[id]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.7, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 32,
            contentStyle: { backgroundColor: color.nightRaised },
          }}
        />
        <Stack.Screen name="plan-card/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recap/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="hunt/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="send-set-times/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="send" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pick-artists" options={{ presentation: 'modal' }} />
        <Stack.Screen name="this-or-that" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="compare" />
        <Stack.Screen name="festival-map" />
        <Stack.Screen name="festival-calendar" />
        <Stack.Screen name="quests" />
        <Stack.Screen name="whats-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="secrets" />
        <Stack.Screen name="prep/[id]" />
        <Stack.Screen name="your-artists" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="care" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="tonight" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen
          name="start-crew"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 32,
            contentStyle: { backgroundColor: color.nightRaised },
          }}
        />
        <Stack.Screen
          name="check-in"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 0.95],
            sheetGrabberVisible: true,
            sheetCornerRadius: 32,
            contentStyle: { backgroundColor: color.nightRaised },
          }}
        />
        <Stack.Screen name="crew-story" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
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
          name="switch-account"
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
        <Stack.Screen name="my-code" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="give-sprout" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sprout/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="welcome" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
      </Stack>
      <FirstRun />
      <FounderClaim />
      <ActivityPing />
      <SavedAccountSync />
      <LivePatchSync />
      <ScoutSync />
      <AdminReturnPill />
      <TonightLauncher />
      <WhatsNewLauncher />
      <QuestTracker />
      <DailyQuestTracker />
      <LevelSync />
      <ReminderSync />
      <LikeSync />
      <QuestToast />
      <SunriseWatcher />
      <SecretStage />
      <OfflineNotice />
      <DialogHost />
      </FriendAddsProvider>
      </FestivalModeProvider>
      </CrewChatProvider>
      </CrewUpdatesProvider>
      </CrewsProvider>
      </NoticesProvider>
      </FindsProvider>
      </SproutsProvider>
      </SocialProvider>
      </ClipNewsProvider>
      </LineupNewsProvider>
      </WeekendsProvider>
      </CareProvider>
      </AutoplayProvider>
      </SeenProvider>
      </GoingProvider>
      </PrepProvider>
      </SetRemindersProvider>
      </PlanProvider>
      </FollowedArtistsProvider>
      </TasteProvider>
      </RatingsProvider>
      </CommunityProvider>
      </ReactionsProvider>
      </MemoriesProvider>
      </MusicConnectionsProvider>
      </NearbyProvider>
      </CatalogProvider>
      </ClipFlagsProvider>
    </GestureHandlerRootView>
  );
}

/** A screen that breaks shows a friendly page with Try again, never a white screen. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <CrashScreen error={props.error} retry={props.retry} />;
}
