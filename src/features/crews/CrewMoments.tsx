import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useCrewUpdates } from '../../state/crewUpdates';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { countdown } from '../festivals/when';
import type { Pick } from '../plan/plan';
import { warmupLine, warmupPlaylist } from '../plan/warmup';
import type { Crew } from '../social/models';
import { t, tn } from '../../i18n';

/**
 * Before the festival: the countdown, and a warm-up playlist for the whole
 * crew (live sets of the acts you've all starred or voted Must see).
 * After it: the crew's festival, looked back on.
 */
export function CrewMoments({ crew, festival, stars, shared }: { crew: Crew; festival: Festival; stars: Record<string, readonly string[]>; shared: number }) {
  const today = useToday();
  const { artist, clipsOf } = useCatalog();
  const { meetupsFor } = useCrewUpdates();
  const when = countdown(festival, today);
  const over = when === t('Over');

  if (over) {
    const meetups = meetupsFor(crew.id).filter((m) => Date.parse(m.at) < today.getTime()).length;
    const starred = new Set(Object.values(stars).flat()).size;
    const lines = [shared ? tn(shared, '{n} set you all starred', '{n} sets you all starred') : undefined, starred ? tn(starred, '{n} act on the crew’s list', '{n} acts on the crew’s list') : undefined, meetups ? tn(meetups, '{n} meetup', '{n} meetups') : undefined].filter(Boolean);
    return (
      <View style={styles.card} accessible accessibilityLabel={`${t('Your crew at {festival}', { festival: festival.name })}. ${tn(crew.members.length, '{n} of you', '{n} of you')}. ${lines.join('. ')}`}>
        <Text style={styles.kicker}>{t('Your crew at {festival}', { festival: festival.name })}</Text>
        <Text style={styles.big}>{tn(crew.members.length, '{n} of you', '{n} of you')}</Text>
        {lines.length ? <Text style={styles.line}>{lines.join(' · ')}</Text> : null}
      </View>
    );
  }

  // The crew's acts, most-starred first, as picks for the warm-up.
  const counts = new Map<string, number>();
  for (const list of Object.values(stars)) for (const id of new Set(list)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const picks = [...counts]
    .sort((a, b) => b[1] - a[1])
    .flatMap(([id, n]): Pick[] => {
      const a = artist(id);
      return a ? [{ artist: a, match: Math.min(1, n / crew.members.length), tier: 'must-see', pinned: true, known: true }] : [];
    });
  const warmup = warmupPlaylist(picks, clipsOf);
  if (!when && !warmup) return null;
  return (
    <View style={styles.card}>
      {when ? <Text style={styles.kicker}>{festival.name}</Text> : null}
      {when ? <Text style={styles.big}>{when}</Text> : null}
      {warmup ? (
        <Pressable
          onPress={() => {
            haptic.tap();
            void Linking.openURL(warmup.url).catch(() => {});
          }}
          accessibilityRole="link"
          accessibilityLabel={t('The crew’s warm-up playlist: live sets from {artists}. Opens YouTube.', { artists: warmupLine(warmup) })}
          style={({ pressed }) => [styles.warmup, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.warmupTitle}>{t('The crew’s warm-up')}</Text>
          <Text style={styles.line} numberOfLines={1}>
            {t('{n} live sets · {artists}', { n: warmup.artists.length, artists: warmupLine(warmup) })}
          </Text>
          <Text style={styles.go}>YouTube ↗</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.lg, padding: space.lg, gap: space.xs, borderRadius: radius.md, backgroundColor: glowA(0.1), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4) },
  kicker: { ...type.label, color: color.glow },
  big: { ...type.title, color: color.moon },
  line: { ...type.caption, color: color.moonDim },
  warmup: { marginTop: space.sm, padding: space.md, gap: 2, borderRadius: radius.sm, backgroundColor: color.glass },
  warmupTitle: { ...type.label, color: color.moon },
  go: { ...type.caption, color: color.glow },
});
