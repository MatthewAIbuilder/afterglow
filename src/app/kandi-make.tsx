import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { CHARMS, type CharmId, cleanWord, type KandiCard, kandiLink, NOTE_MAX, PATTERNS, type PatternId, WORD_IDEAS, WORD_MAX } from '../features/kandi/kandi';
import { FriendQR } from '../features/friends/FriendQR';
import { SearchField } from '../components/SearchField';
import type { Profile } from '../features/social/models';
import { shareMessage } from '../lib/share';
import { CharmIcon, KandiBracelet } from '../features/kandi/KandiBracelet';
import { useFriendsCircle } from '../features/friends/useFriendsCircle';
import { PersonAvatar } from '../components/PersonAvatar';
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { goBack } from '../lib/nav';
import { useKandi } from '../state/kandi';
import { useSocial } from '../state/social';
import { color, glowA, radius, space, type } from '../theme/tokens';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Make kandi for someone: a word in letter beads, a bead pattern and a note
 * only they read, then leave it in their garden (`?uid=…&name=…`). Kept on
 * this phone the moment you make it; it reaches them once there's signal.
 * Opened with nobody chosen: pick someone you follow or search for anyone,
 * or give it by code (`?code=1`): a QR whoever scans first picks it up from.
 */
export default function KandiMakeScreen() {
  const { uid, name, handle, code } = useLocalSearchParams<{ uid?: string; name?: string; handle?: string; code?: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const kandi = useKandi();
  const [word, setWord] = useState('PLUR');
  const [beads, setBeads] = useState<PatternId>('rainbow');
  const [charm, setCharm] = useState<CharmId>();
  const [note, setNote] = useState('');
  const [left, setLeft] = useState(false);
  const who = firstName(name ?? (handle ? `@${handle}` : t('them')));
  const shownWord = cleanWord(word) || '♥';
  // Given by code: for whoever scans it first.
  const byCode = code === '1' && !uid && !!social.profile;
  const canMake = byCode || (!!uid && !!social.user && !!social.profile && uid !== social.user.uid);
  // Opened without anyone chosen (from your garden): pick one of the people you follow, search, or make a code.
  const { profiles: friends } = useFriendsCircle();
  const choosing = !uid && !byCode && !!social.profile;
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ query: string; list: Profile[] }>();
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      social.service
        .searchProfiles(q)
        .then((list) => live && setFound({ query: q, list }))
        .catch(() => live && setFound({ query: q, list: [] }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, social.service]);
  const me = social.user?.uid;
  const people = (q.length >= 2 ? (found?.query === q ? found.list : undefined) : friends)?.filter((p) => p.uid !== me && !social.blocked.has(p.uid));
  const [card, setCard] = useState<KandiCard>();

  const leave = () => {
    if (!canMake) return;
    if (byCode) {
      const made = kandi.giveByCode(shownWord, beads, note, charm);
      if (made) {
        haptic.celebrate();
        setCard(made);
      }
      return;
    }
    if (uid && kandi.give({ uid, name: who }, shownWord, beads, note, charm)) {
      haptic.celebrate();
      setLeft(true);
    }
  };

  return (
    <View style={styles.root}>
      <PageTitle title={t('Make kandi')} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          {choosing ? t('Who’s it for?') : card ? t('Show them this code') : byCode ? t('Kandi to give in person') : left ? t('Left in {name}’s garden', { name: who }) : t('Kandi for {name}', { name: who })}
        </Text>
        {choosing ? (
          <View style={styles.people}>
            <Text style={styles.body}>{t('Kandi hangs in their garden, with a note only they read.')}</Text>
            {/* In person: a code whoever scans first picks it up from. */}
            <Pressable
              onPress={() => {
                haptic.select();
                router.setParams({ code: '1' });
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.person, styles.codeOption, pressed && styles.pressed]}
              testID="kandi-by-code"
            >
              <KandiBracelet word="" beads="neon" size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{t('Give it in person')}</Text>
                <Text style={styles.personHandle}>{t('Make a code they scan, like a sprout')}</Text>
              </View>
            </Pressable>
            <SearchField value={query} onChange={setQuery} placeholder={t('Search for anyone')} label={t('Search for someone to make kandi for')} />
            {people === undefined ? null : people.length ? (
              people.map((p) => (
                <Pressable
                  key={p.uid}
                  onPress={() => {
                    haptic.select();
                    router.setParams({ uid: p.uid, name: p.displayName, handle: p.handle });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('Make kandi for {name}', { name: p.displayName })}
                  style={({ pressed }) => [styles.person, pressed && styles.pressed]}
                  testID={`kandi-for-${p.handle}`}
                >
                  <PersonAvatar name={p.displayName} url={p.avatarUrl} uid={p.uid} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{p.displayName}</Text>
                    <Text style={styles.personHandle}>@{p.handle}</Text>
                  </View>
                </Pressable>
              ))
            ) : q.length >= 2 ? (
              <Text style={styles.body}>{t('Nobody called “{query}”.', { query: q })}</Text>
            ) : (
              <>
                <Text style={styles.body}>{t('Follow a friend first, then make them kandi.')}</Text>
                <Pressable onPress={() => router.push('/people')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                  <Text style={styles.primaryText}>{t('Find people')}</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : card ? (
          <View style={styles.preview}>
            <View style={styles.codeCard} accessible accessibilityRole="image" accessibilityLabel={t('A code for your kandi spelling {word}. Someone scans it to pick it up.', { word: card.word })}>
              <FriendQR value={kandiLink(card)} size={220} theme="aurora" centre={(sz) => <KandiBracelet word="" beads={card.beads} charm={charm} size={sz} />} />
              <Text style={styles.personName}>{card.word}</Text>
              <Text style={styles.personHandle}>{t('from {name}', { name: `@${card.handle}` })}</Text>
            </View>
            <ConfettiBurst key={card.id} spread={160} />
          </View>
        ) : (
          <View style={styles.preview}>
            <KandiBracelet word={shownWord} beads={beads} charm={charm} size={240} label={t('A kandi bracelet spelling {word}', { word: shownWord })} />
            {left ? <ConfettiBurst spread={160} /> : null}
          </View>
        )}
        {choosing ? null : card ? (
          <>
            <Text style={styles.body}>{t('They scan it with Afterglow, or with their phone camera if they don’t have the app yet. Whoever picks it up first gets it, note and all.')}</Text>
            <Pressable
              onPress={() => void shareMessage(t('Kandi for you, from @{handle} on Afterglow: {link}', { handle: card.handle, link: kandiLink(card) }), t('Kandi for you'))}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>{t('Send the link instead')}</Text>
            </Pressable>
            <Pressable onPress={() => goBack()} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{t('Done')}</Text>
            </Pressable>
          </>
        ) : left ? (
          <>
            <Text style={styles.body}>{t('It hangs in their garden now (once there’s signal), and they can read your note.')}</Text>
            <Pressable onPress={() => goBack()} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{t('Done')}</Text>
            </Pressable>
          </>
        ) : !canMake ? (
          <Text style={styles.body}>{social.profile ? t('Kandi is for someone else.') : t('Make your profile to give kandi.')}</Text>
        ) : (
          <>
            <Text style={styles.label}>{t('Letter beads')}</Text>
            <TextInput
              value={word}
              onChangeText={(v) => setWord(cleanWord(v) || (v.trim() ? word : ''))}
              autoCapitalize="characters"
              maxLength={WORD_MAX}
              placeholder="PLUR"
              placeholderTextColor={color.moonFaint}
              accessibilityLabel={t('The word in letter beads')}
              style={styles.input}
            />
            <View style={styles.chips}>
              {WORD_IDEAS.map((w) => (
                <Pressable
                  key={w}
                  onPress={() => {
                    haptic.select();
                    setWord(w);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.chip, shownWord === w && styles.chipOn, pressed && styles.pressed]}
                >
                  <Text style={styles.chipText}>{w}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>{t('Beads')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.patterns} accessibilityRole="radiogroup">
              {PATTERNS.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    haptic.select();
                    setBeads(p.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: beads === p.id }}
                  accessibilityLabel={p.name}
                  style={[styles.pattern, beads === p.id && styles.patternOn]}
                >
                  <KandiBracelet word="" beads={p.id} size={56} />
                  <Text style={styles.patternName} numberOfLines={1}>
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>{t('A charm')}</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {[undefined, ...CHARMS.map((c) => c.id)].map((id) => (
                <Pressable
                  key={id ?? 'none'}
                  onPress={() => {
                    haptic.select();
                    setCharm(id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: charm === id }}
                  accessibilityLabel={id ? CHARMS.find((c) => c.id === id)!.name : t('No charm')}
                  style={({ pressed }) => [styles.charm, charm === id && styles.patternOn, pressed && styles.pressed]}
                >
                  {id ? <CharmIcon id={id} size={34} /> : <Text style={styles.chipText}>{t('None')}</Text>}
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>{byCode ? t('A note (only whoever picks it up reads it)') : t('A note (only {name} reads it)', { name: who })}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={NOTE_MAX}
              multiline
              placeholder={t('So glad we met at the rail')}
              placeholderTextColor={color.moonFaint}
              accessibilityLabel={t('A note with your kandi')}
              style={[styles.input, styles.note]}
            />
            <Pressable onPress={leave} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{byCode ? t('Make the code') : t('Leave it in {name}’s garden', { name: who })}</Text>
            </Pressable>
            <Text style={styles.hint}>{t('Everyone visiting their garden sees the bracelet and who made it. Your note stays between you two.')}</Text>
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
  preview: { alignItems: 'center' },
  body: { ...type.body, color: color.moonDim },
  hint: { ...type.caption, color: color.moonFaint, textAlign: 'center' },
  label: { ...type.label, color: color.moonDim, marginTop: space.sm },
  input: { ...type.headline, color: color.moon, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, letterSpacing: 2 },
  note: { ...type.body, letterSpacing: 0, minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  chipOn: { backgroundColor: glowA(0.2), borderColor: glowA(0.55) },
  chipText: { ...type.label, color: color.moon, letterSpacing: 1 },
  patterns: { gap: space.sm },
  pattern: { alignItems: 'center', width: 76, paddingVertical: space.xs, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
  patternOn: { borderColor: glowA(0.6), backgroundColor: glowA(0.12) },
  patternName: { ...type.caption, color: color.moonDim },
  people: { gap: space.sm },
  charm: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.glass },
  codeOption: { borderColor: glowA(0.5), backgroundColor: glowA(0.12) },
  codeCard: { alignItems: 'center', gap: space.xs, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  personName: { ...type.headline, color: color.moon },
  personHandle: { ...type.caption, color: color.moonDim },
  primary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, marginTop: space.md },
  primaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
