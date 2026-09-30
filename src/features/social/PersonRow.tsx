import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import { color, space, type } from '../../theme/tokens';
import { FollowButton } from './FollowButton';
import type { Profile } from './models';

/** A person in a list (search, followers, following): photo, name and @handle, opening their profile, with Follow beside it. */
export function PersonRow({ profile: p, follow = false, onOpen }: { profile: Profile; follow?: boolean; onOpen?: () => void }) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          onOpen?.();
          router.push({ pathname: '/u/[handle]', params: { handle: p.handle } });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${p.displayName}, @${p.handle}`}
        style={({ pressed }) => [styles.open, pressed && { opacity: 0.75 }]}
      >
        <View style={styles.avatar}>
          {p.avatarUrl ? <Image source={{ uri: p.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.initial}>{p.displayName.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {p.displayName}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{p.handle}
          </Text>
        </View>
        {follow ? null : <ChevronIcon color={color.moonFaint} size={12} />}
      </Pressable>
      {follow ? <FollowButton uid={p.uid} handle={p.handle} compact /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: color.haze, alignItems: 'center', justifyContent: 'center' },
  initial: { ...type.headline, color: color.moon },
  name: { ...type.headline, color: color.moon },
  handle: { ...type.caption, color: color.moonDim },
});
