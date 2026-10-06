import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useCrewUpdates } from '../../state/crewUpdates';
import { color, radius, space, type } from '../../theme/tokens';
import { CREW_NOTE_MAX, type CrewUpdate } from '../social/models';
import { clock, presetLabel, QUICK_REPLIES } from './updates';
import { t } from '../../i18n';

/**
 * Under a crewmate's update: what the crew has said back (oldest first, each
 * with when it was written) and a way to answer, one tap or your own words.
 * A reply waits for signal like a check-in and keeps the time you sent it.
 */
export function ReplyBar({ target, nameOf, me, bottom }: { target: CrewUpdate; nameOf: (uid: string) => string; me?: string; bottom: number }) {
  const { reply, repliesFor, ready } = useCrewUpdates();
  const [text, setText] = useState('');
  const replies = repliesFor(target);
  const shown = replies.slice(-3);
  const yours = target.uid === me;
  const who = nameOf(target.uid);

  const send = (words: string) => {
    if (!reply(target, words)) return;
    haptic.settle();
    setText('');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.wrap, { paddingBottom: bottom + space.md }]} pointerEvents="box-none">
      {shown.length ? (
        <View style={styles.thread}>
          {replies.length > shown.length ? <Text style={styles.more}>{t('{n} earlier', { n: replies.length - shown.length })}</Text> : null}
          {shown.map(({ reply: r, waiting }) => (
            <View
              key={r.id}
              style={styles.bubble}
              accessible
              accessibilityLabel={`${nameOf(r.uid)}, ${clock(r.at)}: ${presetLabel(r.note)}${waiting ? `. ${t('Waiting for signal')}` : ''}`}
            >
              <Text style={styles.bubbleText}>
                <Text style={styles.bubbleName}>{nameOf(r.uid)} </Text>
                {presetLabel(r.note)}
              </Text>
              <Text style={[styles.bubbleTime, waiting && styles.waiting]}>{waiting ? t('{time} · waiting for signal', { time: clock(r.at) }) : clock(r.at)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {ready ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            {QUICK_REPLIES.map((q) => (
              <Pressable
                key={q}
                onPress={() => send(q)}
                accessibilityRole="button"
                accessibilityLabel={yours ? t('Write back “{words}”', { words: presetLabel(q) }) : t('Reply “{words}” to {name}', { words: presetLabel(q), name: who })}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Text style={styles.chipText}>{presetLabel(q)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.field}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={yours ? t('Write back') : t('Reply to {name}', { name: who })}
              placeholderTextColor="rgba(255,255,255,0.55)"
              maxLength={CREW_NOTE_MAX}
              returnKeyType="send"
              onSubmitEditing={() => send(text)}
              style={styles.input}
              accessibilityLabel={yours ? t('Write back') : t('Reply to {name}', { name: who })}
            />
            {text.trim() ? (
              <Pressable onPress={() => send(text)} accessibilityRole="button" accessibilityLabel={t('Send reply')} hitSlop={8}>
                <Text style={styles.send}>{t('Send')}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, gap: space.sm },
  thread: { gap: space.xs, alignItems: 'flex-start' },
  more: { ...type.caption, color: 'rgba(255,255,255,0.6)' },
  bubble: { maxWidth: '85%', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.5)' },
  bubbleName: { fontWeight: '700' },
  bubbleText: { ...type.body, color: color.moon },
  bubbleTime: { ...type.caption, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  waiting: { color: '#FFB86B' },
  chips: { gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  chipText: { ...type.label, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  input: { flex: 1, ...type.body, color: color.moon, paddingVertical: space.md },
  send: { ...type.headline, color: color.glow },
});
