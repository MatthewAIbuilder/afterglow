import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PersonAvatar } from '../components/PersonAvatar';
import { CheckIcon } from '../components/TabIcons';
import { accountDetail, accountTitle, type SavedAccount } from '../features/accounts/saved';
import { useSwitchAccount } from '../features/accounts/useSwitchAccount';
import { KEEPS_PASSWORDS } from '../features/accounts/vault';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { forgetAccount, useSavedAccounts } from '../state/savedAccounts';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';

/**
 * Switch account: the accounts saved on this phone, one tap to move between
 * them (handy for going from your own profile to the support account and
 * back). Opened by holding the Profile tab, from Settings, or from the
 * dashboard. Passwords are kept only in the phone's keychain; the website
 * asks for one each time.
 */
export default function SwitchAccountScreen() {
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const saved = useSavedAccounts();
  const { busy, switchTo, addAccount, saveCurrent } = useSwitchAccount();
  const me = social.user;
  const meSaved = !!me && !!saved?.some((a) => a.uid === me.uid);

  // The account whose password is being asked for (or 'me' to save this one, 'new' to add one).
  const [asking, setAsking] = useState<string | undefined>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(KEEPS_PASSWORDS);
  const [problem, setProblem] = useState<string | undefined>();
  const [savedNote, setSavedNote] = useState(false);

  if (!social.availability.ok) {
    return (
      <View style={[styles.root, { padding: space.xl }]}>
        <Text style={styles.title}>Switch account</Text>
        <Text style={styles.body}>Accounts are in the full version of Afterglow.</Text>
      </View>
    );
  }

  const ask = (key: string, problemText?: string) => {
    setAsking(key);
    setPassword('');
    setProblem(problemText);
  };
  const close = () => {
    setAsking(undefined);
    setPassword('');
    setProblem(undefined);
  };

  const tap = async (a: SavedAccount) => {
    if (a.uid === me?.uid || busy) return;
    haptic.select();
    const r = await switchTo(a);
    if (!r.ok) {
      if (r.needsPassword) ask(a.uid, r.problem);
      else showAlert('Couldn’t switch', r.problem);
    }
  };
  const submit = async (a?: SavedAccount) => {
    setProblem(undefined);
    const r = asking === 'me' ? await saveCurrent(password, remember) : asking === 'new' ? await addAccount(email, password, remember) : a ? await switchTo(a, password, remember) : undefined;
    if (!r) return;
    if (r.ok) {
      if (asking === 'me') setSavedNote(true);
      close();
    } else setProblem(r.problem ?? 'Type the password.');
  };
  const remove = (a: SavedAccount) =>
    showAlert(`Remove ${accountTitle(a)} from this phone?`, 'It leaves the list and its saved password is forgotten. The account itself isn’t changed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void forgetAccount(a.uid) },
    ]);

  const passwordForm = (a?: SavedAccount) => (
    <View style={styles.form}>
      {asking === 'new' ? (
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={color.moonFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          accessibilityLabel="Email"
          style={styles.input}
        />
      ) : null}
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={color.moonFaint}
        secureTextEntry
        autoFocus
        textContentType="password"
        accessibilityLabel={a ? `Password for ${accountTitle(a)}` : 'Password'}
        onSubmitEditing={() => void submit(a)}
        style={styles.input}
      />
      {KEEPS_PASSWORDS ? (
        <View style={styles.rememberRow}>
          <Text style={styles.rememberText}>Remember the password on this phone</Text>
          <Switch value={remember} onValueChange={setRemember} accessibilityLabel="Remember the password on this phone" trackColor={{ false: 'rgba(255,255,255,0.18)', true: color.glow }} />
        </View>
      ) : null}
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      <View style={styles.formButtons}>
        <Pressable onPress={close} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => void submit(a)}
          disabled={!password || (asking === 'new' && !email.trim()) || !!busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, (!password || !!busy) && styles.dim, pressed && styles.pressed]}
        >
          {busy ? <ActivityIndicator color={color.night} /> : <Text style={styles.primaryText}>{asking === 'me' ? 'Save' : asking === 'new' ? 'Sign in' : 'Switch'}</Text>}
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        Switch account
      </Text>
      <Text style={styles.body}>
        {KEEPS_PASSWORDS ? 'Accounts saved on this phone, one tap apart. Passwords stay in the phone’s keychain.' : 'Accounts saved in this browser. You’ll type the password each time.'}
      </Text>

      {!saved ? <ActivityIndicator color={color.glow} style={{ marginTop: space.lg }} /> : null}
      {saved?.map((a) => {
        const current = a.uid === me?.uid;
        return (
          <View key={a.uid}>
            <Pressable
              onPress={() => void tap(a)}
              disabled={current}
              accessibilityRole="button"
              accessibilityLabel={current ? `${accountTitle(a)}, signed in` : `Switch to ${accountTitle(a)}`}
              accessibilityActions={[{ name: 'remove', label: 'Remove from this phone' }]}
              onAccessibilityAction={(e) => e.nativeEvent.actionName === 'remove' && remove(a)}
              style={({ pressed }) => [styles.row, current && styles.rowOn, pressed && styles.pressed]}
            >
              <PersonAvatar name={a.name ?? a.handle ?? a.email} url={a.avatarUrl} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {accountTitle(a)}
                </Text>
                {accountDetail(a) ? (
                  <Text style={styles.rowDetail} numberOfLines={1}>
                    {accountDetail(a)}
                  </Text>
                ) : null}
              </View>
              {busy === a.uid ? (
                <ActivityIndicator color={color.glow} />
              ) : current ? (
                <View style={styles.check}>
                  <CheckIcon color={color.night} size={14} />
                </View>
              ) : (
                <Pressable onPress={() => remove(a)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${accountTitle(a)} from this phone`}>
                  <Text style={styles.remove}>×</Text>
                </Pressable>
              )}
            </Pressable>
            {asking === a.uid ? passwordForm(a) : null}
          </View>
        );
      })}

      {/* The account you're in isn't saved yet: save it, so you can come back to it. */}
      {saved && me?.email && !meSaved ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Save {me.email}</Text>
          <Text style={styles.body}>So you can switch back to it in one tap.</Text>
          {asking === 'me' ? (
            passwordForm()
          ) : (
            <Pressable onPress={() => ask('me')} accessibilityRole="button" style={({ pressed }) => [styles.primary, styles.cardButton, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>Save this account</Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {savedNote ? <Text style={styles.note}>Saved. Hold the Profile tab any time to switch.</Text> : null}

      {asking === 'new' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add an account</Text>
          {passwordForm()}
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setEmail('');
            ask('new');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <Text style={styles.addPlus}>+</Text>
          <Text style={styles.addText}>Add an account</Text>
        </Pressable>
      )}

      {me ? (
        <Pressable
          onPress={() =>
            void social.signOut().then(() => {
              if (router.canDismiss()) router.dismissAll();
              router.replace('/');
            })
          }
          accessibilityRole="button"
          style={styles.signOut}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.nightRaised },
  content: { padding: space.xl, gap: space.sm },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  rowOn: { borderColor: 'rgba(169,124,255,0.55)', backgroundColor: 'rgba(169,124,255,0.1)' },
  rowTitle: { ...type.headline, color: color.moon },
  rowDetail: { ...type.caption, color: color.moonDim },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: color.glow, alignItems: 'center', justifyContent: 'center' },
  remove: { fontSize: 22, lineHeight: 24, color: color.moonFaint, paddingHorizontal: 4 },
  form: { gap: space.sm, paddingTop: space.sm, paddingBottom: space.sm },
  input: { ...type.body, color: color.moon, minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  rememberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  rememberText: { ...type.caption, color: color.moonDim, flex: 1 },
  problem: { ...type.caption, color: '#FFB86B' },
  formButtons: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
  primary: { paddingHorizontal: space.lg, minHeight: 44, minWidth: 96, justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.headline, color: color.night },
  secondary: { paddingHorizontal: space.lg, minHeight: 44, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  card: { marginTop: space.sm, padding: space.lg, gap: 2, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  cardTitle: { ...type.headline, color: color.moon },
  cardButton: { alignSelf: 'flex-start' },
  note: { ...type.caption, color: color.glow, textAlign: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: color.hairline, marginTop: space.sm },
  addPlus: { fontSize: 24, lineHeight: 28, color: color.glow, width: 44, textAlign: 'center' },
  addText: { ...type.headline, color: color.moon },
  signOut: { alignSelf: 'center', padding: space.md, marginTop: space.md },
  signOutText: { ...type.label, color: color.moonFaint },
});
