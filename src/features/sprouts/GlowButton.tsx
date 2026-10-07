import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { t } from '../../i18n';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useSocial } from '../../state/social';
import { bumpQuestEvent } from '../../state/dailyQuests';
import { radius, space, type } from '../../theme/tokens';

const GOLD = '#FFE58A';
const SPARKS = 10;

/**
 * Leave a glow on someone's garden: a little light that says you visited and
 * liked it. Once each; tap again to take it back. Bursts into sparks when
 * you leave it (still with reduced motion).
 */
export function GlowButton({ uid, handle }: { uid: string; handle?: string }) {
  const social = useSocial();
  const { service } = social;
  const [glowed, setGlowed] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();
  const burst = useSharedValue(0);
  const star = useSharedValue(1);
  useEffect(() => {
    let live = true;
    service
      .glowedGarden(uid)
      .then((on) => live && setGlowed(on))
      .catch(() => live && setGlowed(false));
    return () => {
      live = false;
    };
  }, [uid, service]);
  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: star.get() }] }));

  if (glowed === undefined) return null;
  const toggle = async () => {
    if (busy) return;
    const next = !glowed;
    setBusy(true);
    setGlowed(next);
    if (next) {
      haptic.celebrate();
      if (!reduce) {
        burst.set(0);
        burst.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
        star.set(withSequence(withTiming(1.6, { duration: 160 }), withSpring(1, { damping: 6, stiffness: 180 })));
      }
    } else haptic.select();
    try {
      await service.glowGarden(uid, next);
      if (next) bumpQuestEvent('glow');
    } catch {
      setGlowed(!next);
      showAlert(t('Couldn’t leave your glow'), t('Check your signal and try again.'));
    }
    setBusy(false);
  };
  const who = handle ? `@${handle}` : t('them');
  return (
    <View style={styles.wrap}>
      {reduce ? null : Array.from({ length: SPARKS }, (_, i) => <Spark key={i} index={i} progress={burst} />)}
      <Pressable
        onPress={() => void toggle()}
        accessibilityRole="button"
        accessibilityState={{ selected: glowed }}
        accessibilityLabel={glowed ? t('You left a glow for {who}. Take it back.', { who }) : t('Leave a glow for {who}', { who })}
        style={({ pressed }) => [styles.button, glowed && styles.on, pressed && styles.pressed]}
      >
        <Animated.Text style={[styles.star, glowed && styles.starOn, starStyle]}>✦</Animated.Text>
        <Text style={[styles.text, glowed && styles.textOn]}>{glowed ? t('You left a glow') : t('Leave a glow')}</Text>
      </Pressable>
    </View>
  );
}

function Spark({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const a = (index / SPARKS) * Math.PI * 2;
  const reach = 46 + (index % 3) * 10;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p <= 0 || p >= 1 ? 0 : 1 - p,
      transform: [{ translateX: Math.cos(a) * reach * p }, { translateY: Math.sin(a) * reach * p * 0.6 }, { scale: 1 - p * 0.5 }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.spark, index % 2 ? styles.sparkPink : null, style]} />;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,229,138,0.5)' },
  on: { backgroundColor: 'rgba(255,229,138,0.16)', borderColor: GOLD },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  star: { fontSize: 18, color: 'rgba(255,229,138,0.8)' },
  starOn: { color: GOLD, textShadowColor: GOLD, textShadowRadius: 10 },
  text: { ...type.headline, color: 'rgba(255,229,138,0.85)' },
  textOn: { color: GOLD },
  spark: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  sparkPink: { backgroundColor: '#FF8AD8' },
});
