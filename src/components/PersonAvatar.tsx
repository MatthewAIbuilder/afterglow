import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { OrgDot } from '../features/organizers/OrgMark';
import { orgOfAccount } from '../features/organizers/organizers';
import { useOrgs } from '../state/orgs';
import { color } from '../theme/tokens';

/**
 * Someone's profile photo, or the first letter of their name on the night's
 * haze. Given `uid`, an event organizer's account shows the organizer's logo
 * instead, the same as on its profile.
 */
export function PersonAvatar({ name, url, size, uid }: { name?: string; url?: string; size: number; uid?: string }) {
  const org = orgOfAccount(useOrgs(), uid);
  if (org) return <OrgDot org={org} size={size} />;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{(name ?? '?').slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { overflow: 'hidden', backgroundColor: color.haze, alignItems: 'center', justifyContent: 'center' },
  initial: { color: color.moon, fontWeight: '700' },
});
