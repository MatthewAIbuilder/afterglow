import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { MIX } from './focus';
import { t } from '../../i18n';

/**
 * Following with nothing to watch: why (signed out, following no one, or no
 * videos from them yet) and where to go instead.
 */
export function FollowingEmpty({ signedIn, follows, loading, bottomSpace }: { signedIn: boolean; follows: number; loading: boolean; bottomSpace: number }) {
  if (signedIn && follows > 0 && loading) {
    return (
      <View style={[styles.wrap, { paddingBottom: bottomSpace }]} pointerEvents="box-none">
        <ActivityIndicator color={color.glow} accessibilityLabel={t('Loading videos from people you follow')} />
      </View>
    );
  }
  const [title, body] = !signedIn
    ? [t('Follow people'), t('Sign in on your profile, follow people, and the videos they share from festivals show up here.')]
    : follows === 0
      ? [t('No one yet'), t('When you follow people, the videos they share from festivals show up here.')]
      : [t('Nothing new yet'), t('The people you follow haven’t shared videos of artists on Afterglow yet.')];
  const button = (label: string, onPress: () => void, primary = false) => (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, primary && styles.primary, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.wrap, { paddingBottom: bottomSpace }]} pointerEvents="box-none">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>
        {signedIn ? button(t('Find people'), () => router.push('/people'), true) : button(t('Sign in'), () => router.push('/account'), true)}
        {button(t('Watch your mix'), () => router.setParams({ festival: MIX }))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: space.xl },
  title: { ...type.largeTitle, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.md },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  button: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  primary: { backgroundColor: color.glowDeep, borderColor: glowA(0.6) },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  buttonText: { ...type.label, color: color.moon },
});
