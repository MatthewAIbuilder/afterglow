import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { formatTime } from '../festivals/format';
import { color, radius, space, type } from '../../theme/tokens';
import type { Tracklist } from './tracklist';
import { t, tn } from '../../i18n';

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : formatTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
};

/**
 * A set's crowd tracklist: the songs people's videos caught, in the order
 * they were heard, with how many people caught each. Each opens the video.
 * `title` says whose set (on a festival's page) or where (on an artist's).
 */
export function TracklistCard({ list, title }: { list: Tracklist; title: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.sub}>{tn(list.tracks.length, '{n} track heard by the crowd', '{n} tracks heard by the crowd')}</Text>
      {list.tracks.map((x, i) => (
        <Pressable
          key={`${x.track.title}|${x.track.artist}`}
          onPress={() => {
            haptic.select();
            router.push({ pathname: '/shared/[id]', params: { id: x.memoryId } });
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t('{n}.', { n: i + 1 })} ${t('{title} by {artist}', { title: x.track.title, artist: x.track.artist })}, ${timeOf(x.at)}${x.people > 1 ? `, ${tn(x.people, '{n} person caught it', '{n} people caught it')}` : ''}. ${t('Opens the video.')}`}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
        >
          <Text style={styles.time}>{timeOf(x.at)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.song} numberOfLines={1}>
              {x.track.title}
            </Text>
            <Text style={styles.by} numberOfLines={1}>
              {x.track.artist}
            </Text>
          </View>
          {x.people > 1 ? <Text style={styles.count}>{t('×{n}', { n: x.people })}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  title: { ...type.headline, color: color.moon },
  sub: { ...type.caption, color: color.moonDim, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  time: { ...type.caption, color: color.moonFaint, width: 64, fontVariant: ['tabular-nums'] },
  song: { ...type.label, color: color.moon },
  by: { ...type.caption, color: color.moonDim },
  count: { ...type.caption, color: color.glow, fontVariant: ['tabular-nums'] },
});
