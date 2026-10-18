import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { PhotoCropper, type CropSource } from '../profile/PhotoCropper';
import { pickToCrop } from '../profile/pickToCrop';
import type { Crew, CrewCover } from '../social/models';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../social/service';
import { t } from '../../i18n';

/**
 * The crew's group photo: a wide picture across the top of the crew page (the
 * whole crew, in real life). Any member can add or change it; whoever put it
 * there, or the crew's owner, can take it down. Without one it's a quiet
 * "Add a crew photo" row.
 */
export function CrewCoverPhoto({ crew }: { crew: Crew }) {
  const social = useSocial();
  const me = social.user?.uid;
  const [cover, setCover] = useState<CrewCover | null>(null);
  const [cropping, setCropping] = useState<CropSource>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    let live = true;
    void social.service
      .crewCover(crew.id)
      .then((c) => live && setCover(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [social.service, crew.id, me]);

  if (!me || !crew.members.includes(me)) return null;

  const save = async (uri: string | null) => {
    setBusy(true);
    try {
      setCover(await social.service.setCrewCover(crew.id, uri));
      haptic.settle();
    } catch (e) {
      showAlert(t('Couldn’t update the crew photo'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setBusy(false);
    }
  };
  const pick = async () => {
    const picked = await pickToCrop();
    if (picked) setCropping(picked);
  };
  const open = () => {
    haptic.select();
    const canRemove = !!cover && (cover.by === me || crew.owner === me);
    showAlert(t('Crew photo'), t('A group picture of the crew, in real life. Everyone in the crew can see it.'), [
      { text: cover ? t('Choose a new photo') : t('Choose a photo'), onPress: () => void pick() },
      ...(canRemove ? [{ text: t('Remove photo'), style: 'destructive' as const, onPress: () => void save(null) }] : []),
      { text: t('Cancel'), style: 'cancel' },
    ]);
  };

  return (
    <>
      {cover ? (
        <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={t('Change the crew photo')} style={styles.photo}>
          <Image source={{ uri: cover.url }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={t('{crew} crew photo', { crew: crew.name })} />
          <View style={styles.badge}>
            {busy ? <ActivityIndicator size="small" color={color.moon} /> : <Text style={styles.badgeText}>{t('Change photo')}</Text>}
          </View>
        </Pressable>
      ) : (
        <Pressable onPress={open} disabled={busy} accessibilityRole="button" accessibilityLabel={t('Add a crew photo')} style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
          {busy ? <ActivityIndicator size="small" color={color.glow} /> : <Text style={styles.addText}>{t('Add a crew photo')}</Text>}
          <Text style={styles.addHint}>{t('A group picture of you all, in real life')}</Text>
        </Pressable>
      )}
      <PhotoCropper
        source={cropping}
        shape="cover"
        onDone={(uri) => {
          setCropping(undefined);
          void save(uri);
        }}
        onCancel={() => setCropping(undefined)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  photo: { height: 168, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, justifyContent: 'flex-end', alignItems: 'flex-end', padding: space.md },
  badge: { minHeight: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: 'rgba(8,6,20,0.62)', alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...type.caption, color: color.moon },
  add: { gap: 2, alignItems: 'center', paddingVertical: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderColor: color.hairline, backgroundColor: color.glass },
  addText: { ...type.label, color: color.glow },
  addHint: { ...type.caption, color: color.moonDim },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
