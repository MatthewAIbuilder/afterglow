import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { SOCIAL_ERROR_COPY, socialErrorKind } from './service';

/**
 * Follow / Following for someone else's profile. Changes straight away and
 * goes back if it doesn't go through. Needs your own profile first (people
 * should see who follows them), so without one it offers to make it.
 */
export function FollowButton({ uid, handle, compact = false, onChange }: { uid: string; handle: string; compact?: boolean; onChange?: (on: boolean) => void }) {
  const social = useSocial();
  const on = social.following.has(uid);
  if (!social.user || uid === social.user.uid) return null;

  const press = () => {
    if (!social.profile) {
      haptic.select();
      Alert.alert('Create your profile first', 'People can see who follows them, so you need a profile to follow someone.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Create profile', onPress: () => router.push('/profile-edit') },
      ]);
      return;
    }
    if (on) haptic.select();
    else haptic.tap();
    onChange?.(!on);
    social.setFollowing(uid, !on).catch((e) => {
      onChange?.(on);
      Alert.alert(on ? 'Couldn’t unfollow' : 'Couldn’t follow', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    });
  };

  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Following @${handle}. Tap to unfollow.` : `Follow @${handle}`}
      hitSlop={compact ? 6 : 0}
      style={({ pressed }) => [styles.pill, compact && styles.compact, on ? styles.on : styles.off, pressed && styles.pressed]}
    >
      <Text style={[styles.label, compact && styles.compactLabel, on && styles.onLabel]}>{on ? 'Following' : 'Follow'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { minWidth: 120, alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.sm + 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  compact: { minWidth: 92, paddingHorizontal: space.md, paddingVertical: 6 },
  off: { backgroundColor: color.glowDeep, borderColor: 'rgba(169,124,255,0.6)' },
  on: { backgroundColor: color.glass, borderColor: color.hairline },
  label: { ...type.headline, color: color.moon },
  compactLabel: { ...type.label },
  onLabel: { color: color.moonDim },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
