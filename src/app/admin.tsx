import { Redirect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageTitle } from '../components/PageTitle';
import { Tabs } from '../components/Tabs';
import { isSupportAccount } from '../features/admin/admin';
import { AdminAccounts } from '../features/admin/AdminAccounts';
import { AdminData } from '../features/admin/AdminData';
import { AdminOverview } from '../features/admin/AdminOverview';
import { AdminReports } from '../features/admin/AdminReports';
import { AdminStickers } from '../features/admin/AdminStickers';
import { AdminSupport } from '../features/admin/AdminSupport';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { setGuestView } from '../state/adminView';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';

type Section = 'overview' | 'data' | 'stickers' | 'accounts' | 'support' | 'reports';

/**
 * Afterglow HQ: what the support account sees instead of the app. How
 * Afterglow is doing (Overview), lineups and set times to add (Data),
 * stickers to collect and print (Stickers), privileges for other accounts (Accounts), messages from people (Support)
 * and what they reported (Reports). "View the app" shows the app as everyone sees
 * it, with a pill back here. It opens only for the support email, once
 * that email is confirmed (the database checks it too).
 */
export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const user = social.user;
  const [tab, setTab] = useState<Section>('overview');
  const [open, setOpen] = useState<number | undefined>();
  const onCount = useCallback((n: number) => setOpen(n), []);
  const [sent, setSent] = useState(false);

  if (social.ready && !isSupportAccount(user)) return <Redirect href="/" />;

  const viewApp = () => {
    haptic.select();
    setGuestView(true);
    router.replace('/');
  };
  const signOut = () =>
    showAlert('Sign out of the support account?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void social.signOut().then(() => router.replace('/')) },
    ]);

  return (
    <View style={styles.root}>
      <PageTitle title="Afterglow HQ" />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxxl }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Afterglow HQ</Text>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable onPress={viewApp} accessibilityRole="button" accessibilityLabel="View the app as everyone sees it" style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
              <Text style={styles.pillText}>View the app</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/switch-account')} accessibilityRole="button" accessibilityLabel="Switch account" hitSlop={6}>
              <Text style={styles.switchText}>Switch account</Text>
            </Pressable>
            <Pressable onPress={signOut} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          </View>
        </View>

        {!user?.emailVerified ? (
          <View style={styles.verify}>
            <Text style={styles.verifyTitle}>Confirm this email to open the dashboard</Text>
            <Text style={styles.verifyBody}>
              So nobody else can get in with this address, the numbers, messages and reports only open once the email is confirmed. Tap below, open the email from Firebase on any device, tap its link, then come back and tap “I’ve confirmed it”.
            </Text>
            <View style={styles.verifyRow}>
              <Pressable
                onPress={() =>
                  void social.service
                    .sendVerification()
                    .then(() => setSent(true))
                    .catch(() => showAlert('Couldn’t send the email', 'Check the signal and try again in a minute.'))
                }
                accessibilityRole="button"
                style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>{sent ? 'Send it again' : 'Send the email'}</Text>
              </Pressable>
              <Pressable onPress={() => void social.refreshUser().catch(() => {})} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>I’ve confirmed it</Text>
              </Pressable>
            </View>
            {sent ? <Text style={styles.verifyBody}>Sent to {user?.email}. Check spam if it isn’t there.</Text> : null}
          </View>
        ) : (
          <>
            <View style={styles.tabs}>
              <Tabs<Section>
                value={tab}
                onChange={setTab}
                items={[
                  { key: 'overview', label: 'Overview' },
                  { key: 'data', label: 'Data' },
                  { key: 'stickers', label: 'Stickers' },
                  { key: 'accounts', label: 'Accounts' },
                  { key: 'support', label: 'Support', count: open || undefined },
                  { key: 'reports', label: 'Reports' },
                ]}
              />
            </View>
            {tab === 'overview' ? (
              <AdminOverview />
            ) : tab === 'data' ? (
              <AdminData />
            ) : tab === 'stickers' ? (
              <AdminStickers />
            ) : tab === 'accounts' ? (
              <AdminAccounts />
            ) : tab === 'support' ? (
              <AdminSupport onCount={onCount} />
            ) : (
              <AdminReports />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.xl, marginBottom: space.lg },
  kicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.caption, color: color.moonDim },
  headerButtons: { alignItems: 'flex-end', gap: space.sm },
  pill: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(169,124,255,0.5)' },
  pillText: { ...type.label, color: color.moon },
  signOut: { ...type.caption, color: color.moonFaint },
  switchText: { ...type.caption, color: color.glow },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  tabs: { marginBottom: space.lg },
  verify: { marginHorizontal: space.lg, padding: space.xl, gap: space.md, borderRadius: radius.lg, backgroundColor: 'rgba(255,184,107,0.08)', borderWidth: 1, borderColor: 'rgba(255,184,107,0.4)' },
  verifyTitle: { ...type.headline, color: color.moon },
  verifyBody: { ...type.body, color: color.moonDim },
  verifyRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  primary: { paddingHorizontal: space.lg, minHeight: 46, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.headline, color: color.night },
  secondary: { paddingHorizontal: space.lg, minHeight: 46, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
});
