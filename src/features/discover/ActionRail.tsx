import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { color, motion, space, type, nightA } from '../../theme/tokens';
import { CommentIcon } from '../../components/TabIcons';
import { HeartIcon, SaveIcon, ThumbDownIcon } from './icons';
import { t } from '../../i18n';
import { StandingAvatar } from '../standing/StandingAvatar';
import { ringOf } from '../standing/standing';
import { useStanding } from '../standing/useStanding';
import { LEVEL_SHOWN_FROM } from '../quests/daily';
import { usePersonFace } from '../social/usePersonFace';

type Props = {
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  /** Without it there's no Save button (community clips can't be kept in Your clips). */
  onSave?: () => void;
  /** Not for me: you didn't like it (counts against the artist and sounds like theirs), and the feed moves on. */
  onSkip: () => void;
  /** Who filmed a crowd video: their photo first (with their ring and glow level), opening their profile. */
  filmer?: Filmer;
  /** The speech bubble: opens the clip's comments; `caption` is the count (or the word when there are none). */
  comments?: { caption: string; label: string; onPress: () => void };
  /** Row sits under a video instead of floating beside the stage. */
  horizontal?: boolean;
};

type Filmer = { uid: string; handle: string; label: string; onPress: () => void };

export function ActionRail({ liked, saved, onLike, onSave, onSkip, filmer, comments, horizontal }: Props) {
  return (
    <View style={[styles.rail, horizontal && styles.row]}>
      {filmer ? <FilmerButton filmer={filmer} /> : null}
      <RailButton label={liked ? t('Liked') : t('Like')} active={liked} onPress={onLike}>
        <HeartIcon color={liked ? color.glow : color.moon} filled={liked} />
      </RailButton>
      {comments ? (
        <RailButton label={comments.label} caption={comments.caption} active={false} onPress={comments.onPress}>
          <CommentIcon color={color.moon} size={27} />
        </RailButton>
      ) : null}
      {onSave ? (
        <RailButton label={saved ? t('Saved') : t('Save')} active={saved} onPress={onSave}>
          <SaveIcon color={saved ? color.glow : color.moon} filled={saved} />
        </RailButton>
      ) : null}
      <RailButton label={t('Not for me')} active={false} onPress={onSkip} nudge>
        <ThumbDownIcon color={color.moon} />
      </RailButton>
    </View>
  );
}

const FACE = 44;

/**
 * The person who filmed it, like TikTok: their photo above the buttons, with
 * their ring (founder, artist, team, partner) and their glow level when they
 * show it. Tapping opens their profile. Their first letter until the photo
 * is read (or when signed out).
 */
