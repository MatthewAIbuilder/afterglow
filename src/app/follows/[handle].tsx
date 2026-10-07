import { useLocalSearchParams } from 'expo-router';
import { useOrgs } from '../../state/orgs';
import { orgOfAccount } from '../../features/organizers/organizers';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterChips } from '../../components/FilterChips';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon } from '../../components/TabIcons';
import type { Profile } from '../../features/social/models';
import { PersonRow } from '../../features/social/PersonRow';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../../features/social/service';
import { useSocial } from '../../state/social';
import { color, space, type } from '../../theme/tokens';
import { goBack } from '../../lib/nav';
import { t } from '../../i18n';

type List = 'followers' | 'following';
/** Lists show the newest this many. */
const LIST_MAX = 100;

/** Who follows someone, and who they follow, newest first, with Follow beside each. People you blocked don't show. */
export default function FollowsScreen() {
  const params = useLocalSearchParams<{ handle: string; list?: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const [list, setList] = useState<List>(params.list === 'following' ? 'following' : 'followers');
  const [owner, setOwner] = useState<Profile | null | undefined>();
  // Answers are kept with the list they answer, so switching never shows the other list's people.
  const [answer, setAnswer] = useState<{ list: List; people?: Profile[]; problem?: string }>();

  const signedIn = !!social.user;
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    social.service
      .profileByHandle(params.handle ?? '')
      .then((p) => live && setOwner(p))
      .catch(() => live && setOwner(null));
    return () => {
      live = false;
    };
  }, [params.handle, signedIn, social.service]);

  // An event organizer's lists are only its own to see.
  const orgs = useOrgs();
  const hidden = !!owner && owner.uid !== social.user?.uid && !!orgOfAccount(orgs, owner.uid);
  useEffect(() => {
    if (!owner || hidden) return;
    let live = true;
    (async () => {
      try {
        const uids = await (list === 'followers' ? social.service.followers(owner.uid, LIST_MAX) : social.service.following(owner.uid, LIST_MAX));
        const people = (await Promise.all(uids.map((u) => social.service.profileOf(u).catch(() => null)))).filter((p): p is Profile => !!p);
        if (live) setAnswer({ list, people });
      } catch (e) {
        if (live) setAnswer({ list, problem: SOCIAL_ERROR_COPY[socialErrorKind(e)] });
      }
    })();
    return () => {
      live = false;
    };
  }, [owner, list, social.service, hidden]);

  const current = answer?.list === list ? answer : undefined;
  const shown = (current?.people ?? []).filter((p) => !social.blocked.has(p.uid));
  const mine = !!owner && owner.uid === social.user?.uid;
  const empty =
    list === 'followers'
      ? mine
        ? t('No followers yet. Share memories to your profile and people who like your videos can follow you.')
        : t('No one follows @{handle} yet.', { handle: String(owner?.handle) })
      : mine
        ? t('You’re not following anyone yet. Tap Follow on someone’s profile to see their videos in Discover.')
        : t('@{handle} isn’t following anyone yet.', { handle: String(owner?.handle) });

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, gap: space.md }}>
        <View style={styles.pad}>
          <Text style={styles.title} accessibilityRole="header">
            {owner ? `@${owner.handle}` : t('People')}
          </Text>
        </View>
        <FilterChips
          chips={[
            { key: 'followers', label: t('Followers'), accessibilityLabel: t('Followers') },
            { key: 'following', label: t('Following'), accessibilityLabel: t('Following') },
          ]}
          value={list}
          onChange={(k) => setList(k === 'following' ? 'following' : 'followers')}
        />
        <View style={[styles.pad, styles.list]}>
          {!social.availability.ok || !signedIn ? (
            <Text style={styles.quiet}>{social.availability.ok ? t('Sign in to see who follows whom.') : SOCIAL_ERROR_COPY.unavailable}</Text>
          ) : owner === null ? (
            <Text style={styles.quiet}>{t('No one is called @{handle} on Afterglow.', { handle: params.handle ?? '' })}</Text>
          ) : hidden ? (
            <Text style={styles.quiet}>{t('@{handle} keeps who follows them private.', { handle: String(owner?.handle) })}</Text>
          ) : current?.problem ? (
            <Text style={styles.quiet}>{current.problem}</Text>
          ) : !current ? (
            <ActivityIndicator color={color.glow} />
          ) : shown.length ? (
            shown.map((p) => <PersonRow key={p.uid} profile={p} follow />)
          ) : (
            <Text style={styles.quiet}>{empty}</Text>
          )}
        </View>
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label={t('Back')} onPress={() => goBack()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  pad: { paddingHorizontal: space.xl },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  list: { gap: space.xs },
  quiet: { ...type.body, color: color.moonDim },
});
