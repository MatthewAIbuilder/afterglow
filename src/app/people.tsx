import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { NightSky } from '../components/NightSky';
import { SearchField } from '../components/SearchField';
import { ChevronIcon } from '../components/TabIcons';
import type { Profile } from '../features/social/models';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../features/social/service';
import { useSocial } from '../state/social';
import { color, space, type } from '../theme/tokens';

/** Find people on Afterglow by name or @handle. People you've blocked never show up. */
export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const [query, setQuery] = useState('');
  // Answers are kept with the search they answer, so an old answer never shows for a new search.
  const [answer, setAnswer] = useState<{ q: string; results?: Profile[]; problem?: string }>();
  const q = query.trim();
  const searchable = q.replace(/^@/, '').length >= 2;

  useEffect(() => {
    if (!searchable) return;
    let live = true;
    const t = setTimeout(() => {
      social.service
        .searchProfiles(q)
        .then((results) => live && setAnswer({ q, results }))
        .catch((e) => live && setAnswer({ q, problem: SOCIAL_ERROR_COPY[socialErrorKind(e)] }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, searchable, social.service]);
  const current = searchable && answer?.q === q ? answer : undefined;
  const results = current?.results;
  const problem = current?.problem;

  const shown = (results ?? []).filter((p) => !social.blocked.has(p.uid) && p.uid !== social.user?.uid);

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl, gap: space.md }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={styles.title} accessibilityRole="header">
          Find people
        </Text>
        <SearchField value={query} onChange={setQuery} placeholder="Name or @handle" label="Search people" autoFocus />
        {problem ? <Text style={styles.quiet}>{problem}</Text> : null}
        {searchable && !current ? <ActivityIndicator color={color.glow} /> : null}
        {results && !shown.length ? <Text style={styles.quiet}>No one matches “{query.trim()}”.</Text> : null}
        {shown.map((p) => (
          <Pressable
            key={p.uid}
            onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: p.handle } })}
            accessibilityRole="button"
            accessibilityLabel={`${p.displayName}, @${p.handle}`}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
          >
            <View style={styles.avatar}>
              {p.avatarUrl ? <Image source={{ uri: p.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.initial}>{p.displayName.slice(0, 1).toUpperCase()}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.displayName}</Text>
              <Text style={styles.handle}>@{p.handle}</Text>
            </View>
            <ChevronIcon color={color.moonFaint} size={12} />
          </Pressable>
        ))}
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => router.back()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  quiet: { ...type.body, color: color.moonDim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: color.haze, alignItems: 'center', justifyContent: 'center' },
  initial: { ...type.headline, color: color.moon },
  name: { ...type.headline, color: color.moon },
  handle: { ...type.caption, color: color.moonDim },
});
