import { StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { t, tn } from '../../i18n';
import { useCatalog } from '../../state/catalog';
import { color, radius, space, type } from '../../theme/tokens';
import { artistLook } from '../sprouts/artistLook';
import { CollectibleCard } from '../sprouts/CollectibleCard';
import type { ShowcaseCard } from '../sprouts/ShowcaseRow';

/**
 * Your profile as a story picture: your photo in a ring of light, your name
 * and @handle, your glow level, the cards in your showcase and what's in
 * your garden. Drawn inside a StoryFrame, `width` wide.
 */
export function ProfileStory({
  width: w,
  name,
  handle,
  avatarUrl,
  uid,
  level,
  cards,
  counts,
}: {
  width: number;
  name: string;
  handle: string;
  avatarUrl?: string;
  uid?: string;
  level?: { level: number; name: string };
  cards: readonly ShowcaseCard[];
  counts: { collectibles: number; sprouts: number; kandi: number };
}) {
  const catalog = useCatalog();
  const inner = w - 2 * space.lg;
  const avatar = Math.round(w * 0.26);
  const cardW = Math.floor((inner - 2 * space.xs) / 3);
  const k = w / 360;
  const line = [
    counts.collectibles ? tn(counts.collectibles, '{n} collectible', '{n} collectibles') : undefined,
    counts.sprouts ? tn(counts.sprouts, '{n} sprout', '{n} sprouts') : undefined,
    counts.kandi ? tn(counts.kandi, '{n} kandi', '{n} kandi') : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[styles.root, { width: inner, gap: space.sm * k }]}>
      <View style={[styles.ring, { width: avatar + 10, height: avatar + 10, borderRadius: (avatar + 10) / 2 }]}>
        <PersonAvatar name={name} url={avatarUrl} size={avatar} uid={uid} />
      </View>
      <Text style={[styles.name, { fontSize: 24 * k, lineHeight: 30 * k }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.handle, { fontSize: 14 * k }]}>{`@${handle}`}</Text>
      {level ? <Text style={[styles.level, { fontSize: 12 * k }]}>{t('Level {n} · {name}', { n: level.level, name: level.name })}</Text> : null}
      {cards.length ? (
        <View style={[styles.cards, { marginTop: space.sm * k }]}>
          {cards.slice(0, 3).map((c) => (
            <CollectibleCard key={c.artistId} look={artistLook(catalog.artist(c.artistId) ?? { id: c.artistId, name: c.name, sound: {} })} artistName={c.name} tier={c.tier} shiny={!!c.shiny} width={cardW} still />
          ))}
        </View>
      ) : null}
      {line ? <Text style={[styles.line, { fontSize: 12 * k }]}>{line}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.glow, shadowColor: color.glow, shadowOpacity: 0.8, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  name: { ...type.title, color: color.moon, marginTop: space.sm },
  handle: { ...type.body, color: color.moonDim },
  level: { ...type.label, color: '#FFE58A', borderWidth: 1, borderColor: 'rgba(255,229,138,0.5)', borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 2, overflow: 'hidden' },
  cards: { flexDirection: 'row', gap: space.xs },
  line: { ...type.caption, color: color.moonDim, marginTop: space.xs },
});
