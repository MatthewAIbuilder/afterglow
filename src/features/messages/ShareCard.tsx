import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArtistAvatar } from '../../components/ArtistAvatar';
import { PersonAvatar } from '../../components/PersonAvatar';
import { SOUND_LABEL, type Artist, type SoundTag } from '../../data/models';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { posterUrl } from '../discover/youtube';
import { whereWhen } from '../festivals/format';
import type { Profile } from '../social/models';
import { shareRoute, type ChatShare } from './shares';
import { t } from '../../i18n';

export const SHARE_CARD_WIDTH = 236;

type Shown = { kicker: string; title: string; subtitle?: string; art: React.ReactNode; faces?: Artist[] };

/**
 * Something sent from the app, as a card in a chat: what it is, its name
 * and one line, with its picture. Tap to open it. Things no longer in the
 * catalogue say so instead of opening nothing.
 */
export function ShareCard({ share }: { share: ChatShare }) {
  const { festival, artist, clip } = useCatalog();
  const social = useSocial();
  const handle = share.kind === 'profile' ? share.handle : undefined;
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  useEffect(() => {
    if (!handle) return;
    let live = true;
    social.service
      .profileByHandle(handle)
      .then((p) => live && setProfile(p))
      .catch(() => live && setProfile(null));
    return () => {
      live = false;
    };
  }, [handle, social.service]);

  const shown = ((): Shown | undefined => {
    switch (share.kind) {
      case 'festival': {
        const f = festival(share.id);
        if (!f) return undefined;
        const faces = (share.picks ?? []).map(artist).filter((a): a is Artist => !!a);
        if (faces.length)
          return { kicker: t('Must-sees'), title: f.name, subtitle: faces.map((a) => a.name).join(', '), art: <Glow letter={f.name} />, faces };
        return {
          kicker: t('Festival'),
          title: f.name,
          subtitle: whereWhen(f),
          art: f.posterImageUrl ? <Image source={{ uri: f.posterImageUrl }} style={styles.art} contentFit="cover" accessibilityIgnoresInvertColors /> : <Glow letter={f.name} />,
        };
      }
      case 'artist': {
        const a = artist(share.id);
        if (!a) return undefined;
        return { kicker: t('Artist'), title: a.name, subtitle: topSounds(a) || undefined, art: <ArtistAvatar artist={a} size={56} /> };
      }
      case 'clip': {
        const c = clip(share.id);
        const a = c && artist(c.artistId);
        if (!c || !a) return undefined;
        const f = festival(c.festivalId);
        return {
          kicker: t('Live set'),
          title: a.name,
          subtitle: f ? `${c.title} · ${f.name}` : c.title,
          art:
            c.source?.provider === 'youtube' ? (
              <Image source={{ uri: posterUrl(c.source) }} style={styles.art} contentFit="cover" accessibilityIgnoresInvertColors />
            ) : (
              <ArtistAvatar artist={a} size={56} />
            ),
        };
      }
      case 'profile':
        if (!profile) return profile === undefined ? { kicker: t('Profile'), title: `@${share.handle}`, art: <PersonAvatar size={56} /> } : undefined;
        return { kicker: t('Profile'), title: profile.displayName, subtitle: `@${profile.handle}`, art: <PersonAvatar name={profile.displayName} url={profile.avatarUrl} size={56} uid={profile.uid} /> };
    }
  })();

  if (!shown)
    return (
      <View style={[styles.card, styles.gone]} accessible accessibilityLabel={t('This isn’t on Afterglow any more')}>
        <Text style={styles.subtitle}>{t('This isn’t on Afterglow any more')}</Text>
      </View>
    );

  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push(shareRoute(share));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${shown.kicker}: ${shown.title}${shown.subtitle ? `, ${shown.subtitle}` : ''}. ${t('Open')}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={styles.artSlot}>{shown.art}</View>
        <View style={styles.words}>
          <Text style={styles.kicker}>{shown.kicker}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {shown.title}
          </Text>
          {shown.subtitle && !shown.faces ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {shown.subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {shown.faces ? (
        <View style={styles.facesBlock}>
          <View style={styles.faces}>
            {shown.faces.map((a, i) => (
              <View key={a.id} style={[styles.face, i > 0 && styles.overlap, { zIndex: shown.faces!.length - i }]}>
                <ArtistAvatar artist={a} size={34} />
              </View>
            ))}
          </View>
          <Text style={styles.subtitle} numberOfLines={2}>
            {shown.subtitle}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** "Dubstep · Riddim": an artist's two strongest sounds. */
const topSounds = (a: Artist) =>
  (Object.entries(a.sound) as [SoundTag, number][])
    .sort((x, y) => y[1] - x[1])
    .slice(0, 2)
    .map(([tag]) => SOUND_LABEL[tag])
    .join(' · ');

/** A festival without a picture: its first letter in the night glow. */
function Glow({ letter }: { letter: string }) {
  return (
    <LinearGradient colors={[color.glowDeep, color.haze, color.dusk]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.art, styles.center]}>
      <Text style={styles.letter}>{letter.trim().charAt(0).toUpperCase()}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    padding: space.sm,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: color.nightRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  gone: { paddingVertical: space.md, alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  artSlot: { width: 56, height: 56, borderRadius: radius.sm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  art: { width: 56, height: 56, borderRadius: radius.sm },
  center: { alignItems: 'center', justifyContent: 'center' },
  letter: { ...type.title, color: color.moon },
  words: { flex: 1 },
  kicker: { ...type.caption, color: color.glow, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 },
  title: { ...type.headline, color: color.moon },
  subtitle: { ...type.caption, color: color.moonDim, marginTop: 2 },
  facesBlock: { gap: space.xs, paddingHorizontal: 2 },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 20, borderWidth: 2, borderColor: color.nightRaised },
  overlap: { marginLeft: -10 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
