import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { QrIcon, ScanIcon, SearchIcon, ShareIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { showActionSheet } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { color, space, type } from '../../theme/tokens';
import { inviteText } from '../social/friends';
import { useFriendAdds } from '../../state/friendAdds';
import { Sprout } from '../sprouts/Sprout';
import { t } from '../../i18n';

/** How many of your festivals the Invite menu offers. */
const INVITE_FESTIVALS = 3;

/**
 * The Friends page's one row of round buttons: find people, show your code,
 * scan a friend's (phones), your garden (to give a sprout or kandi), and invite friends to Afterglow (or to plan one
 * of your festivals). At a festival, inviting gives way: what matters there
 * is adding the people in front of you.
 */
export function QuickActions({ handle, festivals = [], atFestival = false }: { handle?: string; festivals?: readonly Festival[]; atFestival?: boolean }) {
  // Your friend link: friends who join from it count for your invite rewards.
  const { myCard } = useFriendAdds();
  const invite = () => {
    const chips = festivals.slice(0, INVITE_FESTIVALS);
    const send = (f?: Festival) => void shareMessage(inviteText(handle, f, myCard), t('Join me on Afterglow'));
    if (!chips.length) {
      send();
      return;
    }
    const options = [t('Invite to Afterglow'), ...chips.map((f) => t('Invite to plan {festival}', { festival: f.name })), t('Cancel')];
    showActionSheet({ title: t('Invite friends'), options, cancelButtonIndex: options.length - 1 }, (i) => {
      if (i === 0) send();
      else if (i > 0 && i <= chips.length) send(chips[i - 1]);
    });
  };
  const phone = Platform.OS !== 'web';
  return (
    <View style={styles.row}>
      {atFestival ? null : <Action label={t('Find')} a11y={t('Find people')} icon={<SearchIcon color={color.moon} size={20} />} onPress={() => router.push('/people')} />}
      <Action label={t('My code')} a11y={t('Show my friend code')} icon={<QrIcon color={color.moon} size={22} />} onPress={() => router.push('/my-code')} />
      {phone ? <Action label={t('Scan')} a11y={t("Scan a friend's code")} icon={<ScanIcon color={color.night} size={22} />} onPress={() => router.push('/scan')} glow /> : null}
      <Action label={t('Sprout')} a11y={t('Your garden: give a sprout or kandi')} icon={<Sprout kind="seedling" stage={2} size={40} still />} onPress={() => router.push('/garden')} />
      {atFestival ? (
        <Action label={t('Find')} a11y={t('Find people')} icon={<SearchIcon color={color.moon} size={20} />} onPress={() => router.push('/people')} />
      ) : (
        <Action label={t('Invite')} a11y={t('Invite friends to Afterglow')} icon={<ShareIcon color={color.moon} size={19} />} onPress={invite} />
      )}
    </View>
  );
}

function Action({ label, a11y, icon, onPress, glow }: { label: string; a11y: string; icon: React.ReactNode; onPress: () => void; glow?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <View style={[styles.circle, glow && styles.glow]}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', marginTop: space.lg, marginBottom: space.sm },
  action: { alignItems: 'center', gap: space.xs, minWidth: 54 },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  glow: { backgroundColor: color.glow, borderColor: color.glow, shadowColor: color.glow, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  label: { ...type.caption, color: color.moon },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
});
