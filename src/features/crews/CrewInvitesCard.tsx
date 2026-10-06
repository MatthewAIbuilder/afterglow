import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useCrews } from '../../state/crews';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../social/service';
import { StandingAvatar } from '../standing/StandingAvatar';
import { inviteTitle } from './invite';
import { firstName } from './together';
import { t } from '../../i18n';

/** Crews you've been invited to in the app: who asked, for which festival, Join or Not now. Nothing when there are none. */
export function CrewInvitesCard() {
  const { invites, inviters, join, declineInvite } = useCrews();
  const catalog = useCatalog();
  const [joining, setJoining] = useState<string>();
  if (!invites.length) return null;

  const accept = async (crewId: string) => {
    if (joining) return;
    haptic.select();
    setJoining(crewId);
    try {
      await join(crewId);
      haptic.settle();
      router.push({ pathname: '/crew/[id]', params: { id: crewId } });
    } catch (e) {
      showAlert(t('Couldn’t join'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setJoining(undefined);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{invites.length === 1 ? t('Crew invite') : t('Crew invites · {n}', { n: invites.length })}</Text>
      {invites.map((i) => {
        const who = inviters[i.from];
        const title = inviteTitle(who ? firstName(who.displayName) : undefined, i.crewName);
        const festivalName = catalog.festival(i.festivalId)?.name;
        return (
          <View key={i.id} style={styles.card}>
            <Pressable
              onPress={() => router.push({ pathname: '/crew/[id]', params: { id: i.crewId } })}
              accessibilityRole="button"
              accessibilityLabel={festivalName ? t('{title}, for {festival}. See the crew', { title, festival: festivalName }) : t('{title}, for a festival. See the crew', { title })}
              style={styles.top}
            >
              <StandingAvatar uid={i.from} name={who?.displayName} url={who?.avatarUrl} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.detail} numberOfLines={1}>
                  {festivalName ? t('Plan {festival} together', { festival: festivalName }) : t('Plan a festival together')}
                </Text>
              </View>
            </Pressable>
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  haptic.select();
                  void declineInvite(i.crewId);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('Not now: {title}', { title })}
                style={({ pressed }) => [styles.later, pressed && styles.pressed]}
              >
                <Text style={styles.laterText}>{t('Not now')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void accept(i.crewId)}
                disabled={!!joining}
                accessibilityRole="button"
                accessibilityLabel={i.crewName ? t('Join {crew}', { crew: i.crewName }) : t('Join the crew')}
                style={({ pressed }) => [styles.join, pressed && styles.pressed]}
              >
                {joining === i.crewId ? <ActivityIndicator color={color.night} size="small" /> : <Text style={styles.joinText}>{t('Join')}</Text>}
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  heading: { ...type.label, color: color.glow, textTransform: 'uppercase', letterSpacing: 1 },
  card: { padding: space.lg, gap: space.md, borderRadius: radius.lg, backgroundColor: glowA(0.12), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.45) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2 },
  actions: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
  later: { minHeight: 36, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  laterText: { ...type.label, color: color.moonDim },
  join: { minHeight: 36, minWidth: 80, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glow },
  joinText: { ...type.label, color: color.night },
  pressed: { opacity: 0.8 },
});
