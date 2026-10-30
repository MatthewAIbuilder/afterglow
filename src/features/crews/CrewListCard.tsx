import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { showActionSheet, showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useCrewList } from '../../state/crewList';
import { useSocial } from '../../state/social';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { type Crew, CREW_ITEM_MAX, CREW_ITEMS_MAX } from '../social/models';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../social/service';
import { t } from '../../i18n';

/** Things crews usually need, offered as one-tap additions (only those not on the list yet). */
const IDEAS = ['Sunscreen', 'Portable charger', 'Earplugs', 'Water bottle', 'Poncho', 'Totem', 'Kandi', 'Snacks', 'Tickets', 'Hydration pack'];

/** The crew's list: who's bringing what, ticked off by whoever has it. */
export function CrewListCard({ crew, nameOf }: { crew: Crew; nameOf: (uid: string) => string }) {
  const social = useSocial();
  const me = social.user?.uid;
  const { items, add, tick, remove } = useCrewList(crew.id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const fail = (e: unknown) => showAlert(t('Couldn’t save that'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
  const has = new Set(items.map((i) => i.text.toLowerCase()));
  const ideas = IDEAS.filter((i) => !has.has(t(i).toLowerCase())).slice(0, 6);

  const addIt = async (words: string) => {
    if (!words.trim() || busy || items.length >= CREW_ITEMS_MAX) return;
    setBusy(true);
    try {
      await add(words);
      haptic.tap();
      setText('');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('Who’s bringing what')}</Text>
      {items.map((i) => {
        const mine = i.by === me || crew.owner === me;
        return (
          <Pressable
            key={i.id}
            onPress={() => {
              if (!me) return;
              haptic.select();
              void tick(i, !i.done, me).catch(fail);
            }}
            onLongPress={
              mine
                ? () => {
                    haptic.select();
                    showActionSheet({ title: i.text, options: [t('Take it off the list'), t('Cancel')], cancelButtonIndex: 1, destructiveButtonIndex: 0 }, (n) => {
                      if (n === 0) void remove(i).catch(fail);
                    });
                  }
                : undefined
            }
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!i.done }}
            accessibilityLabel={`${i.text}. ${i.done && i.doneBy ? t('{name} has it', { name: nameOf(i.doneBy) }) : t('Nobody has it yet')}. ${t('Added by {name}', { name: nameOf(i.by) })}`}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.box, i.done && styles.boxOn]}>{i.done ? <Text style={styles.tick}>✓</Text> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.item, i.done && styles.itemDone]}>{i.text}</Text>
              <Text style={styles.meta}>{i.done && i.doneBy ? t('{name} has it', { name: nameOf(i.doneBy) }) : t('Added by {name}', { name: nameOf(i.by) })}</Text>
            </View>
          </Pressable>
        );
      })}
      {!items.length ? <Text style={styles.meta}>{t('Sunscreen, a charger, the totem: add what the crew needs, and tick it when you have it.')}</Text> : null}
      <View style={styles.addRow}>
        <TextInput value={text} onChangeText={setText} maxLength={CREW_ITEM_MAX} placeholder={t('Add something')} placeholderTextColor={color.moonFaint} accessibilityLabel={t('Add something to the crew’s list')} style={styles.input} onSubmitEditing={() => void addIt(text)} returnKeyType="done" />
        <Pressable onPress={() => void addIt(text)} disabled={!text.trim() || busy} accessibilityRole="button" accessibilityLabel={t('Add it')} style={[styles.add, (!text.trim() || busy) && { opacity: 0.5 }]}>
          <Text style={styles.addText}>{t('Add')}</Text>
        </Pressable>
      </View>
      {ideas.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ideas}>
          {ideas.map((i) => (
            <Pressable key={i} onPress={() => void addIt(t(i))} accessibilityRole="button" accessibilityLabel={t('Add {thing}', { thing: t(i) })} style={styles.idea}>
              <Text style={styles.ideaText}>+ {t(i)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.lg, padding: space.lg, gap: space.sm, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  title: { ...type.headline, color: color.moon },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: color.moonFaint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: color.glow, borderColor: color.glow },
  tick: { fontSize: 13, fontWeight: '800', color: color.night },
  item: { ...type.label, color: color.moon },
  itemDone: { color: color.moonDim, textDecorationLine: 'line-through' },
  meta: { ...type.caption, color: color.moonDim },
  addRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  input: { flex: 1, ...type.body, color: color.moon, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  add: { paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: glowA(0.22) },
  addText: { ...type.label, color: color.moon },
  ideas: { gap: space.sm },
  idea: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  ideaText: { ...type.caption, color: color.moonDim },
});
