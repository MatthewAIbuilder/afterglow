import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { haptic } from '../../lib/haptics';
import { useFriendAdds } from '../../state/friendAdds';
import { color, radius, space, type } from '../../theme/tokens';
import { addLine } from './adds';
import { t } from '../../i18n';

/**
 * Friends you scanned: waiting for signal (amber, sends by itself), friends
 * now (opens their profile), or couldn't be added (try again or remove).
 */
export function FriendAddsList() {
  const { adds, retry, remove } = useFriendAdds();
  if (!adds.length) return null;
  const waiting = adds.filter((a) => a.state === 'waiting').length;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{waiting ? t('Scanned · {n} waiting for signal', { n: waiting }) : t('Scanned')}</Text>
      {adds.map((a) => {
        const line = addLine(a);
        const body = (
          <>
            <PersonAvatar name={a.name} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {a.name} <Text style={styles.handle}>@{a.handle}</Text>
              </Text>
              <Text style={[styles.line, a.state === 'waiting' && styles.waiting, a.state === 'added' && styles.added]} numberOfLines={2}>
                {line}
              </Text>
            </View>
          </>
        );
        if (a.state === 'failed')
          return (
            <View key={a.uid} style={styles.row} accessible accessibilityLabel={`${a.name}, @${a.handle}. ${line}`}>
              {body}
              <Pressable onPress={() => retry(a.uid)} accessibilityRole="button" accessibilityLabel={t('Try adding {name} again', { name: a.name })} hitSlop={8}>
                <Text style={styles.action}>{t('Try again')}</Text>
              </Pressable>
              <Pressable onPress={() => remove(a.uid)} accessibilityRole="button" accessibilityLabel={t('Remove {name} from this list', { name: a.name })} hitSlop={8}>
                <Text style={styles.remove}>{t('Remove')}</Text>
              </Pressable>
            </View>
          );
        return (
          <Pressable
            key={a.uid}
            disabled={a.state !== 'added'}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/u/[handle]', params: { handle: a.handle } });
            }}
            accessibilityRole={a.state === 'added' ? 'button' : undefined}
            accessibilityLabel={`${a.name}, @${a.handle}. ${line}`}
            style={({ pressed }) => [styles.row, a.state === 'waiting' && styles.rowWaiting, pressed && { opacity: 0.8 }]}
          >
            {body}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.lg, gap: space.sm },
  title: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  rowWaiting: { borderStyle: 'dashed', borderColor: 'rgba(255,184,107,0.6)' },
  name: { ...type.headline, color: color.moon },
  handle: { ...type.body, color: color.moonDim },
  line: { ...type.caption, color: color.moonDim, marginTop: 2 },
  waiting: { color: '#FFB86B' },
  added: { color: color.glow },
  action: { ...type.label, color: color.glow },
  remove: { ...type.label, color: color.moonFaint },
});
