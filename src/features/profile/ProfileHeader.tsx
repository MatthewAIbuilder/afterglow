import { SocialLinks } from '../../components/SocialIcons';
import type { Socials } from '../social/socials';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ProfileIcon } from '../../components/TabIcons';
import { SOUND_LABEL, type SoundTag } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { type ProfileStat, shortCount } from './profileView';
import { StandingAvatar, StandingCaption } from '../standing/StandingAvatar';
import { SparkIcon } from '../quests/QuestRing';
import { LEVEL_SHOWN_FROM, levelName } from '../quests/daily';
import { ringOf } from '../standing/standing';
import { useStanding } from '../standing/useStanding';
import { SOUND_COLOR, withAlpha } from '../sound-map/colors';
import { type Favourite, feelingLine } from './identity';
import { SoundOrbit } from './SoundOrbit';
import { t } from '../../i18n';
import type { PublicKandi } from '../kandi/kandi';
import { KandiBracelet } from '../kandi/KandiBracelet';

type Props = {
  name: string;
  /** The kandi they show on their profile. */
  kandi?: PublicKandi;
  /** Draw the name's first letter when there's no photo (a real profile); otherwise a person glyph. */
  initial?: boolean;
  /** Your bio, or a line saying what this page is before you have a profile. */
  bio?: string;
  avatarUrl?: string;
  stats: ProfileStat[];
  onStat?: (key: ProfileStat['key']) => void;
  /** Your top sounds, as small chips (tap: the full breakdown). */
  /** Top sounds, as small chips (tap: the full breakdown). Someone else's come without percentages. */
  sounds: { tag: SoundTag; percent?: number }[];
  onSounds?: () => void;
  /** The artists drifting round your photo, and where tapping them goes (My Sound). */
  orbit: Favourite[];
  onOrbit?: () => void;
  /** The sound you've been feeling this week, when there is one. */
  feeling?: SoundTag;
  children?: React.ReactNode;
  /** Your uid, for a founder's or flair's ring and caption. */
  uid?: string;
  /** Someone else's profile: their @handle under the name, and whose they are (their name, "Maya") in what's read out. */
  handle?: string;
  whose?: string;
  /** Their Instagram, Snapchat and TikTok, as little icons under the bio. */
  socials?: Socials;
  /** A quiet line under the bio ("Going to EDC Orlando 2026"). */
  note?: string;
  /**
   * Your glow level, live from your quests, as a gold pill that opens them;
   * null while yours is still being worked out (nothing shows, never a
   * stand-in). Without it, the level their profile shows (if any).
   */
  level?: { level: number; name: string } | null;
  onLevel?: () => void;
  /** Which counts can be tapped (all of them by default). */
  tappable?: ProfileStat['key'][];
  /** Drawn instead of the photo (an event organizer's logo). */
  face?: React.ReactNode;
};

const ORBIT_H = 236;

/**
 * The top of your profile, as a living picture of your festival life: your
 * photo at the heart of a tiny sound universe (your favourite artists drift
 * round it), your name and bio, what you're feeling lately, the counts, your
 * sound as chips, and the buttons (passed as children).
 */
