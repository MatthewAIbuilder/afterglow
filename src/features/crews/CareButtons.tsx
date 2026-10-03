import { useNetworkState } from 'expo-network';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useCrewUpdates } from '../../state/crewUpdates';
import { color, radius, space, type } from '../../theme/tokens';
import { isOffline } from '../offline/status';
import type { CrewCare } from '../social/models';
import { clock } from './updates';

const GREEN = '#5BE3B5';
const RED = 'rgba(255,150,150,0.95)';

/**
 * Tell your crew how you are, only when you choose to: "I'm OK", or "Not
 * feeling great, can someone come find me?" (asked first). Both wait for
 * signal like any check-in and keep the time you tapped. After asking for
 * help, the next thing offered is "I'm OK now", which clears it for them.
 * `only` shows just one of the two (Look after yourself suggests the one
 * that fits how you said you feel).
 */
export function CareButtons({ festivalId, only }: { festivalId: string; only?: CrewCare }) {
  const { sendCare, outbox, dropped, myCare } = useCrewUpdates();
  const offline = isOffline(useNetworkState());
  const [sent, setSent] = useState<{ id: string; care: CrewCare } | undefined>();

  const send = (care: CrewCare) => {
    const go = () => {
      const id = sendCare(festivalId, care);
      if (!id) return;
      haptic.settle();
      setSent({ id, care });
    };
    if (care === 'ok') return go();
    showAlert(
      'Ask your crew to come find you?',
      'They’ll see “Not feeling great” with the time you sent it, and their phones nudge them. A check-in with where you are helps them find you.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Ask my crew', onPress: go },
      ],
    );
  };

  const asked = myCare?.care === 'help';
  const waiting = sent ? outbox.some((o) => o.id === sent.id) : false;
  const status = !sent
    ? undefined
    : dropped.includes(sent.id)
      ? 'Couldn’t reach your crew. Try again, or ask someone near you.'
      : waiting
        ? offline
          ? 'Saved for when there’s signal. It sends itself, still marked when you tapped.'
          : 'Sending…'
        : sent.care === 'ok'
          ? 'Sent. Your crew knows you’re OK.'
          : 'Sent. Your crew can see you’d like someone to come.';

  const showOk = asked || !only || only === 'ok';
  const showHelp = !asked && (!only || only === 'help');

  return (
    <View style={styles.wrap}>
      {asked && myCare ? (
        <Text style={styles.asked}>
          You asked your crew for help at {clock(myCare.at)}. Feeling better? Let them know.
        </Text>
      ) : null}
      <View style={styles.row}>
        {showOk ? (
          <Pressable
            onPress={() => send('ok')}
            accessibilityRole="button"
            accessibilityLabel={asked ? 'I’m OK now. Tell my crew' : 'I’m OK. Tell my crew'}
            style={({ pressed }) => [styles.button, styles.ok, pressed && styles.pressed]}
          >
            <Text style={[styles.text, { color: GREEN }]}>{asked ? 'I’m OK now' : 'I’m OK'}</Text>
          </Pressable>
        ) : null}
        {showHelp ? (
          <Pressable
            onPress={() => send('help')}
            accessibilityRole="button"
            accessibilityLabel="Not feeling great. Ask my crew to come find me"
            style={({ pressed }) => [styles.button, styles.help, pressed && styles.pressed]}
          >
            <Text style={[styles.text, { color: RED }]}>Ask my crew for help</Text>
          </Pressable>
        ) : null}
      </View>
      {status ? (
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {status}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', gap: space.sm },
  button: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  ok: { backgroundColor: 'rgba(91,227,181,0.12)', borderColor: 'rgba(91,227,181,0.55)' },
  help: { backgroundColor: 'rgba(255,120,120,0.12)', borderColor: 'rgba(255,140,140,0.55)' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  text: { ...type.headline, textAlign: 'center' },
  asked: { ...type.caption, color: color.moonDim },
  status: { ...type.caption, color: color.moonDim, textAlign: 'center' },
});
