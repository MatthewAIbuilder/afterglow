import { StyleSheet, View } from 'react-native';
import { Collectible } from '../sprouts/Collectible';
import { type Hunt, lookOf } from './finds';

/** A hunt's stickers in a row: the ones you've found glowing, the rest as grey figures. */
export function HuntRow({ hunt, found, size }: { hunt: Hunt; found: boolean[]; size: number }) {
  return (
    <View style={styles.row}>
      {hunt.items.map((item, i) => (
        <Collectible key={i} look={lookOf(item.creature)} size={size} locked={!found[i]} still />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
});
