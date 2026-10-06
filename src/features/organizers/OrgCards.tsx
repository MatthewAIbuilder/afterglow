import { router } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useOrg, useOrgs } from '../../state/orgs';
import { useSocial } from '../../state/social';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { t } from '../../i18n';
import { localDay } from '../artists/shows';
import { datesLine, formatTime } from '../festivals/format';
import { OrgDot } from './OrgMark';
import { activePromotions, datesText, eventFestivalId, eventOf, type Org, type OrgEvent, type Promoted } from './organizers';
import { countOrgOnce, useOrgView } from './useOrgView';

const openOrg = (id: string) => {
  haptic.select();
  router.push({ pathname: '/org/[id]', params: { id } });
};

/**
 * On an organizer's event page: who's putting it on (opening their page),
 * doors, a few words, and tickets. Counts a view of the event for their
 * numbers. Nothing for festivals that aren't an organizer's.
 */
export function HostedBy({ festival }: { festival: Festival }) {
  const ids = festival.organizer ? eventOf(festival.id) : undefined;
  const org = useOrg(festival.organizer);
  const { service, user } = useSocial();
  const today = localDay(useToday());
  useOrgView(org ? ids?.orgId : undefined, ids ? `e_${ids.eventId}` : undefined);
  const event = org?.events.find((e) => e.id === ids?.eventId);
  if (!org || !event) return null;
  const tickets = event.tickets;
  const over = (event.endDate ?? event.date) < today;
  return (
    <View style={styles.card}>
      <Pressable onPress={() => openOrg(org.id)} accessibilityRole="button" accessibilityLabel={t('Hosted by {organizer}. Open their page', { organizer: org.name })} style={({ pressed }) => [styles.hostRow, pressed && styles.pressed]}>
        <OrgDot org={org} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{t('Hosted by')}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {org.name}
          </Text>
        </View>
        <ChevronIcon color={color.moonFaint} size={12} />
      </Pressable>
      {event.doors ? <Text style={styles.line}>{t('Doors {time}', { time: formatTime(event.doors) })}</Text> : null}
      {event.about ? <Text style={styles.about}>{event.about}</Text> : null}
      {tickets && !over ? (
        <Pressable
          onPress={() => {
            haptic.select();
            countOrgOnce(service, org.id, 'tickets', !!user);
            Linking.openURL(tickets).catch(() => {});
          }}
          accessibilityRole="link"
          accessibilityLabel={t('Get tickets for {festival} from {organizer}', { festival: festival.name, organizer: org.name })}
          style={({ pressed }) => [styles.tickets, pressed && styles.pressed]}
        >
          <Text style={styles.ticketsText}>{t('Get tickets ↗')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One organizer's event as a row: their mark, its name, when and where. */
function EventRow({ org, event, onOpen }: { org: Org; event: OrgEvent; onOpen?: () => void }) {
  const when = datesLine({ dates: datesText(event), startDate: event.date, endDate: event.endDate ?? event.date });
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onOpen?.();
        router.push(`/festival/${eventFestivalId(org.id, event.id)}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('{event} by {organizer}, {when}, {place}', { event: event.name, organizer: org.name, when, place: [event.venue, event.city].filter(Boolean).join(', ') })}
      style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
    >
      <OrgDot org={org} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={styles.eventName} numberOfLines={1}>
          {event.name}
        </Text>
        <Text style={styles.line} numberOfLines={1}>
          {[when, event.venue, event.city].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

/** On a festival's page: after parties organizers put on for it, while they're still to come. */
export function AfterParties({ festivalId }: { festivalId: string }) {
  const orgs = useOrgs();
  const today = localDay(useToday());
  const list = useMemo(
    () =>
      orgs
        .flatMap((org) => org.events.filter((e) => e.published && e.afterOf === festivalId && (e.endDate ?? e.date) >= today).map((event) => ({ org, event })))
        .sort((a, b) => a.event.date.localeCompare(b.event.date)),
    [orgs, festivalId, today],
  );
  if (!list.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{t('After parties')}</Text>
      {list.map(({ org, event }) => (
        <EventRow key={`${org.id}/${event.id}`} org={org} event={event} />
      ))}
    </View>
  );
}

/**
 * Events Afterglow HQ is promoting, at the top of the Festivals tab: always
 * labelled "Promoted", at most two, and never part of your taste. Counts
 * each one seen for its organizer.
 */
export function PromotedEvents() {
  const orgs = useOrgs();
  const today = localDay(useToday());
  const list = useMemo(() => activePromotions(orgs, today).slice(0, 2), [orgs, today]);
  if (!list.length) return null;
  return (
    <View style={styles.promoWrap}>
      {list.map((p) => (
        <PromotedCard key={p.festivalId} p={p} />
      ))}
    </View>
  );
}

function PromotedCard({ p }: { p: Promoted }) {
  useOrgView(p.org.id, 'promo');
  const when = datesLine({ dates: datesText(p.event), startDate: p.event.date, endDate: p.event.endDate ?? p.event.date });
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push(`/festival/${p.festivalId}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('Promoted: {event} by {organizer}, {when}, {place}', { event: p.event.name, organizer: p.org.name, when, place: [p.event.venue, p.event.city].filter(Boolean).join(', ') })}
      style={({ pressed }) => [styles.promo, pressed && styles.pressed]}
    >
      <View style={styles.promoTop}>
        <Text style={styles.promoLabel}>{t('Promoted')}</Text>
        <Text style={styles.promoBy} numberOfLines={1}>
          {p.org.name}
        </Text>
      </View>
      <View style={styles.hostRow}>
        <OrgDot org={p.org} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.promoName} numberOfLines={2}>
            {p.event.name}
          </Text>
          <Text style={styles.line} numberOfLines={1}>
            {[when, p.event.venue, p.event.city].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <ChevronIcon color={color.moonFaint} size={12} />
      </View>
    </Pressable>
  );
}

/** An organizer's upcoming events as rows (their page). */
export function OrgEventRows({ org, events }: { org: Org; events: OrgEvent[] }) {
  return (
    <View>
      {events.map((e) => (
        <EventRow key={e.id} org={org} event={e} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg, marginHorizontal: space.xl, marginBottom: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  kicker: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1 },
  name: { ...type.headline, color: color.moon },
  line: { ...type.caption, color: color.moonDim },
  about: { ...type.body, color: color.moonDim },
  tickets: { alignSelf: 'flex-start', paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: glowA(0.18), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4) },
  ticketsText: { ...type.label, color: color.moon },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  eventName: { ...type.headline, color: color.moon },
  promoWrap: { gap: space.md, marginHorizontal: space.xl, marginBottom: space.lg },
  promo: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: 'rgba(14,14,18,0.72)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  promoTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  promoLabel: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1.2, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, overflow: 'hidden' },
  promoBy: { ...type.caption, color: color.moonDim, flex: 1 },
  promoName: { ...type.title, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
