import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

/**
 * A profile's cover photo, across the top behind the header: darkened at
 * the very top for the status bar and fading into the night below, so the
 * name and buttons stay readable over any photo. Nothing without a photo.
 */
export function ProfileCover({ url, height }: { url?: string; height: number }) {
  if (!url) return null;
  return (
    <View style={[styles.root, { height }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      <LinearGradient colors={['rgba(10,9,24,0.55)', 'rgba(10,9,24,0.05)', 'rgba(10,9,24,0.35)', 'rgba(10,9,24,1)']} locations={[0, 0.3, 0.65, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
