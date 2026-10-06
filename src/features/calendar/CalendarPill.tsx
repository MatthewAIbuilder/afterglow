import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { CalendarIcon, CheckIcon } from '../../components/TabIcons';
import { WEB_URL } from '../../config/app';
import type { Festival } from '../../data/models';
import { addToCalendar } from '../../lib/calendar';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type } from '../../theme/tokens';
import { festivalEvent } from './events';
import { t } from '../../i18n';

/**
 * "Add to calendar" beside Going on a festival page: the festival's days (your
 * weekend, when `festival` is given as it is for you) in the phone's own
 * New Event screen, or an .ics file on the website. Nothing for festivals
 * without dates.
 */
export function CalendarPill({ festival }: { festival: Festival }) {
  const [added, setAdded] = useState(false);
  const event = festivalEvent(festival, WEB_URL);
  if (!event) return null;
  const press = async () => {
    haptic.select();
    const outcome = await addToCalendar(event);
    if (outcome === 'added') {
      haptic.settle();
      setAdded(true);
    } else if (outcome === 'downloaded') {
      setAdded(true);
      showAlert(t('Calendar file downloaded'), t('Open it to add {festival} to your calendar.', { festival: festival.name }));
    } else if (outcome === 'failed') {
      showAlert(t('Couldn’t open your calendar'), Platform.OS === 'web' ? t('Try again in a moment.') : t('Check that Afterglow may use the calendar in Settings, then try again.'));
    }
  };
  return (
    <Pressable
      onPress={() => void press()}
      accessibilityRole="button"
      accessibilityLabel={added ? t('{festival} is in your calendar. Add it again.', { festival: festival.name }) : t('Add {festival} to your calendar', { festival: festival.name })}
      style={({ pressed }) => [styles.pill, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
    >
      {added ? <CheckIcon color={color.moonDim} size={14} /> : <CalendarIcon color={color.moonDim} size={14} />}
      <Text style={styles.text}>{added ? t('In your calendar') : t('Add to calendar')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.md,
    paddingRight: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  text: { ...type.label, color: color.moonDim },
});
