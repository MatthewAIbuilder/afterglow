import { describe, expect, it } from '@jest/globals';
import { GUIDELINES } from '../../social/copy';
import { contactParagraph, isLegalDoc, LEGAL_DOCS, legalDocument, legalPath } from '../documents';

describe('legal pages', () => {
  it('every page has a title, a date and sections', () => {
    for (const id of LEGAL_DOCS) {
      const d = legalDocument(id);
      expect(d.title.length).toBeGreaterThan(5);
      expect(d.updated).toMatch(/2026/);
      expect(d.sections.length).toBeGreaterThan(0);
      expect(d.sections.every((s) => s.paragraphs.length > 0)).toBe(true);
    }
    expect(legalPath('privacy')).toBe('/legal/privacy');
    expect(isLegalDoc('terms')).toBe(true);
    expect(isLegalDoc('cookies')).toBe(false);
  });

  it('the guidelines page carries the same guidelines people agree to', () => {
    expect(legalDocument('guidelines').sections[0].paragraphs).toEqual(GUIDELINES);
  });

  it('says how to reach the team, with or without a support email', () => {
    expect(contactParagraph('help@example.com')).toContain('help@example.com');
    expect(contactParagraph('')).toContain('Report');
    expect(JSON.stringify(legalDocument('privacy', 'help@example.com'))).toContain('help@example.com');
  });

  it('the privacy policy names what leaves the phone and what doesn’t', () => {
    const text = JSON.stringify(legalDocument('privacy'));
    for (const must of ['stay on your phone', 'Firebase', 'YouTube', 'Delete account', 'under 18', 'don’t sell']) expect(text).toContain(must);
  });
});
