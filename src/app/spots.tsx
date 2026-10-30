import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { NightSky } from '../components/NightSky';
import { PageActions } from '../components/PageActions';
import { PageFeedback } from '../components/PageFeedback';
import { PageTitle } from '../components/PageTitle';
import { arrowAngle, cleanSpots, compassWord, LABEL_MAX, mapsLink, OLD_AFTER_MS, removeSpot, saveSpot, type Spot, type SpotKind, spotName, wayTo } from '../features/care/spots';
import { distanceText } from '../features/care/trail';
import { unitsFor } from '../features/festivals/near';
import { formatTime } from '../features/festivals/format';
import { t, weekdays } from '../i18n';
import { showAlert } from '../lib/dialog';
import { haptic } from '../lib/haptics';
import { useNow } from '../lib/useNow';
import { color, glowA, radius, space, type } from '../theme/tokens';

/** Where your saved spots are kept: this phone only, per account (`features/accounts/scope.ts`). */
export const SPOTS_KEY = 'spots.v1';

type Here = { lat: number; lon: number; accuracy?: number };
type Permission = 'unknown' | 'granted' | 'denied';

const locale = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
};

/**
 * Find my way back: save where you parked or pitched your tent (or any spot),
 * then an arrow, the distance and the walk back to it. Kept only on this
 * phone. In a browser there's no compass, so it says the direction in words.
 */
export default function SpotsScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [here, setHere] = useState<Here | undefined>();
  const [heading, setHeading] = useState<number | undefined>();
  const [permission, setPermission] = useState<Permission>('unknown');
  const [saving, setSaving] = useState<SpotKind | undefined>();
  const [label, setLabel] = useState('');
  const miles = unitsFor(locale()) === 'mi';

  useEffect(() => {
    AsyncStorage.getItem(SPOTS_KEY)
      .then((raw) => setSpots(raw ? cleanSpots(JSON.parse(raw)) : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const keep = useCallback((next: Spot[]) => {
    setSpots(next);
    void AsyncStorage.setItem(SPOTS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // Where you are, and which way you face, while this page is open.
  useEffect(() => {
    let live = true;
    const subs: { remove: () => void }[] = [];
    void (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!live) return;
        if (!perm.granted) {
          setPermission(perm.canAskAgain === false ? 'denied' : 'unknown');
          return;
        }
        setPermission('granted');
        subs.push(
          await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 3 }, (p) => {
            if (live) setHere({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy ?? undefined });
          }),
        );
        if (Platform.OS !== 'web') {
          subs.push(
            await Location.watchHeadingAsync((h) => {
              const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
              if (live && deg >= 0) setHeading(deg);
            }),
          );
        }
      } catch {
        // No location: saving still asks when you tap.
      }
    })();
    return () => {
      live = false;
      subs.forEach((s) => s.remove());
    };
  }, [permission]);

  const save = async (kind: SpotKind) => {
    haptic.select();
    setSaving(kind);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setPermission('denied');
        showAlert(t('Location is off for Afterglow'), t('Allow location in Settings to save where you are.'), [
          { text: t('Not now'), style: 'cancel' },
          ...(Platform.OS !== 'web' ? [{ text: t('Open Settings'), onPress: () => void Linking.openSettings() }] : []),
        ]);
        return;
      }
      setPermission('granted');
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const words = kind === 'spot' ? label.trim().slice(0, LABEL_MAX) : '';
      const spot: Spot = {
        id: kind === 'spot' ? `spot-${Date.now()}` : kind,
        kind,
        ...(words ? { label: words } : {}),
        lat: p.coords.latitude,
        lon: p.coords.longitude,
        ...(p.coords.accuracy != null ? { accuracy: Math.round(p.coords.accuracy) } : {}),
        at: Date.now(),
      };
      keep(saveSpot(spots, spot));
      setHere({ lat: spot.lat, lon: spot.lon, accuracy: spot.accuracy });
      if (kind === 'spot') setLabel('');
      haptic.settle();
    } catch {
      showAlert(t('Couldn’t find where you are'), t('Step outside or wait a moment for a clearer signal, then try again.'));
    } finally {
      setSaving(undefined);
    }
  };

  const forget = (s: Spot) => {
    haptic.select();
    showAlert(t('Forget {name}?', { name: spotName(s) }), undefined, [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Forget'), style: 'destructive', onPress: () => keep(removeSpot(spots, s.id)) },
    ]);
  };

  return (
    <View style={styles.root}>
      <PageTitle title={t('Find my way back')} />
      <NightSky />
      <PageActions />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + space.xxxl }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('Find my way back')}</Text>
        <Text style={styles.sub}>{t('Save where you parked or camped, and find your way back at the end of the night. Kept only on this phone.')}</Text>

        <View style={styles.saveRow}>
          <SaveButton label={t('Save my car here')} busy={saving === 'car'} onPress={() => void save('car')} />
          <SaveButton label={t('Save my tent here')} busy={saving === 'tent'} onPress={() => void save('tent')} />
        </View>
        <View style={styles.spotRow}>
          <View style={styles.field}>
            <TextInput
              value={label}
              onChangeText={setLabel}
              maxLength={LABEL_MAX}
              placeholder={t('Name a spot: Gate C, our flag…')}
              placeholderTextColor={color.moonFaint}
              accessibilityLabel={t('Name for the spot')}
              style={styles.input}
              returnKeyType="done"
            />
          </View>
          <SaveButton label={t('Save spot')} busy={saving === 'spot'} onPress={() => void save('spot')} small />
        </View>
        {permission === 'denied' ? (
          <Pressable onPress={() => (Platform.OS !== 'web' ? void Linking.openSettings() : undefined)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.warn}>{Platform.OS !== 'web' ? t('Location is off for Afterglow. Open Settings to allow it.') : t('Location is off for this site. Allow it in your browser’s settings.')}</Text>
          </Pressable>
        ) : null}

        {spots.length ? (
          spots.map((s) => <SpotCard key={s.id} spot={s} here={here} heading={heading} miles={miles} now={now} onForget={() => forget(s)} />)
        ) : loaded ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('Nothing saved yet')}</Text>
            <Text style={styles.emptyText}>{t('When you park or pitch your tent, tap Save. At 3 AM an arrow points you back.')}</Text>
          </View>
        ) : null}
        <PageFeedback />
      </ScrollView>
    </View>
  );
}

