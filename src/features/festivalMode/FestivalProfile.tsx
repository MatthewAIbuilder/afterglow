import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useProfileBackdrop } from '../profile/useProfileBackdrop';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { PersonAvatar } from '../../components/PersonAvatar';
import { ProfileCover } from '../../components/ProfileCover';
import { MenuIcon, PinIcon, QrIcon, ShareIcon, TilesIcon } from '../../components/TabIcons';
import { Tabs } from '../../components/Tabs';
import { WEB_URL } from '../../config/app';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { useCatalog } from '../../state/catalog';
import { useMoments } from '../memories/useMoments';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { VideosTab } from '../profile/ProfileTabsContent';
import { StandingAvatar, StandingCaption } from '../standing/StandingAvatar';
import { ringOf } from '../standing/standing';
import { useStanding } from '../standing/useStanding';
import { videoGrid } from '../profile/profileView';
import { BadgeCelebration } from '../profile/BadgeCelebration';
import { BadgesPanel, ClaimBanner } from '../profile/BadgesPanel';
import { useProfileBadges } from '../profile/useProfileBadges';
import { t } from '../../i18n';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { showEventId } from './showEvent';
import { Sprout } from '../sprouts/Sprout';
import { gardenLine } from '../sprouts/sprouts';
import { useSprouts } from '../../state/sprouts';

/**
 * Profile in festival mode: just you. Your photo, name and bio (still
 * editable), sharing your profile or your friend code, then Moments (the
 * videos you filmed here first; they live on this phone, so they're here
 * with no signal) and Badges (side quests first, since this is where
 * they're earned, then pins and milestones, with the unlock when you claim
 * one). `?tab=badges` opens on Badges (a side quest notification).
 */
