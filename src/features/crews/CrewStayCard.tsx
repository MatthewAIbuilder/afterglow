import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WEB_URL } from '../../config/app';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useCrewChat } from '../../state/crewChat';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { localDay } from '../artists/shows';
import { shareMessageText, shareRoute, STAY_GUESTS_MAX, type ChatShare } from '../messages/shares';
import { stayLinkOf } from '../partners/partners';
import type { Crew } from '../social/models';
import { t, tn } from '../../i18n';

/**
 * On a crew's page, while its festival or show is still to come: a place to
 * stay for all of you. "Find a place" opens places for the whole crew;
 * "Ask the crew" posts that as a card in the crew chat, so everyone can
 * look. Nothing when there's nowhere to point at.
 */
export function CrewStayCard({ crew, event }: { crew: Crew; event: Festival }) {
  const chat = useCrewChat();
  const today = localDay(useToday());
  const [asked, setAsked] = useState(false);
  const size = Math.min(Math.max(crew.members.length, 1), STAY_GUESTS_MAX);
  const over = (event.endDate ?? event.startDate ?? '9999') < today;
  if (over || !stayLinkOf(event)) return null;
  const share: ChatShare = size > 1 ? { kind: 'stay', id: event.id, guests: size } : { kind: 'stay', id: event.id };
  const place = event.location?.split(',')[0]?.trim() || event.name;
  const ask = () => {
    const text = shareMessageText(share, tn(size, 'Need a place to stay for {festival}?', 'Need a place to stay for {festival}? Places for all {n} of us:', { festival: event.name }), WEB_URL);
    if (!chat.send(crew.id, text)) return;
    haptic.tap();
    setAsked(true);
  };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('Need a place to stay?')}</Text>
      <Text style={styles.line}>{tn(size, 'Places near {place} for your nights there.', 'Places for all {n} of you near {place}, for your nights there.', { place })}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            haptic.select();
            router.push(shareRoute(share));
          }}
          accessibilityRole="button"
          accessibilityLabel={tn(size, 'Find a place to stay near {place}', 'Find a place for all {n} of you near {place}', { place })}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{t('Find a place')}</Text>
        </Pressable>
        {size > 1 && chat.ready ? (
          <Pressable
            onPress={ask}
            disabled={asked}
            accessibilityRole="button"
            accessibilityState={{ disabled: asked }}
            accessibilityLabel={asked ? t('Sent to the crew chat') : t('Ask the crew in the chat')}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{asked ? t('Sent to the chat') : t('Ask the crew')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
    gap: space.xs,
  },
  title: { ...type.headline, color: color.moon },
  line: { ...type.caption, color: color.moonDim },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  primary: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: glowA(0.18), borderWidth: StyleSheet.hairlineWidth, borderColor: glowA(0.4) },
  primaryText: { ...type.label, color: color.moon },
  secondary: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.label, color: color.moonDim },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
