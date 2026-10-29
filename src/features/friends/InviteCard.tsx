import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PeopleIcon, ShareIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { color, radius, space, type, glowA, raisedA } from '../../theme/tokens';
import { inviteText } from '../social/friends';
import { inviteProgress, tierReward } from '../invites/invites';
import { useFriendAdds } from '../../state/friendAdds';
import { useMyInvites } from '../../state/invites';
import { useSocial } from '../../state/social';
import { t, tn } from '../../i18n';

/** How many of your festivals get their own "Invite to" chip. */
const INVITE_FESTIVALS = 3;

/**
 * Bring friends to Afterglow: one big Send an invite (the share sheet, or
 * copied on the website), and an invite for each festival you're going to,
 * so the message says which one you want to plan together. With a profile,
 * the link is your friend link, and the card shows your invite rewards
 * (features/invites): how many friends joined, and how many more for the
 * next reward (the Plus One pin, a month of Plus, Legend).
 */
export function InviteCard({ handle, festivals }: { handle?: string; festivals: readonly Festival[] }) {
  const social = useSocial();
  const { myCard } = useFriendAdds();
  const { count, invitees, loaded } = useMyInvites();
  const rewards = !!social.profile;
  const progress = inviteProgress(count);
  // The latest friend to join, by name.
  const latest = invitees[0]?.uid;
  const [latestName, setLatestName] = useState<string | undefined>();
  useEffect(() => {
    if (!latest) return;
    let live = true;
    social.service
      .profileOf(latest)
      .then((p) => live && setLatestName(p?.displayName))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [latest, social.service]);
  const send = (festival?: Festival) => {
    haptic.tap();
    void shareMessage(inviteText(handle, festival, myCard), t('Join me on Afterglow'));
  };
  const chips = festivals.slice(0, INVITE_FESTIVALS);
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[glowA(0.30), 'rgba(255,126,182,0.16)', 'rgba(111,195,255,0.10)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.head}>
        <View style={styles.icon}>
          <PeopleIcon color={color.night} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('Bring your friends')}</Text>
          <Text style={styles.body}>
            {rewards
              ? t('Every friend who joins from your link becomes your friend on Afterglow, and earns you rewards.')
              : t('Festivals are better together. Follow each other, start a crew, share one route and find each other on the day.')}
          </Text>
        </View>
      </View>
      {rewards && loaded ? (
        <View style={styles.rewards} accessibilityLabel={`${tn(count, '{n} friend joined', '{n} friends joined')}. ${progress.next ? t('{more} more for {reward}', { more: progress.toGo, reward: tierReward(progress.next) }) : t('Every reward earned')}.`}>
          <View style={styles.rewardRow}>
            <Text style={styles.count}>{tn(count, '{n} friend joined', '{n} friends joined')}</Text>
            <Text style={styles.next} numberOfLines={1}>
              {progress.next ? t('{more} more for {reward}', { more: progress.toGo, reward: tierReward(progress.next) }) : t('Every reward earned')}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress.share * 100)}%` }]} />
          </View>
          {invitees.length && latestName ? (
            <Text style={styles.joined} numberOfLines={1}>
              {t('Latest to join: {name}', { name: latestName })}
            </Text>
          ) : invitees.length ? null : (
            <Text style={styles.joined}>{t('Your first friend to join earns you the Plus One pin.')}</Text>
          )}
        </View>
      ) : null}
      <Pressable
        onPress={() => send()}
        accessibilityRole="button"
        accessibilityLabel={t('Send an invite link')}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
      >
        <ShareIcon color={color.night} size={16} />
        <Text style={styles.primaryText}>{t('Send an invite')}</Text>
      </Pressable>
      {chips.length ? (
        <>
          <Text style={styles.label}>{t('Or invite them to a festival')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chips.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => send(f)}
                accessibilityRole="button"
                accessibilityLabel={t('Invite friends to plan {festival} together', { festival: f.name })}
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
    borderColor: glowA(0.45),
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
  rewards: { gap: space.xs, padding: space.md, borderRadius: radius.md, backgroundColor: raisedA(0.5) },
  rewardRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  count: { ...type.headline, color: color.moon },
  next: { ...type.caption, color: color.moonDim, flexShrink: 1, textAlign: 'right' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginTop: space.xs },
  fill: { height: 6, borderRadius: 3, backgroundColor: color.glow },
  joined: { ...type.caption, color: color.moonFaint, marginTop: space.xs },
  chip: { maxWidth: 220, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: raisedA(0.5), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.5) },
  chipText: { ...type.label, color: color.moon },
});
