import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PeopleIcon, ShareIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { color, radius, space, type } from '../../theme/tokens';
import { inviteText } from '../social/friends';

/** How many of your festivals get their own "Invite to" chip. */
const INVITE_FESTIVALS = 3;

/**
 * Bring friends to Afterglow: one big Send an invite (the share sheet, or
 * copied on the website), and an invite for each festival you're going to,
 * so the message says which one you want to plan together.
 */
export function InviteCard({ handle, festivals }: { handle?: string; festivals: readonly Festival[] }) {
  const send = (festival?: Festival) => {
    haptic.tap();
    void shareMessage(inviteText(handle, festival), 'Join me on Afterglow');
  };
  const chips = festivals.slice(0, INVITE_FESTIVALS);
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['rgba(169,124,255,0.30)', 'rgba(255,126,182,0.16)', 'rgba(111,195,255,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.head}>
        <View style={styles.icon}>
          <PeopleIcon color={color.night} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bring your friends</Text>
          <Text style={styles.body}>Festivals are better together. Follow each other, start a crew, share one route and find each other on the day.</Text>
        </View>
      </View>
      <Pressable
        onPress={() => send()}
        accessibilityRole="button"
        accessibilityLabel="Invite friends to Afterglow"
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
      >
        <ShareIcon color={color.night} size={16} />
        <Text style={styles.primaryText}>Send an invite</Text>
      </Pressable>
      {chips.length ? (
        <>
          <Text style={styles.label}>Or invite them to a festival</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chips.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => send(f)}
                accessibilityRole="button"
                accessibilityLabel={`Invite friends to plan ${f.name} together`}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.lg + 4,
    overflow: 'hidden',
    backgroundColor: color.glass,
    borderWidth: 1,
    borderColor: 'rgba(169,124,255,0.45)',
    gap: space.md,
  },
  head: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glow },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: 2 },
  primary: { flexDirection: 'row', gap: space.sm, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.headline, color: color.night },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  label: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  chips: { gap: space.sm },
  chip: { maxWidth: 220, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: 'rgba(18,16,38,0.5)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(169,124,255,0.5)' },
  chipText: { ...type.label, color: color.moon },
});
