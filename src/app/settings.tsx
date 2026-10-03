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
import { haptic } from '../lib/haptics';
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
import { color, radius, space, type } from '../theme/tokens';
import { useToes } from '../features/toes/useToes';

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
  const { memories } = useMemories();
  const { reactions } = useReactions();
  const pool = useClipPool();
  const kept = yourClipCount(yourClips(pool.clips, reactions));
  const { followed } = useFollowedArtists();
  const followedCount = followed.filter((id) => catalog.artist(id)).length;
  const { state: music } = useMusic();
  const connected = (Object.keys(music) as (keyof typeof music)[]).map((p) => PROVIDER_NAME[p]).join(', ');
  const year = useToday().getFullYear();
  const yearCard = useYear(year);

  return (
    <View style={styles.root}>
      <PageTitle title="Settings" />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]}>
        <Text style={styles.title}>Settings</Text>

        {social.availability.ok ? (
          <Group title="Account">
            {me ? (
              <>
                <Row label="Edit profile" detail={`@${me.handle}`} onPress={() => router.push('/profile-edit')} />
                <Row label="Friends and crews" onPress={() => router.push('/friends')} />
                <Row label="Find people" onPress={() => router.push('/people')} />
                <Row label="Switch account" detail="Or hold the Profile tab" onPress={() => router.push('/switch-account')} />
              </>
            ) : (
              <Row
                label={social.user ? 'Finish your profile' : 'Create your profile'}
                detail={social.user ? undefined : 'Or sign in'}
                onPress={() => (social.user ? router.push('/profile-edit') : router.push('/account'))}
              />
            )}
          </Group>
        ) : null}

        <Group title="Yours">
          <Row label="Memories" detail={memories.length ? `${memories.length}, by festival` : 'Add your videos'} a11y={`Memories, ${memories.length}`} onPress={() => router.push('/memories')} />
          <Row label="Saved and liked clips" detail={String(kept)} a11y={`Your clips, ${kept}`} onPress={() => router.push('/saved')} />
          <Row
            label="Artists you follow"
            detail={followedCount ? String(followedCount) : 'Follow artists'}
            a11y={`Your artists, ${followedCount ? followedCount : 'none followed yet'}`}
            onPress={() => router.push('/your-artists')}
          />
          <Row label="Your sound" detail="Breakdown" onPress={() => router.push('/your-sound')} />
          {yearCard ? <Row label={`Your ${year}`} detail={yearCard.subtitle.endsWith('so far') ? 'So far' : 'Ready to share'} onPress={() => router.push({ pathname: '/year/[year]', params: { year: String(year) } })} /> : null}
        </Group>

        <Group title="Fun">
          <Row label="Quests" detail="Your glow level" a11y="Quests: today's quests, your streak and your glow level" onPress={() => router.push('/quests')} />
          <Row label="Secrets" detail={secretsLine(Object.keys(secrets.found).length)} onPress={() => router.push('/secrets')} />
        </Group>

        <Group title="Festival nights">
          <Row label="Look after yourself" detail="Private" a11y="Look after yourself: stopwatches, water, food and check-ins, private to you" onPress={() => router.push('/care')} />
          {modeFestival ? (
            <Row
              label={mode.active?.preview ? 'End festival mode test' : mode.active ? 'Leave festival mode' : 'Test festival mode'}
              detail={mode.active ? mode.active.festival.name : modeFestival.name}
              a11y={
                mode.active
                  ? `${mode.active.preview ? 'End the festival mode test' : 'Leave festival mode'}, ${mode.active.festival.name}`
                  : `Test festival mode with ${modeFestival.name}: see how the app looks on festival day`
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

        <Group title="Connections">
          <Row
            label="Music connections"
            detail={connected || 'Not connected'}
            a11y={`Music connections${connected ? `, ${connected}` : ', none connected'}`}
            onPress={() => router.push('/music')}
          />
        </Group>

        <Group title="About">
          <Row label="Contact support" detail={support.unseen ? `${support.unseen} new ${support.unseen === 1 ? 'reply' : 'replies'}` : undefined} onPress={() => router.push('/support')} />
          <Row label="Privacy" onPress={() => router.push(legalPath('privacy') as never)} />
          <Row label="Terms" onPress={() => router.push(legalPath('terms') as never)} />
          <Row label="Community guidelines" onPress={() => router.push(legalPath('guidelines') as never)} />
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
          <Text style={styles.version}>{toes ? `${VERSION_LINE} · made with ten toes` : VERSION_LINE}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
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
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 50,
    paddingHorizontal: space.lg,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  // The label always reads in full; the detail gives way (it's a hint, the label is the thing).
  rowLabel: { ...type.body, color: color.moon, flexShrink: 0, maxWidth: '72%' },
  rowDetail: { ...type.body, color: color.moonDim, flex: 1, textAlign: 'right' },
  version: { ...type.caption, color: color.moonFaint, textAlign: 'center', marginTop: space.xxl },
});
