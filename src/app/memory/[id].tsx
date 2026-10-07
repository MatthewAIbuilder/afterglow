import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSocial } from '../../state/social';
import { OrgWatermark } from '../../features/organizers/OrgWatermark';
import { EdgeGlow } from '../../components/EdgeGlow';
import { showsGlow } from '../../features/standing/standing';
import { useStanding } from '../../features/standing/useStanding';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { CloseIcon } from '../../components/TabIcons';
import { momentLine } from '../../features/memories/organize';
import { ShareToProfile } from '../../features/social/ShareToProfile';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useMemories } from '../../state/memories';
import { color, radius, space, type, glowA } from '../../theme/tokens';
import { whereLine } from '../../features/memories/where';
import { b2bLine } from '../../features/memories/b2b';
import { useClipLoop } from '../../features/memories/useClipLoop';
import { fitFor } from '../../features/memories/videoFit';
import { useVideoSize } from '../../features/memories/useVideoSize';
import { showAlert } from '../../lib/dialog';
import { goBack } from '../../lib/nav';
import { SheetClose } from '../../components/SheetClose';
import { pagerIds, VerticalPager } from '../../components/VerticalPager';
import { t, tc } from '../../i18n';

/**
 * One memory, full screen, with sound. Tap to pause. Below it: who, where
 * and when, then Tag, Save to Photos, Send, Share to your profile and Delete.
 */
export default function MemoryScreen() {
  // `ids`: the videos to swipe through (your moments, in the order shown), this one among them.
  const { id, ids } = useLocalSearchParams<{ id: string; ids?: string }>();
  const list = pagerIds(ids, id);
  if (list.length < 2) return <MemoryPage id={id} active />;
  return <VerticalPager ids={list} start={id} renderPage={(page, active) => <MemoryPage id={page} active={active} />} />;
}

function MemoryPage({ id, active }: { id: string; active: boolean }) {
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const mem = useMemories();
  const m = mem.memories.find((x) => x.id === id);
  const uri = m ? mem.uriOf(m.file) : null;
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  useClipLoop(player, m?.clip);
  // Its real shape: fills the screen only when that crops very little, else shows whole.
  const videoSize = useVideoSize(player, uri ?? undefined, m);
  const [paused, setPaused] = useState(false);
  // Only the video in view plays (swiping through your moments), unless you paused it.
  useEffect(() => {
    if (active && !paused) player.play();
    else player.pause();
  }, [active, paused, player]);
  const screen = useWindowDimensions();
  const social = useSocial();
  const mine = useStanding(social.user?.uid);
  // Still uploading to Discover: deleting now would leave the shared copy with nothing on this phone to remove it from.
  const uploading = !!m && m.id in social.sharing;

  // Deleted (here or elsewhere): step back.
  useEffect(() => {
    if (!m && router.canGoBack()) goBack();
  }, [m]);
  // A memory that isn't on this phone (removed, or a link from elsewhere): a way out.
  if (!m)
    return (
      <View style={styles.root}>
        <SheetClose fullScreen />
      </View>
    );

  const artist = m.artistId ? catalog.artist(m.artistId) : undefined;
  const festival = m.festivalId ? catalog.festival(m.festivalId) : undefined;
  const where = whereLine(m, festival?.name);
  const when = momentLine(new Date(m.capturedAt), m.place);

  const toggle = () => {
    haptic.select();
    if (paused) player.play();
    else player.pause();
    setPaused(!paused);
  };

  const saveToPhotos = async () => {
    haptic.tap();
    const ok = await mem.saveToPhotos(m.id);
    if (ok) haptic.settle();
    else showAlert(t('Couldn’t save to Photos'), t('Allow Afterglow to add to Photos in Settings, then try again.'));
  };
  const send = async () => {
    haptic.select();
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(mem.uriOf(m.file), { dialogTitle: artist?.name ?? t('Memory') }).catch(() => {});
  };
  const remove = () => {
    if (uploading) return;
    haptic.select();
    showAlert(
      t('Delete this memory?'),
      m.sharedId ? t('It’s removed from this phone. It stays on your profile until you remove it there.') : t('It’s removed from this phone. If it isn’t in Photos, it’s gone for good.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Delete'), style: 'destructive', onPress: () => void mem.remove(m.id) },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={toggle} accessibilityRole="button" accessibilityLabel={paused ? tc('video', 'Play') : t('Pause')}>
        <VideoView player={player} style={styles.video} contentFit={fitFor(videoSize, screen)} nativeControls={false} playsInline />
      </Pressable>
      {/* How it looks once shared: the edge glow (unless you have Afterglow Plus). */}
      {showsGlow(mine) ? <EdgeGlow width={screen.width} height={screen.height} radius={44} inset={4} label active={!paused} /> : null}
      {/* An event organizer's account: its logo, faintly, as on what it shares. */}
      <OrgWatermark uid={social.user?.uid} style={{ top: insets.top + 64, right: space.lg }} />
      <LinearGradient colors={['rgba(3,2,10,0)', 'rgba(3,2,10,0.85)']} style={styles.scrim} pointerEvents="none" />

      <View style={[styles.close, { top: insets.top + space.sm }]}>
        <GlassCircleButton label={t('Close')} onPress={() => goBack()}>
          <CloseIcon color={color.moon} size={16} />
        </GlassCircleButton>
      </View>

      <View style={[styles.info, { paddingBottom: insets.bottom + space.lg }]} pointerEvents="box-none">
        <Pressable
          disabled={!artist}
          onPress={() => artist && router.push({ pathname: '/artist/[id]', params: { id: artist.id, festival: festival?.id } })}
          accessibilityRole={artist ? 'button' : 'text'}
        >
          <Text style={styles.artist}>{artist ? b2bLine([artist.name, ...(m.withArtistIds ?? []).map((id) => catalog.artist(id)?.name ?? '')]) : t('Who’s playing?')}</Text>
        </Pressable>
        {where ? <Text style={styles.where}>{where}</Text> : null}
        {when ? <Text style={styles.when}>{when}</Text> : null}
        <View style={styles.actions}>
          <Action label={artist ? t('Tag') : t('Tag it')} onPress={() => router.push({ pathname: '/memory-tag', params: { id: m.id } })} />
          <Action label={t('Save to Photos')} onPress={() => void saveToPhotos()} />
          <Action label={t('Send')} onPress={() => void send()} />
          <ShareToProfile memory={m} render={(label, onPress) => <Action label={label} onPress={onPress} glow />} />
          <Action label={t('Delete')} onPress={remove} quiet disabled={uploading} />
        </View>
      </View>
    </View>
  );
}

function Action({ label, onPress, quiet, glow, disabled }: { label: string; onPress: () => void; quiet?: boolean; glow?: boolean; disabled?: boolean }): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.action, glow && styles.actionGlow, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={[styles.actionText, quiet && styles.quiet]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // A video tag doesn't stretch to fill on the website without a size of its own.
  video: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  root: { flex: 1, backgroundColor: '#000' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' },
  close: { position: 'absolute', left: space.lg },
  info: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, gap: 2 },
  artist: { ...type.largeTitle, color: color.moon },
  where: { ...type.headline, color: color.moonDim },
  when: { ...type.caption, color: color.moonFaint, fontVariant: ['tabular-nums'], marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  action: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  actionGlow: { backgroundColor: glowA(0.22), borderColor: glowA(0.5) },
  actionText: { ...type.label, color: color.moon },
  quiet: { color: color.moonDim },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
});
