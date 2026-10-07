import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { shareMessage } from '../../lib/share';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { CODE_LENGTH, codeFrom, findLink, type Hunt, HUNT_NAME_MAX, lookOf, parseEndDate, type Sticker, STICKER_NAME_MAX, untilLine } from '../finds/finds';
import { PLACE_CREATURES, SOUND_CREATURES } from '../sprouts/artistLook';
import { Collectible } from '../sprouts/Collectible';
import { socialErrorKind, SOCIAL_ERROR_COPY } from '../social/service';

/** Festival places first, then the sound creatures. Never an artist's hand-made one (that needs their say-so). */
const HQ_CREATURES = [...PLACE_CREATURES, ...SOUND_CREATURES];
/** In an organizer's studio, its own creature first. */
const ORG_CREATURES: string[] = ['flask', ...HQ_CREATURES.filter((c) => c !== 'flask')];

/** The festival places kit: one sticker for each spot people pass, in this order. */
export const PLACES_KIT = ['gates', 'portapotty', 'refill', 'charger', 'caretent', 'foodtruck', 'lostfound', 'pickup', 'silentdisco', 'shuttle', 'hammock', 'mainstage', 'campfire', 'tent', 'merch'] as const;
/** The kit's names as they're kept and printed: in English, whatever the phone's language (like the rest of HQ). */
const KIT_NAMES: Record<(typeof PLACES_KIT)[number], string> = {
  portapotty: 'Portal potty',
  refill: 'Refill',
  charger: 'Charger',
  caretent: 'Care tent',
  foodtruck: 'Food truck',
  lostfound: 'Lost and found',
  pickup: 'Pick-up point',
  gates: 'Gates',
  merch: 'Merch tee',
  silentdisco: 'Silent disco',
  shuttle: 'Shuttle',
  hammock: 'Hammock',
  mainstage: 'Main stage',
  campfire: 'Campfire',
  tent: 'Tent',
};

function newCode(): string {
  try {
    return codeFrom(Crypto.getRandomBytes(CODE_LENGTH));
  } catch {
    return codeFrom(Array.from({ length: CODE_LENGTH }, () => Math.floor(Math.random() * 256)));
  }
}

/**
 * HQ's Stickers tab: make stickers people collect by scanning them, group
 * them into hunts, see how many people found each, and print them. Every
 * copy of a sticker has the same code. With `orgId`, an organizer's own
 * stickers and hunts in its studio (its creature first).
 */
