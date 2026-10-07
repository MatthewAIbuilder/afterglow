import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../components/GlassTabBar';
import { NightSky } from '../../components/NightSky';
import { PageTitle } from '../../components/PageTitle';
import { ChevronIcon } from '../../components/TabIcons';
import { showAlert } from '../../lib/dialog';
import { haptic } from '../../lib/haptics';
import { useToday } from '../../lib/useToday';
import { useCatalog } from '../../state/catalog';
import { useCrewChat } from '../../state/crewChat';
import { useSocial } from '../../state/social';
import { color, radius, space, type } from '../../theme/tokens';
import { localDay } from '../artists/shows';
import type { Sticker } from '../finds/finds';
import { MessagesList } from '../friends/MessagesList';
import { SOCIAL_ERROR_COPY, socialErrorKind } from '../social/service';
import { OrgLogo } from './OrgMark';
import { cleanPostInput, type Org, orgListings, type OrgPost, POST_TEXT_MAX } from './organizers';
import { Button, Card, Chip, Field, studio } from './studio/ui';

/** Updates listed under the form. */
const POSTS_SHOWN = 10;

/**
 * The Friends tab of an event organizer's account, as Messages: an update to
 * everyone who follows it (with one of its events or a gift attached), the
 * updates it sent, and its inbox: anyone may message an organizer, and it
 * answers here. Its notes to Afterglow HQ stay in the studio. In English,
 * like the studio.
 */
