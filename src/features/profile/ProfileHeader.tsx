import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProfileIcon } from '../../components/TabIcons';
import { SOUND_LABEL, type SoundTag } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { type ProfileStat, shortCount } from './profileView';

type Props = {
  name: string;
  /** Draw the name's first letter when there's no photo (a real profile); otherwise a person glyph. */
  initial?: boolean;
  /** Your bio, or a line saying what this page is before you have a profile. */
  bio?: string;
  avatarUrl?: string;
  stats: ProfileStat[];
  onStat?: (key: ProfileStat['key']) => void;
  /** Your top sounds, as small chips (tap: the full breakdown). */
  sounds: { tag: SoundTag; percent: number }[];
  onSounds?: () => void;
  children?: React.ReactNode;
};

/**
 * The top of a profile, the way people know it from Instagram and TikTok:
 * the photo on the left with three counts beside it, then the name, the bio,
 * your sound as chips, and the buttons (passed as children).
 */
export function ProfileHeader({ name, initial, bio, avatarUrl, stats, onStat, sounds, onSounds, children }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" transition={200} />
          ) : initial ? (
            <Text style={styles.initial}>{name.slice(0, 1).toUpperCase()}</Text>
          ) : (
            <ProfileIcon color={color.moonDim} size={36} />
          )}
        </View>
        <View style={styles.stats} accessibilityRole="summary">
          {stats.map((s) => {
            const tappable = !!onStat && (s.key === 'followers' || s.key === 'following' || s.key === 'festivals');
            return (
              <Pressable
                key={s.key}
                disabled={!tappable}
                onPress={() => {
                  haptic.select();
                  onStat?.(s.key);
                }}
                accessibilityRole={tappable ? 'button' : 'text'}
                accessibilityLabel={s.a11y}
                hitSlop={6}
                style={({ pressed }) => [styles.stat, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.statN}>{shortCount(s.n)}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.name} accessibilityRole="header">
        {name}
      </Text>
      {bio ? <Text style={styles.bio}>{bio}</Text> : null}

      {sounds.length > 0 ? (
        <Pressable
          onPress={() => {
            haptic.select();
            onSounds?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Your sound: ${sounds.map((m) => `${SOUND_LABEL[m.tag]} ${m.percent} percent`).join(', ')}. Opens the full breakdown.`}
          style={({ pressed }) => [styles.sounds, pressed && { opacity: 0.7 }]}
        >
          {sounds.map((m, i) => (
            <View key={m.tag} style={[styles.sound, i === 0 && styles.soundTop]}>
              <Text style={[styles.soundText, i === 0 && styles.soundTextTop]}>
                {SOUND_LABEL[m.tag]} <Text style={styles.soundPct}>{m.percent}%</Text>
              </Text>
            </View>
          ))}
        </Pressable>
      ) : null}

      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

/** A button under the profile: "Edit profile", "Share profile". `glow` for the one thing to do. */
export function ProfileButton({ label, onPress, glow, a11y, flex = true }: { label: string; onPress: () => void; glow?: boolean; a11y?: string; flex?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      style={({ pressed }) => [styles.button, flex && { flex: 1 }, glow && styles.buttonGlow, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
    >
      <Text style={[styles.buttonText, glow && styles.buttonTextGlow]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const AVATAR = 86;

const styles = StyleSheet.create({
  root: { paddingHorizontal: space.xl },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: 1.5,
    borderColor: 'rgba(169,124,255,0.55)',
  },
  avatarImage: { width: AVATAR, height: AVATAR },
  initial: { ...type.largeTitle, color: color.moon },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', minWidth: 64, paddingVertical: space.xs },
  statN: { ...type.headline, fontSize: 19, color: color.moon, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption, color: color.moonDim, marginTop: 2 },
  name: { ...type.headline, color: color.moon, marginTop: space.lg },
  bio: { ...type.body, color: color.moonDim, marginTop: 2 },
  sounds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.md, alignSelf: 'flex-start' },
  sound: { paddingHorizontal: space.sm + 2, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: color.glass },
  soundTop: { backgroundColor: 'rgba(169,124,255,0.16)' },
  soundText: { ...type.caption, color: color.moonDim },
  soundTextTop: { color: color.moon },
  soundPct: { color: color.moonFaint, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  button: {
    minHeight: 36,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  buttonGlow: { backgroundColor: color.glowDeep, borderColor: 'rgba(169,124,255,0.6)' },
  buttonText: { ...type.label, color: color.moon },
  buttonTextGlow: { color: color.moon },
});
