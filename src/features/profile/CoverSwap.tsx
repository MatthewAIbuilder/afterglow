import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { rememberBackdrop, useLastBackdrop } from '../../state/lastBackdrop';
import { useSocial } from '../../state/social';
import { color, glowA, nightA } from '../../theme/tokens';
import { useStanding } from '../standing/useStanding';
import type { Profile } from '../social/models';
import { AnimatedBackdrop } from './AnimatedBackdrop';
import { backdropOf, type BackdropId, canUse, madeFor, NO_BACKDROP } from './backdrops';
import { t } from '../../i18n';

const SIZE = 38;

/**
 * A small round button in the corner of your profile's top, for swapping
 * between your cover photo and your animated background in one tap. It shows
 * a little preview of the other one. Only when you have both: a cover photo,
 * and a background you're showing now or showed last (kept on this phone).
 */
export function CoverSwap({ me, shown, style }: { me: Profile; shown: BackdropId | undefined; style?: object }) {
  const social = useSocial();
  const plus = !!useStanding(me.uid)?.plus;
  const last = useLastBackdrop(me.uid);
  const [busy, setBusy] = useState(false);

  // Remember the background you're showing, to come back to it after the photo.
  useEffect(() => {
    if (shown) rememberBackdrop(me.uid, shown);
  }, [shown, me.uid]);

  const lastBackdrop = backdropOf(last);
  const back = lastBackdrop && canUse(lastBackdrop, me.uid, plus) ? lastBackdrop.id : undefined;
  if (!me.coverUrl || (!shown && !back)) return null;
  const toPhoto = !!shown;
  const otherLabel = toPhoto ? t('Show your cover photo instead') : t('Show {name} instead', { name: backdropOf(back)?.name ?? '' });

  const swap = async () => {
    if (busy) return;
    haptic.select();
    setBusy(true);
    try {
      // Someone with a background made for them turns it off with "none"; for everyone else no choice means the photo.
      await social.setBackdrop(toPhoto ? (madeFor(me.uid) ? NO_BACKDROP : null) : (back ?? null));
      haptic.settle();
    } catch {
      showAlert(t('Couldn’t swap your background'), t('Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={() => void swap()}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={otherLabel}
      accessibilityState={{ busy }}
      hitSlop={8}
      style={({ pressed }) => [styles.button, style, (pressed || busy) && styles.pressed]}
    >
      <View style={styles.thumb}>
        {toPhoto ? <Image source={{ uri: me.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : back ? <AnimatedBackdrop id={back} width={SIZE} height={SIZE} still /> : null}
      </View>
      <View style={styles.badge}>
        <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
          <Path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" stroke={color.moon} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { position: 'absolute', zIndex: 5, width: SIZE, height: SIZE },
  thumb: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden', borderWidth: 1.5, borderColor: color.moonDim, backgroundColor: nightA(0.6) },
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glowA(0.95),
    borderWidth: 1.5,
    borderColor: color.night,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
});
