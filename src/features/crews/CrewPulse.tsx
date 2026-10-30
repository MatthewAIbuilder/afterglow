import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { useNow } from '../../lib/useNow';
import { useCrewUpdates } from '../../state/crewUpdates';
import { color, radius, space, type } from '../../theme/tokens';
import type { Crew, Profile } from '../social/models';
import { isReply } from './updates';
import { t } from '../../i18n';

/** A check-in older than this reads as quiet: they've probably moved on. */
const FRESH_MS = 90 * 60_000;

/**
 * The crew's pulse, at the top of the crew chat while its festival is on:
 * everyone's face with where their latest check-in said they were and how
 * long ago. Only what people posted (never GPS), so an old spot is plainly old.
 */
export function CrewPulse({ crew, profiles, me }: { crew: Crew; profiles: Record<string, Profile>; me?: string }) {
  const now = useNow(60_000).getTime();
  const { updatesFor } = useCrewUpdates();
  const updates = updatesFor(crew.id).filter((u) => !isReply(u));
  const people = crew.members.map((uid) => {
    const latest = updates.filter((u) => u.uid === uid).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    const ago = latest ? Math.max(0, Math.round((now - Date.parse(latest.at)) / 60_000)) : undefined;
    return { uid, latest, ago, fresh: !!latest && now - Date.parse(latest.at) < FRESH_MS };
  });
  if (!people.some((p) => p.latest)) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {people.map((p) => {
        const name = p.uid === me ? t('You') : (profiles[p.uid]?.displayName.split(' ')[0] ?? t('Someone'));
        const where = p.latest?.stage ?? (p.latest?.lost ? t('Looking for you') : p.latest ? t('Checked in') : t('Quiet'));
        const when = p.ago === undefined ? '' : p.ago < 1 ? t('now') : p.ago < 60 ? t('{n} min', { n: p.ago }) : t('{n} h', { n: Math.round(p.ago / 60) });
        return (
          <View key={p.uid} style={[styles.person, !p.fresh && { opacity: 0.55 }]} accessible accessibilityLabel={`${name}: ${where}${when ? `, ${when}` : ''}`}>
            <View style={[styles.ring, p.fresh && styles.ringOn]}>
              <PersonAvatar name={profiles[p.uid]?.displayName} url={profiles[p.uid]?.avatarUrl} size={40} uid={p.uid} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.where} numberOfLines={1}>
              {where}
            </Text>
            {when ? <Text style={styles.when}>{when}</Text> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space.md, paddingVertical: space.sm },
  person: { width: 72, alignItems: 'center', gap: 2 },
  ring: { padding: 2, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: color.glow },
  name: { ...type.caption, color: color.moon },
  where: { ...type.caption, fontSize: 11, color: color.moonDim },
  when: { ...type.caption, fontSize: 10, color: color.moonFaint },
});
