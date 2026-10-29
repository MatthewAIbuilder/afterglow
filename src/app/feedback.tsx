import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHEET_BACKGROUND } from '../components/LiquidGlass';
import { PageTitle } from '../components/PageTitle';
import { SheetClose } from '../components/SheetClose';
import { SUPPORT_EMAIL } from '../config/app';
import { cleanPage, type FeedbackKind, feedbackMail, feedbackMessage, isFeedbackKind } from '../features/feedback/feedback';
import { SUPPORT_MAX } from '../features/social/models';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { goBack } from '../lib/nav';
import { useKeyboardInset } from '../lib/useKeyboardInset';
import { VERSION_LINE } from '../lib/version';
import { useSocial } from '../state/social';
import { color, glowA, radius, space, type, pageColumn } from '../theme/tokens';
import { t } from '../i18n';

/**
 * "Report a problem" or "Share an idea" about a page (`/feedback?kind=bug|idea&page=…`,
 * opened from the `PageFeedback` footer at the end of a page): a few words,
 * sent to support like any other message, with the page on it. Replies come
 * back in Settings → Contact support. Signed out, it offers an email.
 */
export default function FeedbackScreen() {
  const params = useLocalSearchParams<{ kind?: string; page?: string }>();
  const [kind, setKind] = useState<FeedbackKind>(isFeedbackKind(params.kind) ? params.kind : 'bug');
  const page = cleanPage(params.page);
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const signedIn = social.availability.ok && !!social.user;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // A form sheet: the field stays above the keyboard.
  const sheet = useRef<View>(null);
  const keyboard = useKeyboardInset(sheet);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await social.service.contactSupport({ topic: kind, text: feedbackMessage(text, page), platform: Platform.OS, version: VERSION_LINE });
      haptic.settle();
      setText('');
      setSent(true);
    } catch {
      showAlert(t('Couldn’t send it'), t('Check the signal and try again, or email {email}.', { email: SUPPORT_EMAIL }));
    } finally {
      setSending(false);
    }
  };
  const email = () => void Linking.openURL(feedbackMail(SUPPORT_EMAIL, kind, page)).catch(() => {});

  return (
    <View ref={sheet} onLayout={keyboard.onLayout} style={[styles.root, { paddingBottom: keyboard.inset }]}>
      <PageTitle title={kind === 'bug' ? t('Report a problem') : t('Share an idea')} />
      <SheetClose />
      <ScrollView contentContainerStyle={[pageColumn, styles.pad, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Text style={styles.title} accessibilityRole="header">
          {kind === 'bug' ? t('Something not working?') : t('Got an idea?')}
        </Text>
        <Text style={styles.body}>
          {kind === 'bug'
            ? t('Tell us what happened, or what looks wrong. We’ll know which page you were on.')
            : t('Anything that would make Afterglow better, big or small. We’ll know which page you were on.')}
        </Text>

        <View style={styles.kinds} accessibilityRole="radiogroup">
          {(['bug', 'idea'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => {
                haptic.select();
                setKind(k);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: kind === k }}
              style={[styles.kind, kind === k && styles.kindOn]}
            >
              <Text style={[styles.kindText, kind === k && { color: color.moon }]}>{k === 'bug' ? t('A problem') : t('An idea')}</Text>
            </Pressable>
          ))}
        </View>

        {signedIn ? (
          sent ? (
            <View style={styles.thanks}>
              <Text style={styles.thanksTitle}>{t('Thank you!')}</Text>
              <Text style={styles.body}>{t('A real person reads every one. If we reply, you’ll find it in Settings → Contact support.')}</Text>
              <Pressable onPress={() => goBack()} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>{t('Done')}</Text>
              </Pressable>
              <Pressable onPress={() => setSent(false)} accessibilityRole="button" hitSlop={8} style={styles.again}>
                <Text style={styles.link}>{t('Send another')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                value={text}
                onChangeText={(v) => setText(v.slice(0, SUPPORT_MAX - 140))}
                placeholder={kind === 'bug' ? t('What happened?') : t('Your idea')}
                placeholderTextColor={color.moonFaint}
                multiline
                autoFocus={Platform.OS !== 'web'}
                accessibilityLabel={kind === 'bug' ? t('What happened?') : t('Your idea')}
                style={styles.input}
              />
              <Pressable
                onPress={() => void send()}
                disabled={sending || !text.trim()}
                accessibilityRole="button"
                style={({ pressed }) => [styles.primary, (!text.trim() || sending) && { opacity: 0.45 }, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>{sending ? t('Sending…') : t('Send')}</Text>
              </Pressable>
              <Text style={styles.small}>{t('We’ll see your name, @handle and sign-in email with it, so we can write back.')}</Text>
            </>
          )
        ) : (
          <>
            <Text style={styles.body}>{t('Sign in to send it here, or email us. Both reach a real person.')}</Text>
            <Pressable onPress={email} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{t('Email us')}</Text>
            </Pressable>
            {social.availability.ok ? (
              <Pressable onPress={() => router.push({ pathname: '/account', params: { mode: 'signin' } })} accessibilityRole="button" hitSlop={8} style={styles.again}>
                <Text style={styles.link}>{t('Sign in')}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHEET_BACKGROUND },
  pad: { paddingHorizontal: space.xl, paddingTop: space.xxl, gap: space.md },
  title: { ...type.title, color: color.moon, paddingRight: space.xxxl },
  body: { ...type.body, color: color.moonDim },
  kinds: { flexDirection: 'row', gap: space.sm },
  kind: { paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  kindOn: { backgroundColor: glowA(0.22), borderColor: glowA(0.6) },
  kindText: { ...type.label, color: color.moonDim },
  input: { ...type.body, color: color.moon, minHeight: 120, textAlignVertical: 'top', padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  primary: { minHeight: 48, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.headline, color: color.night },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  small: { ...type.caption, color: color.moonFaint, textAlign: 'center' },
  thanks: { gap: space.md, paddingTop: space.sm },
  thanksTitle: { ...type.headline, color: color.moon },
  again: { alignSelf: 'center', paddingVertical: space.sm },
  link: { ...type.label, color: color.glow },
});
