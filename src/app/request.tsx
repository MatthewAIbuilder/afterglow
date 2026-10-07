import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckIcon } from '../components/TabIcons';
import { APP_NAME, REQUEST_EMAIL } from '../config/app';
import { cleanRequest, requestMailto, requestText } from '../features/festivals/request';
import { haptic } from '../lib/haptics';
import { useRequests } from '../state/requests';
import { color, radius, space, type, accentEdge } from '../theme/tokens';
import { shareMessage } from '../lib/share';
import { goBack } from '../lib/nav';
import { SheetClose } from '../components/SheetClose';
import { t } from '../i18n';
import { SHEET_BACKGROUND } from '../components/LiquidGlass';

/**
 * Request a festival that isn't in the app yet: its name and, if you have
 * one, a link to the lineup. Goes out by email (REQUEST_EMAIL) or, without
 * one, through the share sheet. A sheet over Festivals.
 */
export default function RequestScreen() {
  const { name: typed } = useLocalSearchParams<{ name?: string }>();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(typed ?? '');
  const [link, setLink] = useState('');
  const [sent, setSent] = useState<string | undefined>();
  const { add } = useRequests();
  const request = cleanRequest(name, link);

  const send = async () => {
    if (!request) return;
    haptic.tap();
    let done = false;
    // By email to the team; without a mail app (or an address), through the share sheet instead.
    if (REQUEST_EMAIL) {
      try {
        await Linking.openURL(requestMailto(REQUEST_EMAIL, request, APP_NAME));
        done = true;
      } catch {
        done = false;
      }
    }
    if (!done) {
      try {
        const { subject, body } = requestText(request, APP_NAME);
        const outcome = await shareMessage(body, subject);
        done = outcome === 'shared' || outcome === 'copied';
      } catch {
        done = false;
      }
    }
    if (!done) return;
    add(request.name);
    haptic.settle();
    setSent(request.name);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {sent ? (
          <View style={styles.done} accessible accessibilityLiveRegion="polite">
            <View style={styles.check}>
              <CheckIcon color={color.moon} size={22} />
            </View>
            <Text style={styles.title}>{t('Thanks for asking')}</Text>
            <Text style={styles.body}>
              {t('{festival} is on the list. When its lineup is in, it’ll show up on your Festivals tab.', { festival: sent })}
            </Text>
            <Pressable
              onPress={() => goBack()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>{t('Done')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>{t('Request a festival')}</Text>
            <Text style={styles.body}>{t('Tell us which one you’re going to and we’ll add its lineup.')}</Text>

            <Text style={styles.label}>{t('Festival')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('Name and year, like Lost Lands 2027')}
              placeholderTextColor={color.moonFaint}
              accessibilityLabel={t('Festival name')}
              autoFocus={!typed}
              autoCapitalize="words"
              returnKeyType="next"
              maxLength={80}
              style={styles.input}
            />
            <Text style={styles.label}>{t('Link to the lineup (optional)')}</Text>
            <TextInput
              value={link}
              onChangeText={setLink}
              placeholder={t('Website or lineup post')}
              placeholderTextColor={color.moonFaint}
              accessibilityLabel={t('Link to the lineup, optional')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="send"
              onSubmitEditing={send}
              maxLength={300}
              style={styles.input}
            />

            <Pressable
              onPress={send}
              disabled={!request}
              accessibilityRole="button"
              accessibilityState={{ disabled: !request }}
              accessibilityLabel={request ? t('Send request for {festival}', { festival: request.name }) : t('Send request. Type a festival name first')}
              style={({ pressed }) => [styles.button, !request && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>{t('Send request')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      <SheetClose />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHEET_BACKGROUND },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.xs },
  label: { ...type.label, color: color.moonDim, marginTop: space.xl, marginBottom: space.sm },
  input: {
    ...type.body,
    color: color.moon,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: space.xl,
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glowDeep,
    ...accentEdge,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonText: { ...type.headline, color: color.moon },
  done: { alignItems: 'center', paddingTop: space.lg },
  check: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glowDeep,
    marginBottom: space.lg,
  },
});
