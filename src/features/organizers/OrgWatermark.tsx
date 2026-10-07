import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useOrgs } from '../../state/orgs';
import { ORG_ASSETS } from './brandAssets';
import { AlchemyMark } from './OrgMark';
import { orgOfAccount } from './organizers';

/** How strongly the watermark shows: there if you look, never in the way. */
const OPACITY = 0.5;

/**
 * A small, faint logo over a video an event organizer's account posted (its
 * uploaded icon, else its official one, else its drawn mark), placed by
 * `style`. Nothing for anyone else's. Only drawn over the player: the video
 * file itself is unchanged. Hidden from screen readers (the poster is named
 * beside the video).
 */
export function OrgWatermark({ uid, size = 22, style }: { uid: string | undefined; size?: number; style?: StyleProp<ViewStyle> }) {
  const org = orgOfAccount(useOrgs(), uid);
  if (!org) return null;
  const icon = org.iconUrl ? { uri: org.iconUrl } : ORG_ASSETS[org.id]?.icon;
  if (!icon && org.mark !== 'alchemy') return null;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="org-watermark" style={[styles.mark, style]}>
      {icon ? (
        <Image source={icon} style={{ width: size, height: size, borderRadius: org.iconUrl ? size / 4 : 0 }} contentFit={org.iconUrl ? 'cover' : 'contain'} />
      ) : (
        <AlchemyMark size={size} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { position: 'absolute', opacity: OPACITY, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
});
