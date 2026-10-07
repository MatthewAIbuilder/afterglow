import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { PageTitle } from '../../components/PageTitle';
import { PersonAvatar } from '../../components/PersonAvatar';
import { cardFrom } from '../../features/friends/qr';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { type AddResult, useFriendAdds } from '../../state/friendAdds';
import { useSocial } from '../../state/social';
import { color, radius, space, type, accentEdge } from '../../theme/tokens';

/**
 * A friend link (what a friend code says, opened from a phone's own camera
 * or a shared link): one tap to be friends both ways. Saved for later when
 * there's no signal, like a scan.
 */
export default function AddFriendScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ handle?: string; u?: string; c?: string; n?: string }>();
  const card = cardFrom(params);
  const social = useSocial();
  const { add } = useFriendAdds();
  const [outcome, setOutcome] = useState<AddResult | 'adding' | undefined>();

  const go = async () => {
    if (!card) return;
    haptic.tap();
    setOutcome('adding');
    setOutcome(await add(card));
  };

  const line = !card
    ? t('This friend link isn’t complete. Ask your friend to share it again, or scan their code.')
    : outcome === 'added'
      ? t('You and {name} are friends now. You follow each other.', { name: card.name })
      : outcome === 'self'
        ? t('This is your own friend link.')
        : outcome === 'waiting'
          ? t('Saved. You’ll be friends with {name} as soon as there’s signal.', { name: card.name })
          : outcome === 'needs-profile'
            ? t('Make your profile and you’ll be friends with {name} once there’s signal.', { name: card.name })
            : t('{name} wants to be friends on Afterglow. You’ll follow each other.', { name: card.name });

  return (
    <View style={styles.root}>
      <PageTitle title={t('Add a friend')} />
      <NightSky />
      <PageActions />
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        {card ? <PersonAvatar name={card.name} size={88} /> : null}
        {card ? <Text style={styles.name}>{card.name}</Text> : null}
        {card ? <Text style={styles.handle}>@{card.handle}</Text> : null}
        <Text style={[styles.body, outcome === 'waiting' && styles.amber]} accessibilityLiveRegion="polite">
          {line}
        </Text>
        {!card ? null : !social.availability.ok ? (
          <Text style={styles.body}>{t('Open Afterglow on your phone to add friends.')}</Text>
        ) : !social.ready ? null : !social.user ? (
          <Primary label={t('Sign in to be friends')} onPress={() => router.push('/account')} />
        ) : outcome === 'added' ? (
          <Primary label={t('See their profile')} onPress={() => router.replace({ pathname: '/u/[handle]', params: { handle: card.handle } })} />
        ) : outcome === 'needs-profile' ? (
          <Primary label={t('Make my profile')} onPress={() => router.push('/profile-edit')} />
        ) : outcome === undefined || outcome === 'adding' ? (
          <Primary label={outcome === 'adding' ? t('Adding…') : t('Be friends')} onPress={() => void go()} disabled={outcome === 'adding'} />
        ) : null}
      </View>
    </View>
  );
}

function Primary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.primary, (pressed || disabled) && styles.pressed]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 520 },
  name: { ...type.largeTitle, color: color.moon, marginTop: space.md, textAlign: 'center' },
  handle: { ...type.body, color: color.moonDim },
  body: { ...type.body, color: color.moonDim, textAlign: 'center', marginTop: space.md },
  amber: { color: '#FFB86B' },
  primary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, ...accentEdge, marginTop: space.lg },
  primaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.7 },
});
