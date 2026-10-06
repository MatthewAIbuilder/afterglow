import { describe, expect, it } from '@jest/globals';
import { createCatalog } from '../../../data/catalog';
import { MOCK_SNAPSHOT } from '../../../data/mock';
import { listenLinks } from '../../taste/listen';
import { clipMedia, type SoundCloudMedia } from '../media';
import {
  artistOfCard,
  embedUrl,
  isSoundCloudClip,
  parseSoundCloudMessage,
  reactedCards,
  SOUNDCLOUD_TITLE,
  soundcloudClip,
  soundcloudClips,
  soundcloudPlayerHtml,
} from '../soundcloud';

const catalog = createCatalog({
  ...MOCK_SNAPSHOT,
  soundcloud: {
    illenium: { url: 'https://soundcloud.com/illenium', name: 'ILLENIUM', image: 'https://i1.sndcdn.com/avatars-1-t500x500.jpg' },
    levity: { url: 'https://soundcloud.com/levity' },
  },
});

describe('SoundCloud cards', () => {
  it('one card per artist with a page, filed under a festival they play', () => {
    const cards = soundcloudClips(catalog);
    expect(cards.map((c) => c.id)).toEqual(['soundcloud:illenium', 'soundcloud:levity']);
    expect(cards[0]).toMatchObject({ artistId: 'illenium', title: SOUNDCLOUD_TITLE, festivalId: catalog.festivalsOf('illenium')[0].id });
    expect(isSoundCloudClip(cards[0])).toBe(true);
    expect(soundcloudClips(catalog, (id) => id === 'levity').map((c) => c.artistId)).toEqual(['levity']);
  });

  it('knows whose card an id is', () => {
    expect(artistOfCard('soundcloud:levity')).toBe('levity');
    expect(artistOfCard('soundcloud:')).toBeUndefined();
    expect(artistOfCard('c1')).toBeUndefined();
  });

  it('cards you reacted to keep counting for the artist, even once their page is gone', () => {
    const cards = reactedCards(['soundcloud:levity', 'soundcloud:subtronics', 'soundcloud:nobody', 'c1', 'soundcloud:illenium'], catalog, (id) => !!catalog.artist(id), new Set(['soundcloud:illenium']));
    expect(cards.map((c) => [c.id, c.artistId, !!c.source])).toEqual([
      ['soundcloud:levity', 'levity', true],
      ['soundcloud:subtronics', 'subtronics', false],
    ]);
  });

  it('plays in SoundCloud’s own player, with the artist’s photo first', () => {
    const card = soundcloudClip('illenium', catalog.soundcloud.illenium);
    const m = clipMedia(card, 'https://example.com/illenium.jpg') as SoundCloudMedia;
    expect(m.provider).toBe('soundcloud');
    expect(m.posterUrl).toBe('https://example.com/illenium.jpg');
    expect(m.externalUrl).toBe('https://soundcloud.com/illenium');
    expect(m.credit).toBe('On SoundCloud');
    expect((clipMedia(card) as SoundCloudMedia).posterUrl).toBe('https://i1.sndcdn.com/avatars-1-t500x500.jpg');
    expect(clipMedia({ ...card, source: { provider: 'soundcloud', url: 'https://evil.com/x' } })).toBeUndefined();
  });

  it('builds the official embed link', () => {
    expect(embedUrl('https://soundcloud.com/john-summit', { autoPlay: true, accent: '#A97CFF' })).toBe(
      'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fjohn-summit&color=a97cff&auto_play=true&visual=true&show_comments=false&hide_related=true&show_reposts=false&show_teaser=false',
    );
    expect(embedUrl('https://soundcloud.com/x', { autoPlay: false, accent: 'not a colour' })).toContain('color=a97cff&auto_play=false');
  });

  it('the player page loads the embed and SoundCloud’s widget controls', () => {
    const html = soundcloudPlayerHtml('https://soundcloud.com/levity', { autoPlay: false, accent: '#A97CFF' });
    expect(html).toContain('"https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Flevity');
    expect(html).toContain('<script src="https://w.soundcloud.com/player/api.js"');
    expect(html).toContain('window.afterglow');
  });

  it('reads the player page’s messages, and nothing else', () => {
    expect(parseSoundCloudMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(parseSoundCloudMessage('{"type":"progress","share":1.4}')).toEqual({ type: 'progress', share: 1 });
    expect(parseSoundCloudMessage('{"type":"progress","share":"x"}')).toBeUndefined();
    expect(parseSoundCloudMessage('{"type":"other"}')).toBeUndefined();
    expect(parseSoundCloudMessage('not json')).toBeUndefined();
    expect(parseSoundCloudMessage(42)).toBeUndefined();
  });
});

describe('Listen on an artist page', () => {
  it('puts their own SoundCloud page first when there is one', () => {
    expect(listenLinks('Levity', 'https://soundcloud.com/levity').map((l) => l.service)).toEqual(['SoundCloud', 'YouTube', 'Spotify']);
    expect(listenLinks('Levity', 'https://soundcloud.com/levity')[0].url).toBe('https://soundcloud.com/levity');
    expect(listenLinks('Levity').map((l) => l.service)).toEqual(['YouTube', 'Spotify']);
  });
});
