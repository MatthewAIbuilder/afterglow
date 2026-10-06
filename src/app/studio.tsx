import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { Tabs } from '../components/Tabs';
import { isSupportAccount } from '../features/admin/admin';
import { OrgLogo } from '../features/organizers/OrgMark';
import { refreshOrgs } from '../features/organizers/OrgSync';
import type { Org } from '../features/organizers/organizers';
import { StudioArtists } from '../features/organizers/studio/StudioArtists';
import { StudioCollectibles } from '../features/organizers/studio/StudioCollectibles';
import { StudioEvents } from '../features/organizers/studio/StudioEvents';
import { StudioOverview } from '../features/organizers/studio/StudioOverview';
import { StudioPage } from '../features/organizers/studio/StudioPage';
import { StudioPromote } from '../features/organizers/studio/StudioPromote';
import { socialErrorKind, SOCIAL_ERROR_COPY } from '../features/social/service';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { rememberOrg, useMyOrg, useOrg } from '../state/orgs';
import { useSocial } from '../state/social';
import { color, radius, space, type, glowA } from '../theme/tokens';

type Section = 'overview' | 'events' | 'artists' | 'promote' | 'collectibles' | 'page';

/**
 * The organizer studio: where an event organizer runs its page on
 * Afterglow. Its numbers (Overview), its events and lineups (Events), words
 * on the artists it books (Artists), promotion requests (Promote), badges,
 * gifts, stickers and design requests (Collectibles), and its page (Page).
 * It opens for an email HQ added to the organizer, once that email is
 * confirmed, and for HQ (`?org=`). In English, like HQ.
 */
export default function StudioScreen() {
  const { org: asked } = useLocalSearchParams<{ org?: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const user = social.user;
  const hq = isSupportAccount(user);
  const mine = useMyOrg(user?.uid);
  const orgId = hq ? (asked ?? mine ?? undefined) : (mine ?? undefined);
  const org = useOrg(orgId);
  const [tab, setTab] = useState<Section>('overview');
  const [sent, setSent] = useState(false);

  // Signed in with the organizer's email: link this account too, so its profile shows the organizer.
  const uid = user?.uid;
  const linkable = !!org && !!uid && !!user?.emailVerified && mine === org.id && !org.uids.includes(uid);
  useEffect(() => {
    if (!linkable || !org || !uid) return;
    social.service
      .setOrgAccount(org.id, uid, true)
      .then(refreshOrgs)
      .catch(() => {});
  }, [linkable, org, uid, social.service]);

  const save = useCallback(
    async (next: Org) => {
      try {
        await social.service.saveOrg(next);
        rememberOrg({ ...next, updatedAt: new Date().toISOString() });
        refreshOrgs();
        return true;
      } catch (e) {
        showAlert('Couldn’t save that', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
        return false;
      }
    },
    [social.service],
  );

  const gate = (title: string, body: string, action?: { label: string; onPress: () => void }, second?: { label: string; onPress: () => void }) => (
    <View style={styles.gate}>
      <Text style={styles.gateTitle}>{title}</Text>
      <Text style={styles.gateBody}>{body}</Text>
      <View style={styles.gateRow}>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>{action.label}</Text>
          </Pressable>
        ) : null}
        {second ? (
          <Pressable onPress={second.onPress} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>{second.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  let body;
  if (!social.ready) body = null;
  else if (!user) body = gate('Sign in to your organizer account', 'The studio is for event organizers working with Afterglow. Sign in with the email Afterglow set up for you.', { label: 'Sign in', onPress: () => router.push('/account') });
  else if (!orgId) body = gate('This account isn’t an organizer yet', `Signed in as ${user.email}. If you put on events and want your own page, badges and stickers on Afterglow, contact us and we’ll set you up.`, { label: 'Contact Afterglow', onPress: () => router.push('/support') });
  // An account HQ linked needs no email check; one let in by its email does.
  else if (!user.emailVerified && !org?.uids.includes(user.uid))
    body = gate(
      'Confirm your email to open the studio',
      'So nobody else can run your page, the studio opens once your email is confirmed. Tap below, open the email from Afterglow, tap its link, then come back and tap “I’ve confirmed it”.',
      {
        label: sent ? 'Send it again' : 'Send the email',
        onPress: () =>
          void social.service
            .sendVerification()
            .then(() => setSent(true))
            .catch(() => showAlert('Couldn’t send the email', 'Check the signal and try again in a minute.')),
      },
      { label: 'I’ve confirmed it', onPress: () => void social.refreshUser().catch(() => {}) },
    );
  else if (!org) body = gate('Your page is on its way', 'Afterglow is reading your page. If this stays, check your signal and open the studio again.');
  else
    body = (
      <>
        <View style={styles.tabs}>
          <Tabs<Section>
            value={tab}
            onChange={setTab}
            items={[
              { key: 'overview', label: 'Overview' },
              { key: 'events', label: 'Events', count: org.events.length || undefined },
              { key: 'artists', label: 'Artists' },
              { key: 'promote', label: 'Promote' },
              { key: 'collectibles', label: 'Collectibles' },
              { key: 'page', label: 'Page' },
            ]}
          />
        </View>
        {tab === 'overview' ? (
          <StudioOverview org={org} />
        ) : tab === 'events' ? (
          <StudioEvents org={org} save={save} />
        ) : tab === 'artists' ? (
          <StudioArtists org={org} save={save} />
        ) : tab === 'promote' ? (
          <StudioPromote org={org} />
        ) : tab === 'collectibles' ? (
          <StudioCollectibles org={org} />
        ) : (
          <StudioPage key={org.updatedAt} org={org} save={save} />
        )}
      </>
    );

  return (
    <View style={styles.root}>
      <PageTitle title={org ? `${org.name} studio` : 'Organizer studio'} />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          {org ? <OrgLogo org={org} width={180} /> : null}
          <Text style={styles.kicker}>Organizer studio</Text>
          {user?.email ? (
            <Text style={styles.sub} numberOfLines={1}>
              {hq && org && mine !== org.id ? `Afterglow HQ, working on ${org.name}` : user.email}
            </Text>
          ) : null}
          {org ? (
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => {
                  haptic.select();
                  router.push({ pathname: '/org/[id]', params: { id: org.id } });
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
              >
                <Text style={styles.pillText}>View your page</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/switch-account')} accessibilityRole="button" style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
                <Text style={styles.pillText}>Switch account</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        {body}
      </ScrollView>
      <PageActions />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  header: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, marginBottom: space.lg },
  kicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: space.sm },
  sub: { ...type.caption, color: color.moonDim },
  headerRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  pill: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.5) },
  pillText: { ...type.label, color: color.moon },
  tabs: { marginBottom: space.lg },
  gate: { marginHorizontal: space.lg, padding: space.xl, gap: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  gateTitle: { ...type.headline, color: color.moon },
  gateBody: { ...type.body, color: color.moonDim },
  gateRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  primary: { paddingHorizontal: space.lg, minHeight: 46, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.headline, color: color.night },
  secondary: { paddingHorizontal: space.lg, minHeight: 46, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
