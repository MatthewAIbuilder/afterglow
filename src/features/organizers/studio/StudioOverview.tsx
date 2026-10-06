import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useNow } from '../../../lib/useNow';
import { localDay } from '../../artists/shows';
import { useSocial } from '../../../state/social';
import { color } from '../../../theme/tokens';
import { eventFestivalIdOf, type Org, type OrgDay, orgStats, type OrgRequest, shortCount, sinceDay, splitEvents } from '../organizers';
import { Bars, Button, Card, Chip, Tile, studio } from './ui';

type Range = 7 | 30 | 90;
type EventNumbers = { going: number; videos: number; filmers: number };

/**
 * The studio's first tab: how the organizer's page and events are doing.
 * Views of their page and events, ticket taps and promoted views (counts
 * only, never who), then per event: people showing they're going, videos
 * filmed there (each filmer collects the badge) and sticker finds.
 */
export function StudioOverview({ org }: { org: Org }) {
  const { service } = useSocial();
  const now = useNow(60_000);
  const [range, setRange] = useState<Range>(30);
  const [rows, setRows] = useState<OrgDay[] | undefined>();
  const [perEvent, setPerEvent] = useState<Record<string, EventNumbers>>({});
  const [finds, setFinds] = useState<number | undefined>();
  const [requests, setRequests] = useState<OrgRequest[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const at = new Date();
      const [days, f, r] = await Promise.all([service.orgViews(org.id, sinceDay(at, 90)), service.orgFinds(org.id).catch(() => ({}) as Record<string, number>), service.orgRequests(org.id, 20).catch(() => [])]);
      setRows(days);
      setFinds(Object.values(f).reduce((a, n) => a + n, 0));
      setRequests(r);
      const shown = org.events.filter((e) => e.published).slice(0, 12);
      const pairs = await Promise.all(
        shown.map(async (e) => {
          const id = eventFestivalIdOf({ id: org.id }, e);
          const [going, videos] = await Promise.all([service.profilesGoingTo(id, 500).catch(() => []), service.festivalMemories(id, 500).catch(() => [])]);
          return [e.id, { going: going.length, videos: videos.length, filmers: new Set(videos.map((v) => v.uid)).size }] as const;
        }),
      );
      setPerEvent(Object.fromEntries(pairs));
    } catch {
      setFailed(true);
      setRows((x) => x ?? []);
    }
  }, [service, org.id, org.events]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const stats = useMemo(() => (rows ? orgStats(rows, now, range) : undefined), [rows, now, range]);
  const today = localDay(now);
  const { upcoming, past } = splitEvents(org, today);
  const open = requests.filter((r) => r.status === 'open').length;

  return (
    <View style={studio.wrap}>
      <View style={studio.chips}>
        {([7, 30, 90] as const).map((r) => (
          <Chip key={r} label={`${r} days`} on={range === r} onPress={() => setRange(r)} />
        ))}
      </View>
      {!stats ? (
        <ActivityIndicator color={color.glow} />
      ) : (
        <>
          {failed ? <Text style={studio.muted}>Couldn’t read the latest numbers. Pull down or try again in a moment.</Text> : null}
          <View style={studio.tiles}>
            <Tile value={shortCount(stats.page)} label="Page views" sub="Your organizer page" />
            <Tile value={shortCount(stats.events)} label="Event views" sub="Your events’ pages" />
            <Tile value={shortCount(stats.tickets)} label="Ticket taps" sub="Get tickets, from Afterglow" />
            <Tile value={shortCount(stats.promo)} label="Promoted views" sub="Seen on the Festivals tab" />
            <Tile value={finds === undefined ? '–' : shortCount(finds)} label="Sticker finds" sub="Stickers and gifts collected, all time" />
            <Tile value={String(upcoming.length)} label="Coming up" sub={`${past.length} past`} />
          </View>
          <Card title="Views day by day" sub={`The last ${range} days. People signed in to Afterglow, counted once each time they open the app.`}>
            <Bars days={stats.byDay} />
          </Card>
        </>
      )}

      <Card title="Your events" sub="Going: people who show it on their profile. Videos: filmed there and shared (each person who films collects your badge).">
        {org.events.filter((e) => e.published).length ? (
          org.events
            .filter((e) => e.published)
            .slice(0, 12)
            .map((e) => {
              const n = perEvent[e.id];
              return (
                <View key={e.id} style={studio.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={studio.rowTitle}>{e.name}</Text>
                    <Text style={studio.rowSub}>
                      {e.date} · {stats?.byEvent[e.id] ?? 0} views
                      {n ? ` · ${n.going} going · ${n.videos} videos · ${n.filmers} badges` : ''}
                      {org.promoted[e.id] ? ` · promoted until ${org.promoted[e.id]}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })
        ) : (
          <Text style={studio.muted}>Publish an event in Events and its numbers show here.</Text>
        )}
      </Card>

      {open ? <Text style={studio.muted}>{open === 1 ? '1 request is waiting for Afterglow.' : `${open} requests are waiting for Afterglow.`}</Text> : null}
      <Button kind="secondary" label="Refresh" onPress={() => void load()} />
    </View>
  );
}
