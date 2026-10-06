import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArtistAvatar } from '../components/ArtistAvatar';
import { CheckIcon, ChevronIcon, ProfileIcon, SoundIcon } from '../components/TabIcons';
import { SearchField } from '../components/SearchField';
import { type Artist, SOUND_LABEL, type SoundTag } from '../data/models';
import { focusChoices, FOLLOWING, isWide, likeFocus, MIX, soundChoices, soundFocus, TONIGHT } from '../features/discover/focus';
import { matchesName, searchFestivals } from '../features/festivals/search';
import { searchCatalog } from '../features/search/universal';
import { stationArtists } from '../features/recommend/station';
import { useRecentStations } from '../state/recentStations';
import { useTaste } from '../state/taste';
import { tonightClips } from '../features/tonight/tonight';
import { useTonight } from '../features/tonight/useTonight';
import { PlayIcon } from '../features/discover/icons';
import { countdown } from '../features/festivals/when';
import { datesLine } from '../features/festivals/format';
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
import { color, radius, space, type, glowA, glowDeepA, nightA } from '../theme/tokens';
import { goBack } from '../lib/nav';
import { t, tn } from '../i18n';
import { SheetClose } from '../components/SheetClose';

/**
 * What Discover shows, a sheet over Discover: Tonight (on a festival night)
 * and Your mix and Following as big tiles; one sound from every lineup as
 * chips in each sound's colour; festivals with clips as cards with their
 * headliners' faces (going ones first, marked Going); festivals you're going
 * to with no clips yet in a quiet "Clips on the way" list; then the two
 * playing switches in one group.
 *
 * A search field under the title narrows it to sounds, festivals and
 * artists that match; an artist starts a station ("Sounds like SUBTRONICS":
 * their sets and artists who sound like them). The last few stations come
 * back as "Recent stations".
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

  const { taste, similarity } = useTaste();
  const { stations } = useRecentStations();
  const [query, setQuery] = useState('');
  const q = query.trim();
  // How many clips each artist has: a station counts the clips of everyone on it.
  const clipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of catalog.clips) counts[c.artistId] = (counts[c.artistId] ?? 0) + 1;
    return counts;
  }, [catalog.clips]);

  const pick = (focus: string) => {
    haptic.select();
    router.dismissTo({ pathname: '/', params: { festival: focus } });
  };

  const followingDetail = !social.user
    ? t('Sign in to follow people')
    : social.following.size
      ? tn(social.following.size, '{n} person you follow', '{n} people you follow')
      : t('Follow people to see their videos');
  // A few of the faces your mix draws from, for its tile.
  const mixFaces = [...new Set(catalog.clips.map((c) => c.artistId))]
    .map((id) => catalog.artist(id))
    .filter((a): a is NonNullable<typeof a> => !!a?.imageUrl)
    .slice(0, 3);
  const festivals = [...choices.going.map((c) => ({ ...c, going: true })), ...choices.others.map((c) => ({ ...c, going: false }))];
  const allWatchable = festivals.filter((f) => f.clips > 0);
  const allWaiting = festivals.filter((f) => f.clips === 0);

  // Searching: only what matches, by name (a festival by its place too). An artist is offered as a station when it has clips.
  const found = useMemo(() => {
    if (!q) return undefined;
    const artists = searchCatalog(q, catalog, taste)
      .artists.map((artist) => ({
        artist,
        clips: stationArtists(artist, catalog.artists, (id) => clipCounts[id] ?? 0, similarity).reduce((n, s) => n + (clipCounts[s.artist.id] ?? 0), 0),
      }))
      .filter((a) => a.clips > 0);
    return {
      sounds: soundChoices(catalog.clips, catalog.artist, 1).filter((s) => matchesName(SOUND_LABEL[s.tag], q)),
      festivalIds: new Set(searchFestivals(catalog.festivals, q).map((f) => f.id)),
      artists,
    };
  }, [q, catalog, taste, similarity, clipCounts]);
  const watchable = found ? allWatchable.filter((f) => found.festivalIds.has(f.festival.id)) : allWatchable;
  const waiting = found ? allWaiting.filter((f) => found.festivalIds.has(f.festival.id)) : allWaiting;
  const shownSounds = found ? found.sounds : sounds;
  const nothing = !!found && !found.sounds.length && !watchable.length && !waiting.length && !found.artists.length;
  const recentStations = stations.map((id) => catalog.artist(id)).filter((a): a is Artist => !!a);
  // Return on a keyboard: the first thing found.
  const pickFirst = () => {
    if (!found) return;
    if (found.sounds[0]) pick(soundFocus(found.sounds[0].tag));
    else if (watchable[0]) pick(watchable[0].festival.id);
    else if (found.artists[0]) pick(likeFocus(found.artists[0].artist.id));
  };
  const soundChip = (tag: SoundTag, clips: number) => {
    const on = current === soundFocus(tag);
    const hue = SOUND_COLOR[tag];
    return (
      <Pressable
        key={tag}
        onPress={() => pick(soundFocus(tag))}
        accessibilityRole="button"
        accessibilityLabel={t('{sound}, {n} clips from every lineup', { sound: SOUND_LABEL[tag], n: clips })}
        accessibilityState={{ selected: on }}
        style={({ pressed }) => [styles.sound, on && { backgroundColor: `${hue}2E`, borderColor: `${hue}99` }, pressed && styles.pressed]}
      >
        <View style={[styles.soundDot, { backgroundColor: hue, shadowColor: hue }]} />
        <Text style={[styles.soundText, on && { color: color.moon }]}>{SOUND_LABEL[tag]}</Text>
        <Text style={styles.soundCount}>{clips}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.root} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
        <Text style={styles.title}>{t('What to discover')}</Text>
        <Text style={styles.body}>{t('Everything at once, one sound, or one festival’s lineup.')}</Text>
        <View style={styles.searchBar}>
          <SearchField value={query} onChange={setQuery} placeholder={t('Sounds, festivals or artists')} label={t('Search sounds, festivals and artists')} onSubmit={pickFirst} />
        </View>

        {!found && tonight && tonightSets > 0 ? (
          <Tile
            title={t('Tonight')}
            detail={
              tonight.night
                ? tn(tonightSets, '{night} at {festival} · {n} artist, in set order', '{night} at {festival} · {n} artists, in set order', { night: t(tonight.night), festival: tonight.festival.name })
                : tn(tonightSets, '{festival} · {n} artist, in set order', '{festival} · {n} artists, in set order', { festival: tonight.festival.name })
            }
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

        {!found && (
        <View style={styles.tiles}>
          <Tile
            title={t('Your mix')}
            detail={t('A bit of everything, from every lineup')}
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
              title={t('Following')}
              detail={followingDetail}
              label={
                !social.user
                  ? t('Following, Sign in to follow people and see their videos')
                  : social.following.size
                    ? tn(social.following.size, 'Following, Videos from the person you follow', 'Following, Videos from the {n} people you follow')
                    : t('Following, Follow people to see their videos here')
              }
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
        )}

        {!found && recentStations.length > 0 && (
          <>
            <Text style={styles.section}>{t('Recent stations')}</Text>
            <View style={styles.sounds}>
              {recentStations.map((a) => {
                const on = current === likeFocus(a.id);
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => pick(likeFocus(a.id))}
                    accessibilityRole="button"
                    accessibilityLabel={t('Sounds like {artist}, recent station', { artist: a.name })}
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.station, on && styles.stationOn, pressed && styles.pressed]}
                  >
                    <ArtistAvatar artist={a} size={24} />
                    <Text style={[styles.soundText, styles.stationText, on && { color: color.moon }]} numberOfLines={1}>
                      {t('Sounds like {artist}', { artist: a.name })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {(found ? shownSounds.length > 0 : sounds.length > 1) && (
          <>
            <Text style={styles.section}>{found ? t('Sounds') : t('By sound')}</Text>
            <View style={styles.sounds}>{shownSounds.map(({ tag, clips }) => soundChip(tag, clips))}</View>
          </>
        )}

        {watchable.length > 0 && (
          <>
            <Text style={styles.section}>{t('Festivals')}</Text>
            <View style={styles.list}>
              {watchable.map(({ festival, clips, going }) => {
                const when = countdown(festival, today) ?? datesLine(festival);
                const detail = tn(clips, '{n} clip · {when}', '{n} clips · {when}', { when });
                const selected = current === festival.id;
                const cover = coverPhotos(festival, catalog.artist, 4);
                return (
                  <Pressable
                    key={festival.id}
                    onPress={() => pick(festival.id)}
                    accessibilityRole="button"
                    accessibilityLabel={going ? t('{festival}, {detail}, going', { festival: festival.name, detail }) : `${festival.name}, ${detail}`}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [styles.festival, selected && styles.selected, pressed && styles.pressed]}
                  >
                    <FestivalCover photos={cover} style={StyleSheet.absoluteFill} />
                    {cover.length ? <LinearGradient colors={[nightA(0.88), nightA(0.35)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
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
                        <Text style={styles.goingText}>{t('Going')}</Text>
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
            <Text style={styles.waitingTitle}>{t('Clips on the way')}</Text>
            {waiting.map(({ festival }) => (
              <View
                key={festival.id}
                style={styles.waitingRow}
                accessible
                accessibilityLabel={t('{festival}, No clips yet · {when}', { festival: festival.name, when: countdown(festival, today) ?? datesLine(festival) })}
                accessibilityState={{ disabled: true }}
              >
                <Text style={styles.waitingName} numberOfLines={1}>
                  {festival.name}
                </Text>
                <Text style={styles.waitingWhen}>{countdown(festival, today) ?? datesLine(festival)}</Text>
              </View>
            ))}
            <Text style={styles.waitingNote}>{t('New live sets are found every night.')}</Text>
          </View>
        )}
        {found && found.artists.length > 0 && (
          <>
            <Text style={styles.section}>{t('Artists')}</Text>
            <View style={styles.list}>
              {found.artists.map(({ artist: a, clips }) => {
                const on = current === likeFocus(a.id);
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => pick(likeFocus(a.id))}
                    accessibilityRole="button"
                    accessibilityLabel={tn(clips, 'Sounds like {artist}. Start a station from their sets and artists with a similar sound, {n} clip', 'Sounds like {artist}. Start a station from their sets and artists with a similar sound, {n} clips', { artist: a.name })}
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.artist, on && styles.selected, pressed && styles.pressed]}
                  >
                    <ArtistAvatar artist={a} size={44} />
                    <View style={styles.rowText}>
                      <Text style={styles.artistName} numberOfLines={1}>
                        <Text style={styles.soundsLike}>{t('Sounds like')} </Text>
                        {a.name}
                      </Text>
                      <Text style={styles.detail} numberOfLines={1}>
                        {tn(clips, '{n} clip from them and artists like them', '{n} clips from them and artists like them')}
                      </Text>
                    </View>
                    <View style={styles.stationBadge}>
                      <SoundIcon color={color.glow} size={16} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {nothing ? (
          <View style={styles.nothing}>
            <Text style={styles.nothingTitle}>{t('Nothing matches “{query}”', { query: q })}</Text>
            <Text style={styles.detail}>{t('Try a sound like dubstep, a festival or an artist’s name.')}</Text>
          </View>
        ) : null}
        {!found && choices.going.length === 0 && (
          <Text style={styles.hint}>{t('Mark the festivals you’re going to on the Festivals tab and they’ll show up first.')}</Text>
        )}

        {!found && (
        <>
        <Text style={styles.section}>{t('Playing')}</Text>
        <View style={styles.group}>
          {social.availability.ok && (
            <>
              <View style={styles.switchRow}>
                <View style={styles.rowText}>
                  <Text style={styles.switchTitle}>{t('Videos from the crowd')}</Text>
                  <Text style={styles.switchDetail}>
                    {!social.user
                      ? t('Sign in on your profile to see videos people shared from the festival.')
                      : community.enabled
                        ? t('Videos people shared from the festival, beside the official clips.')
                        : t('Only official clips.')}
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
                  accessibilityLabel={t('Videos from the crowd')}
                  testID="community-switch"
                />
              </View>
              <View style={styles.separator} />
            </>
          )}
          <View style={styles.switchRow}>
            <View style={styles.rowText}>
              <Text style={styles.switchTitle}>{t('Play the next clip')}</Text>
              <Text style={styles.switchDetail}>
                {autoplay.enabled ? t('When you’ve watched a clip to the end, the next one starts after a short countdown.') : t('Clips loop until you swipe.')}
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
              accessibilityLabel={t('Play the next clip')}
              testID="autoplay-switch"
            />
          </View>
        </View>
        </>
        )}

        {currentFestival && (
          <Pressable
            onPress={() => {
              haptic.select();
              goBack();
              router.push(`/festival/${currentFestival.id}`);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Open {festival}, its lineup and your plan', { festival: currentFestival.name })}
            style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.linkText}>{t('Open {festival}', { festival: currentFestival.name })}</Text>
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
        colors={selected ? [glowDeepA(0.55), 'rgba(58,35,128,0.18)'] : [glowDeepA(0.22), 'rgba(255,255,255,0.03)']}
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
  searchBar: { marginTop: space.lg },
  station: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: '100%',
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: space.md + 2,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  stationOn: { backgroundColor: glowA(0.18), borderColor: glowA(0.6) },
  stationText: { flexShrink: 1 },
  artist: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  artistName: { ...type.headline, color: color.moon },
  soundsLike: { color: color.moonDim },
  stationBadge: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: glowA(0.16), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4) },
  nothing: { marginTop: space.xl, gap: space.xs },
  nothingTitle: { ...type.headline, color: color.moonDim },
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
  tileOn: { borderColor: glowA(0.75), borderWidth: 1.5, shadowColor: color.glow, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
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
  selected: { borderColor: glowA(0.75), borderWidth: 1.5 },
  going: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: glowA(0.22), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.5) },
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
