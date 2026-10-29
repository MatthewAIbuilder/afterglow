import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArtistRow } from '../../components/ArtistRow';
import { NightSky } from '../../components/NightSky';
import { PageActions } from '../../components/PageActions';
import { PageTitle } from '../../components/PageTitle';
import { ChevronIcon } from '../../components/TabIcons';
import { SOUND_LABEL, SOUND_TAGS, type SoundTag } from '../../data/models';
import { soundFocus, soundChoices } from '../../features/discover/focus';
import { datesLine } from '../../features/festivals/format';
import { SOUND_COLOR, withAlpha } from '../../features/sound-map/colors';
import { artistsIn, festivalsWith, SOUND_GUIDE } from '../../features/sound-map/guide';
import { mapCandidates } from '../../features/sound-map/layout';
import { tasteMix } from '../../features/taste/lean';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { goBack } from '../../lib/nav';
import { useCatalog } from '../../state/catalog';
import { useRatings } from '../../state/ratings';
import { useTaste } from '../../state/taste';
import { color, radius, space, type } from '../../theme/tokens';
import { PageFeedback } from '../../components/PageFeedback';

const isTag = (x: unknown): x is SoundTag => typeof x === 'string' && (SOUND_TAGS as readonly string[]).includes(x);

/**
 * One sound, all of it (My Sound's grid opens it): what it feels like, what to listen for, how it differs from
 * its neighbours (each a tap away), how much of your sound it is, your best matches in it, the festivals with
 * the most of it, and ways to watch it in Discover or see it on your map.
 */
export default function SoundGuideScreen() {
  const { tag: raw } = useLocalSearchParams<{ tag?: string }>();
  const tag = isTag(raw) ? raw : undefined;
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const { taste, informed } = useTaste();
  const { ratings } = useRatings();
  const mix = useMemo(() => tasteMix(mapCandidates(catalog.artists, undefined), taste, informed), [catalog.artists, taste, informed]);
  const share = tag ? mix.find((s) => s.tag === tag) : undefined;
  const best = useMemo(() => (tag ? artistsIn(tag, catalog.artists, taste, 8) : []), [tag, catalog.artists, taste]);
  const fests = useMemo(() => (tag ? festivalsWith(tag, catalog.festivals, (id) => catalog.artist(id)) : []), [tag, catalog]);
  const watchable = useMemo(() => !!tag && soundChoices(catalog.clips, catalog.artist).some((c) => c.tag === tag), [tag, catalog]);

  if (!tag) {
    return (
      <View style={styles.root}>
        <NightSky />
        <PageActions />
        <Text style={[styles.gone, { paddingTop: insets.top + 80 }]}>{t('That sound isn’t here.')}</Text>
      </View>
    );
  }
  const g = SOUND_GUIDE[tag];
  const tone = SOUND_COLOR[tag];
  const label = SOUND_LABEL[tag];
  return (
    <View style={styles.root}>
      <PageTitle title={label} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: tone, shadowColor: tone }]} />
          <Text style={[styles.title, { color: tone }]} accessibilityRole="header">
            {label}
          </Text>
        </View>
        <Text style={styles.share}>{share ? t('{pct}% of your sound', { pct: share.percent }) : t('Not part of your sound yet')}</Text>
        <Text style={styles.feel}>{g.feel}</Text>

        <Text style={styles.h}>{t('Listen for')}</Text>
        <View style={[styles.box, { borderColor: withAlpha(tone, 0.3), backgroundColor: withAlpha(tone, 0.06) }]}>
          {g.listenFor.map((l) => (
            <View key={l} style={styles.bulletRow}>
              <View style={[styles.bullet, { backgroundColor: tone }]} />
              <Text style={styles.bulletText}>{l}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h}>{t('How it differs')}</Text>
        <Text style={styles.vs}>{g.vs}</Text>
        <View style={styles.chips}>
          {g.near.map((n) => (
            <Pressable
              key={n}
              onPress={() => {
                haptic.select();
                router.replace({ pathname: '/sound-guide/[tag]', params: { tag: n } });
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Close to {sound}. Open it.', { sound: SOUND_LABEL[n] })}
              style={({ pressed }) => [styles.chip, { borderColor: withAlpha(SOUND_COLOR[n], 0.5) }, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.chipDot, { backgroundColor: SOUND_COLOR[n] }]} />
              <Text style={styles.chipText}>{SOUND_LABEL[n]}</Text>
            </Pressable>
          ))}
        </View>

        {best.length ? (
          <>
            <Text style={styles.h}>{t('Your best matches')}</Text>
            <View style={styles.rows}>
              {best.map((a) => (
                <ArtistRow key={a.id} artist={a} affinity={taste[a.id] ?? 0} rating={ratings[a.id]} />
              ))}
            </View>
          </>
        ) : null}

        {fests.length ? (
          <>
            <Text style={styles.h}>{t('Festivals with the most {sound}', { sound: label.toLowerCase() })}</Text>
            <View style={styles.rows}>
              {fests.map(({ festival, count }) => (
                <Pressable
                  key={festival.id}
                  onPress={() => {
                    haptic.select();
                    router.push({ pathname: '/festival/[id]', params: { id: festival.id } });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${festival.name}, ${datesLine(festival)}`}
                  style={({ pressed }) => [styles.fest, pressed && { opacity: 0.8 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.festName} numberOfLines={1}>
                      {festival.name}
                    </Text>
                    <Text style={styles.festSub}>{`${datesLine(festival)} · ${t('{n} {sound} acts', { n: count, sound: label.toLowerCase() })}`}</Text>
                  </View>
                  <ChevronIcon color={color.moonFaint} size={11} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.actions}>
          {watchable ? (
            <Pressable
              onPress={() => {
                haptic.tap();
                router.navigate({ pathname: '/', params: { festival: soundFocus(tag) } });
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Watch {sound} live sets in Discover', { sound: label.toLowerCase() })}
              style={({ pressed }) => [styles.primary, { backgroundColor: tone }, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.primaryText}>{t('Watch live sets')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              haptic.select();
              router.navigate({ pathname: '/sound', params: { view: 'map' } });
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.secondaryText}>{t('Open your bubble map')}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => goBack()} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center', marginTop: space.lg }}>
          <Text style={styles.back}>{t('Back to My Sound')}</Text>
        </Pressable>
        <PageFeedback />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640, gap: space.sm },
  gone: { ...type.body, color: color.moonDim, textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 16, height: 16, borderRadius: 8, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  title: { ...type.largeTitle },
  share: { ...type.label, color: color.moonDim },
  feel: { ...type.body, fontSize: 17, lineHeight: 24, color: color.moon, marginTop: space.sm },
  h: { ...type.caption, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: space.xl },
  box: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bullet: { width: 6, height: 6, borderRadius: 3 },
  bulletText: { ...type.body, color: color.moon, flex: 1 },
  vs: { ...type.body, color: color.moonDim, fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, backgroundColor: color.glass },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { ...type.label, color: color.moon },
  rows: { gap: space.sm },
  fest: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  festName: { ...type.headline, fontSize: 16, color: color.moon },
  festSub: { ...type.caption, color: color.moonDim, marginTop: 2 },
  actions: { gap: space.sm, marginTop: space.xl },
  primary: { minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...type.headline, color: color.night },
  secondary: { minHeight: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  back: { ...type.label, color: color.moonDim },
});
