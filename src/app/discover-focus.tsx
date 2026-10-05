import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { CheckIcon, ChevronIcon, ProfileIcon } from '../components/TabIcons';
import { SOUND_LABEL } from '../data/models';
import { focusChoices, FOLLOWING, isWide, MIX, soundChoices, soundFocus, TONIGHT } from '../features/discover/focus';
import { tonightClips } from '../features/tonight/tonight';
import { useTonight } from '../features/tonight/useTonight';
import { PlayIcon } from '../features/discover/icons';
import { countdown } from '../features/festivals/when';
import { coverPhotos } from '../features/festivals/cover';
import { FestivalCover } from '../features/festivals/FestivalCover';
import { SOUND_COLOR } from '../features/sound-map/colors';
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
 * What Discover shows, a sheet over Discover: Tonight (on a festival night)
 * and Your mix and Following as big tiles; one sound from every lineup as
 * chips in each sound's colour; festivals with clips as cards with their
 * headliners' faces (going ones first, marked Going); festivals you're going
 * to with no clips yet in a quiet "Clips on the way" list; then the two
 * playing switches in one group.
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

  const followingDetail = !social.user
    ? 'Sign in to follow people'
    : social.following.size
      ? `${social.following.size} ${social.following.size === 1 ? 'person' : 'people'} you follow`
      : 'Follow people to see their videos';
  // A few of the faces your mix draws from, for its tile.
  const mixFaces = [...new Set(catalog.clips.map((c) => c.artistId))]
    .map((id) => catalog.artist(id))
    .filter((a): a is NonNullable<typeof a> => !!a?.imageUrl)
    .slice(0, 3);
  const festivals = [...choices.going.map((c) => ({ ...c, going: true })), ...choices.others.map((c) => ({ ...c, going: false }))];
  const watchable = festivals.filter((f) => f.clips > 0);
  const waiting = festivals.filter((f) => f.clips === 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.title}>What to discover</Text>
        <Text style={styles.body}>Everything at once, one sound, or one festival’s lineup.</Text>

        {tonight && tonightSets > 0 ? (
          <Tile
            title="Tonight"
            detail={`${tonight.night ? `${tonight.night} at ` : ''}${tonight.festival.name} · ${tonightSets} ${tonightSets === 1 ? 'artist' : 'artists'}, in set order`}
            selected={current === TONIGHT}
            onPress={() => pick(TONIGHT)}
            wide
            art={
              <View style={[styles.badge, { backgroundColor: color.glow }]}>
                <PlayIcon color={color.night} size={14} />
              </View>
            }
          />
        ) : null}

        <View style={styles.tiles}>
          <Tile
            title="Your mix"
            detail="A bit of everything, from every lineup"
            selected={current === MIX}
            onPress={() => pick(MIX)}
            art={
              mixFaces.length ? (
                <View style={styles.faces}>
                  {mixFaces.map((a, i) => (
                    <View key={a.id} style={[styles.face, { marginLeft: i ? -12 : 0, zIndex: 3 - i }]}>
                      <ArtistAvatar artist={a} size={36} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.badge}>
                  <PlayIcon color={color.moon} size={14} />
                </View>
              )
            }
          />
          {social.availability.ok ? (
            <Tile
              title="Following"
              detail={followingDetail}
              label={`Following, ${!social.user ? 'Sign in to follow people and see their videos' : social.following.size ? `Videos from the ${social.following.size === 1 ? 'person' : `${social.following.size} people`} you follow` : 'Follow people to see their videos here'}`}
              selected={current === FOLLOWING}
              onPress={() => pick(FOLLOWING)}
              art={
                <View style={styles.badge}>
                  <ProfileIcon color={color.moon} size={16} />
                </View>
              }
            />
          ) : null}
        </View>

        {sounds.length > 1 && (
          <>
            <Text style={styles.section}>By sound</Text>
            <View style={styles.sounds}>
              {sounds.map(({ tag, clips }) => {
                const on = current === soundFocus(tag);
                const hue = SOUND_COLOR[tag];
                return (
                  <Pressable
                    key={tag}
                    onPress={() => pick(soundFocus(tag))}
                    accessibilityRole="button"
                    accessibilityLabel={`${SOUND_LABEL[tag]}, ${clips} clips from every lineup`}
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.sound, on && { backgroundColor: `${hue}2E`, borderColor: `${hue}99` }, pressed && styles.pressed]}
                  >
                    <View style={[styles.soundDot, { backgroundColor: hue, shadowColor: hue }]} />
                    <Text style={[styles.soundText, on && { color: color.moon }]}>{SOUND_LABEL[tag]}</Text>
                    <Text style={styles.soundCount}>{clips}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {watchable.length > 0 && (
          <>
            <Text style={styles.section}>Festivals</Text>
            <View style={styles.list}>
              {watchable.map(({ festival, clips, going }) => {
                const when = countdown(festival, today) ?? festival.dates;
                const detail = `${clips} ${clips === 1 ? 'clip' : 'clips'} · ${when}`;
                const selected = current === festival.id;
                const cover = coverPhotos(festival, catalog.artist, 4);
                return (
                  <Pressable
                    key={festival.id}
                    onPress={() => pick(festival.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${festival.name}, ${detail}${going ? ', going' : ''}`}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [styles.festival, selected && styles.selected, pressed && styles.pressed]}
                  >
                    <FestivalCover photos={cover} style={StyleSheet.absoluteFill} />
                    {cover.length ? <LinearGradient colors={['rgba(10,9,24,0.88)', 'rgba(10,9,24,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
                    <View style={styles.rowText}>
                      <Text style={styles.festivalName} numberOfLines={1}>
                        {festival.name}
                      </Text>
                      <Text style={styles.detail} numberOfLines={1}>
                        {detail}
                      </Text>
                    </View>
                    {going ? (
                      <View style={styles.going}>
                        <Text style={styles.goingText}>Going</Text>
                      </View>
                    ) : null}
                    {selected ? <CheckIcon color={color.glow} size={18} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {waiting.length > 0 && (
          <View style={styles.waiting}>
            <Text style={styles.waitingTitle}>Clips on the way</Text>
            {waiting.map(({ festival }) => (
              <View
                key={festival.id}
                style={styles.waitingRow}
                accessible
                accessibilityLabel={`${festival.name}, No clips yet · ${countdown(festival, today) ?? festival.dates}`}
                accessibilityState={{ disabled: true }}
              >
                <Text style={styles.waitingName} numberOfLines={1}>
                  {festival.name}
                </Text>
                <Text style={styles.waitingWhen}>{countdown(festival, today) ?? festival.dates}</Text>
              </View>
            ))}
            <Text style={styles.waitingNote}>New live sets are found every night.</Text>
          </View>
        )}
        {choices.going.length === 0 && (
          <Text style={styles.hint}>Mark the festivals you’re going to on the Festivals tab and they’ll show up first.</Text>
        )}

        <Text style={styles.section}>Playing</Text>
        <View style={styles.group}>
          {social.availability.ok && (
            <>
              <View style={styles.switchRow}>
                <View style={styles.rowText}>
                  <Text style={styles.switchTitle}>Videos from the crowd</Text>
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
                  thumbColor={color.moon}
                  accessibilityLabel="Videos from the crowd"
                  testID="community-switch"
                />
              </View>
              <View style={styles.separator} />
            </>
          )}
          <View style={styles.switchRow}>
            <View style={styles.rowText}>
              <Text style={styles.switchTitle}>Play the next clip</Text>
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
                  thumbColor={color.moon}
              accessibilityLabel="Play the next clip"
              testID="autoplay-switch"
            />
          </View>
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

/** A big choice at the top: art, then its name and a line under it; glows when it's what's playing. */
function Tile({ title, detail, label, selected, onPress, art, wide }: { title: string; detail: string; label?: string; selected: boolean; onPress: () => void; art: React.ReactNode; wide?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? `${title}, ${detail}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.tile, wide ? styles.tileWide : styles.tileHalf, selected && styles.tileOn, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={selected ? ['rgba(107,63,224,0.55)', 'rgba(58,35,128,0.18)'] : ['rgba(107,63,224,0.22)', 'rgba(255,255,255,0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tileTop}>
        {art}
        {selected ? (
          <View style={styles.check}>
            <CheckIcon color={color.night} size={12} />
          </View>
        ) : null}
      </View>
      <View style={wide ? styles.rowText : undefined}>
        <Text style={styles.tileTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.tileDetail, !wide && styles.tileDetailHalf]} numberOfLines={2}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.nightRaised },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.xs },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.xl, marginBottom: space.md },
  list: { gap: space.sm },
  tiles: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  tile: {
    padding: space.lg,
    justifyContent: 'space-between',
    gap: space.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  tileHalf: { flex: 1, minHeight: 132 },
  tileWide: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg },
  tileOn: { borderColor: 'rgba(169,124,255,0.75)', borderWidth: 1.5, shadowColor: color.glow, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tileTitle: { ...type.headline, color: color.moon },
  tileDetail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  tileDetailHalf: { minHeight: 30 },
  check: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glow },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 20, borderWidth: 2, borderColor: color.nightRaised },
  badge: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glowDeep },
  sounds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sound: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  soundDot: { width: 8, height: 8, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  soundText: { ...type.label, color: color.moonDim },
  soundCount: { ...type.caption, color: color.moonFaint, fontVariant: ['tabular-nums'] },
  festival: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 76,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  festivalName: { ...type.headline, color: color.moon },
  selected: { borderColor: 'rgba(169,124,255,0.75)', borderWidth: 1.5 },
  going: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(169,124,255,0.22)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(169,124,255,0.5)' },
  goingText: { ...type.caption, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  rowText: { flex: 1 },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2, fontVariant: ['tabular-nums'] },
  waiting: { marginTop: space.lg, padding: space.lg, gap: space.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderStyle: 'dashed' },
  waitingTitle: { ...type.label, color: color.moonDim },
  waitingRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  waitingName: { ...type.body, color: color.moonDim, flex: 1 },
  waitingWhen: { ...type.caption, color: color.moonFaint, fontVariant: ['tabular-nums'] },
  waitingNote: { ...type.caption, color: color.moonFaint },
  hint: { ...type.caption, color: color.moonFaint, marginTop: space.lg },
  group: { borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, overflow: 'hidden' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairline, marginLeft: space.lg },
  switchTitle: { ...type.headline, color: color.moon },
  switchDetail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: space.xl, padding: space.sm },
  linkText: { ...type.label, color: color.moonDim },
});
