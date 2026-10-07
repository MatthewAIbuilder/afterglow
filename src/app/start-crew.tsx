import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchField } from '../components/SearchField';
import { ChevronIcon } from '../components/TabIcons';
import { defaultCrewName } from '../features/crews/CrewCard';
import { matchesName } from '../features/festivals/search';
import { bySoonest, isOver } from '../features/festivals/shelves';
import { countdown } from '../features/festivals/when';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../features/social/service';
import type { Festival } from '../data/models';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useCatalog } from '../state/catalog';
import { useCrews } from '../state/crews';
import { useGoing } from '../state/going';
import { useGoingShows } from '../state/goingShows';
import { upcomingShowEvents } from '../features/festivalMode/showEvent';
import { useSocial } from '../state/social';
import { color, radius, space, type, pageColumn } from '../theme/tokens';
import { SheetClose } from '../components/SheetClose';
import { datesLine } from '../features/festivals/format';
import { t } from '../i18n';
import { SHEET_BACKGROUND } from '../components/LiquidGlass';

/** At most this many festivals are listed while searching. */
const LIST_MAX = 20;

/**
 * Start a crew: pick the festival (the ones you're going to first, or find
 * another), and the crew page opens ready to name it and invite friends.
 */
export default function StartCrewScreen() {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const today = useToday();
  const social = useSocial();
  const { going } = useGoing();
  const { crewsAt, create } = useCrews();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | undefined>();

  const upcoming = useMemo(() => bySoonest(catalog.festivals.filter((f) => !isOver(f, today)), today), [catalog.festivals, today]);
  // One-night shows you're going to sit among your festivals, by date.
  const { shows } = useGoingShows();
  const yours = useMemo(
    () => bySoonest([...upcoming.filter((f) => going.includes(f.id)), ...upcomingShowEvents(shows, catalog.shows, today)], today),
    [upcoming, going, shows, catalog.shows, today],
  );
  const q = query.trim();
  const others = q ? upcoming.filter((f) => matchesName(f.name, q)).slice(0, LIST_MAX) : yours.length ? [] : upcoming.slice(0, 8);

  const start = async (f: Festival) => {
    if (busy) return;
    if (!social.profile) {
      router.replace(social.user ? '/profile-edit' : '/account');
      return;
    }
    haptic.select();
    setBusy(f.id);
    try {
      const crew = await create(f.id, defaultCrewName(f));
      haptic.settle();
      router.replace({ pathname: '/crew/[id]', params: { id: crew.id, fresh: '1' } });
    } catch (e) {
      showAlert(t('Couldn’t start a crew'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
      setBusy(undefined);
    }
  };

  const row = (f: Festival) => {
    const had = crewsAt(f.id);
    const when = countdown(f, today);
    return (
      <Pressable
        key={f.id}
        onPress={() => void start(f)}
        disabled={!!busy}
        accessibilityRole="button"
        accessibilityLabel={
          had.length
            ? t('Start a crew for {festival}. You already have {crews}', { festival: f.name, crews: had.map((c) => c.name).join(` ${t('and')} `) })
            : t('Start a crew for {festival}', { festival: f.name })
        }
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {f.name}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            {[when ?? datesLine(f), had.length ? t('You have {crew}', { crew: had[0].name }) : undefined].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {busy === f.id ? <ActivityIndicator color={color.glow} /> : <ChevronIcon color={color.moonFaint} size={12} />}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.root} contentContainerStyle={[pageColumn, { padding: space.xl, paddingBottom: insets.bottom + space.xl, gap: space.md }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('Start a crew')}</Text>
        <Text style={styles.body}>{t('Pick the festival or show. Then name your crew and invite your friends, up to 12 of you. Crews are invite only, with their own chat: starting one means agreeing to the crew chat rules in the community guidelines.')}</Text>
        {yours.length ? (
          <>
            <Text style={styles.section}>{t('You’re going to')}</Text>
            {yours.map(row)}
          </>
        ) : (
          <Text style={styles.quiet}>{t('Not going anywhere yet? Pick any festival below, or tap I’m going on a festival or show first.')}</Text>
        )}
        <Text style={styles.section}>{yours.length ? t('Another festival') : t('Coming up')}</Text>
        <SearchField value={query} onChange={setQuery} placeholder={t('Find a festival')} label={t('Find a festival for your crew')} />
        {others.map(row)}
        {q && !others.length ? <Text style={styles.quiet}>{t('No festival matches “{query}”.', { query: q })}</Text> : null}
      </ScrollView>
      <SheetClose />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHEET_BACKGROUND },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.md },
  quiet: { ...type.body, color: color.moonDim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  name: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
