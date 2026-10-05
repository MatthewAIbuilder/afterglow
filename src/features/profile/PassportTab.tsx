import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { FilterChips } from '../../components/FilterChips';
import { MapIcon } from '../../components/TabIcons';
import type { Artist } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { type ThrowbackBadge, pinLook, throwbackId, throwbackLine, throwbackLook, townOf } from '../badges/badges';
import { pastLabel } from '../memories/past';
import { EnamelPin } from '../badges/EnamelPin';
import { coverPhotos } from '../festivals/cover';
import { FestivalCover } from '../festivals/FestivalCover';
import { countdown } from '../festivals/when';
import { type Passport, type Stamp, stampLine } from './passport';

const CARD_H = 168;

type Props = {
  passport: Passport;
  artistOf: (id: string) => Artist | undefined;
  loves: (id: string) => boolean;
  recapIds: ReadonlySet<string>;
  today: Date;
  onFind: () => void;
  /** Shown under the stamps (your crews). */
  children?: React.ReactNode;
  /** Past festivals from your camera roll, under Been there. */
  throwbacks?: readonly ThrowbackBadge[];
  /** Add a video from a festival you went to before. */
  onAddPast?: () => void;
};

type Side = 'planning' | 'been';

/**
 * Your festival passport: a card for every festival you're planning and every
 * one you've been to, with the headliners' faces behind, your pin (or the
 * pin still to collect), what you filmed there or how many acts you'd love.
 */
export function PassportTab({ passport, artistOf, loves, recapIds, today, onFind, children, throwbacks = [], onAddPast }: Props) {
  const beenCount = passport.been.length + throwbacks.length;
  const [side, setSide] = useState<Side>(passport.planning.length || !beenCount ? 'planning' : 'been');
  const stamps = side === 'planning' ? passport.planning : passport.been;
  const empty = !passport.planning.length && !beenCount;
  return (
    <View style={styles.root}>
      {empty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your festival passport</Text>
          <Text style={styles.emptyBody}>Tap I’m going on a festival and it gets a page here. Film a set there and you collect its pin.</Text>
          {onAddPast ? (
            <Pressable onPress={onAddPast} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.addPastLink}>Add a festival you went to before</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              haptic.tap();
              onFind();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.emptyButton, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.emptyButtonText}>Find festivals</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FilterChips
            chips={[
              { key: 'planning', label: 'Planning', count: passport.planning.length, accessibilityLabel: `Planning, ${passport.planning.length}` },
              { key: 'been', label: 'Been there', count: beenCount, accessibilityLabel: `Been there, ${beenCount}` },
            ]}
            value={side}
            onChange={(k) => k && setSide(k as Side)}
          />
          <View style={styles.cards}>
            {stamps.map((s) => (
              <PassportCard key={s.festival.id} stamp={s} planning={side === 'planning'} artistOf={artistOf} loves={loves} recap={recapIds.has(s.festival.id)} today={today} />
            ))}
            {side === 'been' ? throwbacks.map((t) => <ThrowbackCard key={t.key} badge={t} />) : null}
            {side === 'been' && onAddPast ? (
              <Pressable
                onPress={() => {
                  haptic.select();
                  onAddPast();
                }}
                accessibilityRole="button"
                accessibilityLabel="Add a festival you went to before, with a video from your camera roll"
                style={({ pressed }) => [styles.addPast, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.addPastTitle}>+ Add a past festival</Text>
                <Text style={styles.addPastBody}>A video from your camera roll, tagged with the festival and year, earns a rose gold throwback badge.</Text>
              </Pressable>
            ) : null}
            {stamps.length || (side === 'been' && (throwbacks.length || onAddPast)) ? null : (
              <Text style={styles.none}>
                {side === 'been' ? 'Festivals you’ve been to collect here, with what you filmed.' : 'Tap I’m going on a festival to plan it here.'}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/festival-map', params: { show: 'going' } });
            }}
            accessibilityRole="button"
            accessibilityLabel="See your festivals on the map"
            style={({ pressed }) => [styles.mapLink, pressed && { opacity: 0.7 }]}
          >
            <MapIcon color={color.glow} size={16} />
            <Text style={styles.mapLinkText}>Your festivals on the map</Text>
          </Pressable>
        </>
      )}
      {children}
    </View>
  );
}