export function OrgMessages({ org }: { org: Org }) {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  return (
    <View style={styles.root}>
      <PageTitle title="Messages" />
      <NightSky />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: tabSpace + space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.head}>
          <OrgLogo org={org} width={150} />
          <Text style={styles.title} accessibilityRole="header">
            Messages
          </Text>
        </View>
        <Inbox />
        <View style={studio.wrap}>
          <Updates org={org} />
        </View>
        <Pressable
          onPress={() => {
            haptic.select();
            router.push('/studio');
          }}
          accessibilityRole="button"
          accessibilityLabel="Message Afterglow HQ from your studio"
          style={({ pressed }) => [styles.hq, pressed && { opacity: 0.8 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={studio.rowTitle}>Afterglow HQ</Text>
            <Text style={studio.rowSub}>Requests and notes to the Afterglow team are in your studio, under Messages.</Text>
          </View>
          <ChevronIcon color={color.moonFaint} size={12} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** Its 1-to-1 chats, newest first (the Friends tab's list), or what lands here. */
function Inbox() {
  const { directChats } = useCrewChat();
  if (!directChats.length)
    return (
      <View style={studio.wrap}>
        <Card title="Inbox" sub="Anyone on Afterglow can message you from your page or profile, no following needed. Their messages land here, and you answer them here." />
      </View>
    );
  return <MessagesList directOnly />;
}

/** Write to everyone who follows it, and the updates it already sent. */
function Updates({ org }: { org: Org }) {
  const { service } = useSocial();
  const catalog = useCatalog();
  const today = localDay(useToday());
  const look = useMemo(() => ({ festival: catalog.festival, show: (id: string) => catalog.shows.find((x) => x.id === id) }), [catalog]);
  // Its coming events with a page to open (its own, and the festivals it claimed).
  const events = useMemo(() => orgListings(org, look, today).upcoming.filter((l) => l.href.startsWith('/festival/')), [org, look, today]);
  const [text, setText] = useState('');
  const [festivalId, setFestivalId] = useState<string>();
  const [gift, setGift] = useState<Sticker>();
  const [busy, setBusy] = useState(false);
  const [gifts, setGifts] = useState<Sticker[]>([]);
  const [posts, setPosts] = useState<OrgPost[]>();

  const load = useCallback(async () => {
    const [stickers, sent] = await Promise.all([service.orgStickers(org.id, 200).catch(() => [] as Sticker[]), service.orgPosts([org.id], POSTS_SHOWN).catch(() => [] as OrgPost[])]);
    setGifts(stickers.filter((g) => g.gift && !g.takenDownAt));
    setPosts(sent);
  }, [service, org.id]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const send = async () => {
    const input = cleanPostInput({ text, festivalId, gift: gift?.code, giftName: gift?.name });
    if (!input) return showAlert('Write a few words first', 'Like “Doors at 11. See you down there.”');
    setBusy(true);
    try {
      const post = await service.postOrgUpdate(org.id, input);
      haptic.celebrate();
      setPosts((p) => [post, ...(p ?? [])].slice(0, POSTS_SHOWN));
      setText('');
      setFestivalId(undefined);
      setGift(undefined);
      showAlert('Sent to your followers', 'They’ll see it in their notifications.');
    } catch (e) {
      showAlert('Couldn’t send the update', SOCIAL_ERROR_COPY[socialErrorKind(e)]);
    }
    setBusy(false);
  };

  const remove = (p: OrgPost) =>
    showAlert('Take this update back?', 'Your followers won’t see it any more.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Take it back',
        style: 'destructive',
        onPress: () =>
          void service
            .deleteOrgPost(p.id)
            .then(() => setPosts((list) => list?.filter((x) => x.id !== p.id)))
            .catch((e) => showAlert('Couldn’t take it back', SOCIAL_ERROR_COPY[socialErrorKind(e)])),
      },
    ]);

  const eventName = (id?: string) => (id ? (events.find((l) => l.href === `/festival/${id}`)?.name ?? catalog.festival(id)?.name) : undefined);
  return (
    <>
      <Card title="Send an update to your followers" sub="Everyone who follows you sees it in their notifications. Add one of your events, or a gift: each follower who opens it collects your creature for their garden.">
        <Field label="Your update" value={text} onChangeText={setText} multiline maxLength={POST_TEXT_MAX} placeholder="Doors at 11. See you down there." hint={`${text.trim().length}/${POST_TEXT_MAX}`} />
        {events.length ? (
          <>
            <Text style={styles.label}>Add an event</Text>
            <View style={studio.chips}>
              {events.slice(0, 8).map((l) => {
                const id = l.href.slice('/festival/'.length);
                return <Chip key={l.key} label={l.name} on={festivalId === id} onPress={() => setFestivalId((cur) => (cur === id ? undefined : id))} a11y={`Add ${l.name}`} />;
              })}
            </View>
          </>
        ) : null}
        {gifts.length ? (
          <>
            <Text style={styles.label}>Add a gift</Text>
            <View style={studio.chips}>
              {gifts.slice(0, 8).map((g) => (
                <Chip key={g.code} label={g.name} on={gift?.code === g.code} onPress={() => setGift((cur) => (cur?.code === g.code ? undefined : g))} a11y={`Add the gift ${g.name}`} />
              ))}
            </View>
          </>
        ) : (
          <Text style={studio.muted}>Make a gift under Collectibles in your studio to send one with an update.</Text>
        )}
        <Button label="Send to your followers" busy={busy} onPress={() => void send()} />
      </Card>
      <Text style={studio.h3}>Your updates{posts?.length ? ` · ${posts.length}` : ''}</Text>
      {posts && !posts.length ? <Text style={studio.muted}>Nothing sent yet.</Text> : null}
      {posts?.map((p) => {
        const extra = [eventName(p.festivalId), p.giftName ? `Gift: ${p.giftName}` : undefined].filter(Boolean).join(' · ');
        return (
          <View key={p.id} style={studio.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.post}>{p.text}</Text>
              {extra ? <Text style={studio.rowSub}>{extra}</Text> : null}
            </View>
            <Pressable onPress={() => remove(p)} accessibilityRole="button" accessibilityLabel={`Take back “${p.text.slice(0, 40)}”`} hitSlop={8}>
              <Text style={styles.remove}>Take back</Text>
            </Pressable>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.night },
  head: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl },
  title: { ...type.largeTitle, color: color.moon },
  label: { ...type.label, color: color.moonDim, marginTop: space.xs },
  post: { ...type.body, color: color.moon },
  remove: { ...type.label, color: color.coral },
  hq: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginHorizontal: space.lg, padding: space.md, borderRadius: radius.md, backgroundColor: color.glass },
});