export function ProfileHeader({ kandi, name, initial, bio, avatarUrl, stats, onStat, sounds, onSounds, orbit, onOrbit, feeling, children, uid, handle, whose, note, tappable, level, onLevel, socials, face }: Props) {
  const standing = useStanding(uid);
  const ringed = !!ringOf(standing);
  // Your own level comes live from your quests; anyone else's from what their profile shows.
  const shownLevel = level === null ? undefined : (level ?? (standing?.level && standing.level >= LEVEL_SHOWN_FROM ? { level: standing.level, name: levelName(standing.level) } : undefined));
  const { width } = useWindowDimensions();
  const orbitWidth = Math.min(width, 520);
  const social = stats.filter((s) => s.key === 'followers' || s.key === 'following');
  const mine = stats.filter((s) => s.key !== 'followers' && s.key !== 'following');
  const photo = face ? (
    <View style={styles.avatar}>{face}</View>
  ) : ringed ? (
    <StandingAvatar standing={standing} name={name} url={avatarUrl} size={AVATAR - 10} />
  ) : (
    <View style={styles.avatar}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" transition={200} />
      ) : initial ? (
        <Text style={styles.initial}>{name.slice(0, 1).toUpperCase()}</Text>
      ) : (
        <ProfileIcon color={color.moonDim} size={40} />
      )}
    </View>
  );
  const artistNames = orbit.map((o) => o.artist.name).join(', ');
  const orbitLabel = `${
    orbit.length
      ? whose
        ? t('{name}’s sound universe: {artists}.', { name: whose, artists: artistNames })
        : t('Your sound universe: {artists}.', { artists: artistNames })
      : whose
        ? t('{name}’s photo.', { name: whose })
        : t('Your photo.')
  }${onOrbit ? ` ${t('Opens My Sound.')}` : ''}`;
  const soundList = sounds.map((m) => (m.percent !== undefined ? t('{sound} {pct} percent', { sound: SOUND_LABEL[m.tag], pct: m.percent }) : SOUND_LABEL[m.tag])).join(', ');
  const soundsLabel = `${whose ? t('{name}’s sound: {sounds}.', { name: whose, sounds: soundList }) : t('Your sound: {sounds}.', { sounds: soundList })}${onSounds ? ` ${t('Opens the full breakdown.')}` : ''}`;
  return (
    <View style={styles.root}>
      <View style={styles.orbitWrap}>
        <SoundOrbit width={orbitWidth} height={ORBIT_H} artists={orbit} sounds={sounds.map((s) => s.tag)} onPress={onOrbit} label={orbitLabel}>
          {photo}
        </SoundOrbit>
      </View>

      <Text style={styles.name} accessibilityRole="header">
        {name}
      </Text>
      {handle ? <Text style={styles.handle}>@{handle}</Text> : null}
      {kandi ? (
        <View style={styles.kandi} accessible accessibilityLabel={kandi.from ? t('Wearing kandi spelling {word}, from @{handle}', { word: kandi.word, handle: kandi.from }) : t('Wearing kandi spelling {word}', { word: kandi.word })}>
          <KandiBracelet word={kandi.word} beads={kandi.beads} charm={kandi.charm} size={46} />
          <Text style={styles.kandiText}>{kandi.from ? t('Wearing kandi from @{handle}', { handle: kandi.from }) : t('Wearing kandi')}</Text>
        </View>
      ) : null}
      <StandingCaption standing={standing} align="center" />
      {shownLevel && onLevel ? (
        <Pressable
          onPress={onLevel}
          accessibilityRole="button"
          accessibilityLabel={t('Glow level {level}, {name}. Opens your quests.', { level: shownLevel.level, name: shownLevel.name })}
          hitSlop={6}
          style={({ pressed }) => [styles.level, pressed && { opacity: 0.75 }]}
          testID="profile-level"
        >
          <SparkIcon size={13} />
          <Text style={styles.levelText}>{t('Level {level} · {name}', { level: shownLevel.level, name: shownLevel.name })}</Text>
        </Pressable>
      ) : shownLevel ? (
        <View style={styles.level} accessible accessibilityLabel={t('Glow level {level}, {name}', { level: shownLevel.level, name: shownLevel.name })} testID="profile-level">
          <SparkIcon size={13} />
          <Text style={styles.levelText}>{t('Level {level} · {name}', { level: shownLevel.level, name: shownLevel.name })}</Text>
        </View>
      ) : null}
      {bio ? <Text style={styles.bio}>{bio}</Text> : null}
      <SocialLinks socials={socials} whose={name} />
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {feeling ? (
        <View style={[styles.feeling, { borderColor: withAlpha(SOUND_COLOR[feeling], 0.5), backgroundColor: withAlpha(SOUND_COLOR[feeling], 0.12) }]}>
          <View style={[styles.feelingDot, { backgroundColor: SOUND_COLOR[feeling], shadowColor: SOUND_COLOR[feeling] }]} />
          <Text style={styles.feelingText}>{feelingLine(feeling)}</Text>
        </View>
      ) : null}

      {social.length ? <StatRow stats={social} onStat={onStat} tappable={tappable} big /> : null}
      <StatRow stats={mine} onStat={onStat} tappable={tappable} />

      {sounds.length > 0 ? (
        <Pressable
          onPress={() => {
            haptic.select();
            onSounds?.();
          }}
          disabled={!onSounds}
          accessibilityRole={onSounds ? 'button' : 'text'}
          accessibilityLabel={soundsLabel}
          style={({ pressed }) => [styles.sounds, pressed && { opacity: 0.7 }]}
        >
          {sounds.map((m) => (
            <View key={m.tag} style={[styles.sound, { borderColor: withAlpha(SOUND_COLOR[m.tag], 0.45) }]}>
              <View style={[styles.soundDot, { backgroundColor: SOUND_COLOR[m.tag] }]} />
              <Text style={styles.soundText}>
                {SOUND_LABEL[m.tag]}
                {m.percent !== undefined ? <Text style={styles.soundPct}> {m.percent}%</Text> : null}
              </Text>
            </View>
          ))}
        </Pressable>
      ) : null}

      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const TAPPABLE: ProfileStat['key'][] = ['followers', 'following', 'festivals', 'moments', 'badges', 'artists'];

function StatRow({ stats, onStat, big, tappable = TAPPABLE }: { stats: ProfileStat[]; onStat?: (key: ProfileStat['key']) => void; big?: boolean; tappable?: ProfileStat['key'][] }) {
  return (
    <View style={[styles.stats, big && styles.statsBig]} accessibilityRole="summary">
      {stats.map((s) => {
        const canTap = !!onStat && tappable.includes(s.key);
        return (
          <Pressable
            key={s.key}
            disabled={!canTap}
            onPress={() => {
              haptic.select();
              onStat?.(s.key);
            }}
            accessibilityRole={canTap ? 'button' : 'text'}
            accessibilityLabel={s.a11y}
            hitSlop={6}
            style={({ pressed }) => [styles.stat, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.statN, big && styles.statNBig]}>{shortCount(s.n)}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A button under the profile: "Edit profile", "Share profile". `glow` for the one thing to do. */
export function ProfileButton({ label, onPress, glow, a11y, flex = true }: { label: string; onPress: () => void; glow?: boolean; a11y?: string; flex?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      style={({ pressed }) => [styles.button, flex && { flex: 1 }, glow && styles.buttonGlow, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }]}
    >
      <Text style={[styles.buttonText, glow && styles.buttonTextGlow]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const AVATAR = 104;

const styles = StyleSheet.create({
  level: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: space.sm,
    paddingVertical: 4,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,211,110,0.55)',
    backgroundColor: 'rgba(255,211,110,0.1)',
  },
  levelText: { ...type.caption, color: '#FFD36E', fontWeight: '700' },
  root: { paddingHorizontal: space.xl, alignItems: 'center' },
  orbitWrap: { marginHorizontal: -space.xl, alignItems: 'center', marginTop: -space.sm },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.night,
    borderWidth: 2,
    borderColor: glowA(0.7),
    shadowColor: color.glow,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarImage: { width: AVATAR, height: AVATAR },
  initial: { ...type.largeTitle, color: color.moon },
  name: { ...type.title, color: color.moon, marginTop: -space.xs, textAlign: 'center' },
  bio: { ...type.body, color: color.moonDim, marginTop: 4, textAlign: 'center' },
  handle: { ...type.body, color: color.moonDim, marginTop: 2, textAlign: 'center' },
  kandi: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs, paddingLeft: space.xs, paddingRight: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  kandiText: { ...type.caption, color: color.moonDim },
  note: { ...type.caption, color: color.moonDim, marginTop: space.xs, textAlign: 'center' },
  feeling: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feelingDot: { width: 7, height: 7, borderRadius: 4, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  feelingText: { ...type.caption, color: color.moon },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.md, alignSelf: 'stretch' },
  statsBig: { gap: space.xxl, marginTop: space.lg },
  stat: { alignItems: 'center', minWidth: 58, paddingVertical: 2 },
  statN: { ...type.headline, fontSize: 17, color: color.moon, fontVariant: ['tabular-nums'] },
  statNBig: { fontSize: 20 },
  statLabel: { ...type.caption, color: color.moonDim, marginTop: 1 },
  sounds: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs, marginTop: space.lg },
  sound: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.sm + 2, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth },
  soundDot: { width: 6, height: 6, borderRadius: 3 },
  soundText: { ...type.caption, color: color.moon },
  soundPct: { color: color.moonFaint, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, alignSelf: 'stretch' },
  button: {
    minHeight: 36,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  buttonGlow: { backgroundColor: color.glowDeep, borderColor: glowA(0.6) },
  buttonText: { ...type.label, color: color.moon },
  buttonTextGlow: { color: color.moon },
});
