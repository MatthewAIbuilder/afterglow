import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { type GestureResponderEvent, Linking, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { Festival } from '../../data/models';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useCatalog } from '../../state/catalog';
import { useSocial } from '../../state/social';
import { rememberVenueMap } from '../../state/venueMaps';
import { color, glowA, radius, space, type } from '../../theme/tokens';
import { type Anchor, fitOf, LABEL_MAX, type Pin, PIN_KINDS, type PinKind, PINS_MAX, toGeo } from '../venueMap/venueMap';

type Mode = { kind: 'anchor'; index: number } | { kind: 'pin'; pin: PinKind } | { kind: 'check' };
type Draft = { image: string; width: number; height: number; anchors: (Anchor | Partial<Anchor>)[]; pins: Pin[] };

/** "28.5383, -81.4040" (Google Maps' right-click → copy), into a position. */
export function parseLatLon(text: string): { lat: number; lon: number } | undefined {
  const m = text.match(/(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : undefined;
}

/**
 * HQ → Maps: a festival's own map, for the app (the festival page, festival
 * mode, Sets you've seen). Upload the official map picture (only one you have
 * the rights to), pin it to the ground with three spots far apart (tap each
 * on the picture, then paste its coordinates from Google Maps), drop markers
 * (stages linked to the lineup's stages, water, medical…), check a spot, and
 * save. English only, like the rest of HQ.
 */
export function AdminMaps() {
  const social = useSocial();
  const catalog = useCatalog();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [festival, setFestival] = useState<Festival | undefined>();
  const [draft, setDraft] = useState<Draft | undefined>();
  const [mode, setMode] = useState<Mode>({ kind: 'anchor', index: 0 });
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<{ lat: number; lon: number } | undefined>();
  const [stageFor, setStageFor] = useState<string | undefined>();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalog.festivals.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, catalog.festivals]);

  useEffect(() => {
    if (!festival) return;
    let live = true;
    social.service
      .venueMap(festival.id)
      .then((m) => {
        if (live) setDraft(m ? { image: m.image, width: m.width, height: m.height, anchors: m.anchors, pins: m.pins } : undefined);
      })
      .catch(() => live && setDraft(undefined));
    return () => {
      live = false;
    };
  }, [festival, social.service]);

  const shownW = Math.min(width - space.xl * 2, 1000);
  const scale = draft ? shownW / draft.width : 1;
  const anchors = (draft?.anchors ?? []).filter((a): a is Anchor => typeof a.lat === 'number' && typeof a.lon === 'number' && typeof a.x === 'number');
  const fit = useMemo(() => (anchors.length === 3 ? fitOf(anchors) : undefined), [anchors]);

  const choosePicture = async () => {
    if (!festival) return;
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      const a = r.canceled ? undefined : r.assets?.[0];
      if (!a || !a.width || !a.height) return;
      setBusy(true);
      const url = await social.service.uploadVenueMapImage(festival.id, a.uri, a.mimeType ?? 'image/jpeg');
      setDraft({ image: url, width: a.width, height: a.height, anchors: [{}, {}, {}], pins: draft?.pins ?? [] });
      setMode({ kind: 'anchor', index: 0 });
    } catch {
      showAlert('Couldn’t upload the map', 'Check the signal (and that you’re signed in as HQ), then try again.');
    } finally {
      setBusy(false);
    }
  };

  const tap = (e: GestureResponderEvent) => {
    if (!draft) return;
    const x = Math.round(e.nativeEvent.locationX / scale);
    const y = Math.round(e.nativeEvent.locationY / scale);
    haptic.select();
    if (mode.kind === 'anchor') {
      const next = [...draft.anchors];
      next[mode.index] = { ...next[mode.index], x, y };
      setDraft({ ...draft, anchors: next });
    } else if (mode.kind === 'pin') {
      if (draft.pins.length >= PINS_MAX) return;
      const stage = mode.pin === 'stage' ? festival?.stages.find((s) => s.id === stageFor) : undefined;
      const pin: Pin = { id: `p${Date.now().toString(36)}`, kind: mode.pin, label: stage?.name ?? '', x, y, ...(stage ? { stageId: stage.id } : {}) };
      setDraft({ ...draft, pins: [...draft.pins, pin] });
    } else if (fit) setChecked(toGeo(fit, x, y));
  };

  const save = async () => {
    if (!festival || !draft) return;
    if (anchors.length < 3 || !fit) {
      showAlert('Three spots first', 'Place all three anchors on the picture and paste each one’s coordinates. Pick spots far apart, not in a line.');
      return;
    }
    setBusy(true);
    try {
      const map = { festivalId: festival.id, image: draft.image, width: draft.width, height: draft.height, anchors, pins: draft.pins };
      await social.service.saveVenueMap(map);
      rememberVenueMap(map);
      haptic.settle();
      showAlert('Saved', `${festival.name}’s map is on Afterglow now.`);
    } catch {
      showAlert('Couldn’t save the map', 'Check the signal and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h}>Festival maps</Text>
      <Text style={styles.p}>Upload a festival’s official map (only one you have the rights to), pin it to the ground with three spots, and add markers. It shows on the festival’s page and in festival mode, with people’s own dot on it.</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Find a festival" placeholderTextColor={color.moonFaint} style={styles.input} />
      {matches.map((f) => (
        <Pressable key={f.id} onPress={() => { setFestival(f); setQuery(''); setChecked(undefined); }} style={styles.match}>
          <Text style={styles.matchText}>{f.name}</Text>
        </Pressable>
      ))}
      {festival ? (
        <>
          <Text style={styles.h2}>{festival.name}</Text>
          <Pressable onPress={() => void choosePicture()} disabled={busy} style={[styles.button, busy && { opacity: 0.6 }]}>
            <Text style={styles.buttonText}>{busy ? 'Working…' : draft ? 'Choose a new map picture' : 'Choose the map picture'}</Text>
          </Pressable>
          {draft ? (
            <>
              <View style={styles.modes}>
                {[0, 1, 2].map((i) => (
                  <Chip key={i} on={mode.kind === 'anchor' && mode.index === i} label={`Spot ${i + 1}${typeof draft.anchors[i]?.lat === 'number' ? ' ✓' : ''}`} onPress={() => setMode({ kind: 'anchor', index: i })} />
                ))}
                {PIN_KINDS.map((k) => (
                  <Chip key={k} on={mode.kind === 'pin' && mode.pin === k} label={`+ ${k}`} onPress={() => setMode({ kind: 'pin', pin: k })} />
                ))}
                <Chip on={mode.kind === 'check'} label="Check a spot" onPress={() => setMode({ kind: 'check' })} />
              </View>
              {mode.kind === 'anchor' ? (
                <View style={styles.row}>
                  <Text style={styles.p}>Tap spot {mode.index + 1} on the picture, then paste its coordinates from Google Maps (right-click the same place → copy).</Text>
                  <TextInput
                    key={mode.index}
                    defaultValue={typeof draft.anchors[mode.index]?.lat === 'number' ? `${draft.anchors[mode.index].lat}, ${draft.anchors[mode.index].lon}` : ''}
                    onChangeText={(v) => {
                      const ll = parseLatLon(v);
                      if (!ll) return;
                      const next = [...draft.anchors];
                      next[mode.index] = { ...next[mode.index], ...ll };
                      setDraft({ ...draft, anchors: next });
                    }}
                    placeholder="28.53831, -81.40395"
                    placeholderTextColor={color.moonFaint}
                    style={styles.input}
                  />
                </View>
              ) : null}
              {mode.kind === 'pin' && mode.pin === 'stage' ? (
                <View style={styles.modes}>
                  {(festival.stages ?? []).map((s) => (
                    <Chip key={s.id} on={stageFor === s.id} label={s.name} onPress={() => setStageFor(s.id)} />
                  ))}
                </View>
              ) : null}
              <Pressable onPress={tap} style={{ width: shownW, height: draft.height * scale }}>
                <Image source={{ uri: draft.image }} style={StyleSheet.absoluteFill} contentFit="fill" />
                {draft.anchors.map((a, i) =>
                  typeof a.x === 'number' && typeof a.y === 'number' ? (
                    <View key={`a${i}`} style={[styles.anchor, { left: a.x * scale - 10, top: a.y * scale - 10 }]}>
                      <Text style={styles.anchorText}>{i + 1}</Text>
                    </View>
                  ) : null,
                )}
                {draft.pins.map((p) => (
                  <View key={p.id} style={[styles.pin, { left: p.x * scale - 7, top: p.y * scale - 7 }]} />
                ))}
              </Pressable>
              {mode.kind === 'check' ? (
                fit ? (
                  checked ? (
                    <Pressable onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${checked.lat.toFixed(6)},${checked.lon.toFixed(6)}`)}>
                      <Text style={styles.link}>That spot is {checked.lat.toFixed(5)}, {checked.lon.toFixed(5)}. Open it in Google Maps to check ↗</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.p}>Tap anywhere on the picture to see where the app thinks it is.</Text>
                  )
                ) : (
                  <Text style={styles.p}>Place all three spots first.</Text>
                )
              ) : null}
              <Text style={styles.h2}>Markers ({draft.pins.length})</Text>
              {draft.pins.map((p) => (
                <View key={p.id} style={styles.pinRow}>
                  <Text style={styles.pinKind}>{p.kind}</Text>
                  <TextInput
                    value={p.label}
                    onChangeText={(v) => setDraft({ ...draft, pins: draft.pins.map((x) => (x.id === p.id ? { ...x, label: v.slice(0, LABEL_MAX) } : x)) })}
                    placeholder="Name it (optional)"
                    placeholderTextColor={color.moonFaint}
                    style={[styles.input, { flex: 1 }]}
                  />
                  <Pressable onPress={() => setDraft({ ...draft, pins: draft.pins.filter((x) => x.id !== p.id) })} hitSlop={8}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={() => void save()} disabled={busy} style={[styles.button, styles.save, busy && { opacity: 0.6 }]}>
                <Text style={[styles.buttonText, { color: color.night }]}>Save the map</Text>
              </Pressable>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && { color: color.moon }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingVertical: space.lg },
  h: { ...type.title, color: color.moon },
  h2: { ...type.headline, color: color.moon, marginTop: space.md },
  p: { ...type.body, color: color.moonDim },
  input: { ...type.body, color: color.moon, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  match: { paddingVertical: space.sm },
  matchText: { ...type.body, color: color.glow },
  button: { alignSelf: 'flex-start', paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  save: { backgroundColor: color.glow, marginTop: space.md },
  buttonText: { ...type.label, color: color.moon },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  row: { gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  chipOn: { backgroundColor: glowA(0.25), borderColor: glowA(0.6) },
  chipText: { ...type.caption, color: color.moonDim },
  anchor: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFE066', alignItems: 'center', justifyContent: 'center' },
  anchorText: { fontSize: 11, fontWeight: '800', color: '#0B0A14' },
  pin: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: color.glow, borderWidth: 2, borderColor: '#0B0A14' },
  link: { ...type.body, color: color.glow },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pinKind: { ...type.caption, color: color.moonDim, width: 72 },
  remove: { ...type.caption, color: '#FF8A8A' },
});
