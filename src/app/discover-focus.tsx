import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckIcon, ChevronIcon, ProfileIcon } from '../components/TabIcons';
import { SOUND_LABEL } from '../data/models';
import { focusChoices, FOLLOWING, isWide, MIX, soundChoices, soundFocus, TONIGHT, type FocusChoice } from '../features/discover/focus';
import { tonightClips } from '../features/tonight/tonight';
import { useTonight } from '../features/tonight/useTonight';
import { PlayIcon } from '../features/discover/icons';
import { countdown } from '../features/festivals/when';
import { haptic } from '../lib/haptics';
import { useToday } from '../lib/useToday';
import { useAutoplay } from '../state/autoplay';
import { useCatalog } from '../state/catalog';
import { useCommunity } from '../state/community';
import { useGoing } from '../state/going';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';
import { goBack } from '../lib/nav';
import { SheetClose } from '../components/SheetClose';

/**
 * What Discover shows: your mix (a bit of everything), one sound from every
 * lineup, or one festival's lineup. Festivals you're going to come first; others appear only when
 * they have clips to watch. A sheet over Discover.
 */
export default function DiscoverFocusScreen() {
  const { current } = useLocalSearchParams<{ current?: string }>();
  const catalog = useCatalog();
  const { going } = useGoing();
  const today = useToday();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const community = useCommunity();
  const autoplay = useAutoplay();
  const choices = focusChoices(catalog.festivals, catalog.clips, going, today);
  const currentFestival = current && !isWide(current) ? catalog.festival(current) : undefined;
  // One sound from every lineup, for the sounds with enough clips.
  const sounds = soundChoices(catalog.clips, catalog.artist);
  // A festival you're going to is on: preview who plays tonight, in set order.
  const tonight = useTonight();
  const tonightSets = tonight ? new Set(tonightClips(tonight.festival, catalog.clips, tonight.night).map((c) => c.artistId)).size : 0;

  const pick = (focus: string) => {
    haptic.select();
    router.dismissTo({ pathname: '/', params: { festival: focus } });
  };

  const row = (key: string, title: string, detail: string, selected: boolean, onPress?: () => void, icon?: React.ReactNode) => (
    <Pressable
      key={key}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}`}
      accessibilityState={{ selected, disabled: !onPress }}
      style={({ pressed }) => [styles.row, selected && styles.selected, !onPress && styles.muted, pressed && styles.pressed]}
    >
      {icon}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {selected ? <CheckIcon color={color.glow} size={18} /> : null}
    </Pressable>
  );

  const festivalRow = ({ festival, clips }: FocusChoice) => {
    const when = countdown(festival, today) ?? festival.dates;
    const detail = clips > 0 ? `${clips} ${clips === 1 ? 'clip' : 'clips'} · ${when}` : `No clips yet · ${when}`;
    return row(festival.id, festival.name, detail, current === festival.id, clips > 0 ? () => pick(festival.id) : undefined);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.title}>What to discover</Text>
        <Text style={styles.body}>Focus on a festival to shape your plan for it, or mix it up.</Text>

        <View style={styles.list}>
          {tonight && tonightSets > 0
            ? row(
                TONIGHT,
                'Tonight',
                `${tonight.night ? `${tonight.night} at ` : ''}${tonight.festival.name} · ${tonightSets} ${tonightSets === 1 ? 'artist' : 'artists'}, in set order`,
                current === TONIGHT,
                () => pick(TONIGHT),
                <View style={[styles.mixIcon, styles.tonightIcon]}>
                  <PlayIcon color={color.night} size={14} />
                </View>,
              )
            : null}
          {row(MIX, 'Your mix', 'A bit of everything, from every lineup', current === MIX, () => pick(MIX), (
            <View style={styles.mixIcon}>
              <PlayIcon color={color.moon} size={14} />
            </View>
          ))}
          {social.availability.ok &&
            row(
              FOLLOWING,
              'Following',
              !social.user
                ? 'Sign in to follow people and see their videos'
                : social.following.size
                  ? `Videos from the ${social.following.size === 1 ? 'person' : `${social.following.size} people`} you follow`
                  : 'Follow people to see their videos here',
              current === FOLLOWING,
              () => pick(FOLLOWING),
              <View style={styles.mixIcon}>
                <ProfileIcon color={color.moon} size={15} />
              </View>,
            )}
        </View>

        {sounds.length > 1 && (
          <>
            <Text style={styles.section}>By sound</Text>
            <View style={styles.sounds}>
              {sounds.map(({ tag, clips }) => {
                const on = current === soundFocus(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => pick(soundFocus(tag))}
                    accessibilityRole="button"
                    accessibilityLabel={`${SOUND_LABEL[tag]}, ${clips} clips from every lineup`}
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.sound, on && styles.soundOn, pressed && styles.pressed]}
                  >
                    <Text style={[styles.soundText, on && { color: color.moon }]}>{SOUND_LABEL[tag]}</Text>
                    <Text style={styles.soundCount}>{clips}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {choices.going.length > 0 && (
          <>
            <Text style={styles.section}>Going</Text>
            <View style={styles.list}>{choices.going.map(festivalRow)}</View>
          </>
        )}
        {choices.others.length > 0 && (
          <>
            <Text style={styles.section}>{choices.going.length ? 'More festivals' : 'Festivals'}</Text>
            <View style={styles.list}>{choices.others.map(festivalRow)}</View>
          </>
        )}
        {choices.going.length === 0 && (
          <Text style={styles.hint}>Mark the festivals you’re going to on the Festivals tab and they’ll show up first.</Text>
        )}

        {social.availability.ok && (
          <View style={styles.switchRow}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Videos from the crowd</Text>
              <Text style={styles.switchDetail}>
                {!social.user
                  ? 'Sign in on your profile to see videos people shared from the festival.'
                  : community.enabled
                    ? 'Videos people shared from the festival, beside the official clips.'
                    : 'Only official clips.'}
              </Text>
            </View>
            <Switch
              value={community.enabled}
              onValueChange={(v) => {
                haptic.select();
                community.setEnabled(v);
              }}
              trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }}
              accessibilityLabel="Videos from the crowd"
              testID="community-switch"
            />
          </View>
        )}

        <View style={styles.switchRow}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Play the next clip</Text>
            <Text style={styles.switchDetail}>
              {autoplay.enabled ? 'When you’ve watched a clip to the end, the next one starts after a short countdown.' : 'Clips loop until you swipe.'}
            </Text>
          </View>
          <Switch
            value={autoplay.enabled}
            onValueChange={(v) => {
              haptic.select();
              autoplay.setEnabled(v);
            }}
            trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }}
            accessibilityLabel="Play the next clip"
            testID="autoplay-switch"
          />
        </View>

        {currentFestival && (
          <Pressable
            onPress={() => {
              haptic.select();
              goBack();
              router.push(`/festival/${currentFestival.id}`);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open ${currentFestival.name}, its lineup and your plan`}
            style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.linkText}>Open {currentFestival.name}</Text>
            <ChevronIcon color={color.moonDim} size={12} />
          </Pressable>
        )}
      </ScrollView>
      <SheetClose />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.nightRaised },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.xs },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.xl },
  list: { gap: space.sm, marginTop: space.md },
  sounds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  sound: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  soundOn: { backgroundColor: 'rgba(169,124,255,0.22)', borderColor: 'rgba(169,124,255,0.45)' },
  soundText: { ...type.label, color: color.moonDim },
  soundCount: { ...type.caption, color: color.moonFaint, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  selected: { backgroundColor: 'rgba(169,124,255,0.16)', borderColor: 'rgba(169,124,255,0.45)' },
  muted: { opacity: 0.45 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  rowText: { flex: 1 },
  rowTitle: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2, fontVariant: ['tabular-nums'] },
  tonightIcon: { backgroundColor: color.glow },
  mixIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glowDeep,
  },
  hint: { ...type.caption, color: color.moonFaint, marginTop: space.lg },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xl,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  switchDetail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: space.xl, padding: space.sm },
  linkText: { ...type.label, color: color.moonDim },
});
