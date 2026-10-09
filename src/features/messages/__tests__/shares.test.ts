import { describe, expect, it } from '@jest/globals';
import { CHAT_MAX } from '../../social/models';
import { orderRecipients } from '../recipients';
import { parseShare, shareFromParams, shareLink, shareMessageText, shareNoun, shareParams, shareRoute, type ChatShare } from '../shares';

const WEB = 'https://afterglowmusic.app';

describe('shares in chats', () => {
  const all: ChatShare[] = [
    { kind: 'festival', id: 'edc-orlando-26' },
    { kind: 'festival', id: 'edc-orlando-26', picks: ['subtronics', 'fred-again'] },
    { kind: 'artist', id: 'subtronics' },
    { kind: 'clip', id: 'clip_42' },
    { kind: 'profile', handle: 'maya.lin' },
  ];

  it('makes a website link and reads it back, with the words around it', () => {
    for (const share of all) {
      expect(parseShare(shareLink(share, WEB), WEB)).toEqual({ share, caption: '' });
      expect(parseShare(shareMessageText(share, '  Same stage?  ', WEB), WEB)).toEqual({ share, caption: 'Same stage?' });
      expect(shareFromParams(shareParams(share))).toEqual(share);
    }
    expect(shareLink(all[1], WEB)).toBe('https://afterglowmusic.app/festival/edc-orlando-26?must=subtronics,fred-again');
    expect(shareLink(all[3], WEB)).toBe('https://afterglowmusic.app/?clip=clip_42');
  });

  it('leaves ordinary messages and other links alone', () => {
    expect(parseShare('see you at the big tree', WEB)).toBeUndefined();
    expect(parseShare('https://example.com/festival/x', WEB)).toBeUndefined();
    expect(parseShare('https://afterglowmusic.app/legal/privacy', WEB)).toBeUndefined();
    expect(parseShare('https://afterglowmusic.app.evil.com/festival/x', WEB)).toBeUndefined();
    expect(shareFromParams({ kind: 'festival', id: '../x' })).toBeUndefined();
    expect(shareFromParams({ kind: 'nope', id: 'x' })).toBeUndefined();
  });

  it('keeps a message within a chat message’s length, the link whole', () => {
    const text = shareMessageText(all[1], 'x'.repeat(1000), WEB);
    expect(text.length).toBeLessThanOrEqual(CHAT_MAX);
    expect(parseShare(text, WEB)?.share).toEqual(all[1]);
  });

  it('says what was sent, and where it opens', () => {
    expect(all.map(shareNoun)).toEqual(['a festival', 'must-sees', 'an artist', 'a live set', 'a profile']);
    expect(shareRoute(all[1])).toEqual({ pathname: '/festival/[id]', params: { id: 'edc-orlando-26', must: 'subtronics,fred-again' } });
    expect(shareRoute(all[3])).toEqual({ pathname: '/', params: { clip: 'clip_42' } });
    expect(shareRoute(all[4])).toEqual({ pathname: '/u/[handle]', params: { handle: 'maya.lin' } });
  });
});

describe('who "Send to" offers', () => {
  it('recent chats first, then close friends, friends and the other crews; nobody twice or blocked', () => {
    const list = orderRecipients({
      me: 'me',
      directChats: [
        { id: 'dm_a_me', latestAt: '2026-10-05T10:00:00Z' },
        { id: 'dm_b_me' },
        { id: 'dm_me_x', latestAt: '2026-10-05T12:00:00Z' },
      ],
      crews: [{ id: 'crew1', latestAt: '2026-10-05T11:00:00Z' }, { id: 'crew2' }],
      closeFriends: ['c', 'a'],
      friends: ['b', 'c', 'x', 'd'],
      blocked: new Set(['x']),
    });
    expect(list.map((r) => r.key)).toEqual(['c:crew1', 'p:a', 'p:c', 'p:b', 'p:d', 'c:crew2']);
    // Once the friends list is read, a past chat with someone no longer a friend both ways isn't offered.
    const later = orderRecipients({
      me: 'me',
      directChats: [{ id: 'dm_gone_me', latestAt: '2026-10-05T13:00:00Z' }],
      crews: [],
      closeFriends: [],
      friends: ['b'],
      friendsKnown: true,
      blocked: new Set(),
    });
    expect(later.map((r) => r.key)).toEqual(['p:b']);
  });
});

describe('places to stay in a chat', () => {
  const web = 'https://afterglowmusic.app';

  it('travels as the stays page link, for a festival or a show, with how many', () => {
    expect(shareLink({ kind: 'stay', id: 'edc-orlando-26', guests: 6 }, web)).toBe(`${web}/stay/edc-orlando-26?guests=6`);
    expect(shareLink({ kind: 'stay', id: 'show:edm-1' }, web)).toBe(`${web}/stay/show:edm-1`);
    expect(parseShare(`Need a place?\n${web}/stay/edc-orlando-26?guests=6`, web)).toEqual({ share: { kind: 'stay', id: 'edc-orlando-26', guests: 6 }, caption: 'Need a place?' });
    expect(parseShare(`${web}/stay/show:edm-1`, web)?.share).toEqual({ kind: 'stay', id: 'show:edm-1' });
    // One person, or too many: no count, or Stay22's most.
    expect(shareLink({ kind: 'stay', id: 'f', guests: 1 }, web)).toBe(`${web}/stay/f`);
    expect(shareLink({ kind: 'stay', id: 'f', guests: 40 }, web)).toBe(`${web}/stay/f?guests=16`);
    expect(shareRoute({ kind: 'stay', id: 'f', guests: 3 })).toEqual({ pathname: '/stay/[id]', params: { id: 'f', guests: '3' } });
    expect(shareFromParams(shareParams({ kind: 'stay', id: 'show:edm-1', guests: 5 }))).toEqual({ kind: 'stay', id: 'show:edm-1', guests: 5 });
  });
});
