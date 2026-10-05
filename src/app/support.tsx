import { Linking, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { SUPPORT_EMAIL } from '../config/app';
import { agoShort } from '../features/admin/admin';
import { repliesOf, SUPPORT_MAX, SUPPORT_TOPICS, type SupportTopic } from '../features/social/models';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { useNow } from '../lib/useNow';
import { VERSION_LINE } from '../lib/version';
import { useSocial } from '../state/social';
import { useMySupport } from '../state/supportSeen';
import { color, radius, space, type } from '../theme/tokens';

/**
 * Contact support: pick what it's about, write it, send. Replies come back
 * here (and Settings says when there's a new one). Signed out, it offers an
 * email instead.
 */
export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const signedIn = social.availability.ok && !!social.user;
  const { list, load, seen } = useMySupport();
  const [topic, setTopic] = useState<SupportTopic>('help');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const now = useNow().getTime();
  useEffect(() => {
    if (list) seen();
  }, [list, seen]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await social.service.contactSupport({ topic, text, platform: Platform.OS, version: VERSION_LINE });
      haptic.settle();
      setText('');
      setSent(true);
      void load();
    } catch {
      showAlert('Couldn’t send it', `Check the signal and try again, or email ${SUPPORT_EMAIL}.`);
    } finally {
      setSending(false);
    }
  };
  const email = () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Afterglow')}`).catch(() => {});

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageTitle title="Contact support" />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl, gap: space.md }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Contact support</Text>
        <Text style={styles.body}>A question, something broken, an idea, a festival we should add: tell us. A real person reads every message and replies here.</Text>

        {signedIn ? (
          <>
            <View style={styles.topics} accessibilityRole="radiogroup">
              {SUPPORT_TOPICS.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => {
                    haptic.select();
                    setTopic(t.key);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: topic === t.key }}
                  style={[styles.topic, topic === t.key && styles.topicOn]}
                >
                  <Text style={[styles.topicText, topic === t.key && { color: color.moon }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={text}
              onChangeText={(t) => {
                setText(t.slice(0, SUPPORT_MAX));
                setSent(false);
              }}
              placeholder="What’s up?"
              placeholderTextColor={color.moonFaint}
              multiline
              style={styles.input}
              accessibilityLabel="Your message to support"
            />
            <Text style={styles.count}>
              {text.length}/{SUPPORT_MAX}
            </Text>
            <Pressable onPress={() => void send()} disabled={sending || !text.trim()} accessibilityRole="button" style={({ pressed }) => [styles.primary, (!text.trim() || sending) && { opacity: 0.45 }, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{sending ? 'Sending…' : 'Send'}</Text>
            </Pressable>
            {sent ? <Text style={styles.sent} accessibilityLiveRegion="polite">Sent. We’ll reply here, usually within a day or two.</Text> : null}
            <Text style={styles.small}>We’ll see your name, @handle and sign-in email with it, so we can write back.</Text>

            {list && list.length ? (
              <>
                <Text style={styles.section}>Your messages</Text>
                {list.map((m) => (
                  <View key={m.id} style={styles.card}>
                    <Text style={styles.cardMeta}>
                      {SUPPORT_TOPICS.find((t) => t.key === m.topic)?.label} · {agoShort(m.createdAt, now)}
                    </Text>
                    <Text style={styles.cardText}>{m.text}</Text>
                    {repliesOf(m).length ? (
                      repliesOf(m).map((r, i) => (
                        <View key={i} style={styles.reply}>
                          <Text style={styles.replyLabel}>Afterglow support{r.at ? ` · ${agoShort(r.at, now)}` : ''}</Text>
                          <Text style={styles.replyText}>{r.text}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.waiting}>{m.status === 'closed' ? 'Closed' : 'Waiting for a reply'}</Text>
                    )}
                  </View>
                ))}
              </>
            ) : null}
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardText}>Sign in to send a message and see replies here, or email us.</Text>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {social.availability.ok ? (
                <Pressable onPress={() => router.push('/account')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                  <Text style={styles.primaryText}>Sign in</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={email} accessibilityRole="button" accessibilityLabel={`Email ${SUPPORT_EMAIL}`} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>Email us</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  title: { ...type.largeTitle, color: color.moon },
  body: { ...type.body, color: color.moonDim },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  topic: { paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  topicOn: { backgroundColor: 'rgba(169,124,255,0.22)', borderColor: 'rgba(169,124,255,0.6)' },
  topicText: { ...type.label, color: color.moonDim },
  input: { ...type.body, color: color.moon, minHeight: 140, textAlignVertical: 'top', padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  count: { ...type.caption, color: color.moonFaint, alignSelf: 'flex-end', marginTop: -space.sm },
  primary: { minHeight: 48, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.headline, color: color.night },
  secondary: { minHeight: 48, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  sent: { ...type.label, color: '#5BE3B5', textAlign: 'center' },
  small: { ...type.caption, color: color.moonFaint, textAlign: 'center' },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.lg },
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  cardMeta: { ...type.caption, color: color.moonFaint },
  cardText: { ...type.body, color: color.moon },
  reply: { padding: space.md, gap: 2, borderRadius: radius.md, backgroundColor: 'rgba(169,124,255,0.14)' },
  replyLabel: { ...type.caption, color: color.glow },
  replyText: { ...type.body, color: color.moon },
  waiting: { ...type.caption, color: color.moonDim },
});
