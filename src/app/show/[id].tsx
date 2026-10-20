import { Redirect, useLocalSearchParams } from 'expo-router';
import { useOrgs } from '../../state/orgs';
import { eventFestivalIdOf } from '../../features/organizers/organizers';
import { HostedBy } from '../../features/organizers/OrgCards';
import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistRow } from '../../components/ArtistRow';
import { Missing } from '../../components/Missing';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { PageTitle } from '../../components/PageTitle';
import { WEB_URL } from '../../config/app';
import type { Artist } from '../../data/models';
import { localDay, showDateSpoken, showDayShort, showDaysShort, showTitle, withLine } from '../../features/artists/shows';
import { CalendarPill } from '../../features/calendar/CalendarPill';
import { showEvent } from '../../features/calendar/events';
import { distanceLabel } from '../../features/festivals/near';
import { ShowDateBlock, useShowTaste } from '../../features/festivals/ShowCards';
import { festivalLight } from '../../features/festivals/light';
import { rankShow } from '../../features/festivals/showsForYou';
import { artistSignals, whyLine } from '../../features/taste/why';
import { haptic } from '../../lib/haptics';
import { StayCard } from '../../features/partners/StayCard';
import { showTrip } from '../../features/partners/partners';
import { shareMessage } from '../../lib/share';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useGoingShows } from '../../state/goingShows';
import { CheckIcon } from '../../components/TabIcons';
import { useNearby } from '../../state/nearby';
import { useReactions } from '../../state/reactions';
import { useTaste } from '../../state/taste';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { t, tc } from '../../i18n';
import { TryFestivalMode } from '../../features/festivalMode/FestivalModeCard';
import { showAsEvent } from '../../features/festivalMode/showEvent';
import { goingShowOf } from '../../features/festivals/goingShows';
import { showRun } from '../../features/festivals/showRuns';

/**
 * One club show from the nightly EDMTrain feed: when and where, who's on the
 * bill that Afterglow knows (best for you first, with why), tickets on
 * EDMTrain (credited, as they ask), add to calendar and share. Opens from the
 * Festivals tab, search, the calendar, artist pages and links
 * (afterglowmusic.app/show/<id>). A festival EDMTrain lists as a show a day
 * (`showRun`) is one page: its days, the ones you're going to picked one by
 * one, and who's on each day.
 */
