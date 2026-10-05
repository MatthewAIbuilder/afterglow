import { otherInRoom } from '../social/models';

/** Someone (or a crew) to send something to. */
export type Recipient = { key: string; kind: 'person'; uid: string } | { key: string; kind: 'crew'; crewId: string };

/** People and crews offered on "Send to", at most. */
export const RECIPIENTS_MAX = 40;

type Room = { id: string; latestAt?: string };

/**
 * Who "Send to" offers, in order: the chats you've been talking in (latest
 * first), then close friends, then other friends (people you follow who
 * follow you back), then the rest of your crews. Nobody twice, nobody
 * blocked. Pure.
 */
export function orderRecipients(input: {
  me: string;
  directChats: readonly Room[];
  crews: readonly Room[];
  closeFriends: readonly string[];
  friends: readonly string[];
  blocked: ReadonlySet<string>;
}): Recipient[] {
  const out: Recipient[] = [];
  const seen = new Set<string>();
  const person = (uid: string) => {
    if (uid === input.me || input.blocked.has(uid) || seen.has(uid)) return;
    seen.add(uid);
    out.push({ key: `p:${uid}`, kind: 'person', uid });
  };
  const crew = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ key: `c:${id}`, kind: 'crew', crewId: id });
  };
  const talked = [
    ...input.directChats.filter((d) => d.latestAt).map((d) => ({ at: d.latestAt!, add: () => person(otherInRoom(d.id, input.me)) })),
    ...input.crews.filter((c) => c.latestAt).map((c) => ({ at: c.latestAt!, add: () => crew(c.id) })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  for (const t of talked) t.add();
  for (const uid of input.closeFriends) person(uid);
  for (const uid of input.friends) person(uid);
  for (const c of input.crews) crew(c.id);
  return out.slice(0, RECIPIENTS_MAX);
}
