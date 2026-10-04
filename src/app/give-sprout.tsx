import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { PageTitle } from '../components/PageTitle';
import { CloseIcon, ShareIcon } from '../components/TabIcons';
import { FriendQR } from '../features/friends/FriendQR';
import { accountsOff } from '../features/social/unavailable';
import { SPROUT_DOTS, SPROUT_GLOW, SPROUT_GREEN } from '../features/sprouts/look';
import { Sprout } from '../features/sprouts/Sprout';
import { SproutOf } from '../features/sprouts/SproutOf';
import { artistLook } from '../features/sprouts/artistLook';
import { tierLabel } from '../features/sprouts/artistSprouts';
import { kindOf, seedsLine, SPROUT_NOTE_MAX, type SproutArtist, type SproutCard, type SproutKind, sproutLink, sproutName } from '../features/sprouts/sprouts';
import { useCatalog } from '../state/catalog';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { shareMessage } from '../lib/share';
import { useSocial } from '../state/social';
import { useSprouts } from '../state/sprouts';
import { color, radius, space, type } from '../theme/tokens';

/** While a code is showing, it's checked this often to see if someone picked it up. */
const CHECK_MS = 4000;

/**
 * Give a sprout. Choose the kind (plain sprouts, or any kind you've grown)
 * and a note, then show the code: they scan it with Afterglow, or with their
 * phone camera if they don't have the app yet. Works with no signal: the
 * sprout reaches Afterglow once there is.
 */
