import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { PageTitle } from '../../components/PageTitle';
import { CloseIcon } from '../../components/TabIcons';
import { WEB_URL } from '../../config/app';
import { BADGE_CARD_WIDTH, BadgeCard } from '../../features/badges/BadgeCard';
import { badgeShareText } from '../../features/badges/badges';
import { useBadges } from '../../features/badges/useBadges';
import { sharePoster } from '../../features/plan/PosterCard';
import type { Profile } from '../../features/social/models';
import { useStanding } from '../../features/standing/useStanding';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { goBack } from '../../lib/nav';
import { t } from '../../i18n';

/**
 * Share a badge: the badge as a story-shaped picture (on phones) or as words
 * with a link to the profile. Opened from the badge's page.
 */
export default function BadgeCardScreen() {
  const { id, uid: whose } = useLocalSearchParams<{ id: string; uid?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const catalog = useCatalog();
  const social = useSocial();
  const uid = whose ?? social.user?.uid;
  const mine = !!uid && uid === social.user?.uid;
  const festival = catalog.festival(id);
  const { badges } = useBadges(uid);
  const badge = badges.find((b) => b.festivalId === id);
  const standing = useStanding(uid);
  const [person, setPerson] = useState<Profile | null | undefined>(mine ? social.profile : undefined);
  useEffect(() => {
    if (mine || !uid || !social.availability.ok) return;
    social.service
      .profileOf(uid)
      .then(setPerson)
      .catch(() => setPerson(null));
  }, [mine, uid, social.service, social.availability.ok]);
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  if (!festival) return null;
  const who = mine ? social.profile : person;
  const link = who ? `${WEB_URL}/u/${who.handle}` : `${WEB_URL}/festival/${festival.id}`;
  const cardWidth = Math.min(BADGE_CARD_WIDTH, width - space.xl * 2);
  const close = () => (router.canGoBack() ? goBack() : router.replace('/profile'));

  return (
    <View style={styles.root}>
      <PageTitle title={t('Share the {festival} badge', { festival: festival.name })} />
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.title}>{t('Share your badge')}</Text>
        <GlassCircleButton onPress={close} label={t('Close')}>
          <CloseIcon color={color.moon} size={18} />
        </GlassCircleButton>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
        <View ref={ref} collapsable={false}>
          <BadgeCard
            festival={festival}
            badge={badge}
            width={cardWidth}
            person={who ? { name: who.displayName, handle: who.handle, avatarUrl: who.avatarUrl, standing } : undefined}
          />
        </View>
        <View style={styles.buttons}>
          <Pressable
            onPress={async () => {
              haptic.select();
              setBusy(true);
              await sharePoster(ref, t('{festival} badge', { festival: festival.name }), badgeShareText(festival.name, link, mine, who?.handle));
              setBusy(false);
            }}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{busy ? t('Getting it ready…') : t('Share image')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.select();
              void shareMessage(badgeShareText(festival.name, link, mine, who?.handle), t('{festival} badge', { festival: festival.name }));
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{t('Share as text')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.md },
  title: { ...type.title, color: color.moon },
  content: { alignItems: 'center', gap: space.xl, paddingTop: space.sm },
  buttons: { alignSelf: 'stretch', paddingHorizontal: space.xl, gap: space.sm },
  primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glow },
  primaryText: { ...type.headline, color: color.night },
  secondary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  secondaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
