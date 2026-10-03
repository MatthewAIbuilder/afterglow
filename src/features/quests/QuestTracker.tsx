import { useEffect, useMemo, useRef, useState } from 'react';
import type { SoundTag } from '../../data/models';
import { notifyNow } from '../../lib/notifyNow';
import { useNow } from '../../lib/useNow';
import { useCatalog } from '../../state/catalog';
import { useCrews } from '../../state/crews';
import { useCrewUpdates } from '../../state/crewUpdates';
import { useFriendAdds } from '../../state/friendAdds';
import { useGoing } from '../../state/going';
import { useMemories } from '../../state/memories';
import { recordQuests, setQuestProgress, useQuests } from '../../state/quests';
import { useSocial } from '../../state/social';
import { useSprouts } from '../../state/sprouts';
import { useLoves } from '../../state/useLoves';
import { useWeekends } from '../../state/weekends';
import { newlyDone, QUESTS, questProgress } from './quests';

/**
 * Watches for side quests as they happen (a friend scanned at a set, a
 * crewmate at the same stage, a sunrise moment) and writes them down, with a
 * quiet phone notification when one is done. Renders nothing.
 */
export function QuestTracker() {
  const catalog = useCatalog();
  const { forYou } = useWeekends();
  const { going } = useGoing();
  const festivals = useMemo(() => catalog.festivals.filter((f) => going.includes(f.id)).map(forYou), [catalog.festivals, going, forYou]);
  const loves = useLoves();
  const social = useSocial();
  const me = social.user?.uid;
  const { adds } = useFriendAdds();
  const { memories } = useMemories();
  const { crews } = useCrews();
  const crewUpdates = useCrewUpdates();
  const { log, loaded } = useQuests();
  const { gifts, garden } = useSprouts();
  const sproutFacts = useMemo(
    () => ({ gave: gifts.map((g) => ({ at: g.at, picked: !!g.claimedBy })), got: garden.filter((g) => g.from).map((g) => g.at) }),
    [gifts, garden],
  );
  const now = useNow().getTime();

  // The sounds friends you scanned show on their profiles, read once each.
  const [sounds, setSounds] = useState<Record<string, SoundTag[]>>({});
  const asked = useRef(new Set<string>());
  const friends = useMemo(() => adds.filter((a) => a.state === 'added' && (!me || a.account === me)).map((a) => ({ uid: a.uid, at: a.at })), [adds, me]);
  useEffect(() => {
    for (const f of friends) {
      if (asked.current.has(f.uid)) continue;
      asked.current.add(f.uid);
      social.service
        .profileOf(f.uid)
        .then((p) => p && setSounds((s) => ({ ...s, [f.uid]: p.sounds })))
        .catch(() => asked.current.delete(f.uid));
    }
  }, [friends, social.service]);

  const updates = useMemo(() => crews.flatMap((c) => crewUpdates.updatesFor(c.id)), [crews, crewUpdates]);
  const spotsSetByMe = crews.filter((c) => !!me && crewUpdates.meetSpotFor(c.id)?.by === me).length;

  const progress = useMemo(
    () =>
      questProgress({
        festivals,
        artists: catalog.artists,
        friends,
        theirSounds: (uid) => sounds[uid],
        loves,
        me,
        memories,
        crews,
        updates,
        spotsSetByMe,
        sprouts: sproutFacts,
        now,
      }),
    [festivals, catalog.artists, friends, sounds, loves, me, memories, crews, updates, spotsSetByMe, sproutFacts, now],
  );

  useEffect(() => {
    setQuestProgress(progress);
    if (!loaded) return;
    const fresh = newlyDone(progress, log);
    if (!fresh.length) return;
    recordQuests(fresh);
    for (const [id] of fresh) {
      const q = QUESTS.find((x) => x.id === id);
      if (q) void notifyNow(`quest:${id}`, 'Side quest complete', `${q.title}. Claim your badge on your profile.`, '/profile?tab=badges');
    }
  }, [progress, log, loaded]);

  return null;
}
