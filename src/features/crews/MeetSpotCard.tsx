import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { MEET_SPOT_MAX, type Crew } from '../social/models';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../social/service';
import { firstName } from './together';
import { clock } from './updates';

/**
 * A crew's meeting spot: where you all head if you lose each other. Any
 * member can set or change it, ideally before the night starts, while
 * there's signal. "Can't find you" check-ins point at it.
 */
export function MeetSpotCard({ crew, compact = false }: { crew: Crew; compact?: boolean }) {
  const { meetSpotFor, setMeetSpot, profileOf, ready } = useCrewUpdates();
  const social = useSocial();
  const spot = meetSpotFor(crew.id);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const me = social.user?.uid;
  const by = spot ? (spot.by === me ? 'you' : profileOf(spot.by) ? firstName(profileOf(spot.by)!.displayName) : 'a crewmate') : undefined;

  const start = () => {
    haptic.select();
    setText(spot?.text ?? '');
    setEditing(true);
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await setMeetSpot(crew.id, text);
      haptic.settle();
      setEditing(false);
    } catch (e) {
      showAlert('Couldn’t save the meeting spot', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;
  if (editing) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>Meeting spot{compact ? ` · ${crew.name}` : ''}</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Like: by the big tree left of Main Stage"
          placeholderTextColor={color.moonFaint}
          maxLength={MEET_SPOT_MAX}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          style={styles.input}
          accessibilityLabel="Meeting spot"
        />
        <View style={styles.row}>
          <Pressable onPress={() => setEditing(false)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.quiet}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => void save()} accessibilityRole="button" accessibilityLabel="Save the meeting spot" hitSlop={8}>
            <Text style={styles.link}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={start}
      accessibilityRole="button"
      accessibilityLabel={spot ? `Meeting spot: ${spot.text}. Set by ${by}. Change it` : 'Pick a meeting spot for your crew'}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.label}>Meeting spot{compact ? ` · ${crew.name}` : ''}</Text>
      {spot ? (
        <>
          <Text style={styles.spot}>{spot.text}</Text>
          <Text style={styles.meta}>
            Set by {by}
            {spot.at ? ` · ${clock(spot.at)}` : ''} · Change
          </Text>
        </>
      ) : (
        <Text style={styles.empty}>Pick a spot you all head to if you lose each other. Best done while there’s signal.</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, gap: space.xs },
  pressed: { opacity: 0.8 },
  label: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  spot: { ...type.headline, color: color.moon },
  meta: { ...type.caption, color: color.moonDim },
  empty: { ...type.body, color: color.moonDim },
  input: { ...type.body, color: color.moon, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.xl, marginTop: space.sm },
  quiet: { ...type.label, color: color.moonDim },
  link: { ...type.headline, color: color.glow },
});
