import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { color, space, type } from '../../theme/tokens';

/**
 * A row's title on your profile with a quiet Hide / Show beside it, so rows
 * that repeat what the tabs below hold can be tucked away. An optional link
 * sits before it.
 */
export function ShelfHead({
  title,
  hidden,
  onToggle,
  link,
  onLink,
}: {
  title: string;
  hidden: boolean;
  onToggle: () => void;
  link?: string;
  onLink?: () => void;
}) {
  return (
    <View style={styles.head}>
      <Text style={[styles.title, hidden && styles.titleHidden]} accessibilityRole="header">
        {title}
      </Text>
      {!hidden && link && onLink ? (
        <Pressable
          onPress={() => {
            haptic.select();
            onLink();
          }}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.linkText}>{link}</Text>
          <ChevronIcon color={color.moonFaint} size={10} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => {
          haptic.select();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityLabel={hidden ? `Show ${title.toLowerCase()}` : `Hide ${title.toLowerCase()}`}
        hitSlop={8}
        style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.toggleText}>{hidden ? 'Show' : 'Hide'}</Text>
        <ChevronIcon color={color.moonFaint} size={10} direction={hidden ? 'down' : 'up'} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, marginBottom: space.sm },
  title: { ...type.headline, color: color.moon, flex: 1 },
  titleHidden: { color: color.moonDim },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { ...type.caption, color: color.moonDim },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(243,240,255,0.06)' },
  toggleText: { ...type.caption, color: color.moonDim },
});
