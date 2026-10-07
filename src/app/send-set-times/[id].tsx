import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { PageTitle } from '../../components/PageTitle';
import { CloseIcon } from '../../components/TabIcons';
import { shrinkPhoto } from '../../features/setTimes/shrinkPhoto';
import { SocialError, socialErrorKind, SOCIAL_ERROR_COPY } from '../../features/social/service';
import { TIP_TEXT_MAX } from '../../features/social/models';
import { accountsOff } from '../../features/social/unavailable';
import { haptic } from '../../lib/haptics';
import { goBack } from '../../lib/nav';
import { useCatalog } from '../../state/catalog';
import { loadScouted, setScouted } from '../../state/scouted';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';

/**
 * Send set times for a festival that has none yet: paste them, or add a
 * screenshot of the timetable (shrunk on the phone). They go to Afterglow HQ
 * to be checked; nothing is shown to anyone until HQ publishes them, and the
 * sender is thanked (and earns Set scout) when they're live. A modal from the
 * festival page.
 */
export default function SendSetTimesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const festival = useCatalog().festival(id);
  const social = useSocial();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; data: string } | undefined>();
  const [busy, setBusy] = useState<'photo' | 'send' | undefined>();
  const [problem, setProblem] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  const addPhoto = async () => {
    haptic.select();
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 }).catch(() => undefined);
    const asset = r && !r.canceled ? r.assets?.[0] : undefined;
    if (!asset) return;
    setBusy('photo');
    setProblem(undefined);
    const data = await shrinkPhoto(asset.uri, asset.width);
    setBusy(undefined);
    if (data) setPhoto({ uri: asset.uri, data });
    else setProblem(t('That picture couldn’t be used. Try a screenshot, or crop it to the timetable.'));
  };

  const send = async () => {
    if (!festival || busy) return;
    setBusy('send');
    setProblem(undefined);
    try {
      await social.service.sendSetTimes(festival.id, { text: text.trim() || undefined, photo: photo?.data });
      // From now on this phone thanks you when they go live (even the first time it looks).
      const uid = social.user?.uid;
      if (uid) void loadScouted().then(() => setScouted(uid, []));
      haptic.settle();
      setSent(true);
    } catch (e) {
      const kind = socialErrorKind(e);
      setProblem(kind === 'network' ? t('No signal right now. Try again when you have some.') : e instanceof SocialError ? SOCIAL_ERROR_COPY[kind] : t('That didn’t send. Try again.'));
    } finally {
      setBusy(undefined);
    }
  };

  const ready = !!text.trim() || !!photo;
  return (
    <View style={styles.root}>
      <PageTitle title={t('Send set times')} />
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>{t('Send set times')}</Text>
        <GlassCircleButton label={t('Close')} onPress={() => goBack()}>
          <CloseIcon color={color.moon} />
        </GlassCircleButton>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        {!festival ? (
          <Text style={styles.body}>{t('This festival isn’t on Afterglow any more.')}</Text>
        ) : sent ? (
          <>
            <Text style={styles.title}>{t('Thank you')}</Text>
            <Text style={styles.body}>{t('We’ll check them and add them to {festival} for everyone. When they’re live you’ll hear about it, and earn the Set scout badge.', { festival: festival.name })}</Text>
            <Button label={t('Done')} onPress={() => goBack()} primary />
          </>
        ) : (
          <>
            <Text style={styles.title}>{festival.name}</Text>
            <Text style={styles.body}>{t('Seen the set times somewhere: the festival’s app or site, or a friend’s screenshot? Send them over. We check them before anyone sees them, then everyone’s plan turns into a schedule.')}</Text>
            {!social.availability.ok ? (
              <Text style={styles.body}>{accountsOff(Platform.OS === 'web', 'Accounts').body}</Text>
            ) : !social.user ? (
              <>
                <Text style={styles.body}>{t('Make a free account to send them, so we can thank you when they’re live.')}</Text>
                <Button label={t('Create a free account')} onPress={() => router.push('/account')} primary />
              </>
            ) : (
              <>
                <TextInput
                  value={text}
                  onChangeText={(v) => setText(v.slice(0, TIP_TEXT_MAX))}
                  multiline
                  placeholder={t('Paste them here, like\nFriday\nMain Stage\n10:00 PM SUBTRONICS')}
                  placeholderTextColor={color.moonFaint}
                  accessibilityLabel={t('Set times as text')}
                  style={styles.input}
                  autoCorrect={false}
                />
                {photo ? (
                  <View style={styles.photoRow}>
                    <Image source={{ uri: photo.uri }} style={styles.thumb} accessibilityIgnoresInvertColors accessible={false} />
                    <Text style={[styles.body, { flex: 1 }]}>{t('Your screenshot')}</Text>
                    <Pressable onPress={() => setPhoto(undefined)} accessibilityRole="button" accessibilityLabel={t('Remove the screenshot')} hitSlop={8}>
                      <Text style={styles.link}>{t('Remove')}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Button label={busy === 'photo' ? t('Getting it ready…') : t('Add a screenshot of the timetable')} onPress={() => void addPhoto()} disabled={!!busy} />
                )}
                {problem ? <Text style={styles.problem}>{problem}</Text> : null}
                <Button label={busy === 'send' ? t('Sending…') : t('Send to Afterglow')} onPress={() => void send()} disabled={!ready || !!busy} primary />
                <Text style={styles.small}>{t('Only the set times are ever shown, never your screenshot. It’s deleted once they’re checked.')}</Text>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Button({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.button, primary && styles.primary, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.md },
  heading: { ...type.title, color: color.moon },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.md },
  title: { ...type.headline, color: color.moon },
  body: { ...type.body, color: color.moonDim },
  small: { ...type.caption, color: color.moonFaint },
  problem: { ...type.caption, color: '#FFB86B' },
  link: { ...type.label, color: color.glow },
  input: {
    minHeight: 160,
    textAlignVertical: 'top',
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
    color: color.moon,
    ...type.body,
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 56, height: 72, borderRadius: radius.sm, backgroundColor: color.glass },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  primary: { backgroundColor: color.glowDeep, borderColor: color.glowDeep },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonText: { ...type.headline, color: color.moon },
});
