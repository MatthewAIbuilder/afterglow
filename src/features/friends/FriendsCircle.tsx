import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { PersonAvatar } from '../../components/PersonAvatar';
import { ChevronIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { OrbitBackdrop } from '../../components/ProfileCover';
import { useProfileBackdrop } from '../profile/useProfileBackdrop';
import { FriendQuickMenu } from './FriendQuickMenu';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useCrewChat } from '../../state/crewChat';
import { useSocial } from '../../state/social';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { directRoom, type Profile } from '../social/models';
import { FriendsOrbit } from './FriendsOrbit';
import { openChatWith } from './openChat';
import { nextFestivalOf, splitOrbit } from './orbit';
import { SectionHeader } from './SectionHeader';
import { t, tn } from '../../i18n';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
/** Your profile background behind the orbit: a little taller than the orbit, so it fades out beyond the outer ring. */
const ORBIT_BACKDROP_PAD = 40;
const ORBIT_BACKDROP_H = 300 + ORBIT_BACKDROP_PAD * 2;

/**
 * "Your friends" at the top of the Friends tab: the orbit (close friends on
 * the inner ring, everyone else you follow round the outside), how many,
 * and See all. Before you've starred anyone, a line saying how to bring
 * people close. Nothing until you follow someone. `folded`: it starts
 * tucked away behind a small bouncing button (the Friends tab opens on what
 * you do: find, codes, sprouts, crews, messages); tapping it opens the orbit.
 */
export function FriendsCircle({ profiles, close, folded = false }: { profiles: Profile[] | undefined; close: readonly string[]; folded?: boolean }) {
  const social = useSocial();
  const me = social.profile;
  const chat = useCrewChat();
  const { festival } = useCatalog();
  const today = useToday();
  const backdrop = useProfileBackdrop(me);
  const { width: screen } = useWindowDimensions();
  const [picked, setPicked] = useState<Profile | null>(null);
  const [open, setOpen] = useState(!folded);
  const reduce = useReducedMotion();
  if (!me || !profiles?.length) return null;
  const orbitWidth = Math.min(screen - space.xl * 2, 560);
  const { inner } = splitOrbit(profiles, close);
  const total = social.following.size;
  const closeCount = inner.length;
  const line = closeCount
    ? `${tn(closeCount, '{n} close friend', '{n} close friends')} · ${tn(total, '{n} friend', '{n} friends')}`
    : tn(total, '{n} friend', '{n} friends');
  if (!open) {
    const faces = [...inner, ...profiles.filter((p) => !inner.includes(p))].slice(0, 3);
    return (
      <OrbitReveal
        faces={faces}
        line={line}
        onOpen={() => {
          haptic.select();
          setOpen(true);
        }}
      />
    );
  }
  return (
    <Animated.View entering={folded && !reduce ? FadeIn.duration(350) : undefined}>
      <SectionHeader
        title={t('Your friends')}
        action={t('See all')}
        actionLabel={t('See all {n} people you follow', { n: total })}
        onAction={() => router.push({ pathname: '/follows/[handle]', params: { handle: me.handle, list: 'following' } })}
      />
      <FriendsOrbit
        me={me}
        friends={profiles}
        close={close}
        unreadFrom={(uid) => chat.unreadFor(directRoom(me.uid, uid))}
        nextFestival={(p) => nextFestivalOf(p, festival, today)}
        onPick={setPicked}
        backdrop={<OrbitBackdrop url={me.coverUrl} backdrop={backdrop} width={screen} height={ORBIT_BACKDROP_H} style={{ left: (orbitWidth - screen) / 2, top: -ORBIT_BACKDROP_PAD }} />}
      />
      <FriendQuickMenu
        friend={picked}
        unread={picked ? chat.unreadFor(directRoom(me.uid, picked.uid)) : 0}
        next={picked ? nextFestivalOf(picked, festival, today) : undefined}
        onMessage={(p) => void openChatWith(chat.openDirect, p.uid, firstName(p.displayName))}
        onClose={() => setPicked(null)}
      />
      <Text style={styles.line}>{line}</Text>
      {closeCount ? null : <Text style={styles.hint}>{t('Star your closest friends to bring them into your inner ring: tap a face, then Add to close friends. Only you see who’s on it.')}</Text>}
      {folded ? (
        <Pressable
          onPress={() => {
            haptic.select();
            setOpen(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('Hide your friend orbit')}
          hitSlop={10}
          style={({ pressed }) => [styles.hide, pressed && { opacity: 0.6 }]}
        >
          <ChevronIcon color={color.moonFaint} size={16} direction="up" />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

/** The orbit tucked away: a few faces, how many friends, and a chevron that bounces now and then (still with reduced motion). */
function OrbitReveal({ faces, line, onOpen }: { faces: Profile[]; line: string; onOpen: () => void }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      cancelAnimation(y);
      y.set(0);
      return;
    }
    const ease = Easing.out(Easing.quad);
    y.set(
      withRepeat(
        withSequence(
          withDelay(1400, withTiming(-5, { duration: 220, easing: ease })),
          withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }),
          withTiming(-2.5, { duration: 160, easing: ease }),
          withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(y);
  }, [reduce, y]);
  const bounce = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <View style={styles.revealWrap}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t('Show your friend orbit. {line}', { line })}
        style={({ pressed }) => [styles.reveal, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
      >
        <View style={styles.faces}>
          {faces.map((p, i) => (
            <View key={p.uid} style={[styles.face, i > 0 && { marginLeft: -8 }]}>
              <PersonAvatar name={p.displayName} url={p.avatarUrl} size={22} uid={p.uid} />
            </View>
          ))}
        </View>
        <Text style={styles.revealText} numberOfLines={1}>
          {t('Friend orbit')}
        </Text>
        <Animated.View style={bounce}>
          <ChevronIcon color={color.glow} size={14} direction="down" />
        </Animated.View>
      </Pressable>
      <Text style={styles.line}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { ...type.caption, color: color.moonDim, textAlign: 'center', marginTop: space.xs },
  hide: { alignSelf: 'center', padding: space.xs, marginTop: space.xs },
  revealWrap: { alignItems: 'center', gap: space.xs, marginBottom: space.sm },
  reveal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.45),
  },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 12, borderWidth: 1.5, borderColor: color.night },
  revealText: { ...type.label, color: color.moon },
  hint: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.xs, paddingHorizontal: space.xl },
});
