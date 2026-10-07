import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { cleanWord, NOTE_MAX, PATTERNS, type PatternId, WORD_IDEAS, WORD_MAX } from '../features/kandi/kandi';
import { KandiBracelet } from '../features/kandi/KandiBracelet';
import { useFriendsCircle } from '../features/friends/useFriendsCircle';
import { PersonAvatar } from '../components/PersonAvatar';
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { goBack } from '../lib/nav';
import { useKandi } from '../state/kandi';
import { useSocial } from '../state/social';
import { color, glowA, radius, space, type, accentEdge } from '../theme/tokens';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Make kandi for someone: a word in letter beads, a bead pattern and a note
 * only they read, then leave it in their garden (`?uid=…&name=…`). Kept on
 * this phone the moment you make it; it reaches them once there's signal.
 */
export default function KandiMakeScreen() {
  const { uid, name, handle } = useLocalSearchParams<{ uid?: string; name?: string; handle?: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const kandi = useKandi();
  const [word, setWord] = useState('PLUR');
  const [beads, setBeads] = useState<PatternId>('rainbow');
  const [note, setNote] = useState('');
  const [left, setLeft] = useState(false);
  const who = firstName(name ?? (handle ? `@${handle}` : t('them')));
  const shownWord = cleanWord(word) || '♥';
  const canMake = !!uid && !!social.user && !!social.profile && uid !== social.user.uid;
  // Opened without anyone chosen (from your garden): pick one of the people you follow first.
  const { profiles: friends } = useFriendsCircle();
  const choosing = !uid && !!social.profile;

  const leave = () => {
    if (!uid || !canMake) return;
    if (kandi.give({ uid, name: who }, shownWord, beads, note)) {
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
          {choosing ? t('Who’s it for?') : left ? t('Left in {name}’s garden', { name: who }) : t('Kandi for {name}', { name: who })}
        </Text>
        {choosing ? (
          <View style={styles.people}>
            <Text style={styles.body}>{t('Kandi hangs in their garden, with a note only they read.')}</Text>
            {friends === undefined ? null : friends.length ? (
              friends.map((p) => (
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
            ) : (
              <>
                <Text style={styles.body}>{t('Follow a friend first, then make them kandi.')}</Text>
                <Pressable onPress={() => router.push('/people')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                  <Text style={styles.primaryText}>{t('Find people')}</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <View style={styles.preview}>
            <KandiBracelet word={shownWord} beads={beads} size={240} label={t('A kandi bracelet spelling {word}', { word: shownWord })} />
            {left ? <ConfettiBurst spread={160} /> : null}
          </View>
        )}
        {choosing ? null : left ? (
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
            <Text style={styles.label}>{t('A note (only {name} reads it)', { name: who })}</Text>
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
              <Text style={styles.primaryText}>{t('Leave it in {name}’s garden', { name: who })}</Text>
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
  input: { ...type.headline, color: color.moon, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim, letterSpacing: 2 },
  note: { ...type.body, letterSpacing: 0, minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  chipOn: { backgroundColor: glowA(0.2), borderColor: glowA(0.55) },
  chipText: { ...type.label, color: color.moon, letterSpacing: 1 },
  patterns: { gap: space.sm },
  pattern: { alignItems: 'center', width: 76, paddingVertical: space.xs, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
  patternOn: { borderColor: glowA(0.6), backgroundColor: glowA(0.12) },
  patternName: { ...type.caption, color: color.moonDim },
  people: { gap: space.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  personName: { ...type.headline, color: color.moon },
  personHandle: { ...type.caption, color: color.moonDim },
  primary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, ...accentEdge, marginTop: space.md },
  primaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
