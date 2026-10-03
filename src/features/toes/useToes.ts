import { useSocialMaybe } from '../../state/social';
import { hasToes } from './toes';

/** Whether this phone's account gets the hidden toes (never anyone else's). */
export function useToes(): boolean {
  return hasToes(useSocialMaybe()?.user?.uid);
}
