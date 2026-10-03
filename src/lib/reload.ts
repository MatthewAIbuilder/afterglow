import { reloadAppAsync } from 'expo';

/** Start Afterglow again (to put on a new theme). On the website, the page reloads. */
export async function reloadApp(): Promise<void> {
  try {
    await reloadAppAsync('A new theme');
  } catch {
    if (typeof window !== 'undefined' && window.location) window.location.reload();
  }
}