function SaveButton({ label, busy, onPress, small }: { label: string; busy: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ busy }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.saveBtn, small && styles.saveSmall, (pressed || busy) && { opacity: 0.7 }]}
    >
      <Text style={styles.saveText} numberOfLines={1}>
        {busy ? t('Finding you…') : label}
      </Text>
    </Pressable>
  );
}

function SpotCard({ spot, here, heading, miles, now, onForget }: { spot: Spot; here?: Here; heading?: number; miles: boolean; now: Date; onForget: () => void }) {
  const way = here ? wayTo(here, spot) : undefined;
  const name = spotName(spot);
  const saved = new Date(spot.at);
  const when = `${weekdays()[saved.getDay()]} ${formatTime(`${String(saved.getHours()).padStart(2, '0')}:${String(saved.getMinutes()).padStart(2, '0')}`)}`;
  const old = now.getTime() - spot.at > OLD_AFTER_MS;
  const line = !way
    ? t('Finding where you are…')
    : way.here
      ? t('You’re here')
      : heading !== undefined
        ? t('{distance} · {n} min walk', { distance: distanceText(way.meters, miles), n: way.minutes })
        : t('{distance} · {n} min walk, {direction}', { distance: distanceText(way.meters, miles), n: way.minutes, direction: compassWord(way.bearing) });
  const apple = Platform.OS === 'ios';
  return (
    <View style={[styles.card, way?.here && styles.cardHere]} accessible accessibilityLabel={`${name}. ${line}. ${t('Saved {when}', { when })}`}>
      <View style={styles.cardTop}>
        <View style={styles.arrowWrap}>
          {way && !way.here ? (
            <View style={{ transform: [{ rotate: `${arrowAngle(way.bearing, heading)}deg` }] }}>
              <Svg width={44} height={44} viewBox="0 0 44 44">
                <Path d="M22 4 L34 36 L22 29 L10 36 Z" fill={color.glow} />
              </Svg>
            </View>
          ) : (
            <View style={styles.hereDot} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.line}>{line}</Text>
          <Text style={styles.meta}>
            {t('Saved {when}', { when })}
            {old ? ` · ${t('a while ago')}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            haptic.select();
            void Linking.openURL(mapsLink(spot, apple)).catch(() => {});
          }}
          accessibilityRole="link"
          accessibilityLabel={t('Walking directions to {name} in Maps', { name })}
          hitSlop={8}
          style={({ pressed }) => [styles.pill, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.pillText}>{t('Directions')}</Text>
        </Pressable>
        <Pressable onPress={onForget} accessibilityRole="button" accessibilityLabel={t('Forget {name}', { name })} hitSlop={8} style={({ pressed }) => [styles.pillQuiet, pressed && { opacity: 0.6 }]}>
          <Text style={styles.pillQuietText}>{t('Forget')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: space.xl, alignSelf: 'center', width: '100%', maxWidth: 640, gap: space.md },
  title: { ...type.largeTitle, color: color.moon },
  sub: { ...type.body, color: color.moonDim },
  saveRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  spotRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  field: { flex: 1 },
  input: {
    ...type.body,
    color: color.moon,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: glowA(0.2),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glowA(0.5),
  },
  saveSmall: { flex: 0, paddingVertical: space.sm + 2 },
  saveText: { ...type.label, color: color.moon },
  warn: { ...type.caption, color: color.glow },
  empty: { marginTop: space.lg, gap: space.xs },
  emptyTitle: { ...type.headline, color: color.moon },
  emptyText: { ...type.body, color: color.moonDim },
  card: {
    marginTop: space.sm,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderTopColor: color.rim,
  },
  cardHere: { borderColor: glowA(0.5), backgroundColor: glowA(0.1) },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  arrowWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  hereDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: color.glow, shadowColor: color.glow, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  name: { ...type.headline, color: color.moon },
  line: { ...type.body, color: color.moon, marginTop: 2 },
  meta: { ...type.caption, color: color.moonFaint, marginTop: 2 },
  actions: { flexDirection: 'row', gap: space.sm },
  pill: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: glowA(0.18) },
  pillText: { ...type.label, color: color.moon },
  pillQuiet: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  pillQuietText: { ...type.label, color: color.moonDim },
});
