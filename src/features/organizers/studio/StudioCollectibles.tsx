import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import { showAlert } from '../../../lib/dialog';
import { haptic } from '../../../lib/haptics';
import { shareMessage } from '../../../lib/share';
import { useToday } from '../../../lib/useToday';
import { useSocial } from '../../../state/social';
import { color, radius, space, type, glowA } from '../../../theme/tokens';
import { AdminStickers } from '../../admin/AdminStickers';
import { localDay } from '../../artists/shows';
import { pinLook } from '../../badges/badges';
import { EnamelPin } from '../../badges/EnamelPin';
import { CODE_LENGTH, codeFrom, findLink, GIFT_NOTE_MAX, lookOf, parseEndDate, type Sticker, STICKER_NAME_MAX, untilLine } from '../../finds/finds';
import { PLACE_CREATURES, SOUND_CREATURES } from '../../sprouts/artistLook';
import { Collectible } from '../../sprouts/Collectible';
import { socialErrorKind, SOCIAL_ERROR_COPY } from '../../social/service';
import { DESIGN_FOR, eventFestivalIdOf, giftShareText, type Org, REQUEST_TEXT_MAX, splitEvents } from '../organizers';
import { RequestList, useOrgRequests } from './StudioPromote';
import { Action, Button, Card, Chip, Field, studio } from './ui';

type Part = 'badges' | 'gifts' | 'stickers' | 'designs';
const CREATURES: string[] = ['flask', ...[...PLACE_CREATURES, ...SOUND_CREATURES].filter((c) => c !== 'flask')];

function newCode(): string {
  try {
    return codeFrom(Crypto.getRandomBytes(CODE_LENGTH));
  } catch {
    return codeFrom(Array.from({ length: CODE_LENGTH }, () => Math.floor(Math.random() * 256)));
  }
}

/**
 * The studio's Collectibles tab: the organizer's badge (with its mark) and
 * each event's, its creature, gifts sent as links, stickers with QR codes
 * to print and hide at events, and asking Afterglow for a new design.
 */
export function StudioCollectibles({ org }: { org: Org }) {
  const [part, setPart] = useState<Part>('badges');
  return (
    <View style={studio.wrap}>
      <View style={studio.chips}>
        <Chip label="Badges" on={part === 'badges'} onPress={() => setPart('badges')} />
        <Chip label="Gifts" on={part === 'gifts'} onPress={() => setPart('gifts')} />
        <Chip label="Stickers and QR codes" on={part === 'stickers'} onPress={() => setPart('stickers')} />
        <Chip label="Request a design" on={part === 'designs'} onPress={() => setPart('designs')} />
      </View>
      {part === 'badges' ? <Badges org={org} /> : part === 'gifts' ? <Gifts org={org} /> : part === 'stickers' ? <AdminStickers orgId={org.id} /> : <Designs org={org} />}
    </View>
  );
}