export default function ShowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalog = useCatalog();
  const insets = useSafeAreaInsets();
  const today = localDay(useToday());
  const taste = useShowTaste();
  const { tasteClips } = useTaste();
  const { reactions } = useReactions();
  const { here, units } = useNearby();
  const show = useMemo(() => catalog.shows.find((s) => s.id === id), [catalog.shows, id]);
  const { isGoing, setGoing } = useGoingShows();
  // Every day of it, when it runs more than one.
  const run = useMemo(() => (show ? showRun(catalog.shows, show) : []), [catalog.shows, show]);
  // Its organizer made its own page for it on Afterglow: that takes over.
  const copy = useOrgs()
    .flatMap((o) => o.events.filter((e) => e.published && e.fromKind === 'show' && e.from === id).map((e) => eventFestivalIdOf(o, e)))
    .find((fid) => !!catalog.festival(fid));
  if (!show && copy) return <Redirect href={`/festival/${copy}`} />;
  if (!show) return <Missing title={t('Show not found')} line={t('This show isn’t on Afterglow any more (it may have passed), or the link isn’t quite right.')} />;

  const ranked = rankShow(show, taste, here);
  const bill = ranked.bill.flatMap((b) => {
    const a = catalog.artist(b.id);
    return a ? [{ artist: a, bill: b }] : [];
  });
  const names = bill.map((b) => b.artist.name);
  const title = showTitle(show);
  const venueLine = [show.name ? show.venue : undefined, show.location].filter(Boolean).join(', ');
  const away = ranked.km !== undefined ? distanceLabel(ranked.km, units) : undefined;
  const multi = run.length > 1;
  const last = run[run.length - 1] ?? show;
  const over = last.date < today;
  const best = ranked.best && bill.find((b) => b.artist.id === ranked.best!.id)?.artist;
  const event = showEvent(show, WEB_URL, names);
  const going = isGoing(show.id);
  const share = () => {
    haptic.select();
    const w = withLine(names, 3);
    const text = [`${title}, ${showDateSpoken(show.date)}${venueLine ? `, ${venueLine}` : ''}.`, w ? `${w.charAt(0).toUpperCase()}${w.slice(1)}.` : undefined, `${WEB_URL}/show/${show.id}`]
      .filter(Boolean)
      .join('\n');
    void shareMessage(text, title);
  };
  const tickets = () => {
    haptic.tap();
    Linking.openURL(show.link).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <PageTitle title={title} />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <ShowDateBlock date={run[0]?.date ?? show.date} light={festivalLight(show.id)} big />
            <View style={styles.heroWhen}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{multi ? tc('event', 'Festival') : tc('event', 'Show')}</Text>
              </View>
              {multi ? (
                <Text style={styles.date} accessibilityLabel={t('{from} to {to}', { from: showDateSpoken(run[0].date), to: showDateSpoken(last.date) })}>
                  {showDaysShort(run[0].date, last.date)}
                </Text>
              ) : (
                <Text style={styles.date}>{showDateSpoken(show.date)}</Text>
              )}
              {multi ? <Text style={styles.over}>{t('{n} days', { n: run.length })}</Text> : null}
              {over ? <Text style={styles.over}>{multi ? t('This festival has passed') : t('This show has passed')}</Text> : null}
            </View>
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {venueLine ? <Text style={styles.where}>{venueLine}</Text> : null}
          {away ? <Text style={styles.away}>{away}</Text> : null}
          {best && ranked.best ? (
            <Text style={styles.best}>
              {t('{pct}% match with {artist}', { pct: Math.round(ranked.match * 100), artist: best.name })}
            </Text>
          ) : null}

          <Pressable
            onPress={tickets}
            accessibilityRole="link"
            accessibilityLabel={t('Get tickets on EDMTrain for {show}. Opens their site.', { show: title })}
            style={({ pressed }) => [styles.tickets, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          >
            <Text style={styles.ticketsText}>{t('Get tickets on EDMTrain ↗')}</Text>
          </Pressable>
          {over ? null : multi ? (
            <>
              {/* Going to some of its days, not the whole weekend: each day on its own. */}
              <Text style={styles.daysTitle}>{t('Which days are you going?')}</Text>
              <View style={styles.actions}>
                {run.map((d) => {
                  const on = isGoing(d.id);
                  const day = showDateSpoken(d.date);
                  const gone = d.date < today;
                  return (
                    <Pressable
                      key={d.id}
                      disabled={gone}
                      onPress={() => {
                        if (on) haptic.select();
                        else haptic.celebrate();
                        setGoing(d, !on);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on, disabled: gone }}
                      accessibilityLabel={on ? t("You're going on {day}. Tap to undo.", { day }) : t("I'm going on {day}", { day })}
                      style={({ pressed }) => [styles.going, on && styles.goingOn, gone && { opacity: 0.4 }, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
                    >
                      {on ? <CheckIcon color={color.moon} size={14} /> : null}
                      <Text style={[styles.goingText, !on && { color: color.moonDim }]}>{showDayShort(d.date)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.actions}>
                <CalendarPill event={event} name={title} />
              </View>
            </>
          ) : (
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  if (going) haptic.select();
                  else haptic.celebrate();
                  setGoing(show, !going);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: going }}
                accessibilityLabel={going ? t("You're going to {festival}. Tap to undo.", { festival: title }) : t("I'm going to {festival}", { festival: title })}
                style={({ pressed }) => [styles.going, going && styles.goingOn, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
              >
                <CheckIcon color={going ? color.moon : color.moonDim} size={14} />
                <Text style={[styles.goingText, !going && { color: color.moonDim }]}>{going ? t('Going') : t('I’m going')}</Text>
              </Pressable>
              <CalendarPill event={event} name={title} />
            </View>
          )}
          {/* On the night, festival mode works for a show too: try it any day. */}
          {over ? null : (
            <View style={styles.tryMode}>
              <TryFestivalMode festival={showAsEvent(goingShowOf(show), show)} />
            </View>
          )}
        </View>
        {/* Travelling for it: places to stay near the venue that night. */}
        {over ? null : (
          <View style={styles.stay}>
            <StayCard trip={showTrip(show)} name={title} />
          </View>
        )}
        {/* Claimed by an event organizer on Afterglow: who's hosting it. */}
        <HostedBy show={show} />

        {multi ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('On the bill')}
            </Text>
            <Text style={styles.sectionSub}>{t('Artists on Afterglow each day, best for you first. The full lineup is on EDMTrain.')}</Text>
            {run.map((d) => (
              <View key={d.id}>
                <Text style={styles.dayHead} accessibilityRole="header">
                  {showDateSpoken(d.date)}
                  {isGoing(d.id) ? <Text style={styles.dayGoing}>{`  ·  ${t('Going')}`}</Text> : null}
                </Text>
                {rankShow(d, taste, here).bill.flatMap((b) => {
                  const artist = catalog.artist(b.id);
                  return artist ? [<ArtistRow key={artist.id} artist={artist} affinity={b.match} rating={taste.ratings[artist.id]} detail={why(artist, tasteClips, reactions, taste)} />] : [];
                })}
              </View>
            ))}
          </View>
        ) : bill.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('On the bill')}
            </Text>
            <Text style={styles.sectionSub}>{t('Artists on Afterglow, best for you first. The full lineup is on EDMTrain.')}</Text>
            {bill.map(({ artist, bill: b }) => (
              <ArtistRow key={artist.id} artist={artist} affinity={b.match} rating={taste.ratings[artist.id]} detail={why(artist, tasteClips, reactions, taste)} />
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={() => void Linking.openURL('https://edmtrain.com').catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={t('Show info from EDMTrain. Opens their site.')}
          style={({ pressed }) => [styles.credit, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.creditText}>{t('Show info from EDMTrain ↗')}</Text>
        </Pressable>
      </ScrollView>
      <PageActions shareLabel={t('Share {show}', { show: title })} onShare={share} />
    </View>
  );
}

/** What their match rests on, in the artist page's own words. */
function why(artist: Artist, clips: Parameters<typeof artistSignals>[1], reactions: Parameters<typeof artistSignals>[2], taste: ReturnType<typeof useShowTaste>) {
  if (taste.isFollowing(artist.id) && !taste.informed[artist.id]) return t('You follow them');
  return whyLine(artistSignals(artist.id, clips, reactions, taste.ratings), !!taste.informed[artist.id]);
}

const styles = StyleSheet.create({
  stay: { paddingHorizontal: space.xl },
  root: { flex: 1, backgroundColor: color.night },
  hero: { paddingHorizontal: space.xl },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  heroWhen: { flex: 1, gap: space.xs, alignItems: 'flex-start' },
  tag: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  tagText: { ...type.caption, color: color.moon, letterSpacing: 0.6, textTransform: 'uppercase' },
  date: { ...type.headline, color: color.moon },
  daysTitle: { ...type.label, color: color.moonDim, marginTop: space.lg },
  dayHead: { ...type.headline, color: color.moon, marginTop: space.lg, marginBottom: space.xs },
  dayGoing: { ...type.label, color: color.glow },
  over: { ...type.caption, color: color.moonFaint },
  title: { ...type.largeTitle, color: color.moon, marginTop: space.xl },
  where: { ...type.body, color: color.moonDim, marginTop: space.xs },
  away: { ...type.caption, color: color.moonDim, marginTop: 2 },
  best: { ...type.label, color: color.glow, marginTop: space.md },
  tickets: {
    marginTop: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: color.glow,
  },
  ticketsText: { ...type.headline, color: color.night },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  tryMode: { marginTop: space.lg },
  going: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md + 2, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  goingOn: { backgroundColor: glowA(0.28), borderColor: glowA(0.6) },
  goingText: { ...type.label, color: color.moon },
  section: { marginTop: space.xxl, paddingHorizontal: space.xl },
  sectionTitle: { ...type.title, fontSize: 22, color: color.moon },
  sectionSub: { ...type.caption, color: color.moonDim, marginTop: space.xs, marginBottom: space.sm },
  credit: { alignSelf: 'flex-start', paddingVertical: space.sm, paddingHorizontal: space.xl, marginTop: space.lg },
  creditText: { ...type.caption, color: color.moonFaint },
});
