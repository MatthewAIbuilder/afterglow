import { StyleSheet, Text } from 'react-native';
import { useCrews } from '../../state/crews';
import { color, type } from '../../theme/tokens';
import { starsShort } from '../crews/together';
import { namesLine } from './withFriends';
import { t } from '../../i18n';

/** Crewmates who starred this artist at this festival (first names; never you). */
export function useCrewStars(festivalId: string, artistId: string): string[] {
  return useCrews().crewStarsFor(festivalId, artistId);
}

/** ", Maya and Sam starred it too": for a row's accessibility label. */
export const crewStarsSaid = (names: readonly string[]) => (names.length ? `. ${t('{names} starred it too', { names: namesLine(names) })}` : '');

/** "★ Maya and Sam" under a set or pick your crewmates starred too. */
export function CrewStarsLine({ names }: { names: string[] }) {
  const line = starsShort(names);
  if (!line) return null;
  return (
    <Text style={styles.line} numberOfLines={1}>
      {line}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { ...type.caption, color: color.glow, marginTop: 3 },
});
