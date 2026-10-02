import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';
import { PersonAvatar } from '../../components/PersonAvatar';
import { CODE_THEMES, type CodeTheme, finders, inCentre, isFinder } from './qr';
import { qrMatrix } from './qrMatrix';

/**
 * Your friend code as a QR code with a bit of personality: round dots in your
 * colours, soft rounded corner squares and your face in the middle. Dark on
 * a light card so any phone's camera reads it, even in a dark field.
 */
export function FriendQR({ value, size, theme, name, avatarUrl }: { value: string; size: number; theme: CodeTheme; name?: string; avatarUrl?: string }) {
  const grid = useMemo(() => qrMatrix(value), [value]);
  const n = grid.size;
  // A hole for your face: a fifth of the code across, an odd number of squares so it sits centred.
  const hole = Math.max(5, Math.round(n * 0.2) | 1);
  const dots = useMemo(() => {
    const out: [number, number][] = [];
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) if (grid.dark(x, y) && !isFinder(n, x, y) && !inCentre(n, x, y, hole + 1)) out.push([x, y]);
    return out;
  }, [grid, n, hole]);
  const [from, to] = CODE_THEMES[theme].dots;
  // A quiet margin of two squares all round, as scanners like.
  const pad = 2;
  const face = (hole / (n + pad * 2)) * size;
  return (
    <View style={{ width: size, height: size }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox={`${-pad} ${-pad} ${n + pad * 2} ${n + pad * 2}`}>
        <Defs>
          <LinearGradient id="dots" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={n} y2={n}>
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x={-pad} y={-pad} width={n + pad * 2} height={n + pad * 2} rx={3} fill="#FBF9FF" />
        {dots.map(([x, y]) => (
          <Circle key={`${x}-${y}`} cx={x + 0.5} cy={y + 0.5} r={0.44} fill="url(#dots)" />
        ))}
        {finders(n).map(([x, y]) => (
          <G key={`f-${x}-${y}`}>
            <Rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.9} fill="none" stroke="url(#dots)" strokeWidth={1} />
            <Rect x={x + 2} y={y + 2} width={3} height={3} rx={0.9} fill="url(#dots)" />
          </G>
        ))}
      </Svg>
      <View style={[styles.face, { width: face, height: face, borderRadius: face / 2, left: (size - face) / 2, top: (size - face) / 2 }]}>
        <PersonAvatar name={name} url={avatarUrl} size={face - 6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF9FF' },
});