export default function GiveSproutScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const social = useSocial();
  const sprouts = useSprouts();
  const catalog = useCatalog();
  const params = useLocalSearchParams<{ artist?: string }>();
  const [kind, setKind] = useState<SproutKind>('seedling');
  // An artist's sprout (one you've filmed), chosen here or from the garden.
  const [artistId, setArtistId] = useState<string | undefined>(typeof params.artist === 'string' ? params.artist : undefined);
  const earned = artistId ? sprouts.artists.find((a) => a.artistId === artistId) : undefined;
  const artistOf = (id: string) => catalog.artist(id);
  const chosen: SproutArtist | undefined = earned && artistOf(earned.artistId) ? { id: earned.artistId, name: artistOf(earned.artistId)!.name } : undefined;
  const [note, setNote] = useState('');
  const [card, setCard] = useState<SproutCard>();
  const [problem, setProblem] = useState<string>();
  const gift = card ? sprouts.gifts.find((g) => g.id === card.id) : undefined;
  const picked = gift?.claimedBy;
  const size = Math.min(width - space.xl * 2 - 48, 280);

  // While the code shows, look every few seconds for someone picking it up.
  const { checkGift, online } = sprouts;
  const watching = card && gift?.sent && !picked && online ? card.id : undefined;
  useEffect(() => {
    if (!watching) return;
    const t = setInterval(() => void checkGift(watching), CHECK_MS);
    return () => clearInterval(t);
  }, [watching, checkGift]);
  useEffect(() => {
    if (picked) haptic.celebrate();
  }, [picked]);

  const show = () => {
    const r = sprouts.give(chosen ? 'seedling' : kind, note, chosen);
    if ('problem' in r) {
      setProblem(
        r.problem === 'no-seeds'
          ? 'No seeds left today. New ones at 4 AM.'
          : r.problem === 'loading'
            ? 'One moment, your garden is still loading.'
            : r.problem === 'not-yours'
              ? 'Film this artist’s set to grow their sprout first.'
              : 'Make your profile to give sprouts.',
      );
      return;
    }
    haptic.settle();
    setProblem(undefined);
    setCard(r.card);
  };
  const another = () => {
    setCard(undefined);
    setNote('');
  };
  const takeBack = () => {
    if (!card) return;
    showAlert('Take this sprout back?', 'Nobody has picked it up yet. The seed comes back to you.', [
      { text: 'Keep giving', style: 'cancel' },
      {
        text: 'Take it back',
        style: 'destructive',
        onPress: () =>
          void sprouts.takeBack(card.id).then((ok) => {
            if (ok) another();
            else showAlert('Someone already picked it up', 'It’s growing in their garden now.');
          }),
      },
    ]);
  };

  const status = useMemo(() => {
    if (picked) return { text: `Picked up by ${picked.name ?? picked.handle ?? 'someone'}. It’s in their garden now.`, tone: 'done' as const };
    if (gift && !gift.sent) return { text: online ? 'Saving your sprout…' : 'No signal: they can scan it now, and it goes through once you’ve both had signal.', tone: 'wait' as const };
    return { text: 'Waiting for them to scan it…', tone: 'idle' as const };
  }, [picked, gift, online]);

  const k = kindOf(kind);
  const blocked = !social.availability.ok || !social.user || !social.profile;

  return (
    <View style={styles.root}>
      <PageTitle title="Give a sprout" />
      <View style={[styles.top, { paddingTop: Platform.OS === 'ios' ? space.lg : insets.top + space.md }]}>
        <Text style={styles.title} accessibilityRole="header">
          Give a sprout
        </Text>
        <GlassCircleButton label="Close" onPress={() => router.back()}>
          <CloseIcon color={color.moon} size={18} />
        </GlassCircleButton>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        {blocked ? (
          <View style={styles.empty}>
            <Sprout kind="seedling" stage={2} size={120} />
            <Text style={styles.emptyTitle}>{social.availability.ok ? 'Make a profile to give sprouts' : accountsOff(Platform.OS === 'web', 'Sprouts').title}</Text>
            <Text style={styles.body}>
              {social.availability.ok ? 'Sprouts carry your name, so the people you give them to know who they’re from.' : accountsOff(Platform.OS === 'web', 'Sprouts').body}
            </Text>
            {social.availability.ok ? (
              <Pressable onPress={() => router.push(social.user ? '/profile-edit' : '/account')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>{social.user ? 'Finish your profile' : 'Create your profile'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : card ? (
          <>
            <LinearGradient colors={[...SPROUT_GLOW]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
              <View style={styles.card} accessible accessibilityRole="image" accessibilityLabel={`A code for your ${sproutName(card)}. Someone scans it to pick it up.`}>
                <FriendQR
                  value={sproutLink(card)}
                  size={size}
                  theme="aurora"
                  dots={SPROUT_DOTS}
                  centre={(s) => <SproutOf kind={card.kind} artist={card.artist} stage={card.kind === 'seedling' ? 2 : 3} size={s} still />}
                />
                <Text style={styles.cardName}>{sproutName(card)}</Text>
                <Text style={styles.cardFrom}>from @{card.handle}</Text>
              </View>
            </LinearGradient>
            {picked ? <ConfettiBurst key={card.id} spread={160} /> : null}
            <Text style={[styles.status, status.tone === 'done' && styles.done, status.tone === 'wait' && styles.wait]} accessibilityLiveRegion="polite">
              {status.text}
            </Text>
            <Text style={styles.body}>They scan it with Afterglow, or with their phone camera if they don’t have the app yet. One code, one sprout.</Text>
            <View style={styles.actions}>
              <Pressable onPress={another} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>{picked ? 'Give another' : 'Give someone else one'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic.select();
                  void shareMessage(`A sprout for you, from ${card.name} on Afterglow: ${sproutLink(card)}`, 'A sprout for you');
                }}
                accessibilityRole="button"
                accessibilityLabel="Send the sprout as a link instead"
                style={({ pressed }) => [styles.secondary, styles.row, pressed && styles.pressed]}
              >
                <ShareIcon color={color.moon} size={16} />
                <Text style={styles.secondaryText}>Send as a link</Text>
              </Pressable>
              {!picked ? (
                <Pressable onPress={takeBack} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.link}>Take it back</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View style={styles.hero}>
              {chosen && earned ? (
                <>
                  <SproutOf artist={chosen} tier={earned.tier} size={150} />
                  <Text style={styles.heroName}>{chosen.name} sprout</Text>
                  <Text style={styles.body}>
                    {artistLook(artistOf(chosen.id) ?? { id: chosen.id, name: chosen.name }).theme}. {tierLabel(earned)} of them filmed. The one you give stays yours too.
                  </Text>
                </>
              ) : (
                <>
                  <Sprout kind={kind} stage={kind === 'seedling' ? 2 : 3} size={150} />
                  <Text style={styles.heroName}>{k.name}</Text>
                  <Text style={styles.body}>{k.about}</Text>
                </>
              )}
            </View>
            {sprouts.givable.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds} accessibilityRole="radiogroup">
                {sprouts.givable.map((id) => (
                  <Pressable
                    key={id}
                    onPress={() => {
                      haptic.select();
                      setKind(id);
                      setArtistId(undefined);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: !chosen && id === kind }}
                    accessibilityLabel={kindOf(id).name}
                    style={[styles.kind, !chosen && id === kind && styles.kindOn]}
                  >
                    <Sprout kind={id} stage={id === 'seedling' ? 2 : 3} size={44} still />
                    <Text style={styles.kindName} numberOfLines={1}>
                      {kindOf(id).name.replace(' sprout', '')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.hint}>Grow your sprouts into new kinds, and you can give those too.</Text>
            )}
            {sprouts.artists.length ? (
              <>
                <Text style={styles.rowTitle}>Artist sprouts</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds} accessibilityRole="radiogroup">
                  {sprouts.artists.flatMap((a) => {
                    const artist = artistOf(a.artistId);
                    if (!artist) return [];
                    const on = chosen?.id === a.artistId;
                    return [
                      <Pressable
                        key={a.artistId}
                        onPress={() => {
                          haptic.select();
                          setArtistId(a.artistId);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${artist.name} sprout, ${tierLabel(a)}`}
                        style={[styles.kind, on && styles.kindOn]}
                      >
                        <Sprout artist={artistLook(artist)} tier={a.tier} stage={3} size={44} still />
                        <Text style={styles.kindName} numberOfLines={1}>
                          {artist.name}
                        </Text>
                      </Pressable>,
                    ];
                  })}
                </ScrollView>
              </>
            ) : null}
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={SPROUT_NOTE_MAX}
              placeholder="Add a note (optional)"
              placeholderTextColor={color.moonFaint}
              accessibilityLabel="A note with your sprout"
              style={styles.input}
            />
            <Text style={[styles.seeds, sprouts.seeds === 0 && styles.wait]}>{seedsLine(sprouts.seeds, sprouts.festivalDay)}</Text>
            {problem ? <Text style={styles.wait}>{problem}</Text> : null}
            <Pressable
              onPress={show}
              disabled={sprouts.seeds === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: sprouts.seeds === 0 }}
              style={({ pressed }) => [styles.primary, sprouts.seeds === 0 && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Show the code</Text>
            </Pressable>
            <Text style={styles.hint}>They scan it and it’s theirs. Works without signal.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rowTitle: { ...type.label, color: color.moonDim, alignSelf: 'flex-start' },
  root: { flex: 1, backgroundColor: color.night },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.md },
  title: { ...type.title, color: color.moon, flex: 1 },
  content: { paddingHorizontal: space.xl, gap: space.md, alignItems: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  empty: { alignItems: 'center', gap: space.md, paddingTop: space.xl },
  emptyTitle: { ...type.headline, color: color.moon, textAlign: 'center' },
  body: { ...type.body, color: color.moonDim, textAlign: 'center' },
  hint: { ...type.caption, color: color.moonFaint, textAlign: 'center' },
  hero: { alignItems: 'center', gap: space.xs, paddingTop: space.sm },
  heroName: { ...type.title, color: SPROUT_GREEN },
  kinds: { gap: space.sm, paddingHorizontal: space.xs },
  kind: { alignItems: 'center', gap: 2, width: 72, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  kindOn: { borderColor: SPROUT_GREEN, backgroundColor: 'rgba(110,231,160,0.12)' },
  kindName: { ...type.caption, color: color.moon },
  input: { ...type.body, color: color.moon, alignSelf: 'stretch', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  seeds: { ...type.label, color: SPROUT_GREEN },
  ring: { padding: 3, borderRadius: radius.lg + 3, marginTop: space.sm },
  card: { backgroundColor: '#FBF9FF', borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: 2 },
  cardName: { ...type.headline, color: '#0E2A1A', marginTop: space.md },
  cardFrom: { ...type.label, color: '#3B5A48' },
  status: { ...type.headline, color: color.moon, textAlign: 'center' },
  done: { color: SPROUT_GREEN },
  wait: { ...type.label, color: '#FFB86B', textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space.md, marginTop: space.sm, alignItems: 'stretch' },
  primary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: '#1E8F4A' },
  primaryText: { ...type.headline, color: color.moon },
  secondary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  row: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  link: { ...type.label, color: color.moonFaint, textAlign: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
