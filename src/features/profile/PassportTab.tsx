import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { FilterChips } from '../../components/FilterChips';
import { MapIcon } from '../../components/TabIcons';
import type { Artist } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA, accentEdge } from '../../theme/tokens';
import { type ThrowbackBadge, pinLook, throwbackId, throwbackLine, throwbackLook, townOf } from '../badges/badges';
import { pastLabel } from '../memories/past';
import { EnamelPin } from '../badges/EnamelPin';
import { coverPhotos } from '../festivals/cover';
import { FestivalCover } from '../festivals/FestivalCover';
import { countdown } from '../festivals/when';
import { type Passport, type Stamp, stampLine } from './passport';
import { t, tn } from '../../i18n';
import { datesLine } from '../festivals/format';
import type { GoingShow } from '../festivals/goingShows';
import { GoingShowsList } from '../festivals/GoingShowsList';

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
  /** One-night shows you're going to (coming up), under Planning after your festivals. They never count as festivals. */
  shows?: readonly GoingShow[];
};

type Side = 'planning' | 'been';

/**
 * Your festival passport: a card for every festival you're planning and every
 * one you've been to, with the headliners' faces behind, your pin (or the
 * pin still to collect), what you filmed there or how many acts you'd love.
 */
export function PassportTab({ passport, artistOf, loves, recapIds, today, onFind, children, throwbacks = [], onAddPast, shows = [] }: Props) {
  const beenCount = passport.been.length + throwbacks.length;
  const planningCount = passport.planning.length + shows.length;
  const [side, setSide] = useState<Side>(planningCount || !beenCount ? 'planning' : 'been');
  const stamps = side === 'planning' ? passport.planning : passport.been;
  const empty = !planningCount && !beenCount;
  return (
    <View style={styles.root}>
      {empty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('Your festival passport')}</Text>
          <Text style={styles.emptyBody}>{t('Tap I’m going on a festival and it gets a page here. Film a set there and you collect its pin.')}</Text>
          {onAddPast ? (
            <Pressable onPress={onAddPast} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.addPastLink}>{t('Add a festival you went to before')}</Text>
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
            <Text style={styles.emptyButtonText}>{t('Find festivals')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FilterChips
            chips={[
              { key: 'planning', label: t('Planning'), count: planningCount, accessibilityLabel: t('Planning, {n}', { n: planningCount }) },
              { key: 'been', label: t('Been there'), count: beenCount, accessibilityLabel: t('Been there, {n}', { n: beenCount }) },
            ]}
            value={side}
            onChange={(k) => k && setSide(k as Side)}
          />
          <View style={styles.cards}>
            {stamps.map((s) => (
              <PassportCard key={s.festival.id} stamp={s} planning={side === 'planning'} artistOf={artistOf} loves={loves} recap={recapIds.has(s.festival.id)} today={today} />
            ))}
            {side === 'planning' ? <GoingShowsList shows={shows} /> : null}
            {side === 'been' ? throwbacks.map((tb) => <ThrowbackCard key={tb.key} badge={tb} />) : null}
            {side === 'been' && onAddPast ? (
              <Pressable
                onPress={() => {
                  haptic.select();
                  onAddPast();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Add a festival you went to before, with a video from your camera roll')}
                style={({ pressed }) => [styles.addPast, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.addPastTitle}>{t('+ Add a past festival')}</Text>
                <Text style={styles.addPastBody}>{t('A video from your camera roll, tagged with the festival and year, earns a rose gold throwback badge.')}</Text>
              </Pressable>
            ) : null}
            {stamps.length || (side === 'planning' && shows.length) || (side === 'been' && (throwbacks.length || onAddPast)) ? null : (
              <Text style={styles.none}>
                {side === 'been' ? t('Festivals you’ve been to collect here, with what you filmed.') : t('Tap I’m going on a festival to plan it here.')}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/festival-map', params: { show: 'going' } });
            }}
            accessibilityRole="button"
            accessibilityLabel={t('See your festivals on the map')}
            style={({ pressed }) => [styles.mapLink, pressed && { opacity: 0.7 }]}
          >
            <MapIcon color={color.glow} size={16} />
            <Text style={styles.mapLinkText}>{t('Your festivals on the map')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.select();
              router.push('/seen');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Sets you’ve seen: every set you were at, and how it was')}
            style={({ pressed }) => [styles.mapLink, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.mapLinkText}>{t('Sets you’ve seen')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.select();
              router.push('/fits');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Your fit checks: what you wore, day by day')}
            style={({ pressed }) => [styles.mapLink, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.mapLinkText}>{t('Your fit checks')}</Text>
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
  const upcoming = planning ? (when && when !== t('Over') ? when : t('Date to come')) : undefined;
  const dates = datesLine(f);
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
      accessibilityLabel={`${f.name}, ${dates}${town ? `, ${town}` : ''}. ${[upcoming, line].filter(Boolean).join(' · ')}${stamp.badge ? `. ${t('Pin collected')}` : ''}${recap ? `. ${t('Opens your recap')}` : ''}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}
    >
      <FestivalCover photos={photos} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.glass]} />
      <View style={styles.cardBody}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, upcoming && { color: color.glow }]}>{upcoming ?? (recap ? t('Recap ready') : t('Been there'))}</Text>
          <Text style={styles.cardName} numberOfLines={2}>
            {f.name}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {[dates, town].filter(Boolean).join(' · ')}
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
          {line || (upcoming ? '' : t('Film a set next time to collect its pin'))}
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
      accessibilityLabel={t('{name}, a throwback. {line}. Opens its badge', { name: pastLabel(badge.past), line: throwbackLine(badge) })}
      style={({ pressed }) => [styles.throwback, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
    >
      <EnamelPin look={throwbackLook(badge.past)} size={76} />
      <View style={styles.throwbackText}>
        <Text style={styles.throwbackKicker}>{t('THROWBACK')}</Text>
        <Text style={styles.throwbackName} numberOfLines={2}>
          {pastLabel(badge.past)}
        </Text>
        <Text style={styles.throwbackSub} numberOfLines={1}>
          {[badge.past.city, tn(badge.videos, '{n} moment', '{n} moments')].filter(Boolean).join(' · ')}
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
  emptyButton: { marginTop: space.sm, paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, ...accentEdge },
  emptyButtonText: { ...type.headline, color: color.moon },
});
