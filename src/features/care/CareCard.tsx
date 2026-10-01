import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCare } from '../../state/care';
import { color, radius, space, type } from '../../theme/tokens';
import { cardLine, needsHelp } from './care';

/** On a festival's page while it's on: a quiet way into Look after yourself, with what's running. */
export function CareCard() {
  const { care } = useCare();
  const now = useNow(30_000).getTime();
  const line = cardLine(care, now);
  const help = needsHelp(care, now);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push('/care');
      }}
      accessibilityRole="button"
      accessibilityLabel={`Look after yourself. ${line}.`}
      style={({ pressed }) => [styles.card, help && styles.help, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.dot, help && styles.dotHelp]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{help ? 'Get help' : 'Look after yourself'}</Text>
        <Text style={styles.line} numberOfLines={1}>
          {line}
        </Text>
      </View>
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    padding: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  help: { borderColor: 'rgba(255,140,140,0.45)', backgroundColor: 'rgba(255,120,120,0.07)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.glow },
  dotHelp: { backgroundColor: 'rgba(255,120,120,0.95)' },
  title: { ...type.label, color: color.moon },
  line: { ...type.caption, color: color.moonDim, marginTop: 2 },
});
