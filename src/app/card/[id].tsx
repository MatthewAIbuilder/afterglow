import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Missing } from '../../components/Missing';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { PageTitle } from '../../components/PageTitle';
import { artistLook } from '../../features/sprouts/artistLook';
import { tierLabel } from '../../features/sprouts/artistSprouts';
import { cardFrom } from '../../features/sprouts/cards';
import { CardStatsBack, CollectibleCard, FlipCard } from '../../features/sprouts/CollectibleCard';
import { HoloTilt } from '../../features/sprouts/HoloTilt';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useSprouts } from '../../state/sprouts';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * A collectible card someone shared (`/card/<artistId>?h=&t=&v=&s=`): the
 * card as they have it, and how to earn your own (only filming earns one).
 * If you already have it, yours is a tap away in your garden.
 */
export default function SharedCardScreen() {
  const params = useLocalSearchParams<{ id: string; h?: string; t?: string; v?: string; s?: string }>();
  const card = cardFrom(params);
  const catalog = useCatalog();
  const { artists } = useSprouts();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardW = Math.min(300, width - space.xl * 2);
  const artist = card ? catalog.artist(card.artistId) : undefined;
  // Turned over: how far they've come with this artist.
  const [turned, setTurned] = useState(false);
  if (!card || !artist) return <Missing title={t('Card not found')} line={t('This card’s artist isn’t on Afterglow any more, or the link isn’t quite right.')} />;
  const look = artistLook(artist);
  const mine = artists.find((a) => a.artistId === artist.id);
  const owner = card.handle ? `@${card.handle}` : undefined;
  return (
    <View style={styles.root}>
      <PageTitle title={t('{name} card', { name: look.name })} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.kicker}>{owner ? t('{owner}’s collectible', { owner }) : t('A collectible')}</Text>
        <HoloTilt width={cardW} height={Math.round(cardW * 1.4)} shiny={card.shiny} onTap={card.videos ? () => setTurned((v) => !v) : undefined}>
          <FlipCard
            flipped={turned && !!card.videos}
            front={<CollectibleCard look={look} artistName={artist.name} tier={card.tier} shiny={card.shiny} owner={owner} line={card.videos ? tierLabel({ tier: card.tier, videos: card.videos }) : undefined} width={cardW} />}
            back={card.videos ? <CardStatsBack look={look} artistName={artist.name} tier={card.tier} shiny={card.shiny} videos={card.videos} width={cardW} /> : null}
          />
        </HoloTilt>
        {card.videos ? (
          <Pressable
            onPress={() => {
              haptic.select();
              setTurned((v) => !v);
            }}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.turn}>{turned ? t('Turn it back') : t('Turn it over')}</Text>
          </Pressable>
        ) : null}
        {mine ? (
          <>
            <Text style={styles.body}>{t('You have this one too: {line}.', { line: tierLabel(mine) })}</Text>
            <Pressable onPress={() => router.push('/garden')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{t('See yours')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.body}>{t('Film {artist}’s set with Afterglow to earn your own. Every video levels it up: bronze, silver, then gold.', { artist: artist.name })}</Text>
            <Pressable
              onPress={() => {
                haptic.tap();
                router.push({ pathname: '/artist/[id]', params: { id: artist.id } });
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>{t('Where {artist} plays', { artist: artist.name })}</Text>
            </Pressable>
          </>
        )}
        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  turn: { ...type.caption, color: color.moonFaint, textDecorationLine: 'underline' },
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, gap: space.md, alignItems: 'center', maxWidth: 560, width: '100%', alignSelf: 'center' },
  kicker: { ...type.label, color: color.moonDim, letterSpacing: 1.2, textTransform: 'uppercase' },
  body: { ...type.body, color: color.moonDim, textAlign: 'center' },
  primary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  primaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  spacer: { height: space.lg },
});
