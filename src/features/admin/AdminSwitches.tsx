import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { setAppSettings, useAppSettings } from '../../state/appSettings';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';

/**
 * App-wide switches for everyone, from HQ (English, like the rest of HQ).
 * The care timing guide: switched off, Look after yourself keeps its
 * stopwatches (in people's own words), feelings, water, body and Get help,
 * but no substance list, timings or mixes. Phones pick it up the next time
 * Afterglow opens or comes back to the front; no new build is needed.
 */
export function AdminSwitches() {
  const { service } = useSocial();
  const { careGuide } = useAppSettings();
  const [busy, setBusy] = useState(false);

  const save = async (on: boolean) => {
    setBusy(true);
    try {
      await service.setAppSettings({ careGuide: on });
      setAppSettings({ careGuide: on });
      haptic.settle();
    } catch {
      showAlert('Couldn’t change it', 'Check your signal and try again.');
    } finally {
      setBusy(false);
    }
  };

  const flip = (on: boolean) => {
    haptic.select();
    showAlert(
      on ? 'Show the timing guide to everyone?' : 'Hide the timing guide from everyone?',
      on
        ? 'Look after yourself shows the substance list, timings and risky mixes again, on every phone, the next time Afterglow opens.'
        : 'Look after yourself keeps stopwatches, feelings, water, body and Get help, but without the substance list, timings or mixes. Every phone picks it up the next time Afterglow opens.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: on ? 'Show it' : 'Hide it', style: on ? 'default' : 'destructive', onPress: () => void save(on) },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>Care timing guide</Text>
          <Text style={styles.small}>{careGuide ? 'Shown to everyone.' : 'Hidden from everyone. Stopwatches just count.'}</Text>
        </View>
        <Switch value={careGuide} onValueChange={flip} disabled={busy} accessibilityLabel="Show the care timing guide to everyone" trackColor={{ true: color.glow }} />
      </View>
      <Text style={styles.small}>If App Review objects to the timing guide, switch it off here and resubmit the same build.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { ...type.headline, color: color.moon },
  small: { ...type.caption, color: color.moonDim },
});
