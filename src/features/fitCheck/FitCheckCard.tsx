import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Festival } from '../../data/types';
import { showActionSheet, showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useNow } from '../../lib/useNow';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useCrews } from '../../state/crews';
import { useFitChecks } from '../../state/fitChecks';
import { useSocial } from '../../state/social';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { crewFits, FIT_NOTE, fitDate, fitKey } from './fitCheck';
import { t, weekdays } from '../../i18n';

/**
 * Today's fit check at a festival: snap (or choose) your outfit, keep it on
 * your phone, and send it to your crew if you like; your crewmates' fits for
 * the day beside it. Tapping a photo opens it big.
 */
export function FitCheckCard({ festival }: { festival: Festival }) {
  const now = useNow(60_000);
  const date = fitDate(now.getTime());
  const { fits, add, markSent } = useFitChecks();
  const { crews } = useCrews();
  const { updatesFor, sendPhoto, profileOf } = useCrewUpdates();
  const social = useSocial();
  const me = social.user?.uid;
  const mine = fits.find((f) => f.festivalId === festival.id && f.date === date);
  const crewsHere = useMemo(() => crews.filter((c) => c.festivalId === festival.id), [crews, festival.id]);
  const theirs = useMemo(() => crewFits(crewsHere.flatMap((c) => updatesFor(c.id)), festival.id, date, me), [crewsHere, updatesFor, festival.id, date, me]);
  const [open, setOpen] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [y, m, d] = date.split('-').map(Number);
  const dayName = weekdays()[new Date(y, m - 1, d).getDay()];

  const snap = () => {
    haptic.select();
    const camera = Platform.OS !== 'web';
    const TAKE = t('Take a photo');
    const CANCEL = t('Cancel');
    const options = [...(camera ? [TAKE] : []), t('Choose from Photos'), CANCEL];
    showActionSheet({ title: t('Fit check'), message: t('Kept on your phone. You choose whether your crew sees it.'), options, cancelButtonIndex: options.length - 1 }, async (i) => {
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
        if (!a) return;
        await add({ festivalId: festival.id, date, uri: a.uri, at: Date.now(), width: a.width, height: a.height });
        haptic.settle();
      } catch {
        showAlert(t('Couldn’t get that photo'), t('Try again, or choose another one.'));
      }
    });
  };

  const send = async () => {
    if (!mine || sending) return;
    setSending(true);
    try {
      const id = await sendPhoto(festival.id, { uri: mine.uri, width: mine.width, height: mine.height }, { note: FIT_NOTE });
      if (id) {
        await markSent(fitKey(mine));
        haptic.settle();
      }
    } finally {
      setSending(false);
    }
  };

  const shown = open === 'mine' ? mine?.uri : theirs.find((u) => u.id === open)?.thumbUrl;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('Fit check · {day}', { day: dayName })}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {mine ? (
          <View style={styles.item}>
            <Pressable onPress={() => setOpen('mine')} accessibilityRole="imagebutton" accessibilityLabel={t('Your fit today. Opens it big.')}>
              <Image source={{ uri: mine.uri }} style={styles.photo} />
            </Pressable>
            <Text style={styles.who}>{t('You')}</Text>
          </View>
        ) : (
          <Pressable onPress={snap} accessibilityRole="button" accessibilityLabel={t('Snap today’s fit')} style={({ pressed }) => [styles.add, pressed && { opacity: 0.75 }]}>
            <Text style={styles.addPlus}>+</Text>
            <Text style={styles.addText}>{t('Snap today’s fit')}</Text>
          </Pressable>
        )}
        {theirs.map((u) => (
          <View key={u.id} style={styles.item}>
            <Pressable onPress={() => setOpen(u.id)} accessibilityRole="imagebutton" accessibilityLabel={t('{name}’s fit today. Opens it big.', { name: profileOf(u.uid)?.displayName ?? t('Someone') })}>
              <Image source={{ uri: u.thumbUrl }} style={styles.photo} />
            </Pressable>
            <Text style={styles.who} numberOfLines={1}>
              {profileOf(u.uid)?.displayName ?? t('Someone')}
            </Text>
          </View>
        ))}
      </ScrollView>
      {mine ? (
        <View style={styles.actions}>
          {crewsHere.length ? (
            mine.sent ? (
              <Text style={styles.sent}>{t('Sent to your crew')}</Text>
            ) : (
              <Pressable onPress={() => void send()} disabled={sending} accessibilityRole="button" accessibilityLabel={t('Send your fit to your crew')} style={({ pressed }) => [styles.pill, (pressed || sending) && { opacity: 0.7 }]}>
                <Text style={styles.pillText}>{sending ? t('Sending…') : t('Send to my crew')}</Text>
              </Pressable>
            )
          ) : null}
          <Pressable onPress={snap} accessibilityRole="button" accessibilityLabel={t('Take another fit check photo')} hitSlop={8} style={styles.quiet}>
            <Text style={styles.quietText}>{t('Retake')}</Text>
          </Pressable>
        </View>
      ) : !theirs.length ? (
        <Text style={styles.note}>{t('One photo a day of what you’re wearing. Your fits stay in Profile → Festivals.')}</Text>
      ) : null}
      <Modal visible={!!shown} transparent animationType="fade" onRequestClose={() => setOpen(undefined)}>
        <Pressable style={styles.viewer} onPress={() => setOpen(undefined)} accessibilityRole="button" accessibilityLabel={t('Close')}>
          {shown ? <Image source={{ uri: shown }} style={styles.big} resizeMode="contain" /> : null}
          <Text style={styles.close}>{t('Close')}</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.md,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  title: { ...type.label, color: color.moonDim },
  strip: { gap: space.md },
  item: { width: 96, gap: 4 },
  photo: { width: 96, height: 128, borderRadius: radius.sm, backgroundColor: color.glass },
  who: { ...type.caption, color: color.moonDim },
  add: { width: 96, height: 128, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: glowA(0.5), backgroundColor: glowA(0.08) },
  addPlus: { ...type.title, color: color.glow },
  addText: { ...type.caption, color: color.moon, textAlign: 'center', paddingHorizontal: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pill: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: glowA(0.22) },
  pillText: { ...type.caption, color: color.moon },
  sent: { ...type.caption, color: color.glow },
  quiet: { paddingHorizontal: space.sm, paddingVertical: 6 },
  quietText: { ...type.caption, color: color.moonDim },
  note: { ...type.caption, color: color.moonDim },
  viewer: { flex: 1, backgroundColor: 'rgba(5,4,12,0.94)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  big: { width: '100%', height: '80%' },
  close: { ...type.label, color: color.moon, marginTop: space.lg },
});
