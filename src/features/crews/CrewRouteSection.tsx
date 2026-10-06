import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FilterChips } from '../../components/FilterChips';
import { stageName } from '../../data/festival';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useTaste } from '../../state/taste';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { formatTime } from '../festivals/format';
import { clockTime, stintLabel } from '../plan/route';
import { PictureShareSheet } from '../plan/PictureShareSheet';
import { crewRoute, crewRouteCard, type CrewDay, namesLine } from './crewRoute';
import { t } from '../../i18n';

const at = (min: number) => formatTime(clockTime(min));

/**
 * "Our route": one set-to-set plan for the crew once set times are out, from
 * your taste pulled towards everyone's stars, with who splits off where.
 */
export function CrewRouteSection({
  festival,
  me,
  members,
  stars,
  nameOf,
  crewName,
}: {
  festival: Festival;
  me: string;
  members: readonly string[];
  stars: Record<string, readonly string[]>;
  nameOf: (uid: string) => string;
  crewName: string;
}) {
  const { taste, informed } = useTaste();
  const { artists } = useCatalog();
  const days = useMemo(
    () => crewRoute({ festival, artists, taste, informed, me, stars, members }),
    [festival, artists, taste, informed, me, stars, members],
  );
  const withSets = days.filter((d) => d.stops.length);
  const [picked, setPicked] = useState<string | undefined>();
  const [sharing, setSharing] = useState(false);
  const card = sharing ? crewRouteCard(festival, crewName, withSets, me, nameOf) : undefined;
  const day = withSets.find((d) => d.day === picked) ?? withSets[0];
  if (!day) return null;

  // The route goes out as a picture, with the text as a second choice.
  const share = () => {
    haptic.select();
    setSharing(true);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.section}>{t('Our route')}</Text>
        <Pressable onPress={share} accessibilityRole="button" accessibilityLabel={t('Share our route')} hitSlop={8}>
          <Text style={styles.link}>{t('Share')}</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>{t('Set to set for the whole crew: your taste, pulled towards everyone’s stars. Sets half of you starred are must-sees.')}</Text>
      {withSets.length > 1 ? (
        <FilterChips
          chips={withSets.map((d) => ({ key: d.day, label: t(d.day), accessibilityLabel: `${t(d.day)}, ${t('{n} sets', { n: d.stops.filter((s) => s.kind === 'set').length })}` }))}
          value={day.day}
          onChange={(k) => setPicked(k ?? withSets[0].day)}
          inset={0}
        />
      ) : null}
      <DayList festival={festival} day={day} me={me} nameOf={nameOf} />
      {card ? (
        <PictureShareSheet
          visible
          onClose={() => setSharing(false)}
          heading={t('Share our route')}
          card={card}
          text={crewRouteText(festival, crewName, withSets, me, nameOf)}
          shareTitle={t('{crew} at {festival}', { crew: crewName, festival: festival.name })}
          label={t("{crew}'s route at {festival}", { crew: crewName, festival: festival.name })}
        />
      ) : null}
    </View>
  );
}

function DayList({ festival, day, me, nameOf }: { festival: Festival; day: CrewDay; me: string; nameOf: (uid: string) => string }) {
  const splitVars = (s: CrewDay['splits'][number]) => ({
    names: namesLine(s.who, me, nameOf),
    artist: s.artist.name,
    time: formatTime(s.set.start),
    stage: stageName(festival, s.set.stageId),
    back: formatTime(s.backAt),
  });
  return (
    <View style={styles.list}>
      {day.stops.map((stop) =>
        stop.kind === 'break' ? (
          <Text key={`break-${stop.from}`} style={styles.break}>
            {stop.to - stop.from <= 20 ? t('{n} min break', { n: stop.to - stop.from }) : t('Break until {time}', { time: at(stop.to) })}
          </Text>
        ) : (
          <Pressable
            key={`${stop.artist.id}-${stop.from}`}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/artist/[id]', params: { id: stop.artist.id, festival: festival.id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${at(stop.from)}, ${stop.artist.name}, ${stageName(festival, stop.set.stageId)}, ${stintLabel(stop).toLowerCase()}${stop.pinned ? `, ${t('a must-see for the crew')}` : ''}${day.starredBy[stop.artist.id] ? `, ${t('starred by {names}', { names: namesLine(day.starredBy[stop.artist.id], me, nameOf) })}` : ''}`}
            style={({ pressed }) => [styles.stop, stop.pinned && styles.must, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.time}>{at(stop.from)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {stop.artist.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {stageName(festival, stop.set.stageId)} · {stintLabel(stop)}
              </Text>
              {day.starredBy[stop.artist.id] ? (
                <Text style={styles.stars} numberOfLines={1}>
                  ★ {namesLine(day.starredBy[stop.artist.id], me, nameOf)}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ),
      )}
      {day.splits.map((s) => (
        <View
          key={`split-${s.artist.id}-${s.set.start}`}
          style={styles.split}
          accessible
          accessibilityLabel={
            s.during
              ? t('{names} could split off for {artist} at {time}, {stage}, while the crew is at {during}. Meet up at {back}.', { ...splitVars(s), during: s.during.name })
              : t('{names} could split off for {artist} at {time}, {stage}. Meet up at {back}.', splitVars(s))
          }
        >
          <Text style={styles.splitHead}>{t('Split off')}</Text>
          <Text style={styles.splitText}>
            {s.during
              ? t('{names} → {artist}, {time}, {stage} (crew at {during}). Meet up at {back}.', { ...splitVars(s), during: s.during.name })
              : t('{names} → {artist}, {time}, {stage}. Meet up at {back}.', splitVars(s))}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The crew's route as a message. */
export function crewRouteText(festival: Festival, crewName: string, days: CrewDay[], me: string, nameOf: (uid: string) => string): string {
  const parts = [t('{crew} at {festival}, set to set', { crew: crewName, festival: festival.name })];
  for (const d of days) {
    parts.push('', t(d.day));
    for (const s of d.stops) {
      if (s.kind !== 'set') continue;
      parts.push(`${at(s.from)}  ${s.pinned ? '★ ' : ''}${s.artist.name}, ${stageName(festival, s.set.stageId)}`);
    }
    for (const s of d.splits) parts.push(t('Split: {names} to {artist} at {time}', { names: namesLine(s.who, me, nameOf), artist: s.artist.name, time: formatTime(s.set.start) }));
  }
  parts.push('', t('Made with {app}', { app: 'Afterglow' }));
  return parts.join('\n');
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  link: { ...type.label, color: color.glow },
  note: { ...type.caption, color: color.moonFaint },
  list: { gap: space.sm, marginTop: space.xs },
  stop: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  must: { borderColor: glowA(0.55), backgroundColor: glowA(0.1) },
  time: { ...type.label, color: color.moonDim, width: 64, fontVariant: ['tabular-nums'] },
  name: { ...type.headline, color: color.moon },
  meta: { ...type.caption, color: color.moonDim, marginTop: 2 },
  stars: { ...type.caption, color: color.glow, marginTop: 2 },
  break: { ...type.caption, color: color.moonFaint, paddingLeft: 64 + space.md + space.md },
  split: { padding: space.md, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: color.hairline, gap: 2 },
  splitHead: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  splitText: { ...type.body, color: color.moon },
});
