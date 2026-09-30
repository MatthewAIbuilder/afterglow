import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, space, type } from '../theme/tokens';
import { NightSky } from './NightSky';
import { PageActions } from './PageActions';

/** A link to something that isn't on Afterglow (any more): say so, and offer a way on. */
export function Missing({ title, line }: { title: string; line: string }) {
  return (
    <View style={styles.root}>
      <NightSky />
      <View style={styles.body}>
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
