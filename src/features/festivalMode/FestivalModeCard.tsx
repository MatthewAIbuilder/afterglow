import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useFestivalMode } from '../../state/festivalMode';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { t } from '../../i18n';
import { isShowEvent } from './showEvent';

/** What festival mode is, in a line. */
export const MODE_PITCH = t('A simpler app while you’re here: videos filmed at the festival, your night planned out, the camera one tap away, and your friends.');
/** The same, for a one-night show. */
export const SHOW_PITCH = t('A simpler app tonight: videos filmed at the show, the bill best for you first, the camera one tap away, and your friends.');
const pitchOf = (festival: Festival) => (isShowEvent(festival) ? SHOW_PITCH : MODE_PITCH);

/**
 * Festival mode on Tonight: the question on the first night of a festival or
 * the night of a show ("Switch to festival mode?"), what's on, or a way to
 * switch it on after saying not now.
 */
export function FestivalModeCard({ festival }: { festival: Festival }) {
  const { active, ask, turnOn, notNow, leave } = useFestivalMode();
  const on = active?.festival.id === festival.id;
  const asking = ask?.id === festival.id;

  const switchOn = () => {
    haptic.settle();
    turnOn(festival.id);
    router.dismissTo('/');
  };

  if (on)
    return (
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.rowText}>{active?.preview ? t('Testing festival mode') : t('Festival mode is on')}</Text>
        <Pressable
          onPress={() => {
            haptic.select();
            leave();
          }}
          accessibilityRole="button"
          accessibilityLabel={active?.preview ? t('End the festival mode test') : t('Leave festival mode for the full app')}
          hitSlop={8}
        >
          <Text style={styles.link}>{active?.preview ? t('End test') : t('Full app')}</Text>
        </Pressable>
      </View>
    );

  if (!asking)
    return (
      <Pressable onPress={switchOn} accessibilityRole="button" accessibilityLabel={`${t('Switch to festival mode.')} ${pitchOf(festival)}`} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={[styles.dot, styles.dotOff]} />
        <Text style={styles.rowText}>{t('Festival mode')}</Text>
        <Text style={styles.link}>{t('Switch on')}</Text>
      </Pressable>
    );

  return (
    <LinearGradient colors={[glowA(0.28), 'rgba(255,126,182,0.16)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Text style={styles.title}>{t('Switch to festival mode?')}</Text>
      <Text style={styles.body}>{pitchOf(festival)}</Text>
      <View style={styles.buttons}>
        <Pressable onPress={switchOn} accessibilityRole="button" accessibilityLabel={t('Switch to festival mode')} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>{t('Switch')}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptic.select();
            notNow(festival.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('Not now, keep the full app')}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>{t('Not now')}</Text>
        </Pressable>
      </View>
      <Text style={styles.fine}>{isShowEvent(festival) ? t('It ends by itself at noon tomorrow. You can go back to the full app any time.') : t('It ends by itself after the festival. You can go back to the full app any time.')}</Text>
    </LinearGradient>
  );
}

/** On a festival or show page: test festival mode any day, to see what the day will look like. */
export function TryFestivalMode({ festival }: { festival: Festival }) {
  const { active, preview, leave } = useFestivalMode();
  const on = active?.festival.id === festival.id;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        if (on) leave();
        else {
          preview(festival.id);
          router.dismissTo('/');
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={on ? (active?.preview ? t('End the festival mode test') : t('Leave festival mode')) : `${t('Test festival mode with {festival}.', { festival: festival.name })} ${pitchOf(festival)}`}
      style={({ pressed }) => [styles.tryRow, pressed && styles.pressed]}
    >
      <View style={[styles.dot, !on && styles.dotOff]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowText}>{on ? (active?.preview ? t('Testing festival mode') : t('Festival mode is on')) : t('Test festival mode')}</Text>
        <Text style={styles.tryBody}>{on ? (active?.preview ? t('Tap to end the test.') : t('Tap for the full app.')) : isShowEvent(festival) ? t('See how the app will look on the night of the show.') : t('See how the app will look on festival day, as if it were the first night.')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: radius.lg, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.5), marginTop: space.lg },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  primary: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  primaryText: { ...type.headline, color: color.moon },
  secondary: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  fine: { ...type.caption, color: color.moonFaint },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, paddingHorizontal: space.md, paddingVertical: space.sm + 2, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  rowText: { ...type.label, color: color.moon, flex: 1 },
  link: { ...type.label, color: color.glow },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF7EB6' },
  dotOff: { backgroundColor: color.moonFaint },
  tryRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  tryBody: { ...type.caption, color: color.moonDim, marginTop: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
