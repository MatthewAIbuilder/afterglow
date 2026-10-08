import { router } from 'expo-router';
import { createElement, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { NightSky } from '../components/NightSky';
import { PageTitle } from '../components/PageTitle';
import { ChevronIcon } from '../components/TabIcons';
import { clockOf } from '../features/memories/trim';
import { useVideoDrafts } from '../features/memories/useVideoDrafts';
import { draftVideo, removeDraft, saveVideoToPhone, type VideoDraft } from '../features/memories/webDrafts';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { goBack } from '../lib/nav';
import { useMemories } from '../state/memories';
import { color, radius, space, type } from '../theme/tokens';
import { t } from '../i18n';

/**
 * Drafts: videos filmed with the website's camera and not shared yet, kept in
 * this browser (`webDrafts`). Finish one (the tagging sheet, then Share), save
 * it to your phone, or delete it. In the app your recordings are in Memories.
 */
export default function DraftsScreen() {
  const insets = useSafeAreaInsets();
  const drafts = useVideoDrafts();
  const { setDraft } = useMemories();

  const finish = async (d: VideoDraft) => {
    haptic.select();
    const video = await draftVideo(d.id);
    if (!video) {
      showAlert(t('Couldn’t open that draft'), t('This browser may have cleared it.'));
      return;
    }
    setDraft(video);
    router.push(d.params ? { pathname: '/memory-tag', params: d.params } : '/memory-tag');
  };
  const save = async (d: VideoDraft) => {
    haptic.select();
    const video = await draftVideo(d.id);
    const r = video ? await saveVideoToPhone(video.uri, 'Afterglow.mp4') : 'failed';
    if (video) setTimeout(() => URL.revokeObjectURL(video.uri), 60_000);
    if (r === 'failed') showAlert(t('Couldn’t save it'), t('Try again, or share it to Discover to keep it.'));
  };
  const remove = (d: VideoDraft) =>
    showAlert(t('Delete this draft?'), t('It isn’t saved anywhere else unless you saved it to your phone.'), [
      { text: t('Keep it'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: () => void removeDraft(d.id) },
    ]);

  return (
    <View style={styles.root}>
      <PageTitle title={t('Drafts')} />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: space.xl, gap: space.md }}>
        <Text style={styles.title} accessibilityRole="header">
          {t('Drafts')}
        </Text>
        <Text style={styles.sub}>
          {Platform.OS === 'web'
            ? t('Videos you filmed here and haven’t shared yet. They’re kept in this browser, so finish them or save them to your phone.')
            : t('Videos you film are kept in Memories.')}
        </Text>
        {!drafts ? (
          <ActivityIndicator color={color.glow} />
        ) : !drafts.length ? (
          <Text style={styles.quiet}>{t('No drafts. Swipe right on Discover to film one.')}</Text>
        ) : (
          drafts.map((d) => (
            <View key={d.id} style={styles.row}>
              <DraftThumb draft={d} />
              <View style={styles.rowText}>
                <View style={styles.titleRow}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {new Date(d.at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  <Pressable onPress={() => remove(d)} accessibilityRole="button" accessibilityLabel={t('Delete this draft')} hitSlop={8} style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
                    <Text style={styles.deleteText}>{t('Delete')}</Text>
                  </Pressable>
                </View>
                <Text style={styles.rowSub}>{clockOf(d.durationSec)}</Text>
                <View style={styles.actions}>
                  <Pressable onPress={() => void finish(d)} accessibilityRole="button" accessibilityLabel={t('Finish and share this draft')} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                    <Text style={styles.primaryText}>{t('Finish')}</Text>
                  </Pressable>
                  <Pressable onPress={() => void save(d)} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                    <Text style={styles.secondaryText}>{t('Save to phone')}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <GlassCircleButton label={t('Back')} onPress={() => goBack()}>
          <ChevronIcon color={color.moon} direction="left" size={18} />
        </GlassCircleButton>
      </View>
    </View>
  );
}

/** A still of the draft: the browser draws its first frame (the link asks for a moment in, so Safari shows one). */
function DraftThumb({ draft }: { draft: VideoDraft }) {
  const uri = useDraftUri(draft.id);
  return (
    <View style={styles.thumb}>
      {uri && Platform.OS === 'web'
        ? createElement('video', {
            src: `${uri}#t=0.5`,
            muted: true,
            playsInline: true,
            preload: 'metadata',
            'aria-hidden': true,
            style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', backgroundColor: '#000' },
          })
        : null}
    </View>
  );
}

/** A link to a draft's video in this page, let go when the row goes. */
function useDraftUri(id: string): string | undefined {
  const [uri, setUri] = useState<string | undefined>();
  useEffect(() => {
    let live = true;
    let made: string | undefined;
    void draftVideo(id).then((v) => {
      made = v?.uri;
      if (live) setUri(made);
      else if (made) URL.revokeObjectURL(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return uri;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  back: { position: 'absolute', left: space.lg, zIndex: 2 },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim },
  quiet: { ...type.body, color: color.moonFaint, marginTop: space.md },
  row: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderTopColor: color.rim },
  thumb: { width: 72, height: 96, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000' },
  rowText: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  rowTitle: { ...type.headline, color: color.moon, flexShrink: 1 },
  rowSub: { ...type.caption, color: color.moonDim, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  primary: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  primaryText: { ...type.label, color: color.moon },
  secondary: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.label, color: color.moon },
  delete: { paddingVertical: 2 },
  deleteText: { ...type.label, color: color.moonFaint },
  pressed: { opacity: 0.7 },
});
