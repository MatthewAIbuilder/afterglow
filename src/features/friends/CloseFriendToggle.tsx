import { Pressable, StyleSheet } from 'react-native';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { CLOSE_FRIENDS_MAX, useCloseFriends } from '../../state/closeFriends';
import { useSocial } from '../../state/social';
import { color, radius } from '../../theme/tokens';
import { StarIcon } from '../plan/icons';
import { t } from '../../i18n';

/**
 * Star someone you follow as a close friend: they come first on the Friends
 * tab. Private: only you see your list, and they're never told. Beside
 * Follow on their profile; hidden until you follow them.
 */
export function CloseFriendToggle({ uid, name }: { uid: string; name: string }) {
  const social = useSocial();
  const me = social.user?.uid;
  const { ids, ready, set } = useCloseFriends(me);
  // Hidden until your saved list is read, so a quick tap never writes over it.
  if (!me || !ready || uid === me || !social.following.has(uid)) return null;
  const on = ids.includes(uid);
  return (
    <Pressable
      onPress={() => {
        if (on) haptic.select();
        else haptic.tap();
        if (!set(uid, !on)) showAlert(t('Your close friends list is full'), t('It holds up to {n}. Take someone off it first.', { n: CLOSE_FRIENDS_MAX }));
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={t('Close friend: {name}', { name })}
      accessibilityHint={t('Only you can see your close friends')}
      hitSlop={6}
      style={({ pressed }) => [styles.button, on && styles.on, pressed && styles.pressed]}
    >
      <StarIcon color={on ? color.night : color.moonDim} size={18} filled={on} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  on: { backgroundColor: color.glow, borderColor: color.glow },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});
