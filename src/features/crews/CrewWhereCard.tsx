import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useSocial } from '../../state/social';
import { LastUpdated } from '../offline/LastUpdated';
import { color, radius, space, type } from '../../theme/tokens';
import type { Crew, CrewUpdate } from '../social/models';
import { firstName } from './together';
import { ago, clock } from './updates';
import { crewWhere, whereLine, type Whereabouts } from './where';
import { t } from '../../i18n';

/**
 * Where's the crew: everyone at this festival grouped by the stage their
 * newest video or check-in came from, with when it happened. Only what
 * people posted, never live location; old places say so.
 */
export function CrewWhereCard({ festival, crews }: { festival: Festival; crews: readonly Crew[] }) {
  const { updatesFor, profileOf, stories, outbox, readAt, readLive } = useCrewUpdates();
  const social = useSocial();
  const now = useNow().getTime();
  const me = social.user?.uid;
  // Your own check-ins still waiting for signal count too: you know where you are.
  const waiting = me
    ? outbox
        .filter((o) => o.input.kind !== 'reply')
        .flatMap((o) => o.crewIds.filter((id) => crews.some((c) => c.id === id)).map((crewId) => ({ ...o.input, crewId, uid: me, sentAt: o.input.at }) as CrewUpdate))
    : [];
  const updates = [...crews.flatMap((c) => updatesFor(c.id)), ...waiting];
  const where = crewWhere(festival, crews, updates, { blocked: [...social.blocked], now });
  if (!where.stages.length && !where.elsewhere.length) return null;

  const profile = (uid: string) => (uid === me ? social.profile : profileOf(uid));
  const nameOf = (uid: string) => (uid === me ? t('You') : profile(uid) ? firstName(profile(uid)!.displayName) : t('Crewmate'));
  const quiet = where.quiet.filter((u) => u !== me).map(nameOf);

  const person = (w: Whereabouts) => {
    const name = nameOf(w.uid);
    const opens = w.uid !== me && stories.some((s) => s.uid === w.uid);
    const label = `${name}, ${clock(w.update.at)}, ${ago(w.update.at, now)}${w.stale ? `, ${t('may have moved')}` : ''}`;
    const body = (
      <>
        <PersonAvatar name={profile(w.uid)?.displayName} url={profile(w.uid)?.avatarUrl} size={28} />
        <Text style={[styles.person, w.stale && styles.stale]} numberOfLines={1}>
          {name} <Text style={styles.time}>{clock(w.update.at)}</Text>
        </Text>
      </>
    );
    return opens ? (
      <Pressable
        key={w.uid}
        onPress={() => {
          haptic.select();
          router.push({ pathname: '/crew-story', params: { uid: w.uid } });
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
      >
        {body}
      </Pressable>
    ) : (
      <View key={w.uid} style={styles.chip} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header" accessibilityHint={whereLine(where, nameOf)}>
        {t('Where’s the crew')}
      </Text>
      {where.stages.map((g) => (
        <View key={g.stage} style={styles.group}>
          <Text style={styles.stage}>{g.stage}</Text>
          <View style={styles.people}>{g.people.map(person)}</View>
        </View>
      ))}
      {where.elsewhere.length ? (
        <View style={styles.group}>
          <Text style={[styles.stage, styles.dim]}>{t('Somewhere else')}</Text>
          <View style={styles.people}>{where.elsewhere.map(person)}</View>
        </View>
      ) : null}
      {quiet.length ? <Text style={styles.note}>{t('No update yet from {names}.', { names: quiet.join(', ') })}</Text> : null}
      <Text style={styles.note}>{t('From their latest videos and check-ins, not live location.')}</Text>
      <LastUpdated at={readAt} live={readLive} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, gap: space.md },
  title: { ...type.headline, color: color.moon },
  group: { gap: space.xs },
  stage: { ...type.label, color: color.glow },
  dim: { color: color.moonDim },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingRight: space.md, paddingLeft: 2, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.06)' },
  person: { ...type.label, color: color.moon, maxWidth: 160 },
  time: { ...type.caption, color: color.moonDim },
  stale: { opacity: 0.55 },
  note: { ...type.caption, color: color.moonFaint },
});
