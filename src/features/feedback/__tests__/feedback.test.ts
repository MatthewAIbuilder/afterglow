import { describe, expect, it } from '@jest/globals';
import { SUPPORT_MAX } from '../../social/models';
import { cleanPage, feedbackMail, feedbackMessage, isFeedbackKind } from '../feedback';

describe('feedback from any page', () => {
  it('keeps only an app address as the page', () => {
    expect(cleanPage('/festival/edc-orlando-26')).toBe('/festival/edc-orlando-26');
    expect(cleanPage('/festival/edc-orlando-26?must=a,b')).toBe('/festival/edc-orlando-26');
    expect(cleanPage('/(tabs)/profile')).toBe('/(tabs)/profile');
    expect(cleanPage('https://evil.example')).toBeUndefined();
    expect(cleanPage('/<script>')).toBeUndefined();
    expect(cleanPage(undefined)).toBeUndefined();
  });

  it('adds the page on its own last line, and never loses it to a long message', () => {
    expect(feedbackMessage('  The map is blank  ', '/festival-map')).toBe('The map is blank\n\n— From /festival-map');
    expect(feedbackMessage('No page', undefined)).toBe('No page');
    const long = feedbackMessage('x'.repeat(5000), '/settings');
    expect(long.length).toBe(SUPPORT_MAX);
    expect(long.endsWith('— From /settings')).toBe(true);
  });

  it('writes an email for someone signed out, and knows its two kinds', () => {
    expect(feedbackMail('hi@afterglowmusic.app', 'idea', '/shows')).toBe('mailto:hi@afterglowmusic.app?subject=Afterglow%20idea%20(%2Fshows)');
    expect(isFeedbackKind('bug')).toBe(true);
    expect(isFeedbackKind('help')).toBe(false);
  });
});
