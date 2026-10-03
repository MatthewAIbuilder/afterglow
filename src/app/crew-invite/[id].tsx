import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { SearchField } from '../../components/SearchField';
import { ChevronIcon } from '../../components/TabIcons';
import { INVITE_PEOPLE_MAX, inviteCandidates, type InviteRow } from '../../features/crews/invite';
import type { Crew, Profile } from '../../features/social/models';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../../features/social/service';
import { StandingAvatar } from '../../features/standing/StandingAvatar';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { useCatalog } from '../../state/catalog';
import { useCrews } from '../../state/crews';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * Invite people you know on Afterglow to a crew: people you follow and who
 * follow you, those going to the crew's festival first. They see the invite
 * in their bell and on their Friends tab, and join from the crew page. For
 * anyone not on Afterglow yet, a link to share.
 */
export default function CrewInviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const { crews, inviteLink, newInviteLink } = useCrews();
  const crew: Crew | undefined = crews.find((c) => c.id === id);
  const festival = useCatalog().festival(crew?.festivalId ?? '');
  const me = social.user?.uid;
  const [people, setPeople] = useState<Profile[]>();
  const [invited, setInvited] = useState<ReadonlySet<string>>(new Set());
  const [sending, setSending] = useState<string>();
  const [query, setQuery] = useState('');

  // People you follow and who follow you, and who you've already invited.
  const followingKey = [...social.following].sort().join(',');
  useEffect(() => {
    if (!me || !crew) return;
    let live = true;
    const { service } = social;
    Promise.all([service.followers(me, INVITE_PEOPLE_MAX).catch(() => [] as string[]), service.sentCrewInvites(crew.id).catch(() => [] as string[])]).then(async ([followers, sent]) => {
      const uids = [...new Set([...followingKey.split(',').filter(Boolean), ...followers])].slice(0, INVITE_PEOPLE_MAX);
      const found = await Promise.all(uids.map((u) => service.profileOf(u).catch(() => null)));
      if (!live) return;
      setPeople(found.filter((p): p is Profile => !!p));
      setInvited(new Set(sent));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per crew and who you follow
  }, [me, crew?.id, followingKey]);

  const rows = useMemo(
    () => (crew && people ? inviteCandidates(people, { me, members: crew.members, invited, blocked: social.blocked, festivalId: crew.festivalId, query }) : []),
    [crew, people, me, invited, social.blocked, query],
  );

  const invite = async (row: InviteRow) => {
    if (!crew || sending) return;
    haptic.select();
    setSending(row.profile.uid);
    try {
      await social.service.inviteToCrew(crew.id, row.profile.uid);
      haptic.settle();
      setInvited((s) => new Set([...s, row.profile.uid]));
    } catch (e) {
      showAlert(`Couldn’t invite ${row.profile.displayName}`, SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setSending(undefined);
    }
  };

  const shareLink = async (fresh = false) => {
    if (!crew) return;
    haptic.select();
    let link: string;
    try {
      link = fresh ? await newInviteLink(crew.id) : await inviteLink(crew.id);
    } catch (e) {
      showAlert('Couldn’t make the invite link', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
      return;
    }
    const where = festival ? ` for ${festival.name}` : '';
    const outcome = await shareMessage(`Join my crew${where} on Afterglow, so we can plan our sets and chat: ${link}`, crew.name);
    if (outcome === 'failed') showAlert('Couldn’t share the invite', 'Try again in a moment.');
  };
  // The owner can make a new link, so an old one that went too far stops working.
  const freshLink = () => {
    haptic.select();
    showAlert('Make a new invite link?', 'The link you shared before stops working. People already in the crew stay in it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New link', onPress: () => void shareLink(true) },
    ]);
  };

  const total = people?.length ?? 0;
  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl, gap: space.md }}>
        <Text style={styles.title} accessibilityRole="header">
          Invite to {crew?.name || 'your crew'}
        </Text>
        <Text style={styles.body}>
          {festival ? `People you know on Afterglow, those going to ${festival.name} first. ` : 'People you know on Afterglow. '}They’ll get the invite in the app and can join with one tap.
        </Text>

        {!crew ? (
          <Text style={styles.body}>This crew isn’t one of yours any more.</Text>
        ) : people === undefined ? (
          <ActivityIndicator color={color.glow} style={{ marginTop: space.xl }} />
        ) : total === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No one to invite in the app yet</Text>
            <Text style={styles.body}>Follow your friends on Afterglow and they’ll show up here. Or send them a link.</Text>
            <Pressable onPress={() => router.push('/people')} accessibilityRole="button" style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}>
              <Text style={styles.ghostText}>Find people</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {total > 6 ? <SearchField value={query} onChange={setQuery} placeholder="Find a friend" label="Find a friend to invite" /> : null}
            {rows.length === 0 ? <Text style={styles.body}>No one you know matches “{query.trim()}”.</Text> : null}
            {rows.map((r) => (
              <View key={r.profile.uid} style={styles.row}>
                <StandingAvatar uid={r.profile.uid} name={r.profile.displayName} url={r.profile.avatarUrl} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {r.profile.displayName}
                  </Text>
                  <Text style={[styles.detail, r.going && { color: color.glow }]} numberOfLines={1}>
                    {r.going && festival ? `Going to ${festival.name}` : `@${r.profile.handle}`}
                  </Text>
                </View>
                {r.status === 'member' ? (
                  <Text style={styles.status}>In the crew</Text>
                ) : r.status === 'invited' ? (
                  <Text style={styles.status} accessibilityLabel={`${r.profile.displayName} is invited`}>
                    Invited ✓
                  </Text>
                ) : (
                  <Pressable
                    onPress={() => void invite(r)}
                    disabled={!!sending}
                    accessibilityRole="button"
                    accessibilityLabel={`Invite ${r.profile.displayName}`}
                    style={({ pressed }) => [styles.invite, pressed && styles.pressed]}
                  >
                    {sending === r.profile.uid ? <ActivityIndicator color={color.night} size="small" /> : <Text style={styles.inviteText}>Invite</Text>}
                  </Pressable>
                )}
              </View>
            ))}
          </>
        )}

        {crew ? (
          <Pressable onPress={() => void shareLink()} accessibilityRole="button" accessibilityLabel="Share a link instead" style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Share a link instead</Text>
              <Text style={styles.detail}>For friends who aren’t on Afterglow yet. Only share it with people you know: anyone with it can join.</Text>
            </View>
            <ChevronIcon color={color.moonFaint} size={12} />
          </Pressable>
        ) : null}
        {crew && crew.owner === me ? (
          <Pressable onPress={freshLink} accessibilityRole="button" accessibilityLabel="Make a new invite link" hitSlop={8}>
            <Text style={styles.detail}>Shared the link too widely? Make a new one; the old link stops working.</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  name: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  status: { ...type.label, color: color.moonDim },
  invite: { minWidth: 76, minHeight: 34, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: color.glow, alignItems: 'center', justifyContent: 'center' },
  inviteText: { ...type.label, color: color.night },
  empty: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  emptyTitle: { ...type.headline, color: color.moon },
  ghost: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  ghostText: { ...type.label, color: color.moon },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  pressed: { opacity: 0.8 },
});
