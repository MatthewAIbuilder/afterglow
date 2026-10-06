import { router } from 'expo-router';
import { PageTitle } from '../components/PageTitle';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { ArtistRow } from '../components/ArtistRow';
import { FestivalRow } from '../components/FestivalRow';
import { NightSky } from '../components/NightSky';
import { SearchField } from '../components/SearchField';
import { ChevronIcon, CloseIcon } from '../components/TabIcons';
import type { Artist, Festival } from '../data/types';
import { searchCatalog, searchesPeople, liveRecents, topArtists, type Recent } from '../features/search/universal';
import type { Profile } from '../features/social/models';
import { PersonRow } from '../features/social/PersonRow';
import { haptic } from '../lib/haptics';
import { searchSecret } from '../features/secrets/secrets';
import { revealSecret } from '../state/secrets';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { useRatings } from '../state/ratings';
import { useRecentSearches } from '../state/recentSearches';
import { useSocial } from '../state/social';
import { useTaste } from '../state/taste';
import { useWeekends } from '../state/weekends';
import { color, radius, space, type } from '../theme/tokens';
import { goBack } from '../lib/nav';
import { t } from '../i18n';

/**
 * Search everything from Discover: people (when profiles are on and you're
 * signed in), artists and festivals, in one list as you type. Before you
 * type: your recent searches, your festivals and your best matches.
 */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const { taste, informed } = useTaste();
  const { ratings } = useRatings();
  const { going } = useGoing();
  const { forYou } = useWeekends();
  const social = useSocial();
  const { recents, remember, forget, clear } = useRecentSearches(social.user?.uid);
  const [query, setQuery] = useState('');
  // A secret word: "plur" rains hearts (once per time you type it).
  const secretWord = searchSecret(query);
  useEffect(() => {
    if (!secretWord) return;
    const t = setTimeout(() => revealSecret(secretWord), 500);
    return () => clearTimeout(t);
  }, [secretWord]);
  const q = query.trim();

  const found = useMemo(() => searchCatalog(q, catalog, taste), [q, catalog, taste]);

  // People, from your profile's service (a moment after you stop typing). Answers are kept with their search.
  const canFindPeople = social.availability.ok && !!social.user;
  const lookForPeople = canFindPeople && searchesPeople(q);
  const [people, setPeople] = useState<{ q: string; list?: Profile[]; failed?: boolean }>();
  useEffect(() => {
    if (!lookForPeople) return;
    let live = true;
    const t = setTimeout(() => {
      social.service
        .searchProfiles(q)
        .then((list) => live && setPeople({ q, list }))
        .catch(() => live && setPeople({ q, failed: true }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, lookForPeople, social.service]);
  const peopleNow = lookForPeople && people?.q === q ? people : undefined;
  const shownPeople = (peopleNow?.list ?? []).filter((p) => !social.blocked.has(p.uid) && p.uid !== social.user?.uid).slice(0, 5);

  const artistRow = (a: Artist) => {
    const at = catalog.festivalsOf(a.id);
    return (
      <ArtistRow
        key={a.id}
        artist={a}
        affinity={taste[a.id] ?? 0}
        festivalId={at.length === 1 ? at[0].id : undefined}
        detail={at.length ? t('Plays {festivals}', { festivals: at.map((f) => f.name).join(', ') }) : undefined}
        rating={ratings[a.id]}
        onOpen={() => remember({ kind: 'artist', id: a.id, label: a.name })}
      />
    );
  };

  const nothing = !!q && !found.festivals.length && !found.artists.length && (!lookForPeople || (peopleNow && !shownPeople.length));

  return (
    <View style={styles.root}>
      <PageTitle title={t('Search')} />
      <NightSky />
      <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
        <View style={{ flex: 1 }}>
          <SearchField value={query} onChange={setQuery} placeholder={canFindPeople ? t('Artists, festivals or @people') : t('Artists or festivals')} label={t('Search Afterglow')} autoFocus />
        </View>
        <Pressable onPress={() => goBack()} accessibilityRole="button" accessibilityLabel={t('Close search')} hitSlop={10}>
          <Text style={styles.cancel}>{t('Cancel')}</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xxxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {q ? (
          <>
            {lookForPeople ? (
              <>
                <Text style={styles.section}>{t('People')}</Text>
                {!peopleNow ? <ActivityIndicator color={color.glow} style={styles.spinner} /> : null}
                {peopleNow?.failed ? <Text style={styles.quiet}>{t('Couldn’t search people just now.')}</Text> : null}
                {peopleNow && !peopleNow.failed && !shownPeople.length ? <Text style={styles.quiet}>{t('No one matches “{query}”.', { query: q })}</Text> : null}
                {shownPeople.map((p) => (
                  <PersonRow key={p.uid} profile={p} follow onOpen={() => remember({ kind: 'person', id: p.handle, label: p.displayName })} />
                ))}
              </>
            ) : null}
            {found.peopleOnly && !canFindPeople ? (
              <Text style={styles.quiet}>{social.availability.ok ? t('Sign in on your profile to find people.') : t('Finding people isn’t available in this version yet.')}</Text>
            ) : null}
            {found.festivals.length ? <Text style={styles.section}>{t('Festivals')}</Text> : null}
            {found.festivals.map((f) => (
              <FestivalRow key={f.id} festival={f} onOpen={() => remember({ kind: 'festival', id: f.id, label: f.name })} />
            ))}
            {found.artists.length ? <Text style={styles.section}>{t('Artists')}</Text> : null}
            {found.artists.map(artistRow)}
            {nothing ? (
              <>
                <Text style={[styles.quiet, styles.nothing]}>{t('Nothing on Afterglow matches “{query}”.', { query: q })}</Text>
                <Pressable
                  onPress={() => router.push({ pathname: '/request', params: { name: q } })}
                  accessibilityRole="button"
                  accessibilityLabel={t('Request {query} as a festival', { query: q })}
                >
                  <Text style={styles.link}>{t('Is it a festival? Request “{query}”', { query: q })}</Text>
                </Pressable>
              </>
            ) : null}
          </>
        ) : (
          <Suggestions
            recents={recents ? liveRecents(recents, { festival: (id) => !!catalog.festival(id), artist: (id) => !!catalog.artist(id) }) : []}
            onRecent={(r) => {
              haptic.select();
              remember(r);
              if (r.kind === 'festival') router.push(`/festival/${r.id}`);
              else if (r.kind === 'artist') router.push({ pathname: '/artist/[id]', params: { id: r.id } });
              else router.push({ pathname: '/u/[handle]', params: { handle: r.id } });
            }}
            onForget={forget}
            onClear={clear}
            festivals={going.map((id) => catalog.festival(id)).filter((f): f is Festival => !!f).map(forYou)}
            top={topArtists(catalog.artists, taste, informed)}
            onFestival={(f) => remember({ kind: 'festival', id: f.id, label: f.name })}
            onArtist={(a) => {
              haptic.select();
              remember({ kind: 'artist', id: a.id, label: a.name });
              router.push({ pathname: '/artist/[id]', params: { id: a.id } });
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}

const KIND_LABEL: Record<Recent['kind'], string> = { festival: t('Festival'), artist: t('Artist'), person: t('Person') };

function Suggestions({
  recents,
  onRecent,
  onForget,
  onClear,
  festivals,
  top,
  onFestival,
  onArtist,
}: {
  recents: Recent[];
  onRecent: (r: Recent) => void;
  onForget: (r: Recent) => void;
  onClear: () => void;
  festivals: Festival[];
  top: Artist[];
  onFestival: (f: { id: string; name: string }) => void;
  onArtist: (a: Artist) => void;
}) {
  return (
    <>
      {recents.length ? (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>{t('Recent')}</Text>
            <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel={t('Clear recent searches')} hitSlop={8}>
              <Text style={styles.clear}>{t('Clear')}</Text>
            </Pressable>
          </View>
          {recents.map((r) => (
            <View key={`${r.kind}:${r.id}`} style={styles.recent}>
              <Pressable
                onPress={() => onRecent(r)}
                accessibilityRole="button"
                accessibilityLabel={`${r.label}, ${KIND_LABEL[r.kind].toLowerCase()}`}
                style={({ pressed }) => [styles.recentOpen, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.recentName} numberOfLines={1}>
                  {r.kind === 'person' ? `${r.label} · @${r.id}` : r.label}
                </Text>
                <Text style={styles.recentKind}>{KIND_LABEL[r.kind]}</Text>
              </Pressable>
              <Pressable onPress={() => onForget(r)} accessibilityRole="button" accessibilityLabel={t('Remove {name} from recent searches', { name: r.label })} hitSlop={10}>
                <CloseIcon color={color.moonFaint} size={12} />
              </Pressable>
            </View>
          ))}
        </>
      ) : null}
      {top.length ? (
        <>
          <Text style={styles.section}>{t('Your top matches')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faces} keyboardShouldPersistTaps="handled">
            {top.map((a) => (
              <Pressable key={a.id} onPress={() => onArtist(a)} accessibilityRole="button" accessibilityLabel={a.name} style={({ pressed }) => [styles.face, pressed && { opacity: 0.7 }]}>
                <ArtistAvatar artist={a} size={56} />
                <Text style={styles.faceName} numberOfLines={1}>
                  {a.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
      {festivals.length ? (
        <>
          <Text style={styles.section}>{t('Your festivals')}</Text>
          {festivals.map((f) => (
            <FestivalRow key={f.id} festival={f} onOpen={() => onFestival(f)} />
          ))}
        </>
      ) : null}
      {!recents.length && !top.length && !festivals.length ? (
        <Text style={[styles.quiet, styles.nothing]}>{t('Search for an artist, a festival or a friend’s @handle.')}</Text>
      ) : null}
      <Pressable onPress={() => router.push('/festivals')} accessibilityRole="button" style={styles.browse}>
        <Text style={styles.link}>{t('Browse all festivals')}</Text>
        <ChevronIcon color={color.glow} size={10} />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.sm },
  cancel: { ...type.headline, color: color.moonDim },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.xl, marginBottom: space.xs },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  clear: { ...type.label, color: color.moonDim },
  spinner: { marginVertical: space.md },
  quiet: { ...type.label, color: color.moonDim, marginVertical: space.sm },
  nothing: { marginTop: space.xl },
  link: { ...type.label, color: color.glow },
  recent: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  recentOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  recentName: { ...type.body, color: color.moon, flex: 1 },
  recentKind: { ...type.caption, color: color.moonFaint },
  faces: { gap: space.lg, paddingVertical: space.sm },
  face: { width: 64, alignItems: 'center', gap: space.xs },
  faceName: { ...type.caption, color: color.moonDim, textAlign: 'center', borderRadius: radius.sm },
  browse: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xxl, alignSelf: 'center' },
});
