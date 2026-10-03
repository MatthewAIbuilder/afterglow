import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * A number that rolls up to its value when it first shows (a countdown
 * landing on "62"). Anything that isn't a whole number shows as it is.
 */
export function CountUp({ value, style, ms = 700 }: { value: string; style?: StyleProp<TextStyle>; ms?: number }) {
  const reduced = useReducedMotion();
  const target = /^\d+$/.test(value) ? Number(value) : undefined;
  const [shown, setShown] = useState(() => (target === undefined || reduced ? value : '0'));
  useEffect(() => {
    if (target === undefined || reduced || target < 2) return;
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - (1 - t) ** 3;
      setShown(String(Math.round(target * eased)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced, ms]);
  // A value that changes later (or isn't a number) shows as it is.
  const text = target === undefined || reduced || target < 2 ? value : shown;
  return <Text style={style}>{text}</Text>;
}
