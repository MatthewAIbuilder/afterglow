import { forgetSetsSeen } from './setsSeen';
import { forgetCrewVotes } from './crewVotesStore';
import { forgetFitChecks } from './fitChecks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { GUEST, moveTo, type ScopeStorage } from '../features/accounts/scope';
import type { SocialService } from '../features/social/service';
import { defaultSocialService } from '../features/social/services';
import { color } from '../theme/tokens';
import { forgetAccountGlow } from './accountGlow';
import { forgetBadgeClaims } from './badgeClaims';
import { forgetCloseFriends } from './closeFriends';
import { forgetDailyQuests } from './dailyQuests';
import { forgetDayHours } from './dayHours';
import { forgetFestivalWeek } from './festivalWeek';
import { forgetGardenLayout } from './gardenLayout';
import { forgetShowcase } from './showcase';
import { forgetDecorSeen } from './decorSeen';
import { forgetCollectionSeen } from './collectionSeen';
import { forgetGoingShows } from './goingShows';
import { forgetLastBackdrop } from './lastBackdrop';
import { forgetQuests } from './quests';
import { forgetScouted } from './scouted';
import { forgetSecrets } from './secrets';

/** Waits this long for the sign-in to be known on launch before showing the app anyway. */
const KNOWN_WITHIN_MS = 4000;

const storage: ScopeStorage = {
  multiGet: (keys) => AsyncStorage.multiGet(keys as string[]),
  multiSet: (pairs) => AsyncStorage.multiSet(pairs),
  multiRemove: (keys) => AsyncStorage.multiRemove(keys as string[]),
};

/** The shared stores kept in memory: forgotten on a switch, so they read the new account's. */
function forgetShared() {
  forgetAccountGlow();
  forgetSetsSeen();
  forgetCrewVotes();
  forgetFitChecks();
  forgetBadgeClaims();
  forgetCloseFriends();
  forgetDailyQuests();
  forgetDayHours();
  forgetFestivalWeek();
  forgetGardenLayout();
  forgetShowcase();
  forgetDecorSeen();
  forgetCollectionSeen();
  forgetGoingShows();
  forgetLastBackdrop();
  forgetQuests();
  forgetScouted();
  forgetSecrets();
}

/**
 * Each account on this phone gets its own likes, plans, quests and the rest
 * (features/accounts/scope.ts). Sits above every store: once the sign-in is
 * known it makes sure the phone holds that account's things, and when the
 * account changes it puts them away, brings back the other's and starts the
 * app over for it (every store reads again; the screen goes back home).
 */
export function AccountScope({ children, service: given }: { children: ReactNode; service?: SocialService }) {
  const [service] = useState(() => given ?? defaultSocialService());
  // The account whose things the app is showing; undefined until known.
  const [scope, setScope] = useState<string | undefined>();
  const target = useRef<string | undefined>(undefined);
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    const settle = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        // Follow the latest sign-in, however many changes came while moving.
        for (let want = target.current; want !== undefined; ) {
          const change = await moveTo(storage, want).catch(() => 'same' as const);
          if (change === 'switched') forgetShared();
          if (!live) return;
          setScope((cur) => (change === 'switched' || cur === undefined ? want : cur));
          if (target.current === want) break;
          want = target.current;
        }
      } finally {
        busy.current = false;
      }
    };
    const unsubscribe = service.availability().ok
      ? service.onAuthChange((user) => {
          target.current = user?.uid ?? GUEST;
          void settle();
        })
      : undefined;
    if (!service.availability().ok) {
      target.current = GUEST;
      void settle();
    }
    // Never stuck on a blank screen: with no answer yet, show the app with what's on the phone.
    const timer = setTimeout(() => setScope((cur) => cur ?? 'unknown'), KNOWN_WITHIN_MS);
    return () => {
      live = false;
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [service]);

  if (scope === undefined) return <View style={{ flex: 1, backgroundColor: color.night }} />;
  return <Fragment key={scope}>{children}</Fragment>;
}
