import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useSocial } from '../../state/social';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import type { Crew } from '../social/models';
import { firstName } from './together';
import { ago, lateLine, latestPerMember, outboxLine, repliesLine, updateLine } from './updates';

/**
 * On the crew page: where everyone last was, from their newest video or
 * check-in, with when it happened (and when it got through, if signal held
 * it back), and a way to check in yourself.
 */
export function CrewLatest({ crew, nameOf }: { crew: Crew; nameOf: (uid: string) => string | undefined }) {
  const { updatesFor, outbox, profileOf, crewCount, stories, repliesFor } = useCrewUpdates();
  const social = useSocial();
  const catalog = useCatalog();
  const now = useNow().getTime();
  if (!crewCount) return null;
  const me = social.user?.uid;
  const rows = latestPerMember(updatesFor(crew.id), crew.members);
  const waiting = outboxLine(outbox.filter((o) => o.crewIds.includes(crew.id)));

  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>Latest from the crew</Text>
      {rows.map(({ uid, latest }) => {
        const mine = uid === me;
        const p = mine ? social.profile : profileOf(uid);
        const name = mine ? 'You' : (nameOf(uid) ?? (p ? firstName(p.displayName) : 'Crewmate'));
        const artist = latest?.artistId ? catalog.artist(latest.artistId)?.name : undefined;
        const late = latest ? lateLine(latest) : undefined;
        const canOpen = !mine && stories.some((s) => s.uid === uid);
        // What the crew said back to your latest.
        const answers = mine && latest ? repliesLine(repliesFor(latest).map((r) => r.reply), (id) => (id === me ? 'You' : (nameOf(id) ?? (profileOf(id) ? firstName(profileOf(id)!.displayName) : 'Crewmate')))) : undefined;
        const body = (
          <>
            <PersonAvatar name={p?.displayName} url={p?.avatarUrl} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
                {latest ? <Text style={styles.ago}> · {ago(latest.at, now)}</Text> : null}
              </Text>
              <Text style={styles.line} numberOfLines={2}>
                {latest ? `${updateLine(latest, artist)}${latest.note && latest.kind === 'checkin' ? ` · “${latest.note}”` : ''}` : 'No updates yet'}
              </Text>
              {late ? <Text style={styles.late}>{late}</Text> : null}
              {answers ? (
                <Text style={styles.answers} numberOfLines={1}>
                  {answers}
                </Text>
              ) : null}
            </View>
          </>
        );
        return canOpen ? (
          <Pressable
            key={uid}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/crew-story', params: { uid } });
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
          >
            {body}
          </Pressable>
        ) : (
          <View key={uid} style={styles.row} accessible>
            {body}
          </View>
        );
      })}
      {waiting ? <Text style={styles.waiting}>{waiting}</Text> : null}
      <Pressable
        onPress={() => {
          haptic.select();
          router.push('/check-in');
        }}
        accessibilityRole="button"
        accessibilityLabel="Check in with your crew"
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
      >
        <Text style={styles.buttonText}>Check in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  name: { ...type.headline, color: color.moon },
  ago: { ...type.caption, color: color.moonDim, fontWeight: '400' },
  line: { ...type.label, color: color.moonDim, marginTop: 1 },
  late: { ...type.caption, color: '#FFB86B', marginTop: 2 },
  waiting: { ...type.caption, color: '#FFB86B' },
  answers: { ...type.caption, color: color.glow, marginTop: 2 },
  button: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.45),
  },
  buttonText: { ...type.label, color: color.moon },
});
