import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { color, space, type } from '../../theme/tokens';
import type { CharmId, PatternId } from './kandi';
import { KandiBracelet } from './KandiBracelet';

/**
 * Kandi hanging in a garden: a row of bracelets on a string, each with who
 * made it. Tapping one opens it (in your own garden).
 */
export function KandiLine({ items, onOpen, title }: { items: { key: string; word: string; beads: PatternId; charm?: CharmId; from?: string }[]; onOpen?: (key: string) => void; title?: string }) {
  if (!items.length) return null;
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title ?? t('Kandi')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((k) => (
          <Pressable
            key={k.key}
            disabled={!onOpen}
            onPress={() => {
              haptic.select();
              onOpen?.(k.key);
            }}
            accessibilityRole={onOpen ? 'button' : undefined}
            accessibilityLabel={k.from ? t('Kandi spelling {word}, from @{handle}', { word: k.word, handle: k.from }) : t('Kandi spelling {word}', { word: k.word })}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
          >
            <KandiBracelet word={k.word} beads={k.beads} charm={k.charm} size={96} />
            {k.from ? (
              <Text style={styles.from} numberOfLines={1}>
                @{k.from}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
  title: { ...type.headline, color: color.moon },
  row: { gap: space.sm },
  item: { alignItems: 'center', width: 100 },
  from: { ...type.caption, color: color.moonDim, marginTop: -space.sm },
});
