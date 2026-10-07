import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { PageTitle } from '../components/PageTitle';
import { CloseIcon } from '../components/TabIcons';
import { CameraIcon, FlipIcon, PhotosIcon, TorchIcon } from '../features/camera/icons';
import { elapsedLabel, filmingAt, IDLE, MIN_RECORD_MS, RECORD_MAX_SEC, recordButton, type RecordState } from '../features/camera/record';
import { RecordButton } from '../features/camera/RecordButton';
import { recordedVideo } from '../features/memories/device';
import { useMemoryPicker } from '../features/memories/useAddMemory';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useGoing } from '../state/going';
import { useMemories } from '../state/memories';
import { useSocial } from '../state/social';
import { OrgWatermark } from '../features/organizers/OrgWatermark';
import { color, radius, space, type, glowA, raisedA } from '../theme/tokens';
import { goBack } from '../lib/nav';
import { t } from '../i18n';
import { isShowEvent } from '../features/festivalMode/showEvent';
import { useTonight } from '../features/tonight/useTonight';

/**
 * The camera: film a moment at a festival. Reached by swiping right on
 * Discover (or its camera button, or "Record a video" anywhere). Tap the
 * button to start and again to stop, or hold it to film while held; then the
 * tagging sheet works out who was playing. Swipe left or tap close to go
 * back. Videos stay on the phone unless you share them.
 */
export default function CameraScreen() {
  if (Platform.OS === 'web') return <ChooseOnWeb />;
  return <Camera />;
}

