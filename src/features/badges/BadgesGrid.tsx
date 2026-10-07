import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { type Badge, type ThrowbackBadge, pinLook, throwbackId, throwbackLook } from './badges';
import { type PastEvent, pastLabel } from '../memories/past';
import { EnamelPin } from './EnamelPin';
import { NewTag } from '../profile/Milestones';
import { t, tn } from '../../i18n';

/**
 * A collection of festival pins, three across: earned ones in gold with the
 * festival and when, then (on your own profile) the festivals you're going
 * to as dim silver pins still to collect. Each opens the pin's own page.
 */
export function BadgesGrid({
  badges,
  toCollect = [],
  festivalOf,
  uid,
  width,
  mine,
  isNew,
  onClaim,
  throwbacks = [],
  isNewThrowback,
  onClaimThrowback,
  onAddPast,
}: {
  badges: Badge[];
  toCollect?: Festival[];
  festivalOf: (id: string) => Festival | undefined;
  uid?: string;
  width: number;
  mine?: boolean;
  /** Collected but not claimed yet: glows New, and a tap claims it. */
  isNew?: (festivalId: string) => boolean;
  onClaim?: (festival: Festival) => void;
  /** Past festivals added from the camera roll: rose gold pins. */
  throwbacks?: readonly ThrowbackBadge[];
  isNewThrowback?: (key: string) => boolean;
  onClaimThrowback?: (past: PastEvent) => void;
  /** Your own profile: add a video from a festival you went to before. */
  onAddPast?: () => void;
}) {
  const cols = 3;
  const cell = Math.floor((width - space.lg * 2 - space.md * (cols - 1)) / cols);
  const open = (festivalId: string) => {
    haptic.select();
    router.push({ pathname: '/badge/[id]', params: { id: festivalId, ...(uid ? { uid } : {}) } });
  };
  const earned = badges.map((b) => ({ b, f: festivalOf(b.festivalId) })).filter((x): x is { b: Badge; f: Festival } => !!x.f);
  return (
    <View style={styles.wrap}>
      {earned.length ? (
        <>
          <Text style={styles.head}>
            {tn(earned.length, '{n} badge collected', '{n} badges collected')}
          </Text>
          <View style={styles.grid}>
            {earned.map(({ b, f }) => {
              const fresh = !!isNew?.(b.festivalId) && !!onClaim;
              return (
                <Pressable
                  key={b.festivalId}
                  onPress={() => {
                    if (fresh) {
                      haptic.select();
                      onClaim?.(f);
                    } else open(b.festivalId);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    fresh
                      ? t('{festival} badge, new. Tap to claim it', { festival: f.name })
                      : tn(b.videos, '{festival} badge, collected. {n} video filmed there. Opens the badge', '{festival} badge, collected. {n} videos filmed there. Opens the badge', { festival: f.name })
                  }
                  style={({ pressed }) => [styles.cell, { width: cell }, pressed && styles.pressed]}
                >
                  <EnamelPin look={pinLook(f)} size={cell} />
                  {fresh ? <NewTag /> : null}
                  <Text style={styles.name} numberOfLines={2}>
                    {f.name}
                  </Text>
                  {fresh ? <Text style={styles.claim}>{t('Tap to claim')}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : throwbacks.length ? (
        <Text style={[styles.hint, { marginTop: 0 }]}>{mine ? t('Film a set at a festival, on its dates, and share it: its gold pin joins your collection.') : t('Gold pins come from videos filmed at a festival, on its dates.')}</Text>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{mine ? t('Collect a badge for every festival') : t('No badges yet')}</Text>
          <Text style={styles.emptyBody}>
            {mine
              ? t('Film a video at a festival and share it, tagged with the festival: its badge joins your collection. Only videos filmed there, on its dates, count.')
              : t('Badges come from videos filmed at a festival, on its dates.')}
          </Text>
        </View>
      )}
      {throwbacks.length || onAddPast ? (
        <>
          <Text style={[styles.head, styles.roseHead, (earned.length > 0 || throwbacks.length === 0) && { marginTop: space.lg }]}>
            {throwbacks.length ? t('Throwbacks · {n}', { n: throwbacks.length }) : t('Throwbacks')}
          </Text>
          <View style={styles.grid}>
            {throwbacks.map((tb) => {
              const fresh = !!isNewThrowback?.(tb.key) && !!onClaimThrowback;
              return (
                <Pressable
                  key={tb.key}
                  onPress={() => {
                    if (fresh) {
                      haptic.select();
                      onClaimThrowback?.(tb.past);
                    } else open(throwbackId(tb.key));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={fresh ? t('{name} throwback badge, new. Tap to claim it', { name: pastLabel(tb.past) }) : t('{name} throwback badge. Opens the badge', { name: pastLabel(tb.past) })}
                  style={({ pressed }) => [styles.cell, { width: cell }, pressed && styles.pressed]}
                >
                  <EnamelPin look={throwbackLook(tb.past)} size={cell} />
                  {fresh ? <NewTag /> : null}
                  <Text style={styles.name} numberOfLines={2}>
                    {pastLabel(tb.past)}
                  </Text>
                  {fresh ? <Text style={styles.claim}>{t('Tap to claim')}</Text> : null}
                </Pressable>
              );
            })}
            {onAddPast ? (
              <Pressable
                onPress={() => {
                  haptic.select();
                  onAddPast();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Add a festival you went to before, with a video from your camera roll')}
                style={({ pressed }) => [styles.cell, { width: cell }, pressed && styles.pressed]}
              >
                <View style={[styles.addPin, { width: cell * 0.78, height: cell * 0.78, borderRadius: cell * 0.39, marginVertical: cell * 0.11 }]}>
                  <Text style={styles.addPlus}>+</Text>
                </View>
                <Text style={[styles.name, styles.roseName]} numberOfLines={2}>
                  {t('Add a past festival')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {onAddPast && !throwbacks.length ? (
            <Text style={styles.hint}>{t('Been to festivals before Afterglow? Add a video from your camera roll and tag the festival: it gets a rose gold throwback badge.')}</Text>
          ) : null}
        </>
      ) : null}
      {mine && toCollect.length ? (
        <>
          <Text style={[styles.head, { marginTop: space.lg }]}>{t('To collect')}</Text>
          <View style={styles.grid}>
            {toCollect.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => open(f.id)}
                accessibilityRole="button"
                accessibilityLabel={t('{festival} badge, not collected yet. Film a video there to collect it', { festival: f.name })}
                style={({ pressed }) => [styles.cell, { width: cell }, pressed && styles.pressed]}
              >
                <EnamelPin look={pinLook(f)} size={cell} locked />
                <Text style={[styles.name, styles.lockedName]} numberOfLines={2}>
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.lg },
  head: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.md, paddingHorizontal: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { alignItems: 'center', gap: space.xs },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  name: { ...type.caption, color: color.moon, textAlign: 'center', fontWeight: '600' },
  lockedName: { color: color.moonFaint },
  roseHead: { color: '#F2B8A6' },
  roseName: { color: '#F2B8A6' },
  addPin: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(242,184,166,0.7)', backgroundColor: 'rgba(242,184,166,0.06)' },
  addPlus: { ...type.title, color: '#F2B8A6' },
  hint: { ...type.caption, color: color.moonDim, marginTop: space.md, paddingHorizontal: space.xs },
  claim: { ...type.caption, fontSize: 11, color: '#FFE38A', marginTop: -2 },
  empty: { padding: space.xl, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  emptyTitle: { ...type.headline, color: color.moon },
  emptyBody: { ...type.body, color: color.moonDim },
});
