import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { PersonAvatar } from '../../components/PersonAvatar';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import { FollowButton } from '../social/FollowButton';
import type { Profile } from '../social/models';
import { SPROUT_GREEN } from './look';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Under a sprout you picked up: follow whoever gave it to you, in one tap.
 * Sprouts are how people bring friends in, so the giver should be a friend
 * from the start. Nothing for your own sprout, someone you already follow
 * (until you just did, so the tick shows), or someone you've blocked.
 */
export function FollowGiver({ uid, handle, name }: { uid: string; handle: string; name?: string }) {
  const social = useSocial();
  const reduce = useReducedMotion();
  const [giver, setGiver] = useState<Profile | null>();
  // Followed here: keep the card, showing "Following", instead of it vanishing under your thumb.
  const [justFollowed, setJustFollowed] = useState(false);
  const me = social.user?.uid;
  const { service } = social;
  useEffect(() => {
    if (!me || uid === me) return;
    let live = true;
    service
      .profileOf(uid)
      .then((p) => live && setGiver(p))
      .catch(() => live && setGiver(null));
    return () => {
      live = false;
    };
  }, [uid, me, service]);

  if (!me || uid === me || social.blocked.has(uid) || giver === null) return null;
  if (social.following.has(uid) && !justFollowed) return null;
  const shownName = giver?.displayName ?? name ?? handle;
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.delay(250).duration(350)} style={styles.card} testID="follow-giver">
      <PersonAvatar name={shownName} url={giver?.avatarUrl} size={48} uid={uid} />
      <View style={styles.text}>
        <Text style={styles.title}>{justFollowed ? t('You follow {name} now', { name: firstName(shownName) }) : t('Follow {name}?', { name: firstName(shownName) })}</Text>
        <Text style={styles.body}>
          {justFollowed ? t('Their videos, plans and festivals show up for you.') : t('@{handle} gave you this sprout. Follow to see their videos, plans and festivals.', { handle: giver?.handle ?? handle })}
        </Text>
      </View>
      <FollowButton uid={uid} handle={giver?.handle ?? handle} compact onChange={(on) => setJustFollowed(on)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(110,231,160,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(110,231,160,0.45)',
  },
  text: { flex: 1, gap: 2 },
  title: { ...type.headline, color: SPROUT_GREEN },
  body: { ...type.caption, color: color.moonDim },
});
