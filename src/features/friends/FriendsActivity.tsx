import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useSocial } from '../../state/social';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';
import { countdown } from '../festivals/when';
import { isOver } from '../festivals/shelves';
import { activityText, friendActivity, shortAgo, type ActivityItem } from '../social/friendActivity';
import type { Profile, SharedMemory } from '../social/models';
import { tasteMix } from '../taste/lean';
import { useToday } from '../../lib/useToday';

/** How many of the people you follow are read for the row and the activity. */
const FRIENDS_READ = 30;
/** Faces in the row before "+N". */
const FACES = 6;

/**
 * Your friends (people you follow) as a row of faces, then what they've been
 * up to: moments they shared, festivals they're going to, and whose taste is
 * close to yours. Read each time the Friends tab comes into view.
 */
export function FriendsActivity() {
  const social = useSocial();
  const me = social.profile;
  const catalog = useCatalog();
  const today = useToday();
  const now = useNow();
  const { going } = useGoing();
  const { taste, informed } = useTaste();
  const mix = useMemo(() => tasteMix(catalog.artists, taste, informed), [catalog.artists, taste, informed]);

  const [profiles, setProfiles] = useState<Profile[] | undefined>();
  const [memories, setMemories] = useState<SharedMemory[]>([]);
  const followingRef = useRef(social.following);
  useEffect(() => {
    followingRef.current = social.following;
  }, [social.following]);
  const followingKey = [...social.following].sort().join('|');
  useFocusEffect(
    useCallback(() => {
      if (!me) return;
      let live = true;
      const uids = [...followingRef.current].slice(0, FRIENDS_READ);
      if (!uids.length) {
        setProfiles([]);
        setMemories([]);
        return;
      }
      Promise.all(uids.map((u) => social.service.profileOf(u).catch(() => null))).then(
        (list) => live && setProfiles(list.filter((p): p is Profile => !!p)),
      );
      social.service
        .memoriesBy(uids, 20)
        .then((list) => live && setMemories(list))
        .catch(() => {});
      return () => {
        live = false;
      };
      // followingKey stands for who you follow.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [me?.uid, social.service, followingKey]),
  );

  const upcoming = useCallback(
    (id: string): Festival | undefined => {
      const f = catalog.festival(id);
      return f && !isOver(f, today) ? f : undefined;
    },
    [catalog, today],
  );
  const nowMs = now.getTime();
  const items = useMemo(
    () => friendActivity({ profiles: profiles ?? [], memories, upcoming, mine: { sounds: mix, going }, blocked: social.blocked, now: nowMs }),
    [profiles, memories, upcoming, mix, going, social.blocked, nowMs],
  );

  if (!me || !profiles?.length) return null;
  const shown = profiles.filter((p) => !social.blocked.has(p.uid));
  const more = social.following.size - Math.min(FACES, shown.length);

  const open = (item: ActivityItem) => {
    haptic.select();
    if (item.kind === 'moment') router.push({ pathname: '/shared/[id]', params: { id: item.memory.id } });
    else if (item.kind === 'going') router.push(`/festival/${item.festival.id}`);
    else router.push({ pathname: '/u/[handle]', params: { handle: item.profile.handle } });
  };

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title}>Your friends</Text>
        <Pressable
          onPress={() => {
            haptic.select();
            router.push({ pathname: '/follows/[handle]', params: { handle: me.handle, list: 'following' } });
          }}
          accessibilityRole="button"
          accessibilityLabel={`See all ${social.following.size} people you follow`}
          hitSlop={8}
        >
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faces} style={styles.facesWrap}>
        {shown.slice(0, FACES).map((p) => (
          <Pressable
            key={p.uid}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/u/[handle]', params: { handle: p.handle } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open ${p.displayName}’s profile`}
            style={({ pressed }) => [styles.face, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.faceRing}>
              <PersonAvatar name={p.displayName} url={p.avatarUrl} size={54} />
            </View>
            <Text style={styles.faceName} numberOfLines={1}>
              {p.displayName.split(' ')[0]}
            </Text>
          </Pressable>
        ))}
        {more > 0 ? (
          <View style={styles.face} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.faceRing, styles.moreCircle]}>
              <Text style={styles.moreText}>+{more}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {items.length ? (
        <>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <View style={styles.list}>
            {items.map((item) => {
              const text = activityText(item, (id) => catalog.artist(id)?.name);
              const detail =
                item.kind === 'moment'
                  ? [item.memory.festivalId ? catalog.festival(item.memory.festivalId)?.name : undefined, shortAgo(item.at, nowMs)].filter(Boolean).join(' · ')
                  : item.kind === 'going'
                    ? (countdown(item.festival, today) ?? item.festival.dates)
                    : 'From the sounds you both love';
              return (
                <Pressable
                  key={item.id}
                  onPress={() => open(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${text}. ${detail}`}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
                >
                  <PersonAvatar name={item.profile.displayName} url={item.profile.avatarUrl} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowText} numberOfLines={2}>
                      {text}
                    </Text>
                    <Text style={[styles.rowDetail, item.kind === 'match' && { color: color.glow }]} numberOfLines={1}>
                      {detail}
                    </Text>
                  </View>
                  {item.kind === 'moment' && item.memory.thumbUrl ? (
                    <Image source={{ uri: item.memory.thumbUrl }} style={styles.thumb} contentFit="cover" />
                  ) : item.kind === 'match' ? (
                    <Text style={styles.match}>{item.percent}%</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl },
  title: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: space.xs },
  seeAll: { ...type.caption, color: color.glow },
  facesWrap: { marginHorizontal: -space.xl, marginTop: space.sm },
  faces: { paddingHorizontal: space.xl, gap: space.md },
  face: { width: 62, alignItems: 'center' },
  faceRing: { borderRadius: 31, padding: 2, borderWidth: 1.5, borderColor: 'rgba(169,124,255,0.6)' },
  faceName: { ...type.caption, color: color.moon, marginTop: 4 },
  moreCircle: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass },
  moreText: { ...type.headline, color: color.moon },
  sectionTitle: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: space.xs, marginTop: space.xl, marginBottom: space.sm },
  list: { borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  rowText: { ...type.body, color: color.moon },
  rowDetail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  thumb: { width: 40, height: 52, borderRadius: radius.sm },
  match: { ...type.headline, color: color.glow, fontVariant: ['tabular-nums'] },
});
