import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useSocial } from '../../state/social';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';
import type { Profile, VideoTag } from './models';
import { SOCIAL_ERROR_COPY, socialErrorKind } from './service';

/**
 * Who's tagged in a shared video, on its page: "With @sam and @alex". A tag
 * shows on that person's profile straight away; tagged yourself, you can
 * hide it (the tag goes). A tag from before that (not answered) still asks.
 */
export function VideoTags({ memoryId, owner, ownerHandle, refresh }: { memoryId: string; owner: string; ownerHandle: string; refresh: number }) {
  const social = useSocial();
  const me = social.user?.uid;
  const [tags, setTags] = useState<VideoTag[]>([]);
  const [people, setPeople] = useState<Record<string, Profile>>({});
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!me) return;
    let live = true;
    void social.service
      .videoTags(memoryId)
      .then(async (list) => {
        if (!live) return;
        setTags(list);
        const ps = await Promise.all(list.map((x) => social.service.profileOf(x.uid).catch(() => null)));
        if (!live) return;
        setPeople(Object.fromEntries(ps.filter((p): p is Profile => !!p).map((p) => [p.uid, p])));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [memoryId, me, social.service, refresh, reload]);

  const shown = tags.filter((x) => x.status === 'approved' || owner === me).filter((x) => !social.blocked.has(x.uid) && people[x.uid]);
  const mineTag = tags.find((x) => x.uid === me);

  const answer = async (yes: boolean) => {
    haptic.select();
    try {
      await social.service.answerVideoTag(memoryId, yes);
      setReload((n) => n + 1);
    } catch (e) {
      showAlert(t('Couldn’t save that'), SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    }
  };

  return (
    <View style={styles.root}>
      {shown.length ? (
        <View style={styles.with}>
          <Text style={styles.withText}>{t('With')}</Text>
          {shown.map((x) => (
            <Pressable
              key={x.id}
              onPress={() => router.push({ pathname: '/u/[handle]', params: { handle: people[x.uid].handle } })}
              accessibilityRole="button"
              accessibilityLabel={x.status === 'pending' ? t('@{handle}, hasn’t said yes yet', { handle: people[x.uid].handle }) : `@${people[x.uid].handle}`}
              hitSlop={6}
            >
              <Text style={[styles.handle, x.status === 'pending' && styles.waiting]}>
                @{people[x.uid].handle}
                {x.status === 'pending' ? ` ${t('(asked)')}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {mineTag?.status === 'pending' ? (
        <View style={styles.card} testID="tag-ask">
          <Text style={styles.cardTitle}>{t('@{handle} tagged you in this', { handle: ownerHandle })}</Text>
          <Text style={styles.cardBody}>{t('Show it on your profile, under Tagged?')}</Text>
          <View style={styles.buttons}>
            <Pressable onPress={() => void answer(false)} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && { opacity: 0.75 }]}>
              <Text style={styles.buttonText}>{t('No thanks')}</Text>
            </Pressable>
            <Pressable onPress={() => void answer(true)} accessibilityRole="button" style={({ pressed }) => [styles.button, styles.yes, pressed && { opacity: 0.75 }]}>
              <Text style={[styles.buttonText, styles.yesText]}>{t('Yes, show it')}</Text>
            </Pressable>
          </View>
        </View>
      ) : mineTag?.status === 'approved' ? (
        <Pressable onPress={() => void answer(false)} accessibilityRole="button" accessibilityLabel={t('You’re tagged, and it’s on your profile. Hide it from your profile')} hitSlop={6}>
          <Text style={styles.untag}>{t('On your profile under Tagged · Hide it')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm, marginTop: space.xs },
  with: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  withText: { ...type.caption, color: color.moonDim },
  handle: { ...type.caption, color: color.glow, fontWeight: '600' },
  waiting: { color: color.moonDim, fontWeight: '400' },
  card: { padding: space.md, borderRadius: radius.md, backgroundColor: glowA(0.14), borderWidth: 1, borderColor: glowA(0.45), gap: space.xs },
  cardTitle: { ...type.headline, color: color.moon },
  cardBody: { ...type.caption, color: color.moonDim },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  button: { paddingHorizontal: space.md + 2, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  yes: { backgroundColor: color.glow },
  buttonText: { ...type.label, color: color.moon },
  yesText: { color: color.night },
  untag: { ...type.caption, color: color.moonDim },
});
