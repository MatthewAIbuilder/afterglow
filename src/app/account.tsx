import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckIcon } from '../components/TabIcons';
import { contactLine, GUIDELINES } from '../features/social/copy';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../features/social/service';
import { EMAIL_RE, PASSWORD_MIN } from '../features/social/validate';
import { haptic } from '../lib/haptics';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';

/**
 * Create your Afterglow profile, or sign back in. Email and password (kept
 * by Firebase, never by Afterglow). Creating one means agreeing to the
 * community guidelines, shown right here.
 */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();

  const create = mode === 'create';
  const emailOk = EMAIL_RE.test(email.trim());
  const canSubmit = emailOk && password.length >= (create ? PASSWORD_MIN : 1) && (!create || agreed) && !busy;

  const submit = async () => {
    if (!canSubmit) {
      if (!emailOk) setProblem(SOCIAL_ERROR_COPY['invalid-email']);
      else if (create && password.length < PASSWORD_MIN) setProblem(SOCIAL_ERROR_COPY['weak-password']);
      else if (create && !agreed) setProblem('Agree to the guidelines to create your profile.');
      return;
    }
    haptic.tap();
    setBusy(true);
    setProblem(undefined);
    try {
      if (create) await social.signUp(email, password);
      else await social.signIn(email, password);
      haptic.settle();
      // New accounts go straight on to making the profile.
      if (create) router.replace('/profile-edit');
      else router.back();
    } catch (e) {
      setProblem(SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!emailOk) {
      setProblem('Type your email above, then tap “Forgot password?” again.');
      return;
    }
    try {
      await social.service.sendPasswordReset(email);
      Alert.alert('Check your email', `If there’s an account for ${email.trim()}, a link to choose a new password is on its way.`);
    } catch (e) {
      setProblem(SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    }
  };

  if (!social.availability.ok) {
    return (
      <View style={[styles.root, styles.pad, { paddingTop: space.xxl }]}>
        <Text style={styles.title}>Profiles</Text>
        <Text style={styles.body}>{SOCIAL_ERROR_COPY.unavailable}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.pad, { paddingTop: space.xxl, paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          {create ? 'Create your profile' : 'Welcome back'}
        </Text>
        <Text style={styles.body}>
          {create ? 'Show where you’re going and share the memories you choose. Everything else stays on your phone.' : 'Sign in to your Afterglow profile.'}
        </Text>

        <View style={styles.segment} accessibilityRole="tablist">
          {(['create', 'signin'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                haptic.select();
                setMode(m);
                setProblem(undefined);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              style={[styles.segmentItem, mode === m && styles.segmentOn]}
            >
              <Text style={[styles.segmentText, mode === m && styles.segmentTextOn]}>{m === 'create' ? 'New here' : 'Sign in'}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={color.moonFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          accessibilityLabel="Email"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={create ? `Password (at least ${PASSWORD_MIN} characters)` : 'Password'}
          placeholderTextColor={color.moonFaint}
          secureTextEntry
          textContentType={create ? 'newPassword' : 'password'}
          autoComplete={create ? 'new-password' : 'current-password'}
          accessibilityLabel="Password"
          style={styles.input}
          onSubmitEditing={() => void submit()}
        />

        {create ? (
          <View style={styles.guidelines}>
            <Text style={styles.guideTitle}>Community guidelines</Text>
            {GUIDELINES.map((g) => (
              <Text key={g} style={styles.guide}>
                • {g}
              </Text>
            ))}
            {contactLine() ? <Text style={styles.guide}>{contactLine()}</Text> : null}
            <Pressable
              onPress={() => {
                haptic.select();
                setAgreed((a) => !a);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              style={styles.agree}
            >
              <View style={[styles.box, agreed && styles.boxOn]}>{agreed ? <CheckIcon color={color.night} size={14} /> : null}</View>
              <Text style={styles.agreeText}>I agree to the community guidelines</Text>
            </Pressable>
          </View>
        ) : null}

        {problem ? (
          <Text style={styles.problem} accessibilityLiveRegion="assertive">
            {problem}
          </Text>
        ) : null}

        <Pressable
          onPress={() => void submit()}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          style={({ pressed }) => [styles.primary, !canSubmit && styles.dim, pressed && styles.pressed]}
        >
          {busy ? <ActivityIndicator color={color.moon} /> : <Text style={styles.primaryText}>{create ? 'Create profile' : 'Sign in'}</Text>}
        </Pressable>
        {!create ? (
          <Pressable onPress={() => void forgot()} accessibilityRole="button" hitSlop={8} style={styles.forgot}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.nightRaised },
  pad: { paddingHorizontal: space.xl, gap: space.md },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim },
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: color.glass, marginTop: space.sm },
  segmentItem: { flex: 1, paddingVertical: space.sm, borderRadius: radius.pill, alignItems: 'center' },
  segmentOn: { backgroundColor: 'rgba(169,124,255,0.25)' },
  segmentText: { ...type.label, color: color.moonDim },
  segmentTextOn: { color: color.moon },
  input: {
    ...type.body,
    color: color.moon,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  guidelines: { gap: space.xs, padding: space.lg, borderRadius: radius.md, backgroundColor: color.glass },
  guideTitle: { ...type.label, color: color.moon, marginBottom: space.xs },
  guide: { ...type.caption, color: color.moonDim, lineHeight: 18 },
  agree: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: color.moonDim, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: color.glow, borderColor: color.glow },
  agreeText: { ...type.label, color: color.moon, flex: 1 },
  problem: { ...type.label, color: color.moon },
  primary: {
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(169,124,255,0.3)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(169,124,255,0.6)',
    marginTop: space.sm,
  },
  primaryText: { ...type.headline, color: color.moon },
  dim: { opacity: 0.5 },
  forgot: { alignSelf: 'center', paddingVertical: space.sm },
  link: { ...type.label, color: color.glow },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
