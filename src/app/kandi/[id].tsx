import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfettiBurst } from '../../components/ConfettiBurst';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { PageTitle } from '../../components/PageTitle';
import { type Kandi, kandiCardFrom } from '../../features/kandi/kandi';
import { KandiBracelet } from '../../features/kandi/KandiBracelet';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../../features/social/service';
import { FollowGiver } from '../../features/sprouts/FollowGiver';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { useKandi } from '../../state/kandi';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';

type State = { at: 'loading' } | { at: 'missing' } | { at: 'open'; k: Kandi } | { at: 'mine'; k: Kandi } | { at: 'got'; k: Kandi; now?: boolean } | { at: 'failed'; text: string };

/**
 * Kandi given by code (`/kandi/<id>?u=…&h=…&w=…&b=…`, from a QR or a link):
 * the bracelet as the link describes it straight away, then whoever picks it
 * up first puts it in their garden and reads the note. Signed out: make a
 * profile first.
 */
export default function KandiCodeScreen() {
  const params = useLocalSearchParams<{ id: string; u?: string; h?: string; w?: string; b?: string }>();
  const card = kandiCardFrom(params);
  const id = params.id;
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const kandi = useKandi();
  const me = social.user?.uid;
  const [state, setState] = useState<State>({ at: 'loading' });
  const [busy, setBusy] = useState(false);

  const read = useCallback(async () => {
    if (!me || !social.profile) return;
    setState({ at: 'loading' });
    try {
      const k = await social.service.kandiById(id);
      if (!k) setState({ at: 'missing' });
      else if (k.from === me) setState({ at: 'mine', k });
      else if (k.to === me) setState({ at: 'got', k });
      else setState({ at: 'open', k });
    } catch (e) {
      setState({ at: 'failed', text: SOCIAL_ERROR_COPY[socialErrorKind(e)] });
    }
  }, [id, me, social.profile, social.service]);
  useEffect(() => {
    void Promise.resolve().then(read);
  }, [read]);

  const pickUp = async () => {
    if (state.at !== 'open' || busy) return;
    setBusy(true);
    try {
      const k = await social.service.claimKandi(id);
      haptic.celebrate();
      setState({ at: 'got', k, now: true });
      void kandi.refresh();
    } catch (e) {
      setState({ at: 'failed', text: SOCIAL_ERROR_COPY[socialErrorKind(e)] });
    } finally {
      setBusy(false);
    }
  };

  const k = state.at === 'open' || state.at === 'mine' || state.at === 'got' ? state.k : undefined;
  const word = k?.word ?? card?.word ?? '♥';
  const beads = k?.beads ?? card?.beads ?? 'rainbow';
  const from = card?.handle ? `@${card.handle}` : undefined;
  const signedIn = !!me && !!social.profile;

  return (
    <View style={styles.root}>
      <PageTitle title={t('Kandi for you')} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.title} accessibilityRole="header">
          {state.at === 'got' ? t('It’s in your garden') : state.at === 'mine' ? t('Your kandi') : t('Kandi for you')}
        </Text>
        {from ? <Text style={styles.from}>{t('from {name}', { name: from })}</Text> : null}
        <View style={styles.preview}>
          <KandiBracelet word={word} beads={beads} size={240} label={t('A kandi bracelet spelling {word}', { word })} />
          {state.at === 'got' && state.now ? <ConfettiBurst spread={160} /> : null}
        </View>
        {!signedIn ? (
          <>
            <Text style={styles.body}>{t('Make your Afterglow profile to pick it up. It goes in your garden, with a note only you read.')}</Text>
            <Pressable onPress={() => router.push(social.user ? '/profile-edit' : '/account')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{social.user ? t('Finish your profile') : t('Create your profile')}</Text>
            </Pressable>
            <Text style={styles.hint}>{t('Then open this link or scan the code again.')}</Text>
          </>
        ) : state.at === 'loading' ? null : state.at === 'open' ? (
          <Pressable onPress={() => void pickUp()} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}>
            <Text style={styles.primaryText}>{t('Put it in my garden')}</Text>
          </Pressable>
        ) : state.at === 'got' ? (
          <>
            {state.k.note ? <Text style={styles.note}>{`“${state.k.note}”`}</Text> : null}
            {card && card.from !== me ? <FollowGiver uid={card.from} handle={card.handle} name={card.handle} /> : null}
            <Pressable onPress={() => router.replace('/garden')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{t('See your garden')}</Text>
            </Pressable>
          </>
        ) : state.at === 'mine' ? (
          <Text style={styles.body}>{t('This is kandi you made. Show its code to a friend so they can pick it up.')}</Text>
        ) : state.at === 'missing' ? (
          <>
            <Text style={styles.body}>{t('This kandi isn’t on Afterglow yet, or it was taken back. If it was only just made, it arrives once its maker has signal.')}</Text>
            <Pressable onPress={() => void read()} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{t('Try again')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.body}>{state.text}</Text>
            <Pressable onPress={() => void read()} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{t('Try again')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, gap: space.md, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { ...type.largeTitle, color: color.moon },
  from: { ...type.headline, color: color.moonDim, marginTop: -space.sm },
  preview: { alignItems: 'center' },
  body: { ...type.body, color: color.moonDim },
  hint: { ...type.caption, color: color.moonFaint, textAlign: 'center' },
  note: { ...type.title, color: color.moon, textAlign: 'center' },
  primary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, marginTop: space.sm },
  secondary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  primaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
