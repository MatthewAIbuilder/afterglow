import { StyleSheet, View } from 'react-native';
import { Collectible } from '../sprouts/Collectible';
import { counts, type Hunt, lookOf } from './finds';

/** A hunt's stickers in a row: the ones you've found glowing, the rest as grey figures (taken-down ones you never found left out). */
export function HuntRow({ hunt, found, size }: { hunt: Hunt; found: boolean[]; size: number }) {
  return (
    <View style={styles.row}>
      {hunt.items.map((item, i) => (counts(hunt, found, i) ? <Collectible key={i} look={lookOf(item.creature)} size={size} locked={!found[i]} still /> : null))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
});
