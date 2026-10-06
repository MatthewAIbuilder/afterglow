import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { NightSky } from '../../components/NightSky';
import { ChevronIcon } from '../../components/TabIcons';
import type { Profile } from '../../features/social/models';
import { PersonRow } from '../../features/social/PersonRow';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../../features/social/service';
import { useSocial } from '../../state/social';
import { color, space, type } from '../../theme/tokens';
import { goBack } from '../../lib/nav';
import { t } from '../../i18n';

/** Lists show the newest this many. */
const LIST_MAX = 100;

/** Who liked a video you shared, newest first, with Follow beside each. People you blocked don't show. */
export default function LikesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const [answer, setAnswer] = useState<{ people?: Profile[]; problem?: string }>();

  useEffect(() => {
    if (!social.user) return;
    let live = true;
    (async () => {
      try {
        const uids = await social.service.likedBy(id, LIST_MAX);
        const people = (await Promise.all(uids.map((u) => social.service.profileOf(u).catch(() => null)))).filter((p): p is Profile => !!p);
        if (live) setAnswer({ people });
      } catch (e) {
        if (live) setAnswer({ problem: SOCIAL_ERROR_COPY[socialErrorKind(e)] });
      }
    })();
    return () => {
      live = false;
    };
  }, [id, social.user, social.service]);

  const shown = (answer?.people ?? []).filter((p) => !social.blocked.has(p.uid));

  return (
    <View style={styles.root}>
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl, gap: space.md }}>
        <Text style={styles.title} accessibilityRole="header">
          {t('Liked by')}
        </Text>
        <View style={styles.list}>
          {!social.user ? (
            <Text style={styles.quiet}>{t('Sign in to see who liked it.')}</Text>
          ) : answer?.problem ? (
            <Text style={styles.quiet}>{answer.problem}</Text>
          ) : !answer ? (
            <ActivityIndicator color={color.glow} />
          ) : shown.length ? (
            shown.map((p) => <PersonRow key={p.uid} profile={p} follow />)
          ) : (
            <Text style={styles.quiet}>{t('No likes yet.')}</Text>
          )}
        </View>
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label={t('Back')} onPress={() => goBack()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  back: { position: 'absolute', left: space.lg },
  title: { ...type.largeTitle, color: color.moon },
  list: { gap: space.xs },
  quiet: { ...type.body, color: color.moonDim },
});
