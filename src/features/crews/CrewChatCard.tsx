import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon, CommentIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { useCrewChat } from '../../state/crewChat';
import { useSocial } from '../../state/social';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import type { Crew } from '../social/models';
import { chatPreview, gaveUp, unreadLine } from './chat';
import { useNow } from '../../lib/useNow';
import { t, tn } from '../../i18n';

/** A crew's chat, as a card: the latest message and how many are new. Opens the chat. `title`: the crew's name, when there are several. */
export function CrewChatCard({ crew, nameOf, title }: { crew: Crew; nameOf: (uid: string) => string; title?: string }) {
  const chat = useCrewChat();
  const me = useSocial().user?.uid;
  const now = useNow().getTime();
  if (!chat.ready) return null;
  const unread = chat.unreadFor(crew.id);
  // Ones given up on say so in the chat itself; here only the ones still trying.
  const waiting = chat.waitingFor(crew.id).filter((o) => !gaveUp(o, now)).length;
  const preview = chatPreview(chat.latestFor(crew.id), me, nameOf);
  const line = waiting
    ? tn(waiting, '{n} message waiting for signal. It sends by itself, keeping the time you wrote it.', '{n} messages waiting for signal. They send by themselves, keeping the time you wrote them.')
    : (preview ?? t('Say hi to your crew. Only people in it can see the chat.'));
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/crew-chat/[id]', params: { id: crew.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title ?? t('Crew chat')}${unread ? `, ${unreadLine(unread)}` : ''}. ${line}`}
      style={({ pressed }) => [styles.card, unread > 0 && styles.cardNew, pressed && styles.pressed]}
    >
      <View style={[styles.icon, unread > 0 && styles.iconNew]}>
        <CommentIcon color={unread ? color.moon : color.glow} size={18} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>
          {title ?? t('Crew chat')}
          {unread ? <Text style={styles.new}>{`  ${unreadLine(unread)}`}</Text> : null}
        </Text>
        <Text style={[styles.preview, waiting > 0 && { color: '#FFB86B' }]} numberOfLines={waiting ? 2 : 1}>
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
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  cardNew: { borderColor: glowA(0.55), backgroundColor: glowA(0.10) },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: glowA(0.14) },
  iconNew: { backgroundColor: color.glowDeep },
  title: { ...type.headline, color: color.moon },
  new: { ...type.label, color: color.glow },
  preview: { ...type.caption, color: color.moonDim },
  pressed: { opacity: 0.8 },
});
