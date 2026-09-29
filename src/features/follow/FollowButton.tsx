import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text } from 'react-native';
import { CheckIcon, PlusIcon } from '../../components/TabIcons';
import type { Artist } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useFollows } from '../../state/follows';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * Follow an artist: news of them comes to the bell (a new festival, their set
 * time), and it nudges your sound towards them. A glass pill the height of
 * the round back button, so the two sit together at the top of the page.
 */
export function FollowButton({ artist }: { artist: Artist }) {
  const { isFollowing, toggle } = useFollows();
  const on = isFollowing(artist.id);
  return (
    <Pressable
      onPress={() => {
        if (on) haptic.select();
        else haptic.tap();
        toggle(artist.id);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Following ${artist.name}. Tap to unfollow.` : `Follow ${artist.name}`}
      accessibilityHint={on ? undefined : 'Hear when they join a lineup or their set time is out.'}
      hitSlop={8}
      style={({ pressed }) => [styles.pill, on && styles.on, pressed && { transform: [{ scale: 0.95 }] }]}
    >
      {!on && <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />}
      {on ? <CheckIcon color={color.moon} size={14} /> : <PlusIcon color={color.moon} size={14} />}
      <Text style={styles.text}>{on ? 'Following' : 'Follow'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,16,38,0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  on: { backgroundColor: 'rgba(169,124,255,0.28)', borderColor: 'rgba(169,124,255,0.5)' },
  text: { ...type.label, color: color.moon },
});
