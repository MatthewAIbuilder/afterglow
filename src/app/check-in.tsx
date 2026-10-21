import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useNetworkState } from 'expo-network';
import { useRef, useState } from 'react';
import type { Artist, Festival, TasteProfile } from '../data/types';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTitle } from '../components/PageTitle';
import { CHECK_INS, clock, cleanNote, presetLabel } from '../features/crews/updates';
import { guessArtists, nightOf } from '../features/memories/guess';
import { isOffline } from '../features/offline/status';
import { StatusChips } from '../features/crews/CheckInPanel';
import { CREW_NOTE_MAX } from '../features/social/models';
import { showActionSheet, showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { useCatalog } from '../state/catalog';
import { useCrews } from '../state/crews';
import { useCrewUpdates } from '../state/crewUpdates';
import { usePlan } from '../state/plan';
import { useTaste } from '../state/taste';
import { color, radius, space, type, glowA, accentEdge, pageColumn } from '../theme/tokens';
import { goBack } from '../lib/nav';
import { useKeyboardInset } from '../lib/useKeyboardInset';
import { SheetClose } from '../components/SheetClose';
import { t } from '../i18n';
import { SHEET_BACKGROUND } from '../components/LiquidGlass';

/** Crew names as one line: "Bass crew and Day ones". */
const crewNames = (crews: readonly { name: string }[]) => crews.map((c) => c.name).join(` ${t('and')} `);

/**
 * Check in with your crew: one tap says where you are, stamped with the
 * moment you tapped. Tiny, so it gets through on the weakest signal; if
 * there's none, it waits on the phone and sends itself later, still marked
 * with the time you tapped.
 */
export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  // A form sheet: the note stays above the keyboard.
  const page = useRef<View>(null);
  const keyboard = useKeyboardInset(page);
  const catalog = useCatalog();
  const { crewFestivals, checkIn, sendPhoto, ready, outbox, dropped } = useCrewUpdates();
  const { crewsAt } = useCrews();
  const { taste } = useTaste();
  const { mustSeesAt } = usePlan();
  const offline = isOffline(useNetworkState());

  // The festival: the one on right now, else the first of your crews'.
  const [now] = useState(() => new Date());
  const festivals = crewFestivals.map((id) => catalog.festival(id)).filter((f) => !!f);
  const onNow = festivals.find((f) => nightOf(f, now));
  const [chosen, setChosen] = useState<string | undefined>();
  const festival = festivals.find((f) => f.id === chosen) ?? onNow ?? festivals[0];

  // Who's playing now, from the set times: offered as "Watching …".
  const playing = playingNow(festival, now, catalog.artists, taste, mustSeesAt);

  const [stage, setStage] = useState<string | undefined>();
  const [watching, setWatching] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<{ id: string; at: Date } | undefined>();
  // A photo for the crew (crews only: photos never go to Discover or profiles).
  const [photo, setPhoto] = useState<{ uri: string; width?: number; height?: number } | undefined>();
  const addPhoto = () => {
    const camera = Platform.OS !== 'web';
    const TAKE = t('Take a photo');
    const CANCEL = t('Cancel');
    const options = [...(camera ? [TAKE] : []), t('Choose from Photos'), CANCEL];
    showActionSheet({ title: t('A photo for your crew'), message: t('Only your crew sees it.'), options, cancelButtonIndex: options.length - 1 }, async (i) => {
      const choice = options[i];
      if (choice === CANCEL || !choice) return;
      try {
        if (choice === TAKE && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
          showAlert(t('Camera is off for {app}', { app: 'Afterglow' }), t('Turn it on in Settings to take a photo, or choose one from Photos.'));
          return;
        }
        const pick = choice === TAKE ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
        const r = await pick({ mediaTypes: ['images'], quality: 0.7 });
        const a = r.canceled ? undefined : r.assets?.[0];
        if (a) setPhoto({ uri: a.uri, width: a.width, height: a.height });
      } catch {
        showAlert(t('Couldn’t get that photo'), t('Try again, or choose another one.'));
      }
    });
  };

  if (!ready || !festival) {
    return (
      <View style={[styles.root, { paddingTop: space.xl }]}>
        <Text style={styles.title}>{t('Check in with your crew')}</Text>
        <Text style={styles.body}>{t('Start or join a crew for a festival you’re going to, and you can tell them where you are from here.')}</Text>
        <SheetClose />
      </View>
    );
  }

  const crews = crewsAt(festival.id);
  const send = async (words?: string) => {
    const where = {
      note: words,
      stage: watching && playing?.stage ? playing.stage : stage,
      artistId: watching ? playing?.artist.id : undefined,
    };
    const id = photo ? await sendPhoto(festival.id, photo, where) : checkIn(festival.id, where);
    if (!id) return;
    haptic.settle();
    setSent({ id, at: new Date() });
  };

  if (sent) {
    // Said only once it's really through: until then it's sending, or waiting for signal.
    const waiting = outbox.some((o) => o.id === sent.id);
    const refused = dropped.includes(sent.id);
    const marked = clock(sent.at.toISOString());
    return (
      <View style={[styles.root, styles.done, { paddingBottom: insets.bottom + space.xl }]} accessibilityLiveRegion="polite">
        <Text style={styles.doneTime}>{marked}</Text>
        <Text style={styles.title}>{refused ? t('Couldn’t reach your crew') : !waiting ? t('Sent to your crew') : offline ? t('Saved for when there’s signal') : t('Sending…')}</Text>
        <Text style={styles.body}>
          {refused
            ? t('Your crew couldn’t take this check-in (the crew may have ended, or your phone’s clock may be off). Try checking in again.')
            : !waiting
            ? crews.length === 1
              ? t('{crews} sees it marked {time}.', { crews: crewNames(crews), time: marked })
              : t('{crews} see it marked {time}.', { crews: crewNames(crews), time: marked })
            : offline
              ? t('No signal right now. It sends itself as soon as there is, still marked {time}, so your crew knows when you were there.', { time: marked })
              : t('The signal’s slow. It keeps trying by itself, still marked {time}. You can close this.', { time: marked })}
        </Text>
        <Pressable onPress={() => goBack()} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>{t('Done')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View ref={page} onLayout={keyboard.onLayout} style={[styles.root, { paddingBottom: keyboard.inset }]}>
      <PageTitle title={t('Check in')} />
      <ScrollView contentContainerStyle={[pageColumn, { paddingTop: space.xl, paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, styles.pad]}>{t('Check in with your crew')}</Text>
        <Text style={[styles.body, styles.pad]}>
          {crews.length === 1
            ? t('{crews} sees the time you tap, even if the signal holds it back.', { crews: crewNames(crews) })
            : t('{crews} see the time you tap, even if the signal holds it back.', { crews: crewNames(crews) })}
        </Text>
        {offline ? <Text style={[styles.offline, styles.pad]}>{t('No signal right now: it’ll send itself later, marked with this moment.')}</Text> : null}

        {festivals.length > 1 ? (
          <Chips label={t('Festival')}>
            {festivals.map((f) => (
              <Chip key={f.id} label={f.name} on={f.id === festival.id} onPress={() => setChosen(f.id)} />
            ))}
          </Chips>
        ) : null}

        {playing ? (
          <Chips label={t('Watching')}>
            <Chip
              label={`${playing.artist.name}${playing.stage ? ` · ${playing.stage}` : ''}`}
              on={watching}
              onPress={() => {
                setWatching((w) => !w);
                setStage(undefined);
              }}
            />
          </Chips>
        ) : null}

        {festival.stages.length > 0 ? (
          <Chips label={t('Where are you?')}>
            {festival.stages.map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                on={!watching && stage === s.name}
                onPress={() => {
                  setWatching(false);
                  setStage((x) => (x === s.name ? undefined : s.name));
                }}
              />
            ))}
          </Chips>
        ) : null}

        <Text style={[styles.section, styles.pad]}>{t('Photo')}</Text>
        <View style={styles.pad}>
          {photo ? (
            <View style={styles.photoRow}>
              <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" accessibilityLabel={t('Your photo for the crew')} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Text style={styles.photoNote}>{t('Goes with your check-in. Only your crew sees it.')}</Text>
                <Pressable onPress={() => setPhoto(undefined)} accessibilityRole="button" accessibilityLabel={t('Remove the photo')} hitSlop={8}>
                  <Text style={styles.photoRemove}>{t('Remove')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={addPhoto} accessibilityRole="button" accessibilityLabel={t('Add a photo for your crew')} style={({ pressed }) => [styles.photoAdd, pressed && styles.pressed]}>
              <Text style={styles.photoAddText}>{t('+ Add a photo')}</Text>
              <Text style={styles.photoNote}>{t('Just for your crew, never on Discover or your profile.')}</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.section, styles.pad]}>{t('Say')}</Text>
        <View style={[styles.quick, styles.pad]}>
          {CHECK_INS.map((words) => (
            <Pressable
              key={words}
              onPress={() => void send(words)}
              accessibilityRole="button"
              accessibilityLabel={t('Send “{words}” to your crew', { words: presetLabel(words) })}
              style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
            >
              <Text style={styles.quickText}>{presetLabel(words)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.section, styles.pad]}>{t('Let them know')}</Text>
        <View style={styles.pad}>
          <StatusChips
            festivalId={festival.id}
            onSent={(id) => {
              haptic.settle();
              setSent({ id, at: new Date() });
            }}
          />
        </View>

        <View style={[styles.own, styles.pad]}>
          <TextInput
            value={note}
            onChangeText={(v) => setNote(v.slice(0, CREW_NOTE_MAX))}
            placeholder={t('Or say something…')}
            placeholderTextColor={color.moonFaint}
            style={styles.input}
            accessibilityLabel={t('Your own words for your crew')}
            returnKeyType="send"
            onSubmitEditing={() => void (cleanNote(note) && send(note))}
          />
          <Pressable
            onPress={() => void send(cleanNote(note) || undefined)}
            accessibilityRole="button"
            accessibilityLabel={photo ? t('Send the photo to your crew') : cleanNote(note) ? t('Send to your crew') : t('Send where you are to your crew')}
            style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{t('Send')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <SheetClose />
    </View>
  );
}

/** Who's on now at this festival, from the set times (your route and must-sees first), when anyone is. */
function playingNow(
  f: Festival | undefined,
  now: Date,
  artists: Artist[],
  taste: TasteProfile,
  mustSeesAt: (id: string) => ReadonlySet<string>,
) {
  if (!f?.sets?.length) return undefined;
  const at = nightOf(f, now);
  if (!at) return undefined;
  const g = guessArtists({ festival: f, night: at.night, minute: at.minute, artists, taste, pinned: mustSeesAt(f.id) })[0];
  return g?.set ? g : undefined;
}

function Chips({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <Text style={[styles.section, styles.pad]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {children}
      </ScrollView>
    </>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, on && { color: color.moon }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHEET_BACKGROUND },
  pad: { paddingHorizontal: space.xl },
  title: { ...type.title, color: color.moon },
  body: { ...type.body, color: color.moonDim, marginTop: space.sm },
  offline: { ...type.caption, color: '#FFB86B', marginTop: space.md },
  section: { ...type.label, color: color.moonFaint, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.xl, marginBottom: space.sm },
  chips: { paddingHorizontal: space.xl, gap: space.sm },
  chip: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  chipOn: { backgroundColor: glowA(0.2), borderColor: glowA(0.55) },
  chipText: { ...type.label, color: color.moonDim },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quickButton: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: glowA(0.14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.4),
  },
  quickText: { ...type.headline, color: color.moon },
  own: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl },
  photoAdd: { padding: space.lg, gap: 4, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: glowA(0.5), backgroundColor: glowA(0.06) },
  photoAddText: { ...type.headline, color: color.glow },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  photo: { width: 84, height: 84, borderRadius: radius.md },
  photoNote: { ...type.caption, color: color.moonDim },
  photoRemove: { ...type.label, color: color.glow },
  input: {
    flex: 1,
    ...type.body,
    color: color.moon,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  sendButton: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, ...accentEdge },
  primary: { marginTop: space.xl, alignSelf: 'stretch', alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glowDeep, ...accentEdge },
  primaryText: { ...type.headline, color: color.moon },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  done: { justifyContent: 'center', paddingHorizontal: space.xl },
  doneTime: { ...type.largeTitle, color: color.glow, fontVariant: ['tabular-nums'], marginBottom: space.sm },
});
