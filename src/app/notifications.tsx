import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SearchField } from '../components/SearchField';
import { ago, filterNotices, filtersWith, type NoticeFilter } from '../features/notifications/organize';
import type { Notice } from '../features/notifications/inbox';
import { useNow } from '../lib/useNow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { NightSky } from '../components/NightSky';
import { BellIcon, ChevronIcon } from '../components/TabIcons';
import { haptic } from '../lib/haptics';
import { useNotices } from '../state/notices';
import { useSocial } from '../state/social';
import { color, radius, space, type, glowA } from '../theme/tokens';
import { goBack } from '../lib/nav';
import { t } from '../i18n';
import { EmptyState } from '../components/EmptyState';

/**
 * Notifications: news about the festivals you're going to, new followers, likes, comments and tags. Newest
 * first (what's happening now on top), in New and Earlier, with quick filters and a search. Opening it marks
 * everything read.
 */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { list, read, markRead, hydrated, refresh } = useNotices();
  const social = useSocial();
  // Fresh activity each time you look.
  useEffect(() => refresh(), [refresh]);
  // What was new when you opened this keeps its glow for this visit.
  const [fresh, setFresh] = useState<ReadonlySet<string> | undefined>();
  // Anything that arrives while you're here (the refresh, a follow) is new too, before it's marked read.
  const unread = hydrated ? list.filter((n) => !read.has(n.id) && !fresh?.has(n.id)).map((n) => n.id) : [];
  if (hydrated && (!fresh || unread.length)) setFresh(new Set([...(fresh ?? []), ...unread]));
  useEffect(() => {
    if (fresh) markRead(list.map((n) => n.id));
  }, [fresh, list, markRead]);
  const now = useNow().getTime();
  const [filter, setFilter] = useState<NoticeFilter>('all');
  const [query, setQuery] = useState('');
  const filters = useMemo(() => filtersWith(list), [list]);
  const shown = useMemo(() => filterNotices(list, filter, query), [list, filter, query]);
  const newOnes = shown.filter((n) => fresh?.has(n.id));
  const earlier = shown.filter((n) => !fresh?.has(n.id));
  const labels: Record<NoticeFilter, string> = { all: t('All'), people: t('People'), tagged: t('Tagged'), festivals: t('Festivals'), sets: t('New sets'), sprouts: t('Sprouts') };

  const row = (n: Notice) => {
    const isNew = !!fresh?.has(n.id);
    const when = ago(n.at, now);
    return (
      <Pressable
        key={n.id}
        onPress={() => {
          haptic.select();
          // Discover is a tab: go back to it rather than stacking a second set of tabs.
          if (n.href.startsWith('/?')) router.dismissTo(n.href as never);
          else router.push(n.href as never);
        }}
        accessibilityRole="button"
        accessibilityLabel={[isNew ? t('New') : undefined, n.title, n.body, when].filter(Boolean).join('. ')}
        style={({ pressed }) => [styles.row, isNew && styles.rowNew, pressed && styles.pressed]}
      >
        {isNew ? <View style={styles.dot} /> : null}
        <View style={styles.text}>
          <Text style={styles.rowTitle}>{n.title}</Text>
          <Text style={styles.body}>{n.body}</Text>
        </View>
        {when ? <Text style={styles.when}>{when}</Text> : null}
        <ChevronIcon color={color.moonFaint} size={12} />
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pad}>
          <Text style={styles.title}>{t('Notifications')}</Text>
          <Text style={styles.meta}>{social.user ? t('Your festivals, lineup news, new sets, new followers and likes on your videos.') : t('Your festivals, artists you’d love added to lineups, and their new sets.')}</Text>
        </View>
        {list.length > 4 ? (
          <View style={[styles.pad, styles.search]}>
            <SearchField value={query} onChange={setQuery} placeholder={t('Search notifications')} label={t('Search notifications')} />
          </View>
        ) : null}
        {filters.length > 2 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {filters.map((f) => (
              <Pressable
                key={f}
                onPress={() => {
                  haptic.select();
                  setFilter(f);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === f }}
                style={({ pressed }) => [styles.chip, filter === f && styles.chipOn, pressed && { opacity: 0.75 }]}
              >
                <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>{labels[f]}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <View style={[styles.pad, styles.list]}>
          {list.length === 0 ? (
            <EmptyState icon={<BellIcon color={color.moon} size={24} />}>
              {t(
                'Nothing new. Tap “I’m going” on a festival and you’ll hear here when its set times come out and when it’s nearly time, and whenever an artist you’d love is added to a lineup.',
              )}
            </EmptyState>
          ) : !shown.length ? (
            <Text style={styles.empty}>{query.trim() ? t('Nothing matches “{query}”.', { query: query.trim() }) : t('Nothing here.')}</Text>
          ) : null}
          {newOnes.length ? <Text style={styles.section}>{t('New')}</Text> : null}
          {newOnes.map(row)}
          {newOnes.length && earlier.length ? <Text style={styles.section}>{t('Earlier')}</Text> : null}
          {earlier.map(row)}
        </View>
      </ScrollView>

      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label={t('Back')} onPress={() => goBack()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs },
  list: { marginTop: space.lg, gap: space.sm },
  search: { marginTop: space.lg },
  chips: { paddingHorizontal: space.xl, gap: space.sm, marginTop: space.md },
  chip: { paddingHorizontal: space.md + 2, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  chipOn: { backgroundColor: glowA(0.2), borderColor: glowA(0.55) },
  chipText: { ...type.label, color: color.moonDim },
  chipTextOn: { color: color.moon },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.sm },
  when: { ...type.caption, color: color.moonFaint, fontVariant: ['tabular-nums'] },
  empty: { ...type.body, color: color.moonDim },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  rowNew: { backgroundColor: glowA(0.14), borderColor: glowA(0.4) },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.glow },
  text: { flex: 1 },
  rowTitle: { ...type.headline, color: color.moon },
  body: { ...type.caption, color: color.moonDim, marginTop: 2 },
});
