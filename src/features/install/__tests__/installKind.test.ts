import { describe, expect, it } from '@jest/globals';
import { INSTALL_SNOOZE_MS, installKind, isIOS, snoozed, type InstallEnv } from '../installKind';

const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CHROME_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1';
const INSTAGRAM_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.20.113 (iPhone14,5; iOS 17_5)';
const TIKTOK_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.1.0 BytedanceWebview/d8a21c6';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const FIREFOX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0';
const ANDROID_WEBVIEW = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const env = (over: Partial<InstallEnv>): InstallEnv => ({ userAgent: MAC_CHROME, maxTouchPoints: 0, standalone: false, canPrompt: false, ...over });

describe('installKind', () => {
  it('offers nothing once Afterglow is opened from the home screen', () => {
    expect(installKind(env({ userAgent: SAFARI_IPHONE, standalone: true }))).toBe('installed');
    expect(installKind(env({ userAgent: CHROME_ANDROID, standalone: true, canPrompt: true }))).toBe('installed');
  });

  it('shows the Share steps on an iPhone in Safari or Chrome', () => {
    expect(installKind(env({ userAgent: SAFARI_IPHONE, maxTouchPoints: 5 }))).toBe('ios-safari');
    expect(installKind(env({ userAgent: CHROME_IPHONE, maxTouchPoints: 5 }))).toBe('ios-safari');
  });

  it('tells an iPad that calls itself a Mac the same as an iPhone', () => {
    expect(installKind(env({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 }))).toBe('ios-safari');
    // A real Mac has no touch screen.
    expect(installKind(env({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0 }))).toBe('none');
  });

  it('says to open Safari first from inside Instagram, TikTok and the like', () => {
    expect(installKind(env({ userAgent: INSTAGRAM_IPHONE, maxTouchPoints: 5 }))).toBe('ios-other-app');
    expect(installKind(env({ userAgent: TIKTOK_IPHONE, maxTouchPoints: 5 }))).toBe('ios-other-app');
  });

  it('uses the browser’s own prompt when it gave us one', () => {
    expect(installKind(env({ userAgent: CHROME_ANDROID, maxTouchPoints: 5, canPrompt: true }))).toBe('prompt');
    expect(installKind(env({ canPrompt: true }))).toBe('prompt');
  });

  it('points an Android browser with no prompt at its menu', () => {
    expect(installKind(env({ userAgent: FIREFOX_ANDROID, maxTouchPoints: 5 }))).toBe('menu');
    expect(installKind(env({ userAgent: CHROME_ANDROID, maxTouchPoints: 5 }))).toBe('menu');
  });

  it('stays away from an Android app’s own web view and from computers with no prompt', () => {
    expect(installKind(env({ userAgent: ANDROID_WEBVIEW, maxTouchPoints: 5 }))).toBe('none');
    expect(installKind(env({}))).toBe('none');
  });

  it('knows an iPhone, an iPod and a touch-screen Mac-looking iPad', () => {
    expect(isIOS(SAFARI_IPHONE, 5)).toBe(true);
    expect(isIOS('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)', 5)).toBe(true);
    expect(isIOS(IPAD_AS_MAC, 5)).toBe(true);
    expect(isIOS(CHROME_ANDROID, 5)).toBe(false);
    expect(isIOS(MAC_CHROME, 0)).toBe(false);
  });
});

describe('snoozed', () => {
  const now = Date.UTC(2026, 10, 5);
  it('hides the card for two weeks after Not now, then lets it back once', () => {
    expect(snoozed(undefined, now)).toBe(false);
    expect(snoozed(now - 1000, now)).toBe(true);
    expect(snoozed(now - INSTALL_SNOOZE_MS + 1, now)).toBe(true);
    expect(snoozed(now - INSTALL_SNOOZE_MS, now)).toBe(false);
  });

  it('ignores a time that makes no sense (a bad or future value never hides the card for good)', () => {
    expect(snoozed(Number.NaN, now)).toBe(false);
    expect(snoozed(now + 10 * INSTALL_SNOOZE_MS, now)).toBe(false);
  });
});
