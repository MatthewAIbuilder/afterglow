import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon, ProfileIcon } from '../../components/TabIcons';
import { yourClipCount, yourClips } from '../../features/discover/saved';
import { haptic } from '../../lib/haptics';
import { VERSION_LINE } from '../../lib/version';
import { useCatalog } from '../../state/catalog';
import { useClipPool } from '../../state/community';
import { useCrews } from '../../state/crews';
import { useGoing } from '../../state/going';
import { useMemories } from '../../state/memories';
import { useMusic } from '../../state/music';
import { useSocial } from '../../state/social';
import { PROVIDER_NAME } from '../../features/music/models';
import { followersLabel, followingLabel } from '../../features/social/copy';
import { useRatings } from '../../state/ratings';
import { useReactions } from '../../state/reactions';
import { SOUND_LABEL } from '../../data/models';
import { groupFestivals } from '../../features/festivals/going';
import { countdown } from '../../features/festivals/when';
import { tasteMix } from '../../features/taste/lean';
import { SoundBreakdown } from '../../features/taste/SoundBreakdown';
import { useToday } from '../../lib/useToday';
import { useTaste } from '../../state/taste';
import { useWeekends } from '../../state/weekends';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * Profile: your festival profile (once you've made one), what you've built
 * so far (festivals, ratings, clips), your sound in three bars, the festivals
 * you're going to, your Memories, finding people, and what's coming.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const catalog = useCatalog();
  const { going } = useGoing();
  const { ratings } = useRatings();
  const { reactions } = useReactions();
  const pool = useClipPool();
  const clips = yourClipCount(yourClips(pool.clips, reactions));
  const rated = Object.keys(ratings).length;
  const festivals = going.filter((id) => catalog.festival(id)).length;
  // Your sound in three bars, from the live taste.
  const { taste, informed } = useTaste();
  const mix = useMemo(() => tasteMix(catalog.artists, taste, informed).slice(0, 3), [catalog.artists, taste, informed]);
  // The festivals you're going to, soonest first, as they are for you (your weekend).
  const { forYou, weekendOf } = useWeekends();
  const today = useToday();
  const mine = groupFestivals(catalog.festivals.map(forYou), going, today).going;
  // Connected music services, for the Music connections row.
  const { state: music } = useMusic();
  const connectedMusic = (Object.keys(music) as (keyof typeof music)[]).map((p) => PROVIDER_NAME[p]).join(', ');
  const { memories } = useMemories();
  const social = useSocial();
  const { crews } = useCrews();
  const me = social.profile;
  // Your followers, fetched each time the tab comes into view; who you follow is known on the phone.
  const [followers, setFollowers] = useState<{ uid: string; n: number } | undefined>();
  const meUid = me?.uid;
  useFocusEffect(
    useCallback(() => {
      if (!meUid) return;
      let live = true;
      social.service
        .followCounts(meUid)
        .then((c) => live && setFollowers({ uid: meUid, n: c.followers }))
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [meUid, social.service]),
  );
  const openFollows = (list: 'followers' | 'following') => {
    if (!me) return;
    haptic.select();
    router.push({ pathname: '/follows/[handle]', params: { handle: me.handle, list } });
  };
  const openSelf = () => {
    haptic.select();
    if (!social.user) router.push('/account');
    else if (!me) router.push('/profile-edit');
    else router.push({ pathname: '/u/[handle]', params: { handle: me.handle } });
  };

  const stats = [
    { n: festivals, label: festivals === 1 ? 'festival' : 'festivals' },
    { n: rated, label: rated === 1 ? 'artist rated' : 'artists rated' },
    { n: clips, label: clips === 1 ? 'clip kept' : 'clips kept' },
  ];

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.xxl, paddingBottom: tabSpace + space.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.center}
          onPress={social.availability.ok ? openSelf : undefined}
          disabled={!social.availability.ok}
          accessibilityRole={social.availability.ok ? 'button' : 'header'}
          accessibilityLabel={me ? `${me.displayName}, @${me.handle}. Opens your profile.` : undefined}
        >
          <View style={styles.avatar}>
            {me?.avatarUrl ? (
              <Image source={{ uri: me.avatarUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : me ? (
              <Text style={styles.initial}>{me.displayName.slice(0, 1).toUpperCase()}</Text>
            ) : (
              <ProfileIcon color={color.moonDim} size={40} />
            )}
          </View>
          <Text style={styles.title}>{me?.displayName ?? 'You'}</Text>
          <Text style={styles.meta}>{me ? `@${me.handle}` : 'Your festivals and your sound, in one place.'}</Text>
        </Pressable>
        {me ? (
          <View style={styles.follows}>
            <Pressable onPress={() => openFollows('followers')} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.followCount}>{followers?.uid === me.uid ? followersLabel(followers.n) : 'Followers'}</Text>
            </Pressable>
            <Pressable onPress={() => openFollows('following')} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.followCount}>{followingLabel(social.following.size)}</Text>
            </Pressable>
          </View>
        ) : null}
        {social.availability.ok && social.ready ? (
          <View style={styles.profileActions}>
            {me ? (
              <>
                <SmallButton label="Edit profile" onPress={() => router.push('/profile-edit')} />
                <SmallButton label="Find people" onPress={() => router.push('/people')} />
              </>
            ) : (
              <SmallButton label={social.user ? 'Finish your profile' : 'Create your profile'} onPress={openSelf} glow />
            )}
          </View>
        ) : null}

        <View style={styles.stats} accessibilityRole="summary">
          {stats.map((s) => (
            <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.n} ${s.label}`}>
              <Text style={styles.statN}>{s.n}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.pad}>
          {mix.length > 0 && (
            <Pressable
              onPress={() => {
                haptic.select();
                router.push('/your-sound');
              }}
              accessibilityRole="button"
              accessibilityLabel={`Your sound: ${mix.map((m) => `${SOUND_LABEL[m.tag]} ${m.percent} percent`).join(', ')}. Opens the full breakdown.`}
              style={({ pressed }) => [styles.block, pressed && { opacity: 0.8 }]}
            >
              <View style={styles.blockHead}>
                <Text style={styles.blockTitle}>Your sound</Text>
                <ChevronIcon color={color.moonFaint} size={12} />
              </View>
              <SoundBreakdown shares={mix} animate={false} />
            </Pressable>
          )}

          {mine.length > 0 && (
            <View style={styles.block}>
              <Text style={[styles.blockTitle, styles.blockTitleAlone]}>Going</Text>
              {mine.map((f) => {
                const w = weekendOf(f.id);
                const when = countdown(f, today) ?? f.dates;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => {
                      haptic.select();
                      router.push(`/festival/${f.id}`);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${f.name}${w ? `, weekend ${w}` : ''}, ${when}`}
                    style={({ pressed }) => [styles.goingRow, pressed && { opacity: 0.7 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.goingName} numberOfLines={1}>
                        {f.name}
                      </Text>
                      <Text style={styles.goingMeta} numberOfLines={1}>
                        {w ? `Weekend ${w} · ` : ''}
                        {when}
                      </Text>
                    </View>
                    <ChevronIcon color={color.moonFaint} size={12} />
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            onPress={() => {
              haptic.select();
              router.push('/memories');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Memories, ${memories.length}`}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.rowText}>Memories</Text>
            <Text style={styles.rowCount}>{memories.length || 'Add your videos'}</Text>
            <ChevronIcon color={color.moonFaint} size={12} />
          </Pressable>

          <Pressable
            onPress={() => {
              haptic.select();
              router.push('/saved');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Your clips, ${clips}`}
            style={({ pressed }) => [styles.row, styles.rowGap, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.rowText}>Your clips</Text>
            <Text style={styles.rowCount}>{clips}</Text>
            <ChevronIcon color={color.moonFaint} size={12} />
          </Pressable>

          <Pressable
            onPress={() => {
              haptic.select();
              router.push('/music');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Music connections${connectedMusic ? `, ${connectedMusic}` : ', none connected'}`}
            style={({ pressed }) => [styles.row, styles.rowGap, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.rowText}>Music connections</Text>
            <Text style={styles.rowCount} numberOfLines={1}>
              {connectedMusic || 'Not connected'}
            </Text>
            <ChevronIcon color={color.moonFaint} size={12} />
          </Pressable>

          {social.user
            ? crews.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    haptic.select();
                    router.push({ pathname: '/crew/[id]', params: { id: c.id } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Your crew ${c.name}, ${catalog.festival(c.festivalId)?.name ?? ''}, ${c.members.length} ${c.members.length === 1 ? 'person' : 'people'}`}
                  style={({ pressed }) => [styles.row, styles.rowGap, pressed && { opacity: 0.75 }]}
                >
                  <Text style={styles.rowText} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.rowCount} numberOfLines={1}>
                    {c.members.length === 1 ? 'Just you' : `${c.members.length} of you`}
                  </Text>
                  <ChevronIcon color={color.moonFaint} size={12} />
                </Pressable>
              ))
            : null}

          {social.availability.ok ? (
            social.user && !crews.length ? (
              <Text style={styles.crewNote}>Going with friends? Start a crew from a festival page to plan your sets together.</Text>
            ) : null
          ) : (
            <View style={styles.soon}>
              <Text style={styles.soonKicker}>Coming soon</Text>
              <Text style={styles.soonTitle}>Friends</Text>
              <Text style={styles.soonBody}>Your festival profile, friends, and seeing who else is going.</Text>
            </View>
          )}
        </View>
        <Text style={styles.version}>{VERSION_LINE}</Text>
      </ScrollView>
    </View>
  );
}

function SmallButton({ label, onPress, glow }: { label: string; onPress: () => void; glow?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [styles.small, glow && styles.smallGlow, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
    >
      <Text style={styles.smallText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  version: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.xl },
  follows: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.sm },
  followCount: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  profileActions: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginTop: space.lg },
  small: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  smallGlow: { backgroundColor: 'rgba(169,124,255,0.18)', borderColor: 'rgba(169,124,255,0.45)' },
  smallText: { ...type.label, color: color.moon },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  initial: { ...type.largeTitle, color: color.moon },
  block: {
    padding: space.lg,
    marginBottom: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  blockTitle: { ...type.headline, color: color.moon },
  blockTitleAlone: { marginBottom: space.xs },
  goingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  goingName: { ...type.label, color: color.moon },
  goingMeta: { ...type.caption, color: color.moonDim, marginTop: 2, fontVariant: ['tabular-nums'] },
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl },
  center: { alignItems: 'center', paddingHorizontal: space.xl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.45)',
  },
  title: { ...type.largeTitle, color: color.moon, marginTop: space.lg },
  meta: { ...type.body, color: color.moonDim, marginTop: space.xs, textAlign: 'center' },
  stats: { flexDirection: 'row', marginHorizontal: space.xl, marginVertical: space.xxl, gap: space.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
  },
  statN: { ...type.title, color: color.moon, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption, color: color.moonDim, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  rowGap: { marginTop: space.sm },
  rowText: { ...type.headline, color: color.moon, flex: 1 },
  rowCount: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  soon: {
    marginTop: space.xl,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.35)',
    backgroundColor: 'rgba(169,124,255,0.08)',
  },
  crewNote: { ...type.caption, color: color.moonFaint, marginTop: space.lg, paddingHorizontal: space.xs },
  soonKicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 0.8 },
  soonTitle: { ...type.headline, color: color.moon, marginTop: space.sm },
  soonBody: { ...type.body, color: color.moonDim, marginTop: space.xs },
});
