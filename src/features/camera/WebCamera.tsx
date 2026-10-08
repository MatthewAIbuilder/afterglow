import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../../components/GlassCircleButton';
import { GlassFill } from '../../components/LiquidGlass';
import { PageTitle } from '../../components/PageTitle';
import { CloseIcon } from '../../components/TabIcons';
import { t } from '../../i18n';
import { haptic } from '../../lib/haptics';
import { goBack } from '../../lib/nav';
import { useMemories } from '../../state/memories';
import { color, radius, space, type } from '../../theme/tokens';
import { useMemoryPicker } from '../memories/useAddMemory';
import { useVideoDrafts } from '../memories/useVideoDrafts';
import { saveDraft } from '../memories/webDrafts';
import { FlipIcon, PhotosIcon } from './icons';
import { elapsedLabel, IDLE, MIN_RECORD_MS, RECORD_MAX_SEC, recordButton, type RecordState } from './record';
import { RecordButton } from './RecordButton';
import { baseType, cameraAsk, cameraProblem, RECORD_BITS_PER_SEC, recordType, type CameraProblem } from './webRecorder';

type Props = {
  /** The chip at the top: where you're filming, or who. */
  chip: string;
  /** Who you're filming, passed on to the tagging sheet. */
  filming?: Record<string, string>;
  /** What shows when the browser can't film (no camera, no recorder, or no permission): choosing a video instead. */
  fallback: (problem: CameraProblem | 'no-recorder') => ReactNode;
};

/**
 * The camera on the website: the phone's camera through the browser, the
 * same controls as the app (tap to record and tap to stop, or hold to film
 * while held; flip; choose a video instead), recorded as an MP4 in the page.
 * When you stop, it goes to the tagging sheet like a video you chose; nothing
 * leaves the page until you share it to Discover. Swipe left or close to go
 * back. Browsers that can't record an MP4 (or a camera you didn't allow)
 * offer choosing a video instead.
 */
