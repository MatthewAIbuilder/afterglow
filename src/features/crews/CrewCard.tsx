import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronIcon, PlusIcon } from '../../components/TabIcons';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useCrews } from '../../state/crews';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import type { Festival } from '../../data/models';
import { CREW_NAME_MAX } from '../social/models';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../social/service';
import { t, tn } from '../../i18n';

/** A new crew's name until its owner renames it: "EDC Orlando 2026 crew". */
export const defaultCrewName = (festival: Festival) => {
  const name = t('{festival} crew', { festival: festival.name });
  return name.length <= CREW_NAME_MAX ? name : name.slice(0, CREW_NAME_MAX).trim();
};

/**
 * Festival crews on a festival page: the crews you're in for this festival
 * (each opens its page), or "Plan with friends" to start one. Shown only when
 * profiles are set up in this build; signed out, it offers to sign in.
 */
export function CrewCard({ festival }: { festival: Festival }) {
  const social = useSocial();
  const { crewsAt, create } = useCrews();
  const [busy, setBusy] = useState(false);
  if (!social.availability.ok) return null;
  const mine = social.user ? crewsAt(festival.id) : [];

  const start = async () => {
    haptic.select();
    if (!social.user) {
      router.push('/account');
      return;
    }
    if (!social.profile) {
      showAlert(t('Create your profile first'), t('Your crew sees your name and photo, so you need a profile to start one.'), [
        { text: t('Not now'), style: 'cancel' },
        { text: t('Create profile'), onPress: () => router.push('/profile-edit') },
      ]);
      return;
    }
    setBusy(true);
    try {
      const crew = await create(festival.id, defaultCrewName(festival));
      haptic.settle();
      router.push({ pathname: '/crew/[id]', params: { id: crew.id, fresh: '1' } });
    } catch (e) {
      showAlert(t('Couldn’t start a crew'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setBusy(false);
    }
  };

  if (mine.length) {
    return (
      <View style={styles.list}>
        {mine.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => {
              haptic.select();
              router.push({ pathname: '/crew/[id]', params: { id: c.id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={tn(c.members.length, 'Your crew, {crew}, {n} person. Open it.', 'Your crew, {crew}, {n} people. Open it.', { crew: c.name })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>{t('Your crew')}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.detail}>{c.members.length === 1 ? t('Just you so far. Invite your friends.') : t('{n} of you planning together', { n: c.members.length })}</Text>
            </View>
            <ChevronIcon color={color.moonFaint} size={12} />
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <Pressable
      onPress={start}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={social.user ? t('Plan with friends. Start a crew and see which sets you all want.') : t('Plan with friends. Sign in to start a crew.')}
      style={({ pressed }) => [styles.card, styles.list, pressed && styles.pressed]}
    >
      <View style={styles.plus}>{busy ? <ActivityIndicator color={color.moon} size="small" /> : <PlusIcon color={color.moon} size={14} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{t('Plan with friends')}</Text>
        <Text style={styles.detail}>{social.user ? t('Start a crew and see which sets you all want.') : t('Sign in to start a crew with your friends.')}</Text>
      </View>
      <ChevronIcon color={color.moonFaint} size={12} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: space.md, gap: space.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  pressed: { opacity: 0.75 },
  plus: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.glowDeep, alignItems: 'center', justifyContent: 'center' },
  kicker: { ...type.caption, color: color.glow, fontWeight: '600' },
  title: { ...type.headline, color: color.moon },
  detail: { ...type.caption, color: color.moonDim, marginTop: 2 },
});
