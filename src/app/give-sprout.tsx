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
import { type Tier, tierLabel } from '../features/sprouts/artistSprouts';
import { giftStage, keptKinds, kindOf, seedsLine, SPROUT_NOTE_MAX, type SproutArtist, type SproutCard, type SproutKind, sproutLink, sproutName } from '../features/sprouts/sprouts';
import { canGiveThemes, GIFT_THEME_IDS } from '../features/themes/gifts';
import { ThemeSwatch } from '../features/themes/ThemePreview';
import { themeOf } from '../features/themes/themes';
import type { ThemeId } from '../theme/palettes';
import { useCatalog } from '../state/catalog';
import type { Artist } from '../data/models';
import { t } from '../i18n';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { shareMessage } from '../lib/share';
import { useSocial } from '../state/social';
import { useSprouts } from '../state/sprouts';
import { color, radius, space, type } from '../theme/tokens';
import { goBack } from '../lib/nav';

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
  // An artist's collectible (one you've filmed, or one you were given), chosen here or from the garden.
  const [artistId, setArtistId] = useState<string | undefined>(typeof params.artist === 'string' ? params.artist : undefined);
  const artistChoices = useMemo<{ artistId: string; name: string; tier: Tier; videos: number; mine: boolean }[]>(() => {
    const mine = sprouts.artists.map((a) => ({ artistId: a.artistId, name: catalog.artist(a.artistId)?.name ?? '', tier: a.tier, videos: a.videos, mine: true }));
    const given = sprouts.garden.flatMap((g) => (g.artist && g.stage === 3 ? [g.artist] : [])).filter((a, i, all) => all.findIndex((x) => x.id === a.id) === i && !mine.some((m) => m.artistId === a.id));
    return [...mine.filter((m) => m.name), ...given.map((a) => ({ artistId: a.id, name: a.name, tier: 0 as Tier, videos: 0, mine: false }))];
  }, [sprouts.artists, sprouts.garden, catalog]);
  const earned = artistId ? artistChoices.find((a) => a.artistId === artistId) : undefined;
  const artistOf = (id: string) => catalog.artist(id);
  const lookOf = (a: SproutArtist) => {
    const l = artistLook(artistOf(a.id) ?? a);
    return t('{name}: {theme}', { name: l.name, theme: l.theme.toLowerCase() });
  };
  const chosen: SproutArtist | undefined = earned ? { id: earned.artistId, name: earned.name } : undefined;
  const [note, setNote] = useState('');
  // Only Afterglow's developer can send a gift theme with a sprout (features/themes/gifts.ts).
  const themeGiver = canGiveThemes(social.profile?.handle);
  const [theme, setTheme] = useState<ThemeId>();
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
    const r = sprouts.give(chosen ? 'seedling' : kind, note, chosen, themeGiver ? theme : undefined);
    if ('problem' in r) {
      setProblem(
        r.problem === 'no-seeds'
          ? t('No seeds left today. New ones at 4 AM.')
          : r.problem === 'loading'
            ? t('One moment, your garden is still loading.')
            : r.problem === 'not-yours'
              ? chosen
                ? t('Film this artist’s set to earn their collectible first.')
                : (k.notGrown ?? t('Grow it all the way first, then you can pass it on.'))
              : t('Make your profile to give sprouts.'),
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
    showAlert(t('Take this sprout back?'), t('Nobody has picked it up yet. The seed comes back to you.'), [
      { text: t('Keep giving'), style: 'cancel' },
      {
        text: t('Take it back'),
        style: 'destructive',
        onPress: () =>
          void sprouts.takeBack(card.id).then((ok) => {
            if (ok) another();
            else showAlert(t('Someone already picked it up'), t('It’s growing in their garden now.'));
          }),
      },
    ]);
  };

  const status = useMemo(() => {
    if (picked) {
      const who = picked.name ?? picked.handle;
      return { text: who != null ? t('Picked up by {name}. It’s in their garden now.', { name: who }) : t('Picked up by someone. It’s in their garden now.'), tone: 'done' as const };
    }
    if (gift?.failed) return { text: t('This sprout couldn’t be sent, so your seed is back. Try giving it again.'), tone: 'wait' as const };
    if (gift && !gift.sent) return { text: online ? t('Saving your sprout…') : t('No signal: they can scan it now, and it goes through once you’ve both had signal.'), tone: 'wait' as const };
    return { text: t('Waiting for them to scan it…'), tone: 'idle' as const };
  }, [picked, gift, online]);

  const k = kindOf(kind);
  const hat = !!k.seed && !chosen;
  const noSeeds = sprouts.seeds === 0 && !hat;
  const blocked = !social.availability.ok || !social.user || !social.profile;

  return (
    <View style={styles.root}>
      <PageTitle title={t('Give a sprout')} />
      <View style={[styles.top, { paddingTop: Platform.OS === 'ios' ? space.lg : insets.top + space.md }]}>
        <Text style={styles.title} accessibilityRole="header">
          {t('Give a sprout')}
        </Text>
        <GlassCircleButton label={t('Close')} onPress={() => goBack()}>
          <CloseIcon color={color.moon} size={18} />
        </GlassCircleButton>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        {blocked ? (
          <View style={styles.empty}>
            <Sprout kind="seedling" stage={2} size={120} />
            <Text style={styles.emptyTitle}>{social.availability.ok ? t('Make a profile to give sprouts') : accountsOff(Platform.OS === 'web', 'Sprouts').title}</Text>
            <Text style={styles.body}>
              {social.availability.ok ? t('Sprouts carry your name, so the people you give them to know who they’re from.') : accountsOff(Platform.OS === 'web', 'Sprouts').body}
            </Text>
            {social.availability.ok ? (
              <Pressable onPress={() => router.push(social.user ? '/profile-edit' : '/account')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>{social.user ? t('Finish your profile') : t('Create your profile')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : card ? (
          <>
            <LinearGradient colors={[...SPROUT_GLOW]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
              <View style={styles.card} accessible accessibilityRole="image" accessibilityLabel={t('A code for your {sprout}. Someone scans it to pick it up.', { sprout: sproutName(card) })}>
                <FriendQR
                  value={sproutLink(card)}
                  size={size}
                  theme="aurora"
                  dots={SPROUT_DOTS}
                  centre={(s) => <SproutOf kind={card.kind} artist={card.artist} stage={card.kind === 'seedling' ? 2 : 3} size={s} still />}
                />
                <Text style={styles.cardName}>{sproutName(card)}</Text>
                <Text style={styles.cardFrom}>{t('from {name}', { name: `@${card.handle}` })}</Text>
                {gift?.theme ? <Text style={styles.cardTheme}>{t('With the {theme} theme', { theme: themeOf(gift.theme).name })}</Text> : null}
              </View>
            </LinearGradient>
            {picked ? <ConfettiBurst key={card.id} spread={160} /> : null}
            <Text style={[styles.status, status.tone === 'done' && styles.done, status.tone === 'wait' && styles.wait]} accessibilityLiveRegion="polite">
              {status.text}
            </Text>
            <Text style={styles.body}>{t('They scan it with Afterglow, or with their phone camera if they don’t have the app yet. One code, one sprout.')}</Text>
            <View style={styles.actions}>
              <Pressable onPress={another} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>{picked ? t('Give another') : t('Give someone else one')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic.select();
                  void shareMessage(t('A sprout for you, from {name} on Afterglow: {link}', { name: card.name, link: sproutLink(card) }), t('A sprout for you'));
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Send the sprout as a link instead')}
                style={({ pressed }) => [styles.secondary, styles.row, pressed && styles.pressed]}
              >
                <ShareIcon color={color.moon} size={16} />
                <Text style={styles.secondaryText}>{t('Send as a link')}</Text>
              </Pressable>
              {!picked ? (
                <Pressable onPress={takeBack} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.link}>{t('Take it back')}</Text>
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
                  <Text style={styles.heroName}>{sproutName({ kind: 'seedling', artist: chosen })}</Text>
                  <Text style={styles.body}>
                    {earned.mine
                      ? t('{look}. {tier} of them filmed. The one you give leaves your garden: film them again to earn it back.', { look: lookOf(chosen), tier: tierLabel(earned) })
                      : t('{look}. Given to you. The one you give leaves your garden for theirs.', { look: lookOf(chosen) })}
                  </Text>
                </>
              ) : (
                <>
                  <Sprout kind={kind} stage={giftStage(kind)} size={150} />
                  <Text style={styles.heroName}>{k.name}</Text>
                  <Text style={styles.body}>{k.about}</Text>
                  {keptKinds(social.user?.uid).includes(kind) ? (
                    <Text style={styles.body}>{t('You can give as many as you like, and they don’t use seeds.')}</Text>
                  ) : k.passOn ? (
                    <Text style={styles.body}>{k.passOn}</Text>
                  ) : kind !== 'seedling' ? (
                    <Text style={styles.body}>{t('Giving it moves it: it leaves your garden for theirs.')}</Text>
                  ) : null}
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
                    <Sprout kind={id} stage={giftStage(id)} size={44} still />
                    <Text style={styles.kindName} numberOfLines={1}>
                      {kindOf(id).short}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.hint}>{t('Grow your sprouts into new kinds, and you can give those too.')}</Text>
            )}
            {artistChoices.length ? (
              <>
                <Text style={styles.rowTitle}>{t('Artist collectibles')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds} accessibilityRole="radiogroup">
                  {artistChoices.flatMap((a) => {
                    const artist = artistOf(a.artistId) ?? ({ id: a.artistId, name: a.name, sound: {} } as Artist);
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
                        accessibilityLabel={a.mine ? t('{artist} collectible, {tier}', { artist: artist.name, tier: tierLabel(a) }) : t('{artist} collectible, given to you', { artist: artist.name })}
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
            {themeGiver ? (
              <>
                <Text style={styles.rowTitle}>{t('Add a theme (only you can give these)')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds} accessibilityRole="radiogroup">
                  <Pressable
                    onPress={() => {
                      haptic.select();
                      setTheme(undefined);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: !theme }}
                    accessibilityLabel={t('No theme')}
                    style={[styles.kind, styles.themeChoice, !theme && styles.kindOn]}
                  >
                    <View style={styles.noTheme} />
                    <Text style={styles.kindName} numberOfLines={1}>
                      {t('None')}
                    </Text>
                  </Pressable>
                  {GIFT_THEME_IDS.map((id) => (
                    <Pressable
                      key={id}
                      onPress={() => {
                        haptic.select();
                        setTheme(id);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: theme === id }}
                      accessibilityLabel={t('{theme} theme', { theme: themeOf(id).name })}
                      style={[styles.kind, styles.themeChoice, theme === id && styles.kindOn]}
                    >
                      <View style={styles.swatch}>
                        <ThemeSwatch id={id} width={56} height={44} />
                      </View>
                      <Text style={styles.kindName} numberOfLines={1}>
                        {themeOf(id).name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {theme ? <Text style={styles.hint}>{t('Whoever picks it up gets {theme}: on straight away for a new account, offered to one that already has a profile.', { theme: themeOf(theme).name })}</Text> : null}
              </>
            ) : null}
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={SPROUT_NOTE_MAX}
              placeholder={t('Add a note (optional)')}
              placeholderTextColor={color.moonFaint}
              accessibilityLabel={t('A note with your sprout')}
              style={styles.input}
            />
            {/* A hat uses no seed. */}
            {hat ? null : <Text style={[styles.seeds, sprouts.seeds === 0 && styles.wait]}>{seedsLine(sprouts.seeds, sprouts.festivalDay)}</Text>}
            {problem ? <Text style={styles.wait}>{problem}</Text> : null}
            <Pressable
              onPress={show}
              disabled={noSeeds}
              accessibilityRole="button"
              accessibilityState={{ disabled: noSeeds }}
              style={({ pressed }) => [styles.primary, noSeeds && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>{t('Show the code')}</Text>
            </Pressable>
            <Text style={styles.hint}>{t('They scan it and it’s theirs. Works without signal.')}</Text>
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
  kind: { alignItems: 'center', gap: 2, width: 72, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  kindOn: { borderColor: SPROUT_GREEN, backgroundColor: 'rgba(110,231,160,0.12)' },
  kindName: { ...type.caption, color: color.moon },
  themeChoice: { width: 84 },
  swatch: { width: 56, height: 44, borderRadius: radius.sm, overflow: 'hidden' },
  noTheme: { width: 56, height: 44, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: color.hairline },
  cardTheme: { ...type.caption, color: '#B5289E', marginTop: 2 },
  input: { ...type.body, color: color.moon, alignSelf: 'stretch', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
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
  secondary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  secondaryText: { ...type.headline, color: color.moon },
  row: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  link: { ...type.label, color: color.moonFaint, textAlign: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