function Camera() {
  const insets = useSafeAreaInsets();
  const { user } = useSocial();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const cam = useRef<CameraView>(null);
  const [camPerm, askCam] = useCameraPermissions();
  const [micPerm, askMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [rec, setRec] = useState<RecordState>(IDLE);
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState<string | undefined>();
  const recording = rec.phase === 'recording';
  const { setDraft, keepNow } = useMemories();
  // Keeping the clip you just filmed (reading where you are, copying the file): the button waits meanwhile.
  const [saving, setSaving] = useState(false);
  const pick = useMemoryPicker();

  // Where you are, when you're at a festival you're going to.
  const { festivals } = useCatalog();
  const { going } = useGoing();
  const [now] = useState(() => new Date());
  // Or the one-night show you're going to tonight.
  const tonight = useTonight();
  const at = filmingAt(festivals, going, now) ?? (tonight && isShowEvent(tonight.festival) ? tonight.festival.name : undefined);

  // The timer while recording.
  const startedAt = recording ? rec.startedAt : undefined;
  useEffect(() => {
    if (startedAt === undefined) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => clearInterval(timer);
  }, [startedAt]);

  // Closing (or leaving) mid-recording throws the clip away.
  const leaving = useRef(false);
  const finish = useCallback(
    async (uri: string | undefined, began: number) => {
      if (leaving.current) return;
      const length = Date.now() - began;
      setRec(IDLE);
      setElapsed(0);
      if (!uri) return;
      if (length < MIN_RECORD_MS) {
        setHint(t('Hold a little longer to film.'));
        return;
      }
      haptic.settle();
      setSaving(true);
      try {
        const video = await recordedVideo(uri, length / 1000);
        // Kept straight away, untagged, so closing the app never loses it; the tagging sheet then tags it.
        const kept = await keepNow(video);
        // Gone back meanwhile: it's in your Memories (with a Tag badge), but don't open anything over where you are now.
        if (leaving.current) return;
        if (kept) router.replace({ pathname: '/memory-tag', params: { id: kept.id, fresh: '1' } });
        else {
          // Couldn't copy it (a full phone): tag it from where the camera left it, as before.
          setDraft(video);
          router.replace('/memory-tag');
        }
      } finally {
        if (!leaving.current) setSaving(false);
      }
    },
    [setDraft, keepNow],
  );

  const start = useCallback(
    (began: number) => {
      const camera = cam.current;
      if (!camera) return;
      haptic.tap();
      setHint(undefined);
      setElapsed(0);
      camera
        .recordAsync({ maxDuration: RECORD_MAX_SEC })
        .then((r) => finish(r?.uri, began))
        .catch(() => {
          setRec(IDLE);
          setHint(t('Couldn’t record that one. Try again.'));
        });
    },
    [finish],
  );

  const press = (type: 'press-in' | 'press-out' | 'lock') => {
    if (!ready || saving) return;
    const r = recordButton(rec, { type, at: Date.now() });
    if (type === 'lock' && r.state !== rec) haptic.tap();
    setRec(r.state);
    if (r.action === 'start' && r.state.phase === 'recording') start(r.state.startedAt);
    if (r.action === 'stop') cam.current?.stopRecording();
  };

  useEffect(() => {
    const camera = cam;
    return () => {
      leaving.current = true;
      camera.current?.stopRecording();
    };
  }, []);

  // Leaving runs the cleanup above, which stops and throws away a recording in progress.
  const close = useCallback(() => goBack(), []);

  // Swipe left to go back to Discover, the way you came.
  const swipeBack = useMemo(
    () =>
      Gesture.Pan()
        // Never while filming: sliding left off the record button is a lock, not a way out.
        .enabled(!recording)
        .activeOffsetX(-24)
        .failOffsetY([-24, 24])
        .runOnJS(true)
        .onEnd((e) => {
          if (e.translationX < -width * 0.3 || e.velocityX < -700) close();
        }),
    [width, close, recording],
  );

  const allowed = !!camPerm?.granted;
  const askAll = async () => {
    haptic.select();
    const c = await askCam();
    if (c.granted && !micPerm?.granted) await askMic();
  };

  return (
    <GestureDetector gesture={swipeBack}>
      <View style={styles.root}>
        <PageTitle title={t('Camera')} />
        <StatusBar style="light" />
        {allowed ? (
          <CameraView
            ref={cam}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="video"
            mute={!micPerm?.granted}
            enableTorch={torch && facing === 'back'}
            onCameraReady={() => setReady(true)}
            onMountError={() => setHint(t('The camera couldn’t start. Close and try again.'))}
          />
        ) : null}

        {/* An event organizer's account sees where its logo will sit on what it films. */}
        {allowed ? <OrgWatermark uid={user?.uid} style={{ top: insets.top + 72, right: space.lg }} /> : null}
        {/* Night fades at the top and bottom, so the controls read over any picture. */}
        <LinearGradient colors={['rgba(5,4,14,0.75)', 'rgba(5,4,14,0)']} style={[styles.fadeTop, { height: insets.top + 110 }]} pointerEvents="none" />
        <LinearGradient colors={['rgba(5,4,14,0)', 'rgba(5,4,14,0.85)']} style={[styles.fadeBottom, { height: insets.bottom + 220 }]} pointerEvents="none" />

        <View style={[styles.top, { top: insets.top + space.sm }]}>
          {allowed && facing === 'back' ? (
            <GlassCircleButton label={torch ? t('Turn the light off') : t('Turn the light on')} onPress={() => setTorch((on) => !on)}>
              <TorchIcon color={torch ? color.glow : color.moon} filled={torch} size={18} />
            </GlassCircleButton>
          ) : (
            <View style={styles.spacer} />
          )}
          <View style={styles.chip} accessibilityRole="text">
            {recording ? (
              <View style={styles.timerRow} accessibilityLiveRegion="polite" accessibilityLabel={t('Recording, {time}', { time: elapsedLabel(elapsed) })}>
                <View style={styles.recDot} />
                <Text style={styles.timer}>{elapsedLabel(elapsed)}</Text>
              </View>
            ) : (
              <Text style={styles.chipText} numberOfLines={1}>
                {at ? t('Filming at {festival}', { festival: at }) : t('New memory')}
              </Text>
            )}
          </View>
          <GlassCircleButton label={t('Close the camera')} onPress={close}>
            <CloseIcon color={color.moon} size={16} />
          </GlassCircleButton>
        </View>

        {!allowed && camPerm ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(260)} style={styles.permission}>
            <View style={styles.permIcon}>
              <CameraIcon color={color.moon} size={26} />
            </View>
            <Text style={styles.permTitle}>{t('Film your festival')}</Text>
            <Text style={styles.permBody}>
              {t('Record a moment and Afterglow works out who was playing. Your videos stay on your phone unless you share them.')}
            </Text>
            {camPerm.canAskAgain ? (
              <Pressable onPress={askAll} accessibilityRole="button" style={({ pressed }) => [styles.permButton, pressed && styles.pressed]}>
                <Text style={styles.permButtonText}>{t('Allow camera')}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void Linking.openSettings().catch(() => {})}
                accessibilityRole="button"
                accessibilityLabel={t('Camera access is off. Open Settings to allow it.')}
                style={({ pressed }) => [styles.permButton, pressed && styles.pressed]}
              >
                <Text style={styles.permButtonText}>{t('Open Settings')}</Text>
              </Pressable>
            )}
          </Animated.View>
        ) : null}

        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.xl }]}>
          {hint ? (
            <Animated.Text entering={reduceMotion ? undefined : FadeIn} exiting={reduceMotion ? undefined : FadeOut} style={styles.hint} accessibilityLiveRegion="polite">
              {hint}
            </Animated.Text>
          ) : (
            <Text style={styles.hint}>{saving ? t('Keeping your video…') : recording ? (rec.mode === 'pending' ? t('Filming while you hold · slide away to lock') : rec.mode === 'locked' ? t('Locked · tap to stop') : t('Tap to stop')) : allowed ? t('Tap to record · hold to film while you hold') : ' '}</Text>
          )}
          <View style={styles.controls}>
            <Pressable
              onPress={() => {
                haptic.select();
                void pick('library', { replace: true });
              }}
              disabled={recording || saving}
              accessibilityRole="button"
              accessibilityLabel={t('Choose a video from your library')}
              hitSlop={10}
              style={({ pressed }) => [styles.side, recording && styles.hidden, pressed && styles.pressed]}
            >
              <PhotosIcon color={color.moon} size={22} />
            </Pressable>
            <RecordButton
              recording={recording}
              holding={recording && rec.mode === 'pending'}
              locked={recording && rec.mode === 'locked'}
              disabled={!allowed || !ready || saving}
              onPressIn={() => press('press-in')}
              onPressOut={() => press('press-out')}
              onLock={() => press('lock')}
              label={recording ? t('Stop recording') : t('Record a video')}
            />
            <Pressable
              onPress={() => {
                haptic.select();
                setFacing((f) => (f === 'back' ? 'front' : 'back'));
              }}
              disabled={recording || !allowed}
              accessibilityRole="button"
              accessibilityLabel={facing === 'back' ? t('Switch to the front camera') : t('Switch to the back camera')}
              hitSlop={10}
              style={({ pressed }) => [styles.side, (recording || !allowed) && styles.hidden, pressed && styles.pressed]}
            >
              <FlipIcon color={color.moon} size={22} />
            </Pressable>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

