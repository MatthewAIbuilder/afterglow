import { FIREBASE_CONFIG } from '../../config/social';
import { firebaseSocialService } from './firebase/service';
import type { SocialService } from './service';

/**
 * The social backend this build uses, wired to Firebase with the project's
 * public config. The rest of the app gets it through `SocialProvider` and
 * never imports the adapter; tests pass their own.
 */
export function defaultSocialService(): SocialService {
  return firebaseSocialService(FIREBASE_CONFIG);
}
