import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { unreadCount } from '../features/notifications/inbox';
import { haptic } from '../lib/haptics';
import { useNotices } from '../state/notices';
import { color, type } from '../theme/tokens';
import { GlassFill } from './LiquidGlass';
import { BellIcon } from './TabIcons';
import { t } from '../i18n';

/** The notifications bell: a glass circle with a glowing count when something is new. */
export function NoticeBell() {
  const { list, read, hydrated } = useNotices();
  const unread = hydrated ? unreadCount(list, read) : 0;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push('/notifications');
      }}
      accessibilityRole="button"
      accessibilityLabel={unread ? t('Notifications, {n} new', { n: unread }) : t('Notifications')}
      hitSlop={10}
      style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <GlassFill radius={20} />
      {/* Its own layer, so the glass never paints over the bell in a browser. */}
      <View pointerEvents="none">
        <BellIcon color={unread ? color.moon : color.moonDim} />
      </View>
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glow,
    shadowColor: color.glow,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  badgeText: { ...type.caption, fontSize: 11, lineHeight: 13, color: color.night, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
