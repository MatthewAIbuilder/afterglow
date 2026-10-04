import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCircleButton } from '../components/GlassCircleButton';
import { PageTitle } from '../components/PageTitle';
import { PersonAvatar } from '../components/PersonAvatar';
import { CloseIcon, QrIcon } from '../components/TabIcons';
import { type FriendCard, readFriendLink } from '../features/friends/qr';
import { readSproutLink } from '../features/sprouts/sprouts';
import { readFindLink } from '../features/finds/finds';
import { haptic } from '../lib/haptics';
import { type AddResult, useFriendAdds } from '../state/friendAdds';
import { useSocial } from '../state/social';
import { color, radius, space, type } from '../theme/tokens';
import { goBack } from '../lib/nav';

/** A code that isn't a friend code says so for this long before scanning carries on. */
const NOT_A_CODE_MS = 2500;

/**
 * Scan a friend's code. Becoming friends needs signal, but the scan never
 * does: it's kept on the phone and goes through by itself as soon as there's
 * signal, and you're told which happened.
 */
export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const social = useSocial();
  const { add } = useFriendAdds();
  const [perm, ask] = useCameraPermissions();
  const [note, setNote] = useState<string | undefined>();
  const [adding, setAdding] = useState<FriendCard | undefined>();
  const [result, setResult] = useState<{ card: FriendCard; outcome: AddResult } | undefined>();
  const busy = useRef(false);
  const lastText = useRef<string | undefined>(undefined);

  const onScanned = async (text: string) => {
    if (busy.current || result || text === lastText.current) return;
    lastText.current = text;
    const sprout = readSproutLink(text);
    if (sprout) {
      // A sprout someone's giving you: its own page picks it up.
      haptic.settle();
      router.replace({ pathname: '/sprout/[id]', params: { id: sprout.id, u: sprout.from, h: sprout.handle, k: sprout.kind, n: sprout.name, ...(sprout.artist ? { a: sprout.artist.id, an: sprout.artist.name } : {}) } });
      return;
    }
    const sticker = readFindLink(text);
    if (sticker) {
      // A sticker in the wild: its own page keeps it.
      haptic.settle();
      router.replace({ pathname: '/find/[code]', params: { code: sticker.code, c: sticker.creature, n: sticker.name } });
      return;
    }
    const card = readFriendLink(text);
    if (!card) {
      setNote('That isn’t an Afterglow friend code, sprout or sticker.');
      setTimeout(() => {
        lastText.current = undefined;
        setNote(undefined);
      }, NOT_A_CODE_MS);
      return;
    }
    if (!social.user) {
      setNote('Sign in to add friends. Sprouts work without an account.');
      setTimeout(() => {
        lastText.current = undefined;
        setNote(undefined);
      }, NOT_A_CODE_MS);
      return;
    }
    busy.current = true;
    haptic.settle();
    setAdding(card);
    const outcome = await add(card);
    setAdding(undefined);
    if (outcome === 'self') {
      busy.current = false;
      setNote('That’s your own code. Scan a friend’s.');
      setTimeout(() => {
        lastText.current = undefined;
        setNote(undefined);
      }, NOT_A_CODE_MS);
      return;
    }
    if (outcome === 'added') haptic.settle();
    setResult({ card, outcome });
  };

  const again = () => {
    busy.current = false;
    lastText.current = undefined;
    setResult(undefined);
  };

  const showCamera = Platform.OS !== 'web' && perm?.granted && social.availability.ok;

  return (
    <View style={styles.root}>
      <PageTitle title="Scan a code" />
      {showCamera ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={result || adding ? undefined : (r) => void onScanned(r.data)}
        />
      ) : null}
      <View style={[styles.shade, StyleSheet.absoluteFill]} pointerEvents="none" />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.title} accessibilityRole="header">
          Scan a code
        </Text>
        <GlassCircleButton label="Close" onPress={() => goBack()}>
          <CloseIcon color={color.moon} size={18} />
        </GlassCircleButton>
      </View>

      {Platform.OS === 'web' || !social.availability.ok ? (
        <Card title="Scanning is in the app" body="Open Afterglow on your phone to scan a friend’s code." />
      ) : !perm ? null : !perm.granted ? (
        <Card
          title="Scan with your camera"
          body="Afterglow uses the camera only to read the code. Nothing is filmed or saved."
          action={perm.canAskAgain ? 'Allow camera' : 'Open Settings'}
          onAction={() => (perm.canAskAgain ? void ask() : void Linking.openSettings().catch(() => {}))}
        />
      ) : result ? (
        <ResultCard card={result.card} outcome={result.outcome} onAgain={again} />
      ) : (
        <>
          <View style={styles.frameWrap} pointerEvents="none">
            <View style={styles.frame}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>
          </View>
          <View style={[styles.bottom, { paddingBottom: insets.bottom + space.xl }]}>
            <Text style={styles.hint} accessibilityLiveRegion="polite">
              {adding ? `Adding ${adding.name}…` : (note ?? 'Point at a friend’s code or a sprout. It works with no signal.')}
            </Text>
            <Pressable
              onPress={() => router.replace('/my-code')}
              accessibilityRole="button"
              accessibilityLabel="Show my code instead"
              style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
            >
              <QrIcon color={color.moon} size={18} />
              <Text style={styles.pillText}>Show my code</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function ResultCard({ card, outcome, onAgain }: { card: FriendCard; outcome: AddResult; onAgain: () => void }) {
  const added = outcome === 'added';
  const title = added ? `You and ${card.name} are friends` : `Saved ${card.name}`;
  const body = added
    ? 'You follow each other now. Their videos show in Following.'
    : outcome === 'needs-profile'
      ? `Make your profile and you’ll be friends with ${card.name} as soon as there’s signal.`
      : `The signal’s weak, so it’s kept on your phone. You’ll be friends with ${card.name} as soon as there’s signal, and we’ll let you know.`;
  return (
    <View style={styles.cardWrap}>
      <View style={[styles.card, !added && styles.cardWaiting]} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${title}. ${body}`}>
        <PersonAvatar name={card.name} size={64} />
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.handle}>@{card.handle}</Text>
        <Text style={[styles.cardBody, !added && styles.amber]}>{body}</Text>
      </View>
      {added ? (
        <Pressable
          onPress={() => router.replace({ pathname: '/u/[handle]', params: { handle: card.handle } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>See their profile</Text>
        </Pressable>
      ) : outcome === 'needs-profile' ? (
        <Pressable onPress={() => router.replace('/profile-edit')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Make my profile</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onAgain} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <Text style={styles.secondaryText}>Scan another</Text>
      </Pressable>
      <Pressable onPress={() => goBack()} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.link}>Done</Text>
      </Pressable>
    </View>
  );
}

function Card({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.cardWrap}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const FRAME = 250;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05040E' },
  shade: { backgroundColor: 'rgba(5,4,14,0.35)' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl },
  title: { ...type.title, color: color.moon, flex: 1 },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: 44, height: 44, borderColor: color.glow, borderWidth: 0 },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 20 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 20 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 20 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 20 },
  bottom: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xl },
  hint: { ...type.body, color: color.moon, textAlign: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
  pillText: { ...type.headline, color: color.moon },
  cardWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl, gap: space.md, alignSelf: 'center', width: '100%', maxWidth: 520 },
  card: { padding: space.xl, borderRadius: radius.lg, backgroundColor: color.nightRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(169,124,255,0.45)', alignItems: 'center', gap: space.sm },
  cardWaiting: { borderStyle: 'dashed', borderColor: 'rgba(255,184,107,0.7)' },
  cardTitle: { ...type.title, color: color.moon, textAlign: 'center' },
  handle: { ...type.body, color: color.moonDim },
  cardBody: { ...type.body, color: color.moonDim, textAlign: 'center' },
  amber: { color: '#FFB86B' },
  primary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep },
  primaryText: { ...type.headline, color: color.moon },
  secondary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  link: { ...type.label, color: color.moonFaint, textAlign: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
