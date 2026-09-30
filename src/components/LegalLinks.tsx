import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { legalPath, type LegalDoc } from '../features/legal/documents';
import { color, space, type } from '../theme/tokens';

const LABEL: Record<LegalDoc, string> = { privacy: 'Privacy', terms: 'Terms', guidelines: 'Community guidelines' };

/** "Privacy · Terms · Community guidelines", quiet links to the legal pages. */
export function LegalLinks({ docs = ['privacy', 'terms', 'guidelines'] }: { docs?: LegalDoc[] }) {
  return (
    <View style={styles.row}>
      {docs.map((d, i) => (
        <View key={d} style={styles.item}>
          {i > 0 ? <Text style={styles.dot}>·</Text> : null}
          <Pressable onPress={() => router.push(legalPath(d) as never)} accessibilityRole="link" accessibilityLabel={LABEL[d]} hitSlop={8}>
            <Text style={styles.link}>{LABEL[d]}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { ...type.caption, color: color.moonFaint },
  link: { ...type.caption, color: color.moonDim, textDecorationLine: 'underline' },
});
