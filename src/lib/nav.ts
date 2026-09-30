import { router } from 'expo-router';

/** Back, or to Discover when there's nowhere to go back to (a page opened straight from a link). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