export function WebCamera({ chip, filming, fallback }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { setDraft } = useMemories();
  const pick = useMemoryPicker();
  const preview = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<CameraProblem | 'no-recorder' | undefined>(() =>
    typeof MediaRecorder === 'undefined' || !recordType((type) => MediaRecorder.isTypeSupported(type))
      ? 'no-recorder'
      : typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia
        ? 'unsupported'
        : undefined,
  );
  const [rec, setRec] = useState<RecordState>(IDLE);
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const recording = rec.phase === 'recording';
  const leaving = useRef(false);
  const drafts = useVideoDrafts();

  // The camera (and the microphone, when allowed), started again when you flip it.
  useEffect(() => {
    if (problem) return;
    let live = true;
    (async () => {
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia(cameraAsk(facing, true));
      } catch (e) {
        // No microphone (or not allowed): film without sound rather than not at all.
        try {
          if (cameraProblem(e) === 'denied') throw e;
          s = await navigator.mediaDevices.getUserMedia(cameraAsk(facing, false));
        } catch (e2) {
          if (live) setProblem(cameraProblem(e2));
          return;
        }
      }
      if (!live) {
        s.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = s;
      const v = preview.current;
      if (v) {
        v.srcObject = s;
        void v.play().catch(() => {});
      }
      setReady(true);
    })();
    return () => {
      live = false;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [facing, problem]);

  // The timer while recording, and its stop at the longest a clip can be.
  const startedAt = recording ? rec.startedAt : undefined;
  useEffect(() => {
    if (startedAt === undefined) return;
    const timer = setInterval(() => {
      const ms = Date.now() - startedAt;
      setElapsed(ms);
      if (ms >= RECORD_MAX_SEC * 1000 && recorder.current?.state === 'recording') recorder.current.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [startedAt]);

  // Leaving mid-recording throws the clip away.
  useEffect(
    () => () => {
      leaving.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
    },
    [],
  );

  const finish = useCallback(
    (blob: Blob, began: number) => {
      if (leaving.current) return;
      const length = Date.now() - began;
      setRec(IDLE);
      setElapsed(0);
      if (length < MIN_RECORD_MS || !blob.size) {
        setHint(t('Hold a little longer to film.'));
        return;
      }
      haptic.settle();
      setSaving(true);
      const v = preview.current;
      const durationSec = Math.max(1, Math.round(Math.min(length, RECORD_MAX_SEC * 1000) / 1000));
      const size = v?.videoWidth && v.videoHeight ? { width: v.videoWidth, height: v.videoHeight } : {};
      // Kept in this browser's drafts first, so going back or closing the page never loses it.
      void saveDraft(blob, { durationSec, ...size, at: began, ...(filming ? { params: filming } : {}) }).then((draftId) => {
        if (leaving.current) return;
        // A link to the recording in this page: the tagging sheet shows it, and sharing uploads it.
        setDraft({
          uri: URL.createObjectURL(blob),
          source: 'camera',
          durationSec,
          ...size,
          bytes: blob.size,
          moment: { when: new Date(began) },
          keptBySharing: true,
          ...(draftId ? { draftId } : {}),
        });
        router.replace(filming ? { pathname: '/memory-tag', params: filming } : '/memory-tag');
      });
    },
    [setDraft, filming],
  );

  const start = (began: number) => {
    const s = stream.current;
    const type = typeof MediaRecorder !== 'undefined' ? recordType((x) => MediaRecorder.isTypeSupported(x)) : undefined;
    if (!s || !type) return;
    haptic.tap();
    setHint(undefined);
    setElapsed(0);
    const chunks: Blob[] = [];
    try {
      const r = new MediaRecorder(s, { mimeType: type, videoBitsPerSecond: RECORD_BITS_PER_SEC });
      r.ondataavailable = (e) => {
        if (e.data?.size) chunks.push(e.data);
      };
      r.onstop = () => finish(new Blob(chunks, { type: baseType(type) }), began);
      r.onerror = () => {
        setRec(IDLE);
        setHint(t('Couldn’t record that one. Try again.'));
      };
      recorder.current = r;
      // In pieces each second, so a long recording never waits on one big piece at the end.
      r.start(1000);
    } catch {
      setRec(IDLE);
      setHint(t('Couldn’t record that one. Try again.'));
    }
  };

  const press = (kind: 'press-in' | 'press-out' | 'lock') => {
    if (!ready || saving) return;
    const r = recordButton(rec, { type: kind, at: Date.now() });
    if (kind === 'lock' && r.state !== rec) haptic.tap();
    setRec(r.state);
    if (r.action === 'start' && r.state.phase === 'recording') start(r.state.startedAt);
    if (r.action === 'stop' && recorder.current?.state === 'recording') recorder.current.stop();
  };

  const close = useCallback(() => goBack(), []);
  // Swipe left to go back to Discover, the way you came (never while filming).
  const swipeBack = Gesture.Pan()
    .enabled(!recording)
    .activeOffsetX(-24)
    .failOffsetY([-24, 24])
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX < -width * 0.3 || e.velocityX < -700) close();
    });

  if (problem) return <>{fallback(problem)}</>;

  return (
    <GestureDetector gesture={swipeBack}>
      <View style={styles.root}>
        <PageTitle title={t('Camera')} />
        {createElement('video', {
          ref: preview,
          autoPlay: true,
          muted: true,
          playsInline: true,
          'aria-label': t('What the camera sees'),
          // The front camera shows you as a mirror, like the phone's own camera (the recording isn't mirrored).
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: facing === 'front' ? 'scaleX(-1)' : undefined, backgroundColor: '#05040E' },
        })}
        <LinearGradient colors={['rgba(5,4,14,0.75)', 'rgba(5,4,14,0)']} style={[styles.fadeTop, { height: insets.top + 110 }]} pointerEvents="none" />
        <LinearGradient colors={['rgba(5,4,14,0)', 'rgba(5,4,14,0.85)']} style={[styles.fadeBottom, { height: insets.bottom + 220 }]} pointerEvents="none" />

        <View style={[styles.top, { top: insets.top + space.sm }]}>
          {drafts?.length && !recording ? (
            // Videos filmed here and not shared yet.
            <Pressable
              onPress={() => {
                haptic.select();
                router.push('/drafts');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Drafts, {n}', { n: drafts.length })}
              hitSlop={8}
              style={({ pressed }) => [styles.drafts, pressed && styles.pressed]}
            >
              <GlassFill radius={radius.pill} tint={0.45} />
              <Text style={styles.draftsText}>{t('Drafts · {n}', { n: drafts.length })}</Text>
            </Pressable>
          ) : (
            <View style={styles.spacer} />
          )}
          <View style={styles.chip}>
            <GlassFill radius={radius.pill} tint={0.45} />
            {recording ? (
              <View style={styles.timerRow} accessibilityLiveRegion="polite" accessibilityLabel={t('Recording, {time}', { time: elapsedLabel(elapsed) })}>
                <View style={styles.recDot} />
                <Text style={styles.timer}>{elapsedLabel(elapsed)}</Text>
              </View>
            ) : (
              <Text style={styles.chipText} numberOfLines={1}>
                {chip}
              </Text>
            )}
          </View>
          <GlassCircleButton label={t('Close the camera')} onPress={close}>
            <CloseIcon color={color.moon} size={16} />
          </GlassCircleButton>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.xl }]}>
          {hint ? (
            <Animated.Text entering={reduceMotion ? undefined : FadeIn} exiting={reduceMotion ? undefined : FadeOut} style={styles.hint} accessibilityLiveRegion="polite">
              {hint}
            </Animated.Text>
          ) : (
            <Text style={styles.hint}>
              {saving
                ? t('Keeping your video…')
                : recording
                  ? rec.mode === 'pending'
                    ? t('Filming while you hold · slide away to lock')
                    : rec.mode === 'locked'
                      ? t('Locked · tap to stop')
                      : t('Tap to stop')
                  : ready
                    ? t('Tap to record · hold to film while you hold')
                    : t('Starting the camera…')}
            </Text>
          )}
          <View style={styles.controls}>
            <Pressable
              onPress={() => {
                haptic.select();
                void pick('library', { replace: true, params: filming });
              }}
              disabled={recording || saving}
              accessibilityRole="button"
              accessibilityLabel={t('Choose a video from your library')}
              hitSlop={10}
              style={({ pressed }) => [styles.side, recording && styles.hidden, pressed && styles.pressed]}
            >
              <GlassFill radius={radius.md} tint={0.5} />
              <View pointerEvents="none">
                <PhotosIcon color={color.moon} size={22} />
              </View>
            </Pressable>
            <RecordButton
              recording={recording}
              holding={recording && rec.mode === 'pending'}
              locked={recording && rec.mode === 'locked'}
              disabled={!ready || saving}
              onPressIn={() => press('press-in')}
              onPressOut={() => press('press-out')}
              onLock={() => press('lock')}
              label={recording ? t('Stop recording') : t('Record a video')}
            />
            <Pressable
              onPress={() => {
                haptic.select();
                // Ready again once the other camera has started.
                setReady(false);
                setFacing((f) => (f === 'back' ? 'front' : 'back'));
              }}
              disabled={recording || !ready}
              accessibilityRole="button"
              accessibilityLabel={facing === 'back' ? t('Switch to the front camera') : t('Switch to the back camera')}
              hitSlop={10}
              style={({ pressed }) => [styles.side, (recording || !ready) && styles.hidden, pressed && styles.pressed]}
            >
              <GlassFill radius={radius.md} tint={0.5} />
              <View pointerEvents="none">
                <FlipIcon color={color.moon} size={22} />
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05040E', overflow: 'hidden' },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  fadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  top: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  spacer: { width: 40 },
  drafts: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill },
  draftsText: { ...type.label, color: color.moon },
  chip: { flexShrink: 1, paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill },
  chipText: { ...type.label, color: color.moon },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.glow },
  timer: { ...type.label, color: color.moon, fontVariant: ['tabular-nums'] },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  hint: { ...type.caption, color: color.moonDim, marginBottom: space.lg, textAlign: 'center', paddingHorizontal: space.xl },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: space.xxl },
  side: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.95 }] },
});
