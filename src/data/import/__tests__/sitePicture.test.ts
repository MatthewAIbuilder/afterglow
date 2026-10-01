import { describe, expect, it } from '@jest/globals';
import { BUILT_IN } from '../../bundled';
import { parseCatalogFile } from '../../file';
import { buildCatalog } from '../../merge';
import { sharePicture, siteName } from '../sitePicture';

const page = (head: string) => `<!doctype html><html><head><title>EDC Orlando</title>${head}</head><body>…</body></html>`;

describe('pictures from official sites', () => {
  it("reads the page's share picture, best tag first, whatever the attribute order", () => {
    expect(
      sharePicture(
        page(`<meta name="twitter:image" content="https://cdn.edc.com/tw.jpg"><meta content="https://cdn.edc.com/lineup.jpg?w=1200&amp;h=630" property="og:image" />`),
        'https://orlando.edc.com/',
      ),
    ).toBe('https://cdn.edc.com/lineup.jpg?w=1200&h=630');
    expect(sharePicture(page(`<meta name='twitter:image' content='https://cdn.edc.com/tw.jpg'>`), 'https://orlando.edc.com/')).toBe('https://cdn.edc.com/tw.jpg');
    expect(sharePicture(page(`<meta property="og:image:secure_url" content="https://a.example/s.jpg"><meta property="og:image" content="https://a.example/o.jpg">`), 'https://a.example/')).toBe(
      'https://a.example/s.jpg',
    );
  });

  it('resolves relative links against the page and keeps only real https pictures', () => {
    expect(sharePicture(page(`<meta property="og:image" content="/img/poster.png">`), 'https://orlando.edc.com/lineup/')).toBe('https://orlando.edc.com/img/poster.png');
    expect(sharePicture(page(`<meta property="og:image" content="http://insecure.example/p.jpg">`), 'https://orlando.edc.com/')).toBeUndefined();
    expect(sharePicture(page(`<meta property="og:image" content="https://a.example/logo.svg">`), 'https://a.example/')).toBeUndefined();
    expect(sharePicture(page(`<meta property="og:image" content="https://a.example/favicon-512.png">`), 'https://a.example/')).toBeUndefined();
    expect(sharePicture(page('<meta name="description" content="Tickets on sale">'), 'https://a.example/')).toBeUndefined();
  });

  it('names the site without www', () => {
    expect(siteName('https://www.aclfestival.com/lineup')).toBe('aclfestival.com');
    expect(siteName('https://orlando.edc.com/')).toBe('orlando.edc.com');
    expect(siteName('not a link')).toBeUndefined();
  });

  it("shows the site's picture as the festival's poster, credited, only for festivals with that site", () => {
    const file = parseCatalogFile({
      version: 1,
      sitePictures: { 'edc-orlando-26': 'https://cdn.edc.com/lineup.jpg', 'acl-26': 'https://cdn.acl.com/p.jpg', 'bad id!': 'https://x.example/p.jpg', 'eternal-nye-26': 'http://x.example/p.jpg' },
    });
    expect(file.sitePictures).toEqual({ 'edc-orlando-26': 'https://cdn.edc.com/lineup.jpg', 'acl-26': 'https://cdn.acl.com/p.jpg' });
    const built = buildCatalog(BUILT_IN.snapshot, file);
    expect(built.problems).toEqual([]);
    const edc = built.catalog.festivals.find((f) => f.id === 'edc-orlando-26');
    expect([edc?.posterImageUrl, edc?.posterFrom]).toEqual(['https://cdn.edc.com/lineup.jpg', 'orlando.edc.com']);
    // ACL has no official site in the catalogue, so a picture for it is ignored.
    expect(built.catalog.festivals.find((f) => f.id === 'acl-26')?.posterImageUrl).toBeUndefined();
  });
});
