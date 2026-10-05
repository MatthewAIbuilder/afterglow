import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCatalogSettled } from '../state/catalog';
import { color, space, type } from '../theme/tokens';
import { NightSky } from './NightSky';
import { PageActions } from './PageActions';
import { HiddenToe } from '../features/toes/Toe';

/** A link to something that isn't on Afterglow (any more): say so, and offer a way on. */
export function Missing({ title, line, wait = true }: { title: string; line: string; wait?: boolean }) {
  // Opened fresh from a link: the newest festivals and artists come with the hosted catalogue, so wait for it first.
  const settled = useCatalogSettled();
  if (wait && !settled)
    return (
      <View style={styles.root}>
        <NightSky />
        <View style={styles.body}>
          <ActivityIndicator color={color.moonDim} accessibilityLabel="Loading" />
        </View>
        <PageActions />
      </View>
    );
  return (
    <View style={styles.root}>
      <NightSky />
      <View style={styles.body}>
        <HiddenToe size={16} opacity={0.35} turn={12} style={{ top: '28%', right: 28 }} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.line}>{line}</Text>
        <Pressable onPress={() => router.replace('/festivals')} accessibilityRole="button" style={styles.button}>
          <Text style={styles.link}>See all festivals</Text>
        </Pressable>
      </View>
      <PageActions />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl, gap: space.md },
  title: { ...type.title, color: color.moon },
  line: { ...type.body, color: color.moonDim },
  button: { marginTop: space.md, alignSelf: 'flex-start' },
  link: { ...type.headline, color: color.glow },
});