/**
 * In a browser: filming with Afterglow's camera needs the app, but you can
 * post a video you already have (or take one with the phone's own camera).
 * The browser's chooser opens from the tap on Choose a video; then the same
 * tagging sheet as the app.
 */
function ChooseOnWeb() {
  const insets = useSafeAreaInsets();
  const pick = useMemoryPicker();
  return (
    <View style={[styles.root, styles.web, { paddingTop: insets.top + space.xxl }]}>
      <PageTitle title={t('Post a video')} />
      <View style={styles.permIcon}>
        <CameraIcon color={color.moon} size={26} />
      </View>
      <Text style={styles.permTitle}>{t('Post a festival moment')}</Text>
      <Text style={styles.permBody}>
        {t('Choose a video from your Photos or Files, or take one, up to ten minutes long. Trim it to the best part, tag who was playing and share it to Discover.')}
      </Text>
      <Pressable
        onPress={() => {
          haptic.tap();
          void pick('library', { replace: true });
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.permButton, pressed && styles.pressed]}
      >
        <Text style={styles.permButtonText}>{t('Choose a video')}</Text>
      </Pressable>
      <Pressable onPress={() => goBack()} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.webBack, pressed && styles.pressed]}>
        <Text style={styles.webBackText}>{t('Not now')}</Text>
      </Pressable>
      <Text style={styles.webNote}>{t('Filming with Afterglow’s own camera is in the app.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05040E' },
  web: { alignItems: 'center', paddingHorizontal: space.xl },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  fadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  top: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  spacer: { width: 40 },
  chip: {
    flexShrink: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: raisedA(0.45),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  chipText: { ...type.label, color: color.moon },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.glow, shadowColor: color.glow, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  timer: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  permission: { position: 'absolute', left: space.xl, right: space.xl, top: '28%', alignItems: 'center' },
  permIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glowA(0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.45),
  },
  permTitle: { ...type.title, color: color.moon, marginTop: space.lg, textAlign: 'center' },
  permBody: { ...type.body, color: color.moonDim, marginTop: space.sm, textAlign: 'center', maxWidth: 320 },
  permButton: { marginTop: space.xl, paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  permButtonText: { ...type.headline, color: color.moon },
  webBack: { marginTop: space.lg, paddingVertical: space.sm, paddingHorizontal: space.lg },
  webBackText: { ...type.label, color: color.moonDim },
  webNote: { ...type.caption, color: color.moonFaint, marginTop: space.xl, textAlign: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  hint: { ...type.caption, color: color.moonDim, marginBottom: space.lg, textAlign: 'center', paddingHorizontal: space.xl },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: space.xxl },
  side: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: raisedA(0.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  hidden: { opacity: 0 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.95 }] },
});
