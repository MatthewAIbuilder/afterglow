import { ActionSheetIOS, Alert, Platform, type AlertButton, type AlertOptions } from 'react-native';

/**
 * Alerts and action sheets that work everywhere. On a phone they are the
 * system's own (Alert, and ActionSheetIOS on iPhone); in a browser, where
 * React Native's Alert does nothing, `DialogHost` shows them in the app, as
 * it does long choice lists on Android.
 * Use these instead of Alert / ActionSheetIOS directly.
 */
/** A button: its words, its look, and what pressing it does. */
export type DialogButton = { text: string; style?: AlertButton['style']; onPress?: () => void };
export type WebDialog = { id: number; title: string; message?: string; buttons: DialogButton[]; sheet: boolean; cancelable: boolean; onDismiss?: () => void };

let next = 1;
let queue: WebDialog[] = [];
const listeners = new Set<(q: WebDialog[]) => void>();
const emit = () => listeners.forEach((l) => l(queue));

/** For DialogHost: the dialogs waiting to be shown, first first. */
export function subscribeDialogs(l: (q: WebDialog[]) => void) {
  listeners.add(l);
  l(queue);
  return () => void listeners.delete(l);
}
/** For DialogHost: close a dialog, then run what was pressed (if anything). */
export function closeDialog(id: number, pressed?: DialogButton) {
  const d = queue.find((x) => x.id === id);
  queue = queue.filter((x) => x.id !== id);
  emit();
  if (pressed) pressed.onPress?.();
  else d?.onDismiss?.();
}
function openWeb(d: Omit<WebDialog, 'id'>) {
  queue = [...queue, { ...d, id: next++ }];
  emit();
}

/** The same arguments as Alert.alert. */
export function showAlert(title: string, message?: string, buttons?: DialogButton[], options?: AlertOptions) {
  if (Platform.OS !== 'web') {
    // Passed on exactly as given, so it behaves (and tests see it) like Alert.alert itself.
    const args = [title, message, buttons as AlertButton[] | undefined, options].slice(0, options ? 4 : buttons ? 3 : message !== undefined ? 2 : 1) as Parameters<typeof Alert.alert>;
    Alert.alert(...args);
    return;
  }
  const list = buttons?.length ? buttons : [{ text: 'OK' }];
  const cancel = list.find((b) => b.style === 'cancel');
  openWeb({
    title,
    message,
    buttons: list,
    sheet: false,
    cancelable: !!options?.cancelable || !!cancel || list.length === 1,
    onDismiss: () => {
      if (cancel) cancel.onPress?.();
      else if (list.length === 1) list[0].onPress?.();
      options?.onDismiss?.();
    },
  });
}

/** Android's own alert shows no more than this many buttons. */
export const ANDROID_ALERT_MAX = 3;

export type SheetOptions = { title?: string; message?: string; options: string[]; cancelButtonIndex?: number; destructiveButtonIndex?: number };

/**
 * A list of choices: the iPhone action sheet; on Android an alert (or the app's own sheet when there are
 * more than three choices); the app's own sheet in a browser. `onSelect` gets the index.
 */
export function showActionSheet(o: SheetOptions, onSelect: (index: number) => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ ...o, userInterfaceStyle: 'dark' }, onSelect);
    return;
  }
  const buttons: DialogButton[] = o.options.map((text, i) => ({
    text,
    style: i === o.cancelButtonIndex ? 'cancel' : i === o.destructiveButtonIndex ? 'destructive' : 'default',
    onPress: () => onSelect(i),
  }));
  const dismiss = () => (o.cancelButtonIndex !== undefined ? onSelect(o.cancelButtonIndex) : undefined);
  // Android's alert shows at most three buttons, so a longer list uses the app's own sheet there too.
  if (Platform.OS === 'web' || buttons.length > ANDROID_ALERT_MAX) {
    openWeb({ title: o.title ?? '', message: o.message, buttons, sheet: true, cancelable: true, onDismiss: dismiss });
    return;
  }
  Alert.alert(o.title ?? '', o.message, buttons, { cancelable: true, onDismiss: dismiss });
}
