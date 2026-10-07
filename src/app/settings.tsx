import { router } from 'expo-router';
import { Children, type ReactNode, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageTitle } from '../components/PageTitle';
import { ChevronIcon } from '../components/TabIcons';
import { yourClipCount, yourClips } from '../features/discover/saved';
import { legalPath } from '../features/legal/documents';
import { PROVIDER_NAME } from '../features/music/models';
import { useYear } from '../features/recap/useRecap';
import { showActionSheet, showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { reloadApp } from '../lib/reload';

import { useToday } from '../lib/useToday';
import { VERSION_LINE } from '../lib/version';
import { secretsLine, tapStep } from '../features/secrets/secrets';
import { revealSecret, useSecrets } from '../state/secrets';
import { useCatalog } from '../state/catalog';
import { useFestivalMode } from '../state/festivalMode';
import { useGoing } from '../state/going';
import { testFestival } from '../features/festivalMode/mode';
import { useClipPool } from '../state/community';
import { useFollowedArtists } from '../state/followedArtists';
import { useMemories } from '../state/memories';
import { useMusic } from '../state/music';
import { useReactions } from '../state/reactions';
import { useMySupport } from '../state/supportSeen';
import { useSocial } from '../state/social';
import { useMyOrg, useOrgs } from '../state/orgs';
import { useSprouts } from '../state/sprouts';
import { color, radius, space, THEME_ID, type } from '../theme/tokens';
import { useProfileBackdrop } from '../features/profile/useProfileBackdrop';
import { useToes } from '../features/toes/useToes';
import { themeOf } from '../features/themes/themes';
import { backdropOf } from '../features/profile/backdrops';
import { LANGUAGE, LANGUAGE_CHOICE, LANGUAGES, t, tn, type LanguageChoice } from '../i18n';
import { writeStoredLanguage } from '../i18n/storedLanguage';

/**
 * Settings and more, from the menu on Profile: your account, the lists
 * behind your profile, music connections, and the legal pages. Grouped like
 * iOS settings, so the profile itself stays a profile.
 */
export default function SettingsScreen() {
  const toes = useToes();
  const secrets = useSecrets();
  const versionTaps = useRef<number[]>([]);
  // Replies from support you haven't seen yet.
  const support = useMySupport();
  const mode = useFestivalMode();
  const { going } = useGoing();
  const modeToday = useToday();
  const modeFestival = testFestival(useCatalog().festivals, going, modeToday);
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const social = useSocial();
  const me = social.profile;
  const myOrg = useMyOrg(social.user?.uid);
  const orgs = useOrgs();
  const shownBackdrop = useProfileBackdrop(me);
  const { memories } = useMemories();
  const { reactions } = useReactions();
  const pool = useClipPool();
  const kept = yourClipCount(yourClips(pool.clips, reactions));
  const gardenCount = useSprouts().garden.length;
  const { followed } = useFollowedArtists();
  const followedCount = followed.filter((id) => catalog.artist(id)).length;
  const { state: music } = useMusic();
  const connected = (Object.keys(music) as (keyof typeof music)[]).filter((p) => music[p]?.connected).map((p) => PROVIDER_NAME[p]).join(', ');
  const year = useToday().getFullYear();
  const yearCard = useYear(year);

  return (
    <View style={styles.root}>
      <PageTitle title={t('Settings')} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.title}>{t('Settings')}</Text>

        {social.availability.ok ? (
          <Group title={t('Account')}>
            {/* An event organizer's account: its studio, first. */}
            {myOrg ? <Row label={t('Organizer studio')} detail={orgs.find((o) => o.id === myOrg)?.name} onPress={() => router.push('/studio')} /> : null}
            {me ? (
              <>
                <Row label={t('Edit profile')} detail={`@${me.handle}`} onPress={() => router.push('/profile-edit')} />
                <Row label={t('Friends and crews')} onPress={() => router.push('/friends')} />
                <Row label={t('Find people')} onPress={() => router.push('/people')} />
                <Row label={t('Switch account')} detail={t('Or hold the Profile tab')} onPress={() => router.push('/switch-account')} />
              </>
            ) : (
              <Row
                label={social.user ? t('Finish your profile') : t('Create your profile')}
                detail={social.user ? undefined : t('Or sign in')}
                onPress={() => (social.user ? router.push('/profile-edit') : router.push('/account'))}
              />
            )}
          </Group>
        ) : null}

        <Group title={t('Yours')}>
          <Row label={t('Memories')} detail={memories.length ? t('{n}, by festival', { n: memories.length }) : t('Add your videos')} a11y={t('Memories, {n}', { n: memories.length })} onPress={() => router.push('/memories')} />
          <Row label={t('Saved and liked clips')} detail={String(kept)} a11y={t('Your clips, {n}', { n: kept })} onPress={() => router.push('/saved')} />
          <Row label={t('Your garden')} detail={String(gardenCount)} a11y={tn(gardenCount, 'Your garden, {n} sprout', 'Your garden, {n} sprouts')} onPress={() => router.push('/garden')} />
          <Row
            label={t('Artists you follow')}
            detail={followedCount ? String(followedCount) : t('Follow artists')}
            a11y={followedCount ? t('Your artists, {n}', { n: followedCount }) : t('Your artists, none followed yet')}
            onPress={() => router.push('/your-artists')}
          />
          <Row label={t('Your sound')} detail={t('Breakdown')} onPress={() => router.push('/your-sound')} />
          {yearCard ? <Row label={t('Your {year}', { year })} detail={yearCard.subtitle === t('Your festival year so far') ? t('So far') : t('Ready to share')} onPress={() => router.push({ pathname: '/year/[year]', params: { year: String(year) } })} /> : null}
        </Group>

        <Group title={t('Look')}>
          <Row label={t('App theme')} detail={themeOf(THEME_ID).name} a11y={t('App theme: {theme}. Change the colours of the whole app', { theme: themeOf(THEME_ID).name })} onPress={() => router.push('/themes')} />
          {me ? <Row label={t('Profile background')} detail={backdropOf(shownBackdrop)?.name ?? t('Cover photo')} onPress={() => router.push('/backdrop')} /> : null}
          <Row label={t('Language')} detail={languageDetail()} a11y={t('Language: {language}. Change the language of the app', { language: languageDetail() })} onPress={chooseLanguage} />
        </Group>

        <Group title={t('Fun')}>
          <Row label={t('Quests')} detail={t('Your glow level')} a11y={t("Quests: today's quests, your streak and your glow level")} onPress={() => router.push('/quests')} />
          <Row label={t('Secrets')} detail={secretsLine(Object.keys(secrets.found).length)} onPress={() => router.push('/secrets')} />
        </Group>

        <Group title={t('Festival nights')}>
          <Row label={t('Look after yourself')} detail={t('Private')} a11y={t('Look after yourself: stopwatches, water, food and check-ins, private to you')} onPress={() => router.push('/care')} />
          {modeFestival ? (
            <Row
              label={mode.active?.preview ? t('End festival mode test') : mode.active ? t('Leave festival mode') : t('Test festival mode')}
              detail={mode.active ? mode.active.festival.name : modeFestival.name}
              a11y={
                mode.active
                  ? mode.active.preview
                    ? t('End the festival mode test, {festival}', { festival: mode.active.festival.name })
                    : t('Leave festival mode, {festival}', { festival: mode.active.festival.name })
                  : t('Test festival mode with {festival}: see how the app looks on festival day', { festival: modeFestival.name })
              }
              onPress={() => {
                if (mode.active) mode.leave();
                else {
                  mode.preview(modeFestival.id);
                  router.dismissTo('/');
                }
              }}
            />
          ) : null}
        </Group>

        <Group title={t('Connections')}>
          <Row
            label={t('Music connections')}
            detail={connected || t('Not connected')}
            a11y={connected ? t('Music connections, {services}', { services: connected }) : t('Music connections, none connected')}
            onPress={() => router.push('/music')}
          />
        </Group>

        <Group title={t('About')}>
          <Row label={t('Contact support')} detail={support.unseen ? tn(support.unseen, '{n} new reply', '{n} new replies') : undefined} onPress={() => router.push('/support')} />
          <Row label={t('Privacy')} onPress={() => router.push(legalPath('privacy') as never)} />
          <Row label={t('Terms')} onPress={() => router.push(legalPath('terms') as never)} />
          <Row label={t('Community guidelines')} onPress={() => router.push(legalPath('guidelines') as never)} />
        </Group>
        {/* A secret: tap the small print seven times. */}
        <Pressable
          onPress={() => {
            const step = tapStep(versionTaps.current, Date.now());
            versionTaps.current = step.taps;
            if (step.done) revealSecret('smallprint');
            else if (step.taps.length >= 4) haptic.select();
          }}
          accessibilityRole="text"
          accessibilityLabel={VERSION_LINE}
        >
          <Text style={styles.version}>{toes ? `${VERSION_LINE} · ${t('made with ten toes')}` : VERSION_LINE}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** What the Language row says: the language in use, and whether it follows the phone. */
function languageDetail(): string {
  const name = LANGUAGES.find((l) => l.id === LANGUAGE)?.name ?? '';
  return LANGUAGE_CHOICE === 'device' ? t('{language} (from your phone)', { language: name }) : name;
}

/** Pick a language (or go back to the phone's), then start the app again in it, like a new theme. */
function chooseLanguage() {
  const choices: LanguageChoice[] = ['device', ...LANGUAGES.map((l) => l.id)];
  const labels = [t('Same as my phone'), ...LANGUAGES.map((l) => l.name)];
  showActionSheet({ title: t('Language'), options: [...labels, t('Cancel')], cancelButtonIndex: labels.length }, (i) => {
    const picked = choices[i];
    if (!picked || picked === LANGUAGE_CHOICE) return;
    if (!writeStoredLanguage(picked)) {
      showAlert(t('Couldn’t change the language'), t('Try again in a moment.'));
      return;
    }
    haptic.settle();
    void reloadApp('A new language');

  });
}

function Group({
 title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.card}>
        {Children.toArray(children).map((child, i, all) => (
          <View key={i} style={i < all.length - 1 && styles.divider}>
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

function Row({ label, detail, a11y, onPress }: { label: string; detail?: string; a11y?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? (detail ? `${label}, ${detail}` : label)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}
    >
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      {detail ? (
        <Text style={styles.rowDetail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640 },
  title: { ...type.largeTitle, color: color.moon, marginBottom: space.md },
  group: { marginTop: space.xl },
  groupTitle: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.sm, marginLeft: space.xs },
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 50,
    paddingHorizontal: space.lg,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  // The label always reads in full; the detail gives way (it's a hint, the label is the thing).
  rowLabel: { ...type.body, color: color.moon, flexShrink: 0, maxWidth: '86%' },
  rowDetail: { ...type.body, color: color.moonDim, flex: 1, textAlign: 'right' },
  version: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.xxl },
});
