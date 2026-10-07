import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useGoing } from '../../state/going';
import { useSocial } from '../../state/social';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';
import { countdown } from '../festivals/when';
import { isOver } from '../festivals/shelves';
import { datesLine } from '../festivals/format';
import { activityText, friendActivity, shortAgo, type ActivityItem } from '../social/friendActivity';
import type { Profile, SharedMemory } from '../social/models';
import { tasteMix } from '../taste/lean';
import { useToday } from '../../lib/useToday';
import { SectionHeader } from './SectionHeader';
import { t } from '../../i18n';

/**
 * What the people you follow have been up to: moments they shared, festivals
 * they're going to, and whose taste is close to yours, after `between` (the
 * Friends page puts your crews there). `profiles` and `memories` come from
 * `useFriendsCircle`.
 */
export function FriendsActivity({ between, profiles, memories }: { between?: React.ReactNode; profiles: Profile[] | undefined; memories: SharedMemory[] }) {
  const social = useSocial();
  const me = social.profile;
  const catalog = useCatalog();
  const today = useToday();
  const now = useNow();
  const { going } = useGoing();
  const { taste, informed } = useTaste();
  const mix = useMemo(() => tasteMix(catalog.artists, taste, informed), [catalog.artists, taste, informed]);

  const upcoming = useCallback(
    (id: string): Festival | undefined => {
      const f = catalog.festival(id);
      return f && !isOver(f, today) ? f : undefined;
    },
    [catalog, today],
  );
  const nowMs = now.getTime();
  const items = useMemo(
    () => friendActivity({ profiles: profiles ?? [], memories, upcoming, mine: { sounds: mix, going }, blocked: social.blocked, now: nowMs }),
    [profiles, memories, upcoming, mix, going, social.blocked, nowMs],
  );

  // With no one followed yet, only what goes between (your crews) shows.
  if (!me || !profiles?.length) return <>{between}</>;

  const open = (item: ActivityItem) => {
    haptic.select();
    if (item.kind === 'moment') router.push({ pathname: '/shared/[id]', params: { id: item.memory.id } });
    else if (item.kind === 'going') router.push(`/festival/${item.festival.id}`);
    else router.push({ pathname: '/u/[handle]', params: { handle: item.profile.handle } });
  };

  return (
    <View>
      {between}

      {items.length ? (
        <>
          <SectionHeader title={t('Recent activity')} />
          <View style={styles.list}>
            {items.map((item) => {
              const text = activityText(item, (id) => catalog.artist(id)?.name);
              const detail =
                item.kind === 'moment'
                  ? [item.memory.festivalId ? catalog.festival(item.memory.festivalId)?.name : undefined, shortAgo(item.at, nowMs)].filter(Boolean).join(' · ')
                  : item.kind === 'going'
                    ? (countdown(item.festival, today) ?? datesLine(item.festival))
                    : t('From the sounds you both love');
              return (
                <Pressable
                  key={item.id}
                  onPress={() => open(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${text}. ${detail}`}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
                >
                  <PersonAvatar name={item.profile.displayName} url={item.profile.avatarUrl} size={40} uid={item.profile.uid} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowText} numberOfLines={2}>
                      {text}
                    </Text>
                    <Text style={[styles.rowDetail, item.kind === 'match' && { color: color.glow }]} numberOfLines={1}>
                      {detail}
                    </Text>
                  </View>
                  {item.kind === 'moment' && item.memory.thumbUrl ? (
                    <Image source={{ uri: item.memory.thumbUrl }} style={styles.thumb} contentFit="cover" />
                  ) : item.kind === 'match' ? (
                    <Text style={styles.match}>{item.percent}%</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  rowText: { ...type.body, color: color.moon },
  rowDetail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  thumb: { width: 40, height: 52, borderRadius: radius.sm },
  match: { ...type.headline, color: color.glow, fontVariant: ['tabular-nums'] },
});
