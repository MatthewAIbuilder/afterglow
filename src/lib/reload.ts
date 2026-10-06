import { reloadAppAsync } from 'expo';

/** Start Afterglow again (to put on a new theme or language). On the website, the page reloads. */
export async function reloadApp(reason = 'A new theme'): Promise<void> {
  try {
    await reloadAppAsync(reason);

  } catch {
    if (typeof window !== 'undefined' && window.location) window.location.reload();
  }
}
