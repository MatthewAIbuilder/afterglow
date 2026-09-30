import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useSetReminders } from '../../state/setReminders';
import { color, radius, space, type } from '../../theme/tokens';
import { canRemindSets, SET_LEAD_MIN } from '../notifications/setReminders';

/**
 * "Remind me before each set" for one festival, above the full-day route.
 * Only once set times are out and the festival's dates line up with its
 * days, and only on a phone (the website can't send notifications).
 */
export function SetReminderToggle({ festival }: { festival: Festival }) {
  const { on, setOn } = useSetReminders();
  if (Platform.OS === 'web' || !canRemindSets(festival)) return null;
  const value = on.has(festival.id);
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>Remind me before each set</Text>
        <Text style={styles.detail}>
          {value
            ? `${SET_LEAD_MIN} min before you need to head over. They follow your plan as it changes.`
            : 'A nudge when it’s time to move, with the stage and the walk.'}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          haptic.select();
          setOn(festival.id, v);
        }}
        trackColor={{ true: color.glowDeep, false: 'rgba(255,255,255,0.15)' }}
        accessibilityLabel="Remind me before each set"
        testID="set-reminders"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  text: { flex: 1, gap: 2 },
  label: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim },
});
