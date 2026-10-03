import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon, CommentIcon } from '../../components/TabIcons';
import { haptic } from '../../lib/haptics';
import { useCrewChat } from '../../state/crewChat';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import type { Crew } from '../social/models';
import { chatPreview, unreadLine } from './chat';

/** A crew's chat, as a card: the latest message and how many are new. Opens the chat. */
export function CrewChatCard({ crew, nameOf }: { crew: Crew; nameOf: (uid: string) => string }) {
  const chat = useCrewChat();
  const me = useSocial().user?.uid;
  if (!chat.ready) return null;
  const unread = chat.unreadFor(crew.id);
  const preview = chatPreview(chat.latestFor(crew.id), me, nameOf);
  const line = preview ?? 'Say hi to your crew. Only people in it can see the chat.';
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/crew-chat/[id]', params: { id: crew.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`Crew chat${unread ? `, ${unreadLine(unread)}` : ''}. ${line}`}
      style={({ pressed }) => [styles.card, unread > 0 && styles.cardNew, pressed && styles.pressed]}
    >
      <View style={[styles.icon, unread > 0 && styles.iconNew]}>
        <CommentIcon color={unread ? color.moon : color.glow} size={18} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>
          Crew chat
          {unread ? <Text style={styles.new}>{`  ${unreadLine(unread)}`}</Text> : null}
        </Text>
        <Text style={styles.preview} numberOfLines={1}>
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
  },
  cardNew: { borderColor: 'rgba(169,124,255,0.55)', backgroundColor: 'rgba(169,124,255,0.10)' },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(169,124,255,0.14)' },
  iconNew: { backgroundColor: color.glowDeep },
  title: { ...type.headline, color: color.moon },
  new: { ...type.label, color: color.glow },
  preview: { ...type.caption, color: color.moonDim },
  pressed: { opacity: 0.8 },
});
