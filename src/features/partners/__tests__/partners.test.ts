import { describe, expect, it } from '@jest/globals';
import { parseCatalogFile } from '../../../data/file';
import type { Festival } from '../../../data/models';
import { legalDocument, PARTNER_PRIVACY, PARTNER_TERMS } from '../../legal/documents';
import { prepChecklist, sectionNotes } from '../../prep/checklist';
import { AMAZON_NOTE, cleanShopLinks, earnsFrom, hasPartnerLinks, isAmazonLink, PARTNER_NOTE, partnerLinks, SHOP_NOTE, shopNotes } from '../partners';

const fest = (links?: Festival['links']) =>
  ({ id: 'f', name: 'F Fest', dates: '', location: '', lineup: [], days: [], stages: [], startDate: '2026-12-04', endDate: '2026-12-06', links }) as unknown as Festival;

const file = (festival: Record<string, unknown>) => ({
  version: 1,
  mode: 'add',
  artists: [{ id: 'a', name: 'A' }],
  festivals: [{ id: 'f', name: 'F', dates: 'Soon', location: 'Here', lineup: ['a'], days: [], ...festival }],
  clips: [],
});

describe('partner links', () => {
  it('knows Amazon links', () => {
    expect(isAmazonLink('https://www.amazon.com/dp/B0?tag=x-20')).toBe(true);
    expect(isAmazonLink('https://amazon.co.uk/dp/B0')).toBe(true);
    expect(isAmazonLink('https://amzn.to/3abc')).toBe(true);
    expect(isAmazonLink('https://notamazon.com/x')).toBe(false);
    expect(isAmazonLink('https://example.com/?u=amazon.com')).toBe(false);
  });

  it('only partner ticket links and stay links earn, and only before it’s over', () => {
    expect(earnsFrom(fest({ tickets: 'https://t.example.com' }), false)).toBe(false);
    expect(partnerLinks(fest({ tickets: 'https://t.example.com', ticketsPartner: true }), false)).toEqual({ tickets: 'https://t.example.com' });
    expect(earnsFrom(fest({ stay: 'https://stay.example.com' }), false)).toBe(true);
    expect(earnsFrom(fest({ stay: 'https://stay.example.com' }), true)).toBe(false);
  });

  it('keeps only https shop links and picks the right notices', () => {
    expect(cleanShopLinks({ earplugs: 'https://amzn.to/1', water: 'http://x.com', sun: 3 })).toEqual({ earplugs: 'https://amzn.to/1' });
    expect(shopNotes([])).toEqual([]);
    expect(shopNotes(['https://amzn.to/1'])).toEqual([AMAZON_NOTE]);
    expect(shopNotes(['https://amzn.to/1', 'https://brand.example.com'])).toEqual([AMAZON_NOTE, SHOP_NOTE]);
  });

  it('says whether the app has any partner link', () => {
    expect(hasPartnerLinks([fest({ tickets: 'https://t.example.com' })], {})).toBe(false);
    expect(hasPartnerLinks([fest({ stay: 'https://s.example.com' })], {})).toBe(true);
    expect(hasPartnerLinks([], { power: 'https://amzn.to/1' })).toBe(true);
  });
});

describe('partner links in the catalogue', () => {
  it('reads a stay link and a partner tickets link', () => {
    const { snapshot, problems } = parseCatalogFile(file({ tickets: 'https://t.example.com', ticketsPartner: true, stay: 'https://stay.example.com/f' }));
    expect(snapshot!.festivals[0].links).toEqual({ tickets: 'https://t.example.com', ticketsPartner: true, stay: 'https://stay.example.com/f' });
    expect(problems).toEqual([]);
  });

  it('ignores ticketsPartner without a tickets link, and bad stay links', () => {
    const { snapshot, problems } = parseCatalogFile(file({ ticketsPartner: true, stay: 'http://stay.example.com' }));
    expect(snapshot!.festivals[0].links).toBeUndefined();
    expect(problems).toEqual([
      'Festival "f": the stay link must start with https://, so it was ignored.',
      'Festival "f": "ticketsPartner" should be true, next to a "tickets" link, so it was ignored.',
    ]);
  });
});

describe('partner links on the Get ready list', () => {
  const base = { rated: 0, lineup: 0, stars: 0, remindersPossible: false, remindersOn: false, ticked: new Set<string>() };

  it('adds nothing without links', () => {
    const sections = prepChecklist({ ...base, festival: fest() });
    expect(sections.flatMap((s) => s.items).some((x) => x.link)).toBe(false);
    expect(sections.flatMap((s) => sectionNotes(s, fest()))).toEqual([]);
  });

  it('adds places to stay and shop links with their notices', () => {
    const f = fest({ stay: 'https://stay.example.com' });
    const sections = prepChecklist({ ...base, festival: f, shop: { earplugs: 'https://amzn.to/1' } });
    const before = sections.find((s) => s.title === 'Before you go')!;
    const pack = sections.find((s) => s.title === 'Pack')!;
    expect(before.items.find((x) => x.id === 'travel')!.link).toEqual({ url: 'https://stay.example.com', label: 'Places to stay nearby' });
    expect(pack.items.find((x) => x.id === 'earplugs')!.link).toEqual({ url: 'https://amzn.to/1', label: 'Shop' });
    expect(pack.items.find((x) => x.id === 'water')!.link).toBeUndefined();
    expect(sectionNotes(before, f)).toEqual([PARTNER_NOTE]);
    expect(sectionNotes(pack, f)).toEqual([AMAZON_NOTE]);
  });
});

describe('partner links in the legal pages', () => {
  const words = (id: 'terms' | 'privacy', partners?: boolean) => legalDocument(id, 'a@b.c', { partners }).sections.flatMap((s) => s.paragraphs);
  it('mentions them only once there are some', () => {
    expect(words('terms')).not.toContain(PARTNER_TERMS);
    expect(words('privacy')).not.toContain(PARTNER_PRIVACY);
    expect(words('terms', true)).toContain(PARTNER_TERMS);
    expect(words('privacy', true)).toContain(PARTNER_PRIVACY);
  });
});