export function FestivalProfile({ festival }: { festival: Festival }) {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { width } = useWindowDimensions();
  const social = useSocial();
  const me = social.profile;
  const standing = useStanding(me?.uid);
  const backdrop = useProfileBackdrop(me);
  const catalog = useCatalog();
  const { memories, uriOf } = useMoments();
  const all = useMemo(() => videoGrid(memories), [memories]);
  // From here: the festival, or the one-night show (videos tagged with it).
  const here = useMemo(() => all.filter((m) => m.festivalId === festival.id || (!!m.show?.showId && showEventId(m.show.showId) === festival.id)), [all, festival.id]);
  const shown = here.length ? here : all;
  const b = useProfileBadges();
  const { garden } = useSprouts();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'moments' | 'badges'>(params.tab === 'badges' ? 'badges' : 'moments');
  const [seenParam, setSeenParam] = useState(params.tab);
  if (params.tab !== seenParam) {
    setSeenParam(params.tab);
    if (params.tab === 'badges') setTab('badges');
  }
  const navigation = useNavigation();
  useEffect(() => {
    if (params.tab) navigation.setParams({ tab: undefined } as never);
  }, [params.tab, navigation]);

  const share = () => {
    if (!me) return;
    haptic.select();
    void shareMessage(t('@{handle} on Afterglow: {url}', { handle: me.handle, url: `${WEB_URL}/u/${me.handle}` }));
  };

  return (
    <View style={styles.root}>
      <PageTitle title={t('Profile')} />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: tabSpace + space.xl }} showsVerticalScrollIndicator={false}>
        <ProfileCover url={me?.coverUrl} backdrop={backdrop} height={insets.top + 190} />
        <View style={styles.bar}>
          <Text style={styles.at} numberOfLines={1}>
            {me ? `@${me.handle}` : t('Profile')}
          </Text>
          <GlassCircleButton label={t('Settings and more')} onPress={() => router.push('/settings')}>
            <MenuIcon color={color.moon} size={20} />
          </GlassCircleButton>
        </View>

        <View style={styles.hero}>
          {standing && ringOf(standing) ? (
            <StandingAvatar standing={standing} name={me?.displayName ?? t('You')} url={me?.avatarUrl} size={104} />
          ) : (
            <View style={styles.ring}>
              <PersonAvatar name={me?.displayName ?? t('You')} url={me?.avatarUrl} size={104} />
            </View>
          )}
          <Text style={styles.name} accessibilityRole="header">
            {me?.displayName ?? t('You')}
          </Text>
          <Text style={styles.where}>{t('At {festival}', { festival: festival.name })}</Text>
          <StandingCaption standing={standing} align="center" />
          {me?.bio ? <Text style={styles.bio}>{me.bio}</Text> : null}

          {me ? (
            <>
              <View style={styles.row}>
                <Button label={t('Edit profile')} onPress={() => router.push('/profile-edit')} />
                <Button label={t('Share profile')} icon={<ShareIcon color={color.moon} size={15} />} onPress={share} />
              </View>
              {/* Your garden (sprouts, collectibles and the gifts you were given; giving one is inside), still a tap away at the festival. */}
              <View style={styles.rowTight}>
                <Button
                  label={t('My garden')}
                  a11y={t('My garden: {what}. Your sprouts, collectibles and gifts', { what: gardenLine(garden.filter((g) => !g.artist)) })}
                  icon={<Sprout kind="seedling" stage={3} size={22} still />}
                  onPress={() => router.push('/garden')}
                />
              </View>
              <Pressable
                onPress={() => {
                  haptic.tap();
                  router.push('/my-code');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Show my friend code, so friends here can add you')}
                style={({ pressed }) => [styles.code, pressed && styles.pressed]}
              >
                <QrIcon color={color.night} size={20} />
                <Text style={styles.codeText}>{t('My friend code')}</Text>
              </Pressable>
            </>
          ) : social.availability.ok && social.ready ? (
            <Pressable
              onPress={() => router.push(social.user ? '/profile-edit' : '/account')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.code, pressed && styles.pressed]}
            >
              <Text style={styles.codeText}>{social.user ? t('Finish your profile') : t('Create your profile')}</Text>
            </Pressable>
          ) : null}
        </View>

        <ClaimBanner b={b} />
        <View style={styles.tabs}>
          <Tabs<'moments' | 'badges'>
            value={tab}
            onChange={setTab}
            items={[
              { key: 'moments', label: t('Moments'), count: all.length, icon: (c) => <TilesIcon color={c} size={16} /> },
              { key: 'badges', label: t('Badges'), count: b.earned, icon: (c) => <PinIcon color={c} size={17} /> },
            ]}
          />
        </View>
        {tab === 'badges' ? (
          <BadgesPanel b={b} uid={me?.uid} width={width} questsFirst />
        ) : (
          <>
            <View style={styles.videosHead}>
              <Text style={styles.section}>{here.length ? t('Your videos from {festival}', { festival: festival.name }) : t('Your videos')}</Text>
              {all.length ? (
                <Pressable onPress={() => router.push('/memories')} accessibilityRole="button" accessibilityLabel={t('All your videos, by festival')} hitSlop={8}>
                  <Text style={styles.link}>{t('All ›')}</Text>
                </Pressable>
              ) : null}
            </View>
            <VideosTab memories={shown} width={width} uriOf={uriOf} lookup={catalog} filters={false} />
            {Platform.OS !== 'web' && all.length ? <Text style={styles.note}>{t('Your videos are on this phone, so they’re here without signal.')}</Text> : null}
          </>
        )}
      </ScrollView>
      <BadgeCelebration unlock={b.unlock} onDone={b.finishUnlock} />
    </View>
  );
}

function Button({ label, onPress, icon, a11y }: { label: string; onPress: () => void; icon?: React.ReactNode; a11y?: string }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  bar: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.xl, paddingRight: space.md },
  at: { ...type.headline, color: color.moonDim, flex: 1 },
  hero: { alignItems: 'center', paddingHorizontal: space.xl, marginTop: space.md, gap: space.xs },
  ring: { padding: 4, borderRadius: 60, borderWidth: 2, borderColor: '#FF7EB6' },
  name: { ...type.largeTitle, color: color.moon, marginTop: space.md, textAlign: 'center' },
  where: { ...type.label, color: '#FF7EB6' },
  bio: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.xs },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, alignSelf: 'stretch' },
  rowTight: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, alignSelf: 'stretch' },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  buttonText: { ...type.headline, color: color.moon },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    alignSelf: 'stretch',
    minHeight: 52,
    marginTop: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glow,
  },
  codeText: { ...type.headline, color: color.night },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  tabs: { marginTop: space.xl },
  videosHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, marginTop: space.lg, marginBottom: space.sm },
  section: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  link: { ...type.label, color: color.glow },
  note: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.md, paddingHorizontal: space.xl },
});