export function AdminStickers({ orgId }: { orgId?: string } = {}) {
  const social = useSocial();
  const CREATURES = orgId ? ORG_CREATURES : HQ_CREATURES;
  const [stickers, setStickers] = useState<Sticker[] | undefined>();
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [creature, setCreature] = useState<string>(orgId ? ORG_CREATURES[0] : HQ_CREATURES[0]);
  const [huntId, setHuntId] = useState<string | undefined>();
  const [until, setUntil] = useState('');
  const [huntName, setHuntName] = useState('');
  const [huntUntil, setHuntUntil] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      if (orgId) {
        const [s, h, c] = await Promise.all([social.service.orgStickers(orgId, 200), social.service.orgHunts(orgId, 50), social.service.orgFinds(orgId).catch(() => ({}) as Record<string, number>)]);
        // Gifts are in the studio's Gifts part.
        setStickers(s.filter((x) => !x.gift));
        setHunts(h);
        setCounts(Object.fromEntries(s.map((x) => [x.code, c[x.code] ?? 0])));
        return;
      }
      const [s, h] = await Promise.all([social.service.stickers(200), social.service.hunts(50)]);
      setStickers(s);
      setHunts(h);
      const pairs = await Promise.all(s.slice(0, 40).map(async (x) => [x.code, await social.service.stickerFinds(x.code).catch(() => -1)] as const));
      setCounts(Object.fromEntries(pairs.filter(([, n]) => n >= 0)));
    } catch {
      setStickers((x) => x ?? []);
    }
  }, [social.service, orgId]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const fail = (e: unknown) => showAlert('Couldn’t save that', SOCIAL_ERROR_COPY[socialErrorKind(e)]);

  const makeSticker = async () => {
    const end = parseEndDate(until);
    if (!name.trim()) return showAlert('Give it a name', 'Like “Ferris wheel · Night Market 2027”.');
    if (end === 'bad') return showAlert('That end date doesn’t look right', 'Write it as year-month-day, like 2027-06-14, or leave it empty.');
    setBusy(true);
    try {
      await social.service.addSticker({ code: newCode(), name: name.trim(), creature, ...(huntId ? { huntId } : {}), ...(end !== undefined ? { until: end } : {}), ...(orgId ? { orgId } : {}) });
      haptic.settle();
      setName('');
      setUntil('');
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const makeHunt = async () => {
    const end = parseEndDate(huntUntil);
    if (!huntName.trim()) return showAlert('Give the hunt a name', 'Like “Night Market 2027”.');
    if (end === 'bad') return showAlert('That end date doesn’t look right', 'Write it as year-month-day, like 2027-06-14, or leave it empty.');
    setBusy(true);
    try {
      const h = await social.service.addHunt({ id: newCode(), name: huntName.trim(), ...(end !== undefined ? { until: end } : {}), ...(orgId ? { orgId } : {}) });
      haptic.settle();
      setHuntName('');
      setHuntUntil('');
      setHuntId(h.id);
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  // A whole hunt in one go: one sticker for each festival place, named after the hunt.
  // If the signal drops partway, pressing again finishes the same hunt (only the places still missing).
  const [kitPart, setKitPart] = useState<{ huntId: string; name: string; made: string[] }>();
  const makeKit = async () => {
    const end = parseEndDate(huntUntil);
    if (!huntName.trim()) return showAlert('Give the hunt a name first', 'Like “Lost Lands 2027”. Each sticker is named after its place and the hunt.');
    if (end === 'bad') return showAlert('That end date doesn’t look right', 'Write it as year-month-day, like 2027-06-14, or leave it empty.');
    setBusy(true);
    const hunt = huntName.trim();
    const part = kitPart?.name === hunt ? kitPart : undefined;
    const made = [...(part?.made ?? [])];
    let huntId = part?.huntId;
    try {
      if (!huntId) huntId = (await social.service.addHunt({ id: newCode(), name: hunt, ...(end !== undefined ? { until: end } : {}), ...(orgId ? { orgId } : {}) })).id;
      for (const c of PLACES_KIT) {
        if (made.includes(c)) continue;
        await social.service.addSticker({ code: newCode(), name: `${KIT_NAMES[c]} · ${hunt}`.slice(0, STICKER_NAME_MAX), creature: c, huntId, ...(end !== undefined ? { until: end } : {}), ...(orgId ? { orgId } : {}) });
        made.push(c);
      }
      haptic.settle();
      setKitPart(undefined);
      setHuntName('');
      setHuntUntil('');
      await load();
      showAlert('The kit is ready', `${PLACES_KIT.length} stickers in “${hunt}”, one for each place. Print all of them from the hunt below.`);
    } catch (e) {
      if (huntId) {
        setKitPart({ huntId, name: hunt, made });
        showAlert('The kit isn’t finished', `${made.length} of ${PLACES_KIT.length} stickers made in “${hunt}”. Press Make the festival places kit again to finish it.`);
      } else fail(e);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const takeDown = (s: Sticker) =>
    showAlert(`Take down “${s.name}”?`, 'Its code stops working for anyone who hasn’t found it yet. People who found it keep it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take down', style: 'destructive', onPress: () => void social.service.deleteSticker(s.code).then(load, fail) },
    ]);

  const huntNameOf = (id?: string) => hunts.find((h) => h.id === id)?.name;

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>Stickers people collect by scanning them. Every copy of a sticker has the same code, so a photo of one works too. Print them from the website on a computer.</Text>

      <View style={styles.card}>
        <Text style={styles.h3}>New sticker</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Name, like Ferris wheel · Night Market" placeholderTextColor={color.moonFaint} maxLength={STICKER_NAME_MAX} style={styles.input} accessibilityLabel="Sticker name" />
        <Text style={styles.label}>Creature</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.creatures}>
          {CREATURES.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                haptic.select();
                setCreature(c);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: creature === c }}
              accessibilityLabel={lookOf(c).name}
              style={[styles.creature, creature === c && styles.creatureOn]}
            >
              <Collectible look={lookOf(c)} size={52} still />
              <Text style={styles.creatureName} numberOfLines={1}>
                {lookOf(c).name.replace(/^The /, '')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.label}>Hunt</Text>
        <View style={styles.chips}>
          {[undefined, ...hunts.map((h) => h.id)].map((id) => (
            <Pressable key={id ?? 'none'} onPress={() => setHuntId(id)} accessibilityRole="button" accessibilityState={{ selected: huntId === id }} style={[styles.chip, huntId === id && styles.chipOn]}>
              <Text style={styles.chipText}>{id ? huntNameOf(id) : 'No hunt'}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={until} onChangeText={setUntil} placeholder="Can be found until (2027-06-14), or leave empty" placeholderTextColor={color.moonFaint} style={styles.input} accessibilityLabel="End date" autoCapitalize="none" />
        <Pressable onPress={() => void makeSticker()} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.primary, busy && { opacity: 0.6 }, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>{busy ? 'One moment…' : 'Make sticker'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.h3}>New hunt</Text>
        <Text style={styles.body}>A set to collect, like “Night Market 2027: find all 6”. Make the hunt, then make its stickers with it chosen.</Text>
        <TextInput value={huntName} onChangeText={setHuntName} placeholder="Hunt name" placeholderTextColor={color.moonFaint} maxLength={HUNT_NAME_MAX} style={styles.input} accessibilityLabel="Hunt name" />
        <TextInput value={huntUntil} onChangeText={setHuntUntil} placeholder="Ends (2027-06-14), or leave empty" placeholderTextColor={color.moonFaint} style={styles.input} accessibilityLabel="Hunt end date" autoCapitalize="none" />
        <Pressable onPress={() => void makeHunt()} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>Make hunt</Text>
        </Pressable>
        <Text style={styles.body}>Or make the festival places kit: this hunt with a sticker for each spot people pass (the gates, porta potties, water, charging, the care tent, food, lost and found, the pick-up point, silent disco, the shuttle, the chill zone, the main stage, the campfire, the tents, the merch stand).</Text>
        <View style={styles.kitRow}>
          {PLACES_KIT.map((c) => (
            <Collectible key={c} look={lookOf(c)} size={30} still />
          ))}
        </View>
        <Pressable onPress={() => void makeKit()} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>Make the festival places kit</Text>
        </Pressable>
      </View>

      {hunts.map((h) => (
        <View key={h.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{h.name}</Text>
            <Text style={styles.rowSub}>
              Hunt · {live(h)} {live(h) === 1 ? 'sticker' : 'stickers'}
              {h.until ? ` · ${untilLine(h.until)}` : ''}
            </Text>
          </View>
          {h.items.length ? (
            <Pressable onPress={() => router.push({ pathname: '/sticker-sheet', params: { hunt: h.id, ...(orgId ? { org: orgId } : {}) } })} accessibilityRole="button" accessibilityLabel={`Print the ${h.name} stickers`} hitSlop={6}>
              <Text style={styles.action}>Print all</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <Text style={styles.h3}>Stickers{stickers ? ` · ${stickers.length}` : ''}</Text>
      {!stickers ? <ActivityIndicator color={color.glow} /> : stickers.length ? null : <Text style={styles.body}>No stickers yet.</Text>}
      {stickers?.map((s) => (
        <View key={s.code} style={styles.row}>
          <Collectible look={lookOf(s.creature)} size={44} still />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{s.name}</Text>
            <Text style={styles.rowSub}>
              {counts[s.code] === undefined ? '' : `Found by ${counts[s.code]} · `}
              {s.huntId ? `${huntNameOf(s.huntId) ?? 'A hunt'} · ` : ''}
              {s.until ? untilLine(s.until) : 'No end date'}
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => router.push({ pathname: '/sticker-sheet', params: { code: s.code, ...(orgId ? { org: orgId } : {}) } })} accessibilityRole="button" accessibilityLabel={`Print ${s.name}`} hitSlop={6}>
              <Text style={styles.action}>Print</Text>
            </Pressable>
            <Pressable onPress={() => void shareMessage(findLink(s), s.name)} accessibilityRole="button" accessibilityLabel={`Share the link for ${s.name}`} hitSlop={6}>
              <Text style={styles.action}>Link</Text>
            </Pressable>
            <Pressable onPress={() => takeDown(s)} accessibilityRole="button" accessibilityLabel={`Take down ${s.name}`} hitSlop={6}>
              <Text style={styles.danger}>Take down</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  kitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  wrap: { paddingHorizontal: space.lg, gap: space.md },
  lead: { ...type.body, color: color.moonDim },
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  h3: { ...type.headline, color: color.moon },
  body: { ...type.caption, color: color.moonDim },
  label: { ...type.label, color: color.moonDim, marginTop: space.xs },
  input: { ...type.body, color: color.moon, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  creatures: { gap: space.xs, paddingVertical: space.xs },
  creature: { width: 72, alignItems: 'center', padding: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: 'transparent' },
  creatureOn: { borderColor: color.glow, backgroundColor: 'rgba(169,124,255,0.12)' },
  creatureName: { ...type.caption, fontSize: 10, color: color.moonDim },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  chipOn: { borderColor: color.glow, backgroundColor: 'rgba(169,124,255,0.18)' },
  chipText: { ...type.label, color: color.moon },
  primary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glow, marginTop: space.xs },
  primaryText: { ...type.headline, color: color.night },
  secondary: { alignItems: 'center', paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: color.glass, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  secondaryText: { ...type.headline, color: color.moon },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.glass },
  rowTitle: { ...type.label, color: color.moon },
  rowSub: { ...type.caption, color: color.moonDim },
  actions: { alignItems: 'flex-end', gap: 6 },
  action: { ...type.label, color: color.glow },
  danger: { ...type.caption, color: '#FF8A8A' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});

/** A hunt's stickers still out there (taken-down ones left out). */
const live = (h: Hunt) => h.items.filter((i) => !i.gone).length;
