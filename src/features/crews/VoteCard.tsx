import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import type { Crew } from '../social/models';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { tallyLineup, votedCount, type CrewVotes } from './votes';
import { t } from '../../i18n';

/** On the crew page: vote on the lineup together, with how many have voted and the crew's top picks so far. */
export function VoteCard({ crew, votes, lineup }: { crew: Crew; votes: readonly CrewVotes[]; lineup: readonly string[] }) {
  const { artist } = useCatalog();
  const started = crew.members.filter((m) => votedCount(votes.find((v) => v.uid === m), lineup) > 0).length;
  const top = tallyLineup(votes, crew.members, lineup)
    .slice(0, 3)
    .flatMap((r) => {
      const a = artist(r.artistId);
      return a ? [a] : [];
    });
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/crew-vote/[id]', params: { id: crew.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${t('Vote on the lineup together')}. ${t('{n} of {m} have voted', { n: started, m: crew.members.length })}${top.length ? `. ${t('Top so far: {names}', { names: top.map((a) => a.name).join(', ') })}` : ''}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{t('Vote on the lineup together')}</Text>
        <Text style={styles.sub}>{started ? t('{n} of {m} have voted', { n: started, m: crew.members.length }) : t('Must see, maybe or skip: see what the crew wants most.')}</Text>
      </View>
      {top.length ? (
        <View style={styles.faces}>
          {top.map((a, i) => (
            <View key={a.id} style={[styles.face, i > 0 && { marginLeft: -10 }]}>
              <ArtistAvatar artist={a} size={30} />
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: glowA(0.1),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  title: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 16, borderWidth: 1.5, borderColor: color.night },
  chevron: { ...type.title, color: color.moonFaint },
});
