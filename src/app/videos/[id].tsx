import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { Missing } from '../../components/Missing';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { ChevronIcon } from '../../components/TabIcons';
import { CrowdVideos } from '../../features/festivals/CrowdVideos';
import { eventPath, isShowEvent } from '../../features/festivalMode/showEvent';
import { useEventLookup } from '../../features/festivalMode/useEvent';
import { haptic } from '../../lib/haptics';
import { goBack } from '../../lib/nav';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { t } from '../../i18n';

/**
 * Every video people filmed at a festival or a one-night show, opened by
 * tapping where a crowd video was filmed in Discover: the place, when and
 * where it is, a way to its full page, and the videos night by night
 * (throwbacks from earlier years of the same festival too).
 */
export default function PlaceVideosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const event = useEventLookup()(id);
  if (!event) return <Missing title={t('Festival not found')} line={t('This festival isn’t on Afterglow any more, or the link isn’t quite right.')} />;
  const show = isShowEvent(event);
  const about = [event.dates, event.location].filter(Boolean).join(' · ');

  return (
    <View style={styles.root}>
      <PageTitle title={t('Videos from {place}', { place: event.name })} />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }}>
        <View style={styles.head}>
          <Text style={styles.kicker}>{t('VIDEOS FROM THE CROWD')}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {event.name}
          </Text>
          {about ? <Text style={styles.about}>{about}</Text> : null}
          <Pressable
            onPress={() => {
              haptic.select();
              router.push(eventPath(event));
            }}
            accessibilityRole="link"
            style={({ pressed }) => [styles.page, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.pageText}>{show ? t('Show page') : t('Festival page')}</Text>
            <ChevronIcon color={color.glow} direction="right" size={12} />
          </Pressable>
        </View>
        <CrowdVideos festival={event} />
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
  back: { position: 'absolute', left: space.lg, zIndex: 2 },
  head: { paddingHorizontal: space.xl, gap: space.xs },
  kicker: { ...type.label, color: color.glow, letterSpacing: 1.2 },
  title: { ...type.largeTitle, color: color.moon },
  about: { ...type.body, color: color.moonDim },
  page: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.45),
  },
  pageText: { ...type.label, color: color.moon },
});
