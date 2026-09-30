import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { builtInCatalog } from '../../../state/catalog';
import { artistPreview, festivalPreview, withPreview } from '../previews';

const WEB = 'https://afterglowmusic.app';
const page = readFileSync(join(__dirname, '../../../../public/index.html'), 'utf8');

describe('link previews', () => {
  it('describes a festival and an artist', () => {
    const edc = builtInCatalog.festival('edc-orlando-26')!;
    expect(festivalPreview(edc, WEB)).toEqual({
      path: 'festival/edc-orlando-26',
      title: 'EDC Orlando 2026 · Afterglow',
      description: 'Nov 6 to 8, Tinker Field, Orlando · 110 acts on the lineup. Find your sets on Afterglow.',
      url: 'https://afterglowmusic.app/festival/edc-orlando-26',
    });
    const a = builtInCatalog.artist('steve-aoki')!;
    expect(artistPreview(a, builtInCatalog.festivalsOf(a.id), WEB).description).toMatch(/^Playing .+\. Live sets and where they play, on Afterglow\.$/);
    expect(artistPreview(a, [], WEB).description).toBe('Live sets and where they play, on Afterglow.');
  });

  it('puts them into the site page, escaped, leaving the rest alone', () => {
    const out = withPreview(page, { path: 'x', title: 'Tom & "Jerry" <3 · Afterglow', description: 'A & B', url: `${WEB}/artist/x` });
    expect(out).toContain('<title>Tom &amp; &quot;Jerry&quot; &lt;3 · Afterglow</title>');
    expect(out).toContain('<meta property="og:title" content="Tom &amp; &quot;Jerry&quot; &lt;3 · Afterglow" />');
    expect(out).toContain('<meta property="og:description" content="A &amp; B" />');
    expect(out).toContain('<meta name="description" content="A &amp; B" />');
    expect(out).toContain(`<meta property="og:url" content="${WEB}/artist/x" />`);
    expect(out).toContain('<meta property="og:image" content="https://afterglowmusic.app/og.png" />');
    expect(out.length - page.length).toBeLessThan(400);
  });
});
