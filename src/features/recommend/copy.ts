import type { Artist } from '../../data/types';
import type { Reason } from './feed';
import { t } from '../../i18n';

/**
 * A few quiet words on why a clip is in your feed, shown next to the match.
 * Strong matches need no explanation, so they get none.
 */
export function reasonNote(reason: Reason, artistById: (id: string) => Artist | undefined): string | undefined {
  switch (reason.kind) {
    case 'match':
      return undefined;
    case 'near': {
      const to = artistById(reason.artistId);
      return to ? t('Close to {artist}', { artist: to.name }) : t('Close to your sound');
    }
    case 'new-sound':
      return t('A different sound');
    case 'unknown':
      return t('New to you');
  }
}
