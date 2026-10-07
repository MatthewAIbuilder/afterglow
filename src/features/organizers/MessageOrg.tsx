import { Pressable, StyleSheet, Text } from 'react-native';
import { haptic } from '../../lib/haptics';
import { useCrewChat } from '../../state/crewChat';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import { openChatWith } from '../friends/openChat';
import type { Org } from './organizers';

/**
 * "Message" on an organizer's page: a 1-to-1 chat with its account, which
 * anyone signed in may start (no following needed). Nothing when it has no
 * account yet, you're signed out, or it's yours.
 */
export function MessageOrg({ org }: { org: Org }) {
  const social = useSocial();
  const chat = useCrewChat();
  const to = org.uids[0];
  const me = social.user?.uid;
  if (!to || !me || org.uids.includes(me) || social.blocked.has(to)) return null;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        void openChatWith((u) => chat.openDirect(u, org.id), to, org.name);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('Message {name}', { name: org.name })}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.text}>{t('Message')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  text: { ...type.headline, color: color.moon },
});