function PassportCard({ stamp, planning, artistOf, loves, recap, today }: { stamp: Stamp; planning: boolean; artistOf: (id: string) => Artist | undefined; loves: (id: string) => boolean; recap: boolean; today: Date }) {
  const f = stamp.festival;
  const when = countdown(f, today);
  const upcoming = planning ? (when && when !== 'Over' ? when : 'Date to come') : undefined;
  const faces = (stamp.filmed.length ? stamp.filmed : f.lineup.filter(loves))
    .map(artistOf)
    .filter((a): a is Artist => !!a)
    .slice(0, 4);
  const photos = coverPhotos(f, artistOf);
  const town = townOf(f.location);
  const line = stampLine(stamp);
  const open = () => {
    haptic.select();
    if (recap) router.push({ pathname: '/recap/[id]', params: { id: f.id } });
    else router.push(`/festival/${f.id}`);
  };
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${f.name}, ${f.dates}${town ? `, ${town}` : ''}. ${[upcoming, line].filter(Boolean).join(' · ')}${stamp.badge ? '. Pin collected' : ''}${recap ? '. Opens your recap' : ''}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}
    >
      <FestivalCover photos={photos} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.glass]} />
      <View style={styles.cardBody}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, upcoming && { color: color.glow }]}>{upcoming ?? (recap ? 'Recap ready' : 'Been there')}</Text>
          <Text style={styles.cardName} numberOfLines={2}>
            {f.name}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {[f.dates, town].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.pin} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <EnamelPin look={pinLook(f)} size={64} locked={!stamp.badge} />
        </View>
      </View>
      <View style={styles.cardFoot}>
        <View style={styles.faces}>
          {faces.map((a, i) => (
            <View key={a.id} style={[styles.face, { marginLeft: i ? -9 : 0, zIndex: 9 - i }]}>
              <ArtistAvatar artist={a} size={26} />
            </View>
          ))}
        </View>
        <Text style={styles.cardLine} numberOfLines={1}>
          {line || (upcoming ? '' : 'Film a set next time to collect its pin')}
        </Text>
      </View>
    </Pressable>
  );
}

/** A festival from before Afterglow: its rose gold pin, name and year, and how many videos. */
function ThrowbackCard({ badge }: { badge: ThrowbackBadge }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/badge/[id]', params: { id: throwbackId(badge.key) } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${pastLabel(badge.past)}, a throwback. ${throwbackLine(badge)}. Opens its badge`}
      style={({ pressed }) => [styles.throwback, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
    >
      <EnamelPin look={throwbackLook(badge.past)} size={76} />
      <View style={styles.throwbackText}>
        <Text style={styles.throwbackKicker}>THROWBACK</Text>
        <Text style={styles.throwbackName} numberOfLines={2}>
          {pastLabel(badge.past)}
        </Text>
        <Text style={styles.throwbackSub} numberOfLines={1}>
          {[badge.past.city, `${badge.videos} ${badge.videos === 1 ? 'moment' : 'moments'}`].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const ROSE = '#F2B8A6';

const styles = StyleSheet.create({
  throwback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(242,184,166,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(242,184,166,0.32)',
  },
  throwbackText: { flex: 1, gap: 2 },
  throwbackKicker: { ...type.caption, fontSize: 10, letterSpacing: 1.5, color: ROSE, fontWeight: '700' },
  throwbackName: { ...type.headline, color: color.moon },
  throwbackSub: { ...type.caption, color: color.moonDim },
  addPast: { padding: space.lg, gap: space.xs, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(242,184,166,0.5)' },
  addPastTitle: { ...type.headline, color: ROSE },
  addPastBody: { ...type.caption, color: color.moonDim },
  addPastLink: { ...type.label, color: ROSE, marginTop: space.sm },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'center', paddingVertical: space.md, paddingHorizontal: space.lg },
  mapLinkText: { ...type.label, color: color.glow },
  root: { paddingTop: space.md },
  cards: { paddingHorizontal: space.lg, gap: space.md, marginTop: space.md },
  card: {
    height: CARD_H,
    borderRadius: radius.lg + 4,
    overflow: 'hidden',
    backgroundColor: color.night,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
    padding: space.lg,
    justifyContent: 'space-between',
  },
  glass: { backgroundColor: 'rgba(14,12,32,0.35)' },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  kicker: { ...type.caption, color: color.moonDim, textTransform: 'uppercase', letterSpacing: 1 },
  cardName: { ...type.title, color: color.moon, marginTop: 2 },
  cardMeta: { ...type.caption, color: color.moonDim, marginTop: 2 },
  pin: { marginTop: -4, marginRight: -4 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 15, borderWidth: 2, borderColor: color.night },
  cardLine: { ...type.caption, color: color.moon, flex: 1 },
  none: { ...type.body, color: color.moonDim, paddingHorizontal: space.sm },
  empty: { alignItems: 'center', paddingHorizontal: space.xxl, paddingVertical: space.xxl, gap: space.sm },
  emptyTitle: { ...type.headline, color: color.moon },
  emptyBody: { ...type.body, color: color.moonDim, textAlign: 'center' },
  emptyButton: { marginTop: space.sm, paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  emptyButtonText: { ...type.headline, color: color.moon },
});
