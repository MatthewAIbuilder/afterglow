import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import type { Festival, Show } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useOrg, useOrgs } from '../../state/orgs';
import { useSocial } from '../../state/social';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { t } from '../../i18n';
import { localDay } from '../artists/shows';
import { datesLine, formatTime } from '../festivals/format';
import { OrgDot } from './OrgMark';
import { activePromotions, datesText, eventAt, eventExtras, eventFestivalIdOf, isCounter, type Listing, type Org, type OrgCounter, type OrgEvent, type Promoted } from './organizers';
import { countOrgOnce, useOrgView } from './useOrgView';
import { PARTNER_NOTE } from '../partners/partners';
import { countTicketTapOnce } from '../partners/ticketTaps';

const openOrg = (id: string) => {
  haptic.select();
  router.push({ pathname: '/org/[id]', params: { id } });
};

/** A counter key for an event's views (an id too long or odd for one isn't counted). */
const viewKey = (id: string): OrgCounter | undefined => (isCounter(`e_${id}`) ? (`e_${id}` as OrgCounter) : undefined);

/**
 * On an organizer's event page: who's putting it on (opening their page),
 * doors, a few words, and tickets. Also on an imported festival or show the
 * organizer claimed (then with the tickets link it came with). Counts a view
 * of the event for their numbers. Nothing for anyone else's.
 */
export function HostedBy({ festival, show }: { festival?: Festival; show?: Show }) {
  const org = useOrg(festival?.organizer ?? show?.organizer);
  const { service, user } = useSocial();
  const today = localDay(useToday());
  const event = org && festival ? eventAt(org, festival.id) : undefined;
  useOrgView(org?.id, event ? viewKey(event.id) : viewKey((festival ?? show)?.id ?? ''));
  if (!org || (!festival && !show)) return null;
  const name = festival?.name ?? show?.name ?? show?.venue ?? '';
  const tickets = event ? event.tickets : (festival?.links?.tickets ?? undefined);
  const last = event ? (event.endDate ?? event.date) : (festival?.endDate ?? festival?.startDate ?? show?.date ?? today);
  const over = last < today;
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
      {event?.doors ? <Text style={styles.line}>{t('Doors {time}', { time: formatTime(event.doors) })}</Text> : null}
      {event?.about ? <Text style={styles.about}>{event.about}</Text> : null}
      {tickets && !over ? (
        <Pressable
          onPress={() => {
            haptic.select();
            countOrgOnce(service, org.id, 'tickets', !!user);
            if (festival) countTicketTapOnce(service, festival.id, !!user);
            Linking.openURL(tickets).catch(() => {});
          }}
          accessibilityRole="link"
          accessibilityLabel={t('Get tickets for {festival} from {organizer}', { festival: name, organizer: org.name })}
          style={({ pressed }) => [styles.tickets, pressed && styles.pressed]}
        >
          <Text style={styles.ticketsText}>{t('Get tickets ↗')}</Text>
        </Pressable>
      ) : null}
      {tickets && !over && (event ? event.ticketsPartner : festival?.links?.ticketsPartner) ? <Text style={styles.partnerNote}>{PARTNER_NOTE}</Text> : null}
    </View>
  );
}

/** One line on an organizer's page: their mark, its name, when and where. */
function ListingRow({ org, l }: { org: Org; l: Listing }) {
  // "Lineup TBA" only while it's still to come.
  const coming = (l.endDate ?? l.date) >= localDay(useToday());
  const when = datesLine({ dates: datesText({ date: l.date, endDate: l.endDate }), startDate: l.date, endDate: l.endDate ?? l.date });
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push(l.href as never);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('{event} by {organizer}, {when}, {place}', { event: l.name, organizer: org.name, when, place: [l.venue, l.city].filter(Boolean).join(', ') })}
      style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
    >
      {l.poster ? <Image source={{ uri: l.poster }} style={styles.poster} contentFit="cover" accessibilityIgnoresInvertColors /> : <OrgDot org={org} size={36} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.eventName} numberOfLines={1}>
          {l.name}
        </Text>
        <Text style={styles.line} numberOfLines={1}>
          {[when, l.venue, l.city].filter(Boolean).join(' · ')}
        </Text>
        {l.tba && coming ? <Text style={styles.tba}>{t('Lineup TBA')}</Text> : null}
      </View>
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

/** One organizer's event as a row. */
function EventRow({ org, event }: { org: Org; event: OrgEvent }) {
  return <ListingRow org={org} l={{ key: event.id, name: event.name, date: event.date, ...(event.endDate ? { endDate: event.endDate } : {}), venue: event.venue, city: event.city, href: `/festival/${eventFestivalIdOf(org, event)}`, imported: false, ...eventExtras(event) }} />;
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

/** An organizer's events as rows (their page): its own and the imported ones it claimed. */
export function OrgEventRows({ org, listings }: { org: Org; listings: Listing[] }) {
  return (
    <View>
      {listings.map((l) => (
        <ListingRow key={l.key} org={org} l={l} />
      ))}
    </View>
  );
}

/**
 * An organizer found by a search: its logo, name and what it puts on,
 * opening its page. `onOpen` runs first (to remember the search).
 */
export function OrgResultRow({ org, onOpen }: { org: Org; onOpen?: () => void }) {
  const what = [t('Event organizer'), org.tagline].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => {
        onOpen?.();
        openOrg(org.id);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('{organizer}, event organizer. Open their page', { organizer: org.name })}
      style={({ pressed }) => [styles.foundRow, pressed && { opacity: 0.75 }]}
    >
      <OrgDot org={org} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {org.name}
        </Text>
        <Text style={styles.line} numberOfLines={1}>
          {org.handle ? `@${org.handle} · ${what}` : what}
        </Text>
      </View>
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg, marginHorizontal: space.xl, marginBottom: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  poster: { width: 36, height: 48, borderRadius: radius.sm, backgroundColor: color.glass },
  tba: { ...type.caption, color: color.glow },
  foundRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  kicker: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1 },
  name: { ...type.headline, color: color.moon },
  line: { ...type.caption, color: color.moonDim },
  about: { ...type.body, color: color.moonDim },
  tickets: { alignSelf: 'flex-start', paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: glowA(0.18), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4) },
  ticketsText: { ...type.label, color: color.moon },
  partnerNote: { ...type.caption, color: color.moonFaint, marginTop: space.sm },
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