function Badges({ org }: { org: Org }) {
  const today = localDay(useToday());
  const { upcoming, past } = splitEvents(org, today);
  const own = useMemo(() => pinLook({ id: org.id, name: org.name, location: '', organizer: org.id }), [org.id, org.name]);
  const events = [...upcoming, ...past].slice(0, 9);
  return (
    <>
      <Card title="Your badge" sub="Everyone who films at one of your events and shares it collects that event’s badge, wearing your mark. It shows on their profile, and they can share it.">
        <View style={{ alignItems: 'center' }}>
          <EnamelPin look={own} size={200} />
        </View>
      </Card>
      {events.length ? (
        <Card title="Your events’ badges">
          <View style={s.grid}>
            {events.map((e) => (
              <View key={e.id} style={s.cell}>
                <EnamelPin look={pinLook({ id: eventFestivalIdOf(org, e), name: e.name, location: [e.venue, e.city].filter(Boolean).join(', '), startDate: e.date, endDate: e.endDate ?? e.date, organizer: org.id })} size={96} />
                <Text style={studio.rowSub} numberOfLines={1}>
                  {e.name}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      {org.mark === 'alchemy' ? (
        <Card title={lookOf('flask').name} sub="Your creature. People collect it from your stickers and gifts, and it lives in their garden.">
          <View style={{ alignItems: 'center' }}>
            <Collectible look={lookOf('flask')} size={160} still={false} />
          </View>
        </Card>
      ) : null}
    </>
  );
}

/**
 * Gifts: a collectible sent as a link (in a message, a story, an email to
 * ticket holders) rather than printed. Anyone who opens it collects it, until
 * its end date. Each one is a sticker marked as a gift, with a few words.
 */
function Gifts({ org }: { org: Org }) {
  const { service } = useSocial();
  const [gifts, setGifts] = useState<Sticker[] | undefined>();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [until, setUntil] = useState('');
  const [creature, setCreature] = useState(CREATURES[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [all, c] = await Promise.all([service.orgStickers(org.id, 200), service.orgFinds(org.id).catch(() => ({}) as Record<string, number>)]);
      setGifts(all.filter((x) => x.gift));
      setCounts(c);
    } catch {
      setGifts((x) => x ?? []);
    }
  }, [service, org.id]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const share = (g: Sticker) => void shareMessage(giftShareText(org.name, g.note, findLink(g)), g.name);
  const make = async () => {
    const end = parseEndDate(until);
    if (!name.trim()) return showAlert('Give the gift a name', 'Like “Thank you for Transmutation”.');
    if (end === 'bad') return showAlert('That end date doesn’t look right', 'Write it as year-month-day, like 2026-12-01, or leave it empty.');
    setBusy(true);
    try {
      const g = await service.addSticker({ code: newCode(), name: name.trim(), creature, orgId: org.id, gift: true, ...(note.trim() ? { note: note.trim() } : {}), ...(end !== undefined ? { until: end } : {}) });
      haptic.settle();
      setName('');
      setNote('');
      setUntil('');
      await load();
      share(g);
    } catch (e) {
      showAlert('Couldn’t make the gift', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setBusy(false);
    }
  };
  const takeDown = (g: Sticker) =>
    showAlert(`Stop “${g.name}”?`, 'Its link stops working for anyone who hasn’t opened it yet. People who collected it keep it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop it', style: 'destructive', onPress: () => void service.deleteSticker(g.code).then(load, () => {}) },
    ]);

  return (
    <>
      <Card title="Send a gift" sub="A collectible people get from a link: send it to everyone who came, post it in your story, or put it in your ticket emails. Anyone who opens it collects it (in the app, or on the website first).">
        <Field label="Name" value={name} onChangeText={setName} placeholder="Like Thank you for Transmutation" maxLength={STICKER_NAME_MAX} />
        <Field label="A few words" value={note} onChangeText={setNote} placeholder="Shown with the link (optional)" multiline maxLength={GIFT_NOTE_MAX} />
        <Text style={studio.muted}>Creature</Text>
        <CreaturePicker value={creature} onChange={setCreature} />
        <Field label="Can be collected until" value={until} onChangeText={setUntil} placeholder="2026-12-01, or leave empty" autoCapitalize="none" />
        <Button label="Make the gift and share its link" busy={busy} onPress={() => void make()} />
      </Card>
      <Text style={studio.h3}>Gifts{gifts ? ` · ${gifts.length}` : ''}</Text>
      {gifts && !gifts.length ? <Text style={studio.muted}>No gifts yet.</Text> : null}
      {gifts?.map((g) => (
        <View key={g.code} style={studio.row}>
          <Collectible look={lookOf(g.creature)} size={44} still />
          <View style={{ flex: 1 }}>
            <Text style={studio.rowTitle}>{g.name}</Text>
            <Text style={studio.rowSub}>
              Collected by {counts[g.code] ?? 0}
              {g.until ? ` · ${untilLine(g.until)}` : ''}
            </Text>
          </View>
          <View style={studio.actions}>
            <Action label="Share link" onPress={() => share(g)} a11y={`Share the link for ${g.name}`} />
            <Action label="Stop" danger onPress={() => takeDown(g)} a11y={`Stop ${g.name}`} />
          </View>
        </View>
      ))}
    </>
  );
}

export function CreaturePicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.creatures}>
      {CREATURES.map((c) => (
        <Pressable
          key={c}
          onPress={() => {
            haptic.select();
            onChange(c);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: value === c }}
          accessibilityLabel={lookOf(c).name}
          style={[s.creature, value === c && s.creatureOn]}
        >
          <Collectible look={lookOf(c)} size={52} still />
          <Text style={s.creatureName} numberOfLines={1}>
            {lookOf(c).name.replace(/^The /, '')}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Ask Afterglow to design something new: a badge, a sticker, a creature, a gift, a flyer. */
function Designs({ org }: { org: Org }) {
  const { requests, sendRequest } = useOrgRequests(org.id);
  const [about, setAbout] = useState<string>(DESIGN_FOR[0]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return showAlert('Tell us what you have in mind', 'A few words on the idea, colours, where it will be used, and when you need it.');
    setBusy(true);
    try {
      await sendRequest({ orgId: org.id, kind: 'design', about, text: text.trim() });
      haptic.settle();
      setText('');
      showAlert('Sent to Afterglow', 'We’ll reply here.');
    } catch (e) {
      showAlert('Couldn’t send that', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Card title="Request a design" sub="Want your own badge, sticker, creature or gift drawn for an event? Tell us the idea and Afterglow designs it with you.">
        <View style={studio.chips}>
          {DESIGN_FOR.map((d) => (
            <Chip key={d} label={d} on={about === d} onPress={() => setAbout(d)} />
          ))}
        </View>
        <Field label="The idea" value={text} onChangeText={setText} placeholder="What it should show, colours, the event, when you need it" multiline maxLength={REQUEST_TEXT_MAX} />
        <Button label="Send request" busy={busy} onPress={() => void send()} />
      </Card>
      <RequestList requests={requests} org={org} kinds={['design', 'gift', 'other']} />
    </>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  cell: { width: '31%', alignItems: 'center', gap: 4 },
  creatures: { gap: space.xs, paddingVertical: space.xs },
  creature: { width: 72, alignItems: 'center', padding: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: 'transparent' },
  creatureOn: { borderColor: color.glow, backgroundColor: glowA(0.12) },
  creatureName: { ...type.caption, fontSize: 10, color: color.moonDim },
});
