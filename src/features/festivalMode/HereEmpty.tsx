import { router } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useSocial } from '../../state/social';
import { accountsOff } from '../social/unavailable';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { t } from '../../i18n';

/**
 * Festival mode's Discover with nothing to watch yet: why (signed out, or no
 * one has shared a video from here) and the camera, to be the first.
 */
export function HereEmpty({ festival, loading, bottomSpace, onFilm }: { festival: Festival; loading: boolean; bottomSpace: number; onFilm: () => void }) {
  const social = useSocial();
  if (social.user && loading) {
    return (
      <View style={[styles.wrap, { paddingBottom: bottomSpace }]} pointerEvents="box-none">
        <ActivityIndicator color={color.glow} accessibilityLabel={t('Looking for videos from {festival}', { festival: festival.name })} />
      </View>
    );
  }
  const [title, body] = !social.availability.ok
    ? (({ title, body }) => [title, body])(accountsOff(Platform.OS === 'web', 'Videos from the crowd'))
    : !social.user
      ? [t('Live from {festival}', { festival: festival.name }), t('Sign in to watch the videos people film here, and share yours.')]
      : [t('Nothing from {festival} yet', { festival: festival.name }), t('Be the first: film a set and turn on Share to Discover. Videos people share from here show up as they come in.')];
  const film = Platform.OS !== 'web' && social.availability.ok;
  return (
    <View style={[styles.wrap, { paddingBottom: bottomSpace }]} pointerEvents="box-none">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>
        {social.availability.ok && !social.user ? (
          <Button label={t('Sign in')} primary onPress={() => router.push('/account')} />
        ) : film ? (
          <Button label={t('Film a video')} primary onPress={onFilm} />
        ) : null}
        <Button label={t('Tonight’s plan')} onPress
={() => router.navigate('/lineup')} />
      </View>
    </View>
  );
}

function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
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
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: space.xl },
  title: { ...type.largeTitle, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xl },
  button: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  primary: { backgroundColor: color.glowDeep, borderColor: glowA(0.6) },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  buttonText: { ...type.label, color: color.moon },
});
