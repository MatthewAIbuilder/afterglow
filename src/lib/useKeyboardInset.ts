import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, type KeyboardEvent, Platform, type View } from 'react-native';

/**
 * How much of a view the keyboard covers, for a page shown as a form sheet.
 * KeyboardAvoidingView measures from the top of the sheet rather than the
 * screen, so in a sheet it leaves the text field half under the keyboard (and
 * its layout animation fights the sheet growing for the keyboard). This
 * measures the view on the screen instead: give the view `page` as its ref and
 * `onLayout`, and pad its bottom by `inset`. iPhone only: Android resizes the
 * page for the keyboard itself, and a browser has no keyboard to avoid.
 */
export function useKeyboardInset(page: RefObject<View | null>): { onLayout: () => void; inset: number } {
  // The top of the keyboard on the screen, while it's up.
  const keyboardTop = useRef<number | undefined>(undefined);
  const [inset, setInset] = useState(0);

  const measure = useCallback(() => {
    const top = keyboardTop.current;
    if (top === undefined) {
      setInset(0);
      return;
    }
    page.current?.measureInWindow?.((_x, y, _w, h) => setInset(Math.max(0, Math.round(y + h - top))));
  }, [page]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const shown = (e: KeyboardEvent) => {
      const end = e.endCoordinates;
      // With Prefer cross-fade transitions on, iOS reports the keyboard at 0.
      keyboardTop.current = end.screenY > 0 ? end.screenY : Dimensions.get('window').height - end.height;
      measure();
    };
    const hidden = () => {
      keyboardTop.current = undefined;
      measure();
    };
    const subs = [
      Keyboard.addListener('keyboardWillShow', shown),
      // Again once the sheet has finished growing for the keyboard.
      Keyboard.addListener('keyboardDidShow', shown),
      Keyboard.addListener('keyboardWillHide', hidden),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [measure]);

  return { onLayout: measure, inset };
}
