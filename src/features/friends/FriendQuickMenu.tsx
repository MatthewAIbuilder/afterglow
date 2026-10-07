import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { PersonAvatar } from '../../components/PersonAvatar';
import { ChevronIcon, CommentIcon, ProfileIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { CLOSE_FRIENDS_MAX, useCloseFriends } from '../../state/closeFriends';
import { useSocial } from '../../state/social';
import { color, glowA, nightA, radius, space, type } from '../../theme/tokens';
import { StarIcon } from '../plan/icons';
import type { Profile } from '../social/models';
import { t } from '../../i18n';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

type Props = {
  /** The friend tapped in the orbit, or null when closed. */
  friend: Profile | null;
  /** New messages from them. */
  unread: number;
  /** The soonest festival they're going to, if they show it. */
  next?: Festival;
  onMessage: (p: Profile) => void;
  onClose: () => void;
};

/**
 * Quick options for a friend tapped in the Friends orbit: a small glass card
 * with their face and what's next for them, then Message, See profile and
 * the close friends star (private: only you see who's on your list). Closes
 * on a tap outside, the Close row, or after an option.
 */
export function FriendQuickMenu({ friend, unread, next, onMessage, onClose }: Props) {
  const reduce = useReducedMotion();
  const social = useSocial();
  const me = social.user?.uid;
  const { ids, ready, set } = useCloseFriends(me);
  if (!friend) return null;
  const name = firstName(friend.displayName);
  const close = ids.includes(friend.uid);
  const canStar = !!me && ready && social.following.has(friend.uid);

  const go = (fn: () => void) => {
    haptic.select();
    onClose();
    fn();
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={reduce ? undefined : FadeIn.duration(160)} exiting={reduce ? undefined : FadeOut.duration(140)} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close')} />
        <Animated.View entering={reduce ? undefined : ZoomIn.springify().damping(18).stiffness(220)} style={styles.card} accessibilityViewIsModal>
          <View style={styles.head}>
            <View style={[styles.face, close && styles.faceClose]}>
              <PersonAvatar name={friend.displayName} url={friend.avatarUrl} size={64} uid={friend.uid} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {friend.displayName}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              @{friend.handle}
              {next ? ` · ${t('going to {festival}', { festival: next.name })}` : ''}
            </Text>
          </View>

          <View style={styles.rows}>
            <Row
              icon={<CommentIcon color={color.moon} size={18} />}
              label={unread ? t('Message {name} · {n} new', { name, n: unread }) : t('Message {name}', { name })}
              onPress={() => go(() => onMessage(friend))}
              accent={unread > 0}
            />
            <Row icon={<ProfileIcon color={color.moon} size={18} />} label={t('See profile')} onPress={() => go(() => router.push({ pathname: '/u/[handle]', params: { handle: friend.handle } }))} />
            {canStar ? (
              <Row
                icon={<StarIcon color={close ? color.glow : color.moon} size={18} filled={close} />}
                label={close ? t('Close friend') : t('Add to close friends')}
                detail={close ? t('Tap to take them off') : t('Only you see this')}
                role="switch"
                checked={close}
                onPress={() => {
                  if (close) haptic.select();
                  else haptic.tap();
                  if (!set(friend.uid, !close)) showAlert(t('Your close friends list is full'), t('It holds up to {n}. Take someone off it first.', { n: CLOSE_FRIENDS_MAX }));
                }}
              />
            ) : null}
          </View>

          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close')} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
            <Text style={styles.cancelText}>{t('Close')}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function Row({
  icon,
  label,
  detail,
  onPress,
  accent,
  role = 'button',
  checked,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  onPress: () => void;
  accent?: boolean;
  role?: 'button' | 'switch';
  checked?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === 'switch' ? { checked } : undefined}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      style={({ pressed }) => [styles.row, accent && styles.rowAccent, pressed && styles.pressed]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {role === 'button' ? <ChevronIcon color={color.moonFaint} size={12} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: nightA(0.62), alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.sheet,
    padding: space.lg,
    backgroundColor: color.nightRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.35),
    shadowColor: color.glow,
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    gap: space.md,
  },
  head: { alignItems: 'center', gap: 2, paddingTop: space.xs },
  face: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.hairline, marginBottom: space.sm },
  faceClose: { borderColor: color.glow, shadowColor: color.glow, shadowOpacity: 0.7, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  name: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim },
  rows: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  rowAccent: { backgroundColor: glowA(0.12) },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: glowA(0.14) },
  rowLabel: { ...type.body, color: color.moon },
  rowDetail: { ...type.caption, color: color.moonFaint, marginTop: 1 },
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: radius.pill, backgroundColor: color.glass },
  cancelText: { ...type.headline, color: color.moonDim },
  pressed: { opacity: 0.75 },
});
