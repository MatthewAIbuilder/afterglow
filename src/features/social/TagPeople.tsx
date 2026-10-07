import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { SearchField } from '../../components/SearchField';
import { CheckIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { useSocial } from '../../state/social';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import { VIDEO_TAGS_MAX, type Profile } from './models';

/** People you follow offered before you search, at most. */
const OFFERED = 8;

/**
 * Who's in a video: people you follow, or anyone found by searching. Each is
 * shows on their profile under Tagged straight away, and they can hide it.
 */
export function TagPeople({ value, onChange }: { value: string[]; onChange: (uids: string[]) => void }) {
  const social = useSocial();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Profile[]>([]);
  const [known, setKnown] = useState<Record<string, Profile>>({});
  const followingIds = useMemo(() => [...social.following].slice(0, OFFERED), [social.following]);

  // The people you follow, and anyone already tagged, by name.
  const wanted = useMemo(() => [...new Set([...value, ...followingIds])], [value, followingIds]);
  useEffect(() => {
    let live = true;
    const missing = wanted.filter((uid) => !known[uid]);
    if (!missing.length) return;
    void Promise.all(missing.map((uid) => social.service.profileOf(uid).catch(() => null))).then((ps) => {
      if (!live) return;
      setKnown((k) => {
        const next = { ...k };
        for (const p of ps) if (p) next[p.uid] = p;
        return next;
      });
    });
    return () => {
      live = false;
    };
  }, [wanted, known, social.service]);

  useEffect(() => {
    const q = query.trim();
    // Fewer than two letters shows the people you follow instead (`rows` below).
    if (q.length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      void social.service
        .searchProfiles(q)
        .then((ps) => live && setFound(ps.filter((p) => p.uid !== social.user?.uid)))
        .catch(() => live && setFound([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, social.service, social.user?.uid]);

  const toggle = (p: Profile) => {
    haptic.select();
    setKnown((k) => ({ ...k, [p.uid]: p }));
    onChange(value.includes(p.uid) ? value.filter((u) => u !== p.uid) : [...value, p.uid].slice(0, VIDEO_TAGS_MAX));
  };
  const rows = query.trim().length >= 2 ? found : [...value, ...followingIds.filter((u) => !value.includes(u))].map((u) => known[u]).filter((p): p is Profile => !!p);

  return (
    <View style={styles.root}>
      <SearchField value={query} onChange={setQuery} placeholder={t('Find someone by name or @handle')} label={t('Search for people to tag')} />
      <View style={styles.rows}>
        {rows.map((p) => {
          const on = value.includes(p.uid);
          return (
            <Pressable
              key={p.uid}
              onPress={() => toggle(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={on ? t('{name}, @{handle}, tagged', { name: p.displayName, handle: p.handle }) : t('Tag {name}, @{handle}', { name: p.displayName, handle: p.handle })}
              style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && { opacity: 0.75 }]}
            >
              <PersonAvatar name={p.displayName} url={p.avatarUrl} size={34} uid={p.uid} />
              <View style={styles.text}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.displayName}
                </Text>
                <Text style={styles.handle} numberOfLines={1}>
                  @{p.handle}
                </Text>
              </View>
              <View style={[styles.tick, on && styles.tickOn]}>{on ? <CheckIcon color={color.night} size={13} /> : null}</View>
            </Pressable>
          );
        })}
        {query.trim().length >= 2 && !found.length ? <Text style={styles.quiet}>{t('No one matches “{query}”.', { query: query.trim() })}</Text> : null}
      </View>
      <Text style={styles.quiet}>
        {value.length
          ? t('It shows on their profile under Tagged. They can hide it any time.')
          : t('Tag friends who are in it. It shows on their profile under Tagged, and they can hide it any time.')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space.xl, gap: space.sm },
  rows: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  rowOn: { borderColor: glowA(0.6), backgroundColor: glowA(0.12) },
  text: { flex: 1, gap: 1 },
  name: { ...type.headline, color: color.moon },
  handle: { ...type.caption, color: color.moonDim },
  tick: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: color.hairline, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: color.glow, borderColor: color.glow },
  quiet: { ...type.caption, color: color.moonDim },
});
