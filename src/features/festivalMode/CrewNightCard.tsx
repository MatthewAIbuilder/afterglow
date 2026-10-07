import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PersonAvatar } from '../../components/PersonAvatar';
import { ChevronIcon } from '../../components/TabIcons';
import type { Festival } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCrewChat } from '../../state/crewChat';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useSocial } from '../../state/social';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { chatPreview, unreadLine } from '../crews/chat';
import { AMBER, GREEN, RED, useCareActions, useCheckInStatus } from '../crews/CheckInPanel';
import { firstName } from '../crews/together';
import { CHECK_INS, clock, presetLabel } from '../crews/updates';
import { crewWhere, type Whereabouts } from '../crews/where';
import { CrewOrb } from '../friends/CrewOrb';
import type { Crew, CrewUpdate } from '../social/models';
import { t } from '../../i18n';

/**
 * One crew at the festival, everything in one card: its chat (the latest
 * message, how many are new; tap to open), where everyone last checked in,
 * then telling them how you are in one tap (a row of check-ins, and "I'm OK"
 * / "Can't find you" / "Need help"), with whether it got through, and the
 * meeting spot. The full check-in (stage, photo, words) is a tap away.
 */
export function CrewNightCard({ crew, festival }: { crew: Crew; festival: Festival }) {
  const social = useSocial();
  const me = social.user?.uid;
  const chat = useCrewChat();
  const { checkIn, ready, profileOf, updatesFor, outbox, meetSpotFor } = useCrewUpdates();
  const { done, status, tint } = useCheckInStatus();
  const care = useCareActions(festival.id, done);
  const now = useNow().getTime();

  const nameOf = (u: string) => (u === me ? t('You') : profileOf(u) ? firstName(profileOf(u)!.displayName) : t('Crewmate'));
  const others = crew.members.filter((u) => u !== me && !social.blocked.has(u));
  const faces = others.map((u) => ({ name: profileOf(u)?.displayName, url: profileOf(u)?.avatarUrl }));
  const unread = chat.ready ? chat.unreadFor(crew.id) : 0;
  const preview = chat.ready ? chatPreview(chat.latestFor(crew.id), me, nameOf) : undefined;

  // Where everyone last said they were (your own check-ins still waiting for signal count too).
  const waiting: CrewUpdate[] = me
    ? outbox.filter((o) => o.input.kind !== 'reply' && o.crewIds.includes(crew.id)).map((o) => ({ ...o.input, crewId: crew.id, uid: me, sentAt: o.input.at }) as CrewUpdate)
    : [];
  const where = crewWhere(festival, [crew], [...updatesFor(crew.id), ...waiting], { blocked: [...social.blocked], now });
  const seen: (Whereabouts & { stage?: string })[] = [...where.stages.flatMap((g) => g.people.map((p) => ({ ...p, stage: g.stage }))), ...where.elsewhere];
  const spot = meetSpotFor(crew.id);

  const openChat = () => {
    haptic.select();
    router.push({ pathname: '/crew-chat/[id]', params: { id: crew.id } });
  };

  return (
    <View style={styles.card}>
      {/* The crew and its chat. */}
      <Pressable
        onPress={openChat}
        accessibilityRole="button"
        accessibilityLabel={`${t('{crew}: open the crew chat', { crew: crew.name })}${unread ? `. ${unreadLine(unread)}` : ''}${preview ? `. ${preview}` : ''}`}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        <CrewOrb name={crew.name} people={faces} total={others.length} size={44} />
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>
            {crew.name}
          </Text>
          <Text style={[styles.preview, unread > 0 && styles.previewNew]} numberOfLines={1}>
            {preview ?? t('Say hi to your crew. Only people in it can see the chat.')}
          </Text>
        </View>
        {unread ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread}</Text>
          </View>
        ) : null}
        <Text style={styles.chatLink}>{t('Chat')}</Text>
        <ChevronIcon color={color.glow} size={11} />
      </Pressable>

      {/* Where everyone is: from their latest check-ins, not live location. */}
      {seen.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people} style={styles.bleed}>
          {seen.map((w) => (
            <View
              key={w.uid}
              style={[styles.person, w.stale && styles.stale]}
              accessible
              accessibilityLabel={[nameOf(w.uid), w.stage, clock(w.update.at), w.stale ? t('may have moved') : undefined].filter(Boolean).join(', ')}
            >
              <PersonAvatar uid={w.uid} name={w.uid === me ? social.profile?.displayName : profileOf(w.uid)?.displayName} url={w.uid === me ? social.profile?.avatarUrl : profileOf(w.uid)?.avatarUrl} size={26} />
              <View>
                <Text style={styles.personName} numberOfLines={1}>
                  {nameOf(w.uid)}
                </Text>
                <Text style={styles.personWhere} numberOfLines={1}>
                  {[w.stage, clock(w.update.at)].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : others.length ? (
        <Text style={styles.quiet}>{t('No check-ins yet. Be the first: tap one below.')}</Text>
      ) : (
        <Text style={styles.quiet}>{t('Just you so far. Invite friends from the crew’s page.')}</Text>
      )}

      {ready ? (
        <>
          <View style={styles.divider} />
          <View style={styles.tellHead}>
            <Text style={styles.tell}>{t('Tell your crew')}</Text>
            <Pressable
              onPress={() => {
                haptic.select();
                router.push('/check-in');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Check in with a stage, a photo or your own words')}
              hitSlop={8}
            >
              <Text style={styles.more}>{t('Stage, photo, words ›')}</Text>
            </Pressable>
          </View>
          {/* One tap each: what you're doing… */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.bleed}>
            {CHECK_INS.map((words) => (
              <Chip
                key={words}
                label={presetLabel(words)}
                a11y={t('Send “{words}” to your crew', { words: presetLabel(words) })}
                onPress={() => {
                  const id = checkIn(festival.id, { note: words });
                  if (id) done(id, presetLabel(words));
                }}
              />
            ))}
          </ScrollView>
          {/* …and how you are. */}
          <View style={styles.care}>
            <Chip wide label={care.asked ? t('I’m OK now') : t('I’m OK')} tint={GREEN} a11y={care.asked ? t('I’m OK now. Tell my crew') : t('I’m OK. Tell my crew')} onPress={care.ok} />
            <Chip wide label={t('Can’t find you')} tint={AMBER} a11y={t('Can’t find my crew. Tell them')} onPress={care.lost} />
            {care.asked ? null : <Chip wide label={t('Need help')} tint={RED} a11y={t('Not feeling great. Ask my crew to come find me')} onPress={care.help} />}
          </View>
          {care.asked && care.myCare ? (
            <Text style={[styles.status, { color: RED }]}>{t('You asked your crew for help at {time}. Feeling better? Let them know.', { time: clock(care.myCare.at) })}</Text>
          ) : null}
          {status ? (
            <Text style={[styles.status, tint ? { color: tint } : null]} accessibilityLiveRegion="polite">
              {status}
            </Text>
          ) : null}
        </>
      ) : null}

      {/* The meeting spot, set from the crew's page. */}
      <Pressable
        onPress={() => {
          haptic.select();
          router.push({ pathname: '/crew/[id]', params: { id: crew.id } });
        }}
        accessibilityRole="button"
        accessibilityLabel={spot ? t('Meeting spot: {spot}. Open the crew', { spot: spot.text }) : t('Pick a meeting spot for if you lose each other')}
        style={({ pressed }) => [styles.spot, pressed && styles.pressed]}
      >
        <Text style={styles.spotLabel}>{t('Meeting spot')}</Text>
        <Text style={[styles.spotText, !spot && styles.spotEmpty]} numberOfLines={1}>
          {spot ? spot.text : t('Pick one for if you lose each other')}
        </Text>
        <ChevronIcon color={color.moonFaint} size={10} />
      </Pressable>
    </View>
  );
}

function Chip({ label, a11y, tint, wide, onPress }: { label: string; a11y: string; tint?: string; wide?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.chip, wide && styles.chipWide, tint ? { borderColor: `${tint}66`, backgroundColor: `${tint}14` } : null, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, tint ? { color: tint } : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.3),
    borderTopColor: color.rim,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headText: { flex: 1, gap: 1 },
  name: { ...type.headline, color: color.moon },
  preview: { ...type.caption, color: color.moonDim },
  previewNew: { color: color.moon },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glow },
  badgeText: { ...type.caption, fontWeight: '700', color: color.night },
  chatLink: { ...type.label, color: color.glow },
  bleed: { marginHorizontal: -space.lg },
  people: { gap: space.sm, paddingHorizontal: space.lg },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: 2, paddingRight: space.md, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.06)' },
  personName: { ...type.label, fontSize: 13, color: color.moon, maxWidth: 120 },
  personWhere: { ...type.caption, fontSize: 11, color: color.moonDim, maxWidth: 120 },
  stale: { opacity: 0.55 },
  quiet: { ...type.caption, color: color.moonDim },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairline },
  tellHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tell: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1 },
  more: { ...type.caption, color: color.glow },
  chips: { gap: space.xs, paddingHorizontal: space.lg },
  care: { flexDirection: 'row', gap: space.xs },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
    alignItems: 'center',
  },
  chipWide: { flex: 1, paddingHorizontal: space.xs },
  chipText: { ...type.label, fontSize: 13, color: color.moon },
  status: { ...type.caption, color: color.moonDim },
  spot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.04)' },
  spotLabel: { ...type.caption, color: color.moonFaint },
  spotText: { ...type.label, fontSize: 13, color: color.moon, flex: 1 },
  spotEmpty: { color: color.moonDim, fontWeight: '400' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
