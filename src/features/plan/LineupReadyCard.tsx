import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { stageName } from '../../data/festival';
import type { Festival } from '../../data/types';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { formatTime } from '../festivals/format';
import { countdown, isLive } from '../festivals/when';
import { LiveNow } from './LiveNow';
import { routePreview, routeSummary } from './ready';
import { clockTime, stintLabel } from './route';
import { useFestivalPlan } from './useFestivalPlan';

const at = (min: number) => formatTime(clockTime(min));

/**
 * Set times are out for a festival you're going to: the top of the
 * Festivals tab becomes your set-to-set plan. During the festival it shows
 * what to be at now and next; before, the first night's first few stops.
 * Tap it for the whole route.
 */
export function LineupReadyCard({ festival }: { festival: Festival }) {
  const today = useToday();
  const { schedule, route } = useFestivalPlan(festival);
  const live = isLive(festival, today);
  const preview = routePreview(route);
  const summary = routeSummary(route);
  const soon = countdown(festival, today);
  const open = () => {
    haptic.select();
    router.push(`/festival/${festival.id}`);
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`Your lineup is ready: ${festival.name}${soon ? `, ${soon}` : ''}. ${summary ?? 'Set times are out'}. Open your set-to-set plan`}
      style={({ pressed }) => [styles.card, live && styles.live, pressed && styles.pressed]}
      testID="lineup-ready"
    >
      <View style={styles.kickerRow}>
        <View style={[styles.dot, live && { backgroundColor: '#FF7EB6' }]} />
        <Text style={[styles.kicker, live && { color: '#FF7EB6' }]}>{live ? 'Happening now' : 'Your lineup is ready'}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {festival.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {[soon, summary ?? 'Set times are out'].filter(Boolean).join(' · ')}
      </Text>

      {live && schedule ? (
        <View style={styles.liveWrap}>
          <LiveNow festival={festival} schedule={schedule} route={route} />
        </View>
      ) : preview ? (
        <View style={styles.stops}>
          <Text style={styles.day}>{preview.day}, set to set</Text>
          {preview.stops.map((s) => (
            <View key={`${s.artist.id}-${s.from}`} style={styles.stop}>
              <Text style={styles.time}>{at(s.from)}</Text>
              <ArtistAvatar artist={s.artist} size={28} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.artist, s.pinned && { color: color.glow }]} numberOfLines={1}>
                  {s.pinned ? '★ ' : ''}
                  {s.artist.name}
                </Text>
                <Text style={styles.stage} numberOfLines={1}>
                  {stageName(festival, s.set.stageId)} · {stintLabel(s)}
                </Text>
              </View>
            </View>
          ))}
          {preview.more ? <Text style={styles.more}>and {preview.more} more that night</Text> : null}
        </View>
      ) : null}

      <View style={styles.button}>
        <Text style={styles.buttonText}>{live ? 'Your night' : 'See your whole route'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.lg,
    marginBottom: space.xl,
    padding: space.xl,
    borderRadius: radius.lg + 4,
    backgroundColor: glowA(0.14),
    borderWidth: 1,
    borderColor: glowA(0.55),
    shadowColor: color.glow,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  live: { borderColor: 'rgba(255,126,182,0.6)', shadowColor: '#FF7EB6' },
  liveWrap: { marginTop: space.lg },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.glow },
  kicker: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1.2 },
  name: { ...type.largeTitle, fontSize: 28, lineHeight: 33, color: color.moon, marginTop: space.sm },
  meta: { ...type.body, color: color.moonDim, marginTop: 2 },
  stops: { marginTop: space.lg, gap: space.sm },
  day: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  time: { ...type.caption, color: color.moonDim, width: 64, fontVariant: ['tabular-nums'] },
  artist: { ...type.headline, color: color.moon },
  stage: { ...type.caption, color: color.moonDim },
  more: { ...type.caption, color: color.moonFaint, marginLeft: 64 + space.sm },
  button: { marginTop: space.lg, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  buttonText: { ...type.headline, color: color.night },
});
