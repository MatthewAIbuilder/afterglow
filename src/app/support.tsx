import { Linking, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { SUPPORT_EMAIL } from '../config/app';
import { repliesOf, SUPPORT_MAX, SUPPORT_TOPICS, type SupportTopic } from '../features/social/models';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { useNow } from '../lib/useNow';
import { VERSION_LINE } from '../lib/version';
import { useSocial } from '../state/social';
import { useMySupport } from '../state/supportSeen';
import { color, radius, space, type, glowA, pageColumn } from '../theme/tokens';
import { t } from '../i18n';

/** The topics as this screen shows them (the key is what's sent; HQ keeps its own English words). */
const TOPIC_LABEL: Record<SupportTopic, string> = {
  help: t('I need help'),
  bug: t('Something’s broken'),
  idea: t('An idea'),
  festival: t('A festival'),
  other: t('Something else'),
};

/** How long ago, as HQ's `agoShort` says it, in the app's language (HQ itself stays English). */
function agoShort(iso: string, now: number): string {
  const then = Date.parse(iso.split('#')[0]);
  const m = Math.max(0, Math.round((now - then) / 60_000));
  if (m < 1) return t('just now');
  if (m < 60) return t('{m} min ago', { m });
  const h = Math.round(m / 60);
  if (h < 24) return t('{h} h ago', { h });
  const d = Math.round(h / 24);
  return d === 1 ? t('yesterday') : t('{n} days ago', { n: d });
}

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
      showAlert(t('Couldn’t send it'), t('Check the signal and try again, or email {email}.', { email: SUPPORT_EMAIL }));
    } finally {
      setSending(false);
    }
  };
  const email = () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Afterglow')}`).catch(() => {});

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageTitle title={t('Contact support')} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[pageColumn, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl, gap: space.md }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('Contact support')}</Text>
        <Text style={styles.body}>{t('A question, something broken, an idea, a festival we should add: tell us. A real person reads every message and replies here.')}</Text>

        {signedIn ? (
          <>
            <View style={styles.topics} accessibilityRole="radiogroup">
              {SUPPORT_TOPICS.map((tp) => (
                <Pressable
                  key={tp.key}
                  onPress={() => {
                    haptic.select();
                    setTopic(tp.key);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: topic === tp.key }}
                  style={[styles.topic, topic === tp.key && styles.topicOn]}
                >
                  <Text style={[styles.topicText, topic === tp.key && { color: color.moon }]}>{TOPIC_LABEL[tp.key] ?? tp.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v.slice(0, SUPPORT_MAX));
                setSent(false);
              }}
              placeholder={t('What’s up?')}
              placeholderTextColor={color.moonFaint}
              multiline
              style={styles.input}
              accessibilityLabel={t('Your message to support')}
            />
            <Text style={styles.count}>
              {text.length}/{SUPPORT_MAX}
            </Text>
            <Pressable onPress={() => void send()} disabled={sending || !text.trim()} accessibilityRole="button" style={({ pressed }) => [styles.primary, (!text.trim() || sending) && { opacity: 0.45 }, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{sending ? t('Sending…') : t('Send')}</Text>
            </Pressable>
            {sent ? <Text style={styles.sent} accessibilityLiveRegion="polite">{t('Sent. We’ll reply here, usually within a day or two.')}</Text> : null}
            <Text style={styles.small}>{t('We’ll see your name, @handle and sign-in email with it, so we can write back.')}</Text>

            {list && list.length ? (
              <>
                <Text style={styles.section}>{t('Your messages')}</Text>
                {list.map((m) => (
                  <View key={m.id} style={styles.card}>
                    <Text style={styles.cardMeta}>
                      {TOPIC_LABEL[m.topic] ?? SUPPORT_TOPICS.find((tp) => tp.key === m.topic)?.label} · {agoShort(m.createdAt, now)}
                    </Text>
                    <Text style={styles.cardText}>{m.text}</Text>
                    {repliesOf(m).length ? (
                      repliesOf(m).map((r, i) => (
                        <View key={i} style={styles.reply}>
                          <Text style={styles.replyLabel}>{t('Afterglow support')}{r.at ? ` · ${agoShort(r.at, now)}` : ''}</Text>
                          <Text style={styles.replyText}>{r.text}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.waiting}>{m.status === 'closed' ? t('Closed') : t('Waiting for a reply')}</Text>
                    )}
                  </View>
                ))}
              </>
            ) : null}
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardText}>{t('Sign in to send a message and see replies here, or email us.')}</Text>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {social.availability.ok ? (
                <Pressable onPress={() => router.push('/account')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                  <Text style={styles.primaryText}>{t('Sign in')}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={email} accessibilityRole="button" accessibilityLabel={t('Email {email}', { email: SUPPORT_EMAIL })} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>{t('Email us')}</Text>
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
  topic: { paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  topicOn: { backgroundColor: glowA(0.22), borderColor: glowA(0.6) },
  topicText: { ...type.label, color: color.moonDim },
  input: { ...type.body, color: color.moon, minHeight: 140, textAlignVertical: 'top', padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  count: { ...type.caption, color: color.moonFaint, alignSelf: 'flex-end', marginTop: -space.sm },
  primary: { minHeight: 48, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.headline, color: color.night },
  secondary: { minHeight: 48, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  secondaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  sent: { ...type.label, color: '#5BE3B5', textAlign: 'center' },
  small: { ...type.caption, color: color.moonFaint, textAlign: 'center' },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.lg },
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  cardMeta: { ...type.caption, color: color.moonFaint },
  cardText: { ...type.body, color: color.moon },
  reply: { padding: space.md, gap: 2, borderRadius: radius.md, backgroundColor: glowA(0.14) },
  replyLabel: { ...type.caption, color: color.glow },
  replyText: { ...type.body, color: color.moon },
  waiting: { ...type.caption, color: color.moonDim },
});