function FilmerButton({ filmer }: { filmer: Filmer }) {
  const face = usePersonFace(filmer.uid);
  const standing = useStanding(filmer.uid);
  const ringed = !!ringOf(standing);
  const level = standing?.level && standing.level >= LEVEL_SHOWN_FROM ? standing.level : undefined;
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <Pressable
      onPress={filmer.onPress}
      onPressIn={() => s.set(withSpring(0.9, motion.snappy))}
      onPressOut={() => s.set(withSpring(1, motion.snappy))}
      accessibilityRole="link"
      accessibilityLabel={level ? `${filmer.label} ${t('Glow level {level}', { level })}` : filmer.label}
      hitSlop={8}
      style={styles.button}
      testID="filmer-face"
    >
      <Animated.View style={[styles.face, style]}>
        {ringed ? (
          <StandingAvatar standing={standing} uid={filmer.uid} name={face?.name ?? filmer.handle} url={face?.avatarUrl} size={FACE - 4} />
        ) : (
          <View style={styles.plainRing}>
            <StandingAvatar standing={standing} uid={filmer.uid} name={face?.name ?? filmer.handle} url={face?.avatarUrl} size={FACE - 4} />
          </View>
        )}
        {level ? (
          <View style={styles.level}>
            <Text style={styles.levelText}>{level}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function RailButton({
  label,
  caption,
  active,
  onPress,
  nudge,
  children,
}: {
  label: string;
  /** What shows under the icon, when it isn't the label. */
  caption?: string;
  active: boolean;
  onPress: () => void;
  /** Not for me: the icon dips down when tapped. */
  nudge?: boolean;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const y = useSharedValue(0);
  // Each time the button turns on (not when it shows up already on): a pop, a ring and sparks.
  const [burst, setBurst] = useState(0);
  const [prev, setPrev] = useState(active);
  if (active !== prev) {
    setPrev(active);
    if (active && !reduced) setBurst((b) => b + 1);
  }
  const was = useRef(active);
  useEffect(() => {
    if (active && !was.current) s.set(withSequence(withTiming(1.25, { duration: 110 }), withSpring(1, motion.snappy)));
    was.current = active;
  }, [active, s]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }, { scale: s.get() }] }));

  return (
    <Pressable
      onPress={() => {
        if (nudge && !reduced) y.set(withSequence(withTiming(7, { duration: 90 }), withSpring(0, motion.snappy)));
        onPress();
      }}
      onPressIn={() => s.set(withSpring(0.86, motion.snappy))}
      onPressOut={() => s.set(withSpring(1, motion.snappy))}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      style={styles.button}
    >
      <View>
        {burst ? <Burst key={burst} /> : null}
        <Animated.View style={[styles.icon, style]}>{children}</Animated.View>
      </View>
      <Text style={[styles.label, active && { color: color.glow }]}>{caption ?? label}</Text>
    </Pressable>
  );
}

const SPARKS = 8;

/** A ring of light and a handful of sparks flying out from a button that just turned on. */
function Burst() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [t]);
  const ring = useAnimatedStyle(() => ({ opacity: 1 - t.get(), transform: [{ scale: 0.6 + t.get() * 0.9 }] }));
  return (
    <View style={styles.burst} pointerEvents="none">
      <Animated.View style={[styles.ring, ring]} />
      {Array.from({ length: SPARKS }, (_, i) => (
        <Spark key={i} i={i} t={t} />
      ))}
    </View>
  );
}

function Spark({ i, t }: { i: number; t: SharedValue<number> }) {
  const a = (i / SPARKS) * Math.PI * 2 - Math.PI / 2;
  const style = useAnimatedStyle(() => ({
    opacity: t.get() < 0.15 ? 0 : 1 - t.get(),
    transform: [{ translateX: Math.cos(a) * 36 * t.get() }, { translateY: Math.sin(a) * 36 * t.get() }, { scale: 1 - t.get() * 0.5 }],
  }));
  return <Animated.View style={[styles.spark, { backgroundColor: i % 2 ? color.glow : '#FF7EB6' }, style]} />;
}

const styles = StyleSheet.create({
  burst: { position: 'absolute', left: 0, top: 0, width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: color.glow },
  spark: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },
  rail: { alignItems: 'center', gap: space.xl },
  row: { flexDirection: 'row', justifyContent: 'center', gap: space.xxxl },
  button: { alignItems: 'center' },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: nightA(0.35),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  face: { alignItems: 'center', justifyContent: 'center', minWidth: 50, minHeight: 50 },
  plainRing: { padding: 1.5, borderRadius: FACE / 2 + 1.5, borderWidth: 1.5, borderColor: color.moon, backgroundColor: nightA(0.35) },
  level: {
    position: 'absolute',
    bottom: -7,
    minWidth: 20,
    height: 16,
    paddingHorizontal: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD36E',
    borderWidth: 1.5,
    borderColor: color.night,
  },
  levelText: { fontSize: 10, lineHeight: 12, fontWeight: '800', color: color.night, fontVariant: ['tabular-nums'] },
  label: { ...type.caption, color: color.moon, marginTop: 5, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
});
