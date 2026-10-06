import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { mailtoLink } from '../../features/admin/admin';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { forgetGoers } from '../../features/social/useGoers';
import { forgetGuestView } from '../../state/adminView';
import { renderApp } from './appRoutes';

/** The support account's dashboard and contacting support, through the real routes with the in-memory backend. */
let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const network = jest.requireMock<{ __setState: (s: { isConnected?: boolean; isInternetReachable?: boolean }) => void }>('expo-network');
const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
async function person(handle: string, name: string) {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
}
const as = (handle: string) => s().signIn(`${handle}@example.com`, 'password123');
const at = (h: number, m = 0) => new Date(2026, 10, 7, h, m);

beforeEach(async () => {
  jest.useFakeTimers({ now: at(12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
  forgetGoers();
  forgetGuestView();
  network.__setState({ isConnected: true, isInternetReachable: true });
});
afterEach(() => {
  network.__setState({ isConnected: true, isInternetReachable: true });
});

const SUPPORT = 'afterglowmusic.support@gmail.com';
async function supportAccount(verified = true) {
  if (verified) mockSocial.verified.add(SUPPORT);
  await s().signUp(SUPPORT, 'password123');
}

describe('the dashboard numbers', () => {
  it('counts who opened the app, who is active and what they shared, across every view', async () => {
    // Maya opens the app today: the app notes it, and only it (not the support account).
    await person('maya', 'Maya');
    const app = await renderApp('/');
    await flush();
    expect([...mockSocial.presence.values()]).toEqual([expect.objectContaining({ hasProfile: true, platform: 'ios', days: ['2026-11-07'] })]);
    await app.unmount();
    // Someone who drifted away two months ago.
    mockSocial.presence.set('old', { uid: 'old', firstSeenAt: new Date(2026, 7, 1).toISOString(), lastSeenAt: new Date(2026, 8, 1).toISOString(), days: ['2026-08-01', '2026-09-01'], platform: 'android', hasProfile: false });
    await s().signOut();

    await supportAccount();
    const hq = await renderApp('/');
    await flush();
    expect(mockSocial.presence.size).toBe(2);
    expect(hq.getByLabelText(/^Active today: 1/)).toBeTruthy();
    expect(hq.getByLabelText(/^Inactive \(30\+ days\): 1\. 50% of accounts/)).toBeTruthy();
    expect(hq.getByText('1 new person this week, 1 more than the week before.')).toBeTruthy();

    await fireEvent.press(hq.getByRole('tab', { name: 'People' }));
    await flush();
    expect(hq.getByLabelText(/^Accounts: 2/)).toBeTruthy();
    expect(hq.getByText('Who came back')).toBeTruthy();
    expect(hq.getByLabelText('iPhone: 1, 100 percent')).toBeTruthy();

    await fireEvent.press(hq.getByRole('tab', { name: '7 days' }));
    await fireEvent.press(hq.getByRole('tab', { name: 'Content' }));
    await flush();
    expect(hq.getByText('Top sharers, 7 days')).toBeTruthy();
    expect(hq.getByText('No videos shared in this time.')).toBeTruthy();

    await fireEvent.press(hq.getByRole('tab', { name: 'Festivals' }));
    await flush();
    expect(hq.getByText(/People who show they’re going/)).toBeTruthy();
  });
});

describe('contacting support', () => {
  it('someone writes in, support replies on the dashboard, and the reply comes back to them', async () => {
    await person('maya', 'Maya');
    const app = await renderApp('/support');
    await flush();
    await fireEvent.press(app.getByText('Something’s broken'));
    await fireEvent.changeText(app.getByLabelText('Your message to support'), 'The map won’t load on my phone');
    await fireEvent.press(app.getByText('Send'));
    await flush();
    expect(app.getByText('Sent. We’ll reply here, usually within a day or two.')).toBeTruthy();
    expect(app.getByText('Waiting for a reply')).toBeTruthy();
    const [msg] = [...mockSocial.support.values()];
    expect(msg).toMatchObject({ topic: 'bug', handle: 'maya', name: 'Maya', email: 'maya@example.com', status: 'open' });
    await app.unmount();

    // The support account gets its dashboard instead of the app.
    await s().signOut();
    await supportAccount();
    const hq = await renderApp('/');
    await flush();
    expect(hq.getByText('Dashboard')).toBeTruthy();
    expect(hq.getByText('1 support message is waiting for a reply.')).toBeTruthy();
    expect(hq.getByLabelText(/^People with a profile: 1/)).toBeTruthy();
    await fireEvent.press(hq.getByRole('tab', { name: /^Support/ }));
    await flush();
    expect(hq.getByText('The map won’t load on my phone')).toBeTruthy();
    await fireEvent.changeText(hq.getByLabelText('Reply to Maya'), 'Fixed it, try again now.');
    await fireEvent.press(hq.getByLabelText('Send the reply'));
    await flush();
    expect(mockSocial.support.get(msg.id)).toMatchObject({ status: 'answered', reply: 'Fixed it, try again now.' });
    await hq.unmount();

    // Maya sees it, and Settings says there's a new reply.
    await s().signOut();
    await as('maya');
    const settings = await renderApp('/settings');
    await flush();
    expect(settings.getByText('1 new reply')).toBeTruthy();
    await fireEvent.press(settings.getByText('Contact support'));
    await flush();
    expect(settings.getByText('Fixed it, try again now.')).toBeTruthy();
  });
});

describe('the support account', () => {
  it('asks to confirm the email before opening anything', async () => {
    await supportAccount(false);
    const app = await renderApp('/');
    await flush();
    expect(app.getByText('Confirm this email to open the dashboard')).toBeTruthy();
    expect(app.queryByRole('tab', { name: /^Support/ })).toBeNull();
    mockSocial.verified.add(SUPPORT);
    await fireEvent.press(app.getByText('I’ve confirmed it'));
    await flush();
    expect(app.getByRole('tab', { name: /^Support/ })).toBeTruthy();
  });

  it('can look at the app as everyone sees it, and come back', async () => {
    await supportAccount();
    const app = await renderApp('/');
    await flush();
    await fireEvent.press(app.getByLabelText('View the app as everyone sees it'));
    await flush();
    expect(app.queryByText('Dashboard')).toBeNull();
    await fireEvent.press(app.getByLabelText('Back to the dashboard'));
    await flush();
    expect(app.getByText('Dashboard')).toBeTruthy();
  });

  it('deals with reports, taking a video down', async () => {
    await person('maya', 'Maya');
    const shared = await s().shareMemory({ memoryId: 'm1', videoUri: 'file:///m1.mp4', festivalId: 'cyclops-cove-4', capturedAt: new Date(2026, 10, 7).toISOString() });
    await s().signOut();
    await person('sam', 'Sam');
    await s().report({ kind: 'memory', id: shared.id, ownerUid: shared.uid }, 'spam', 'Not a set');
    await s().signOut();
    await supportAccount();
    const app = await renderApp('/admin');
    await flush();
    await fireEvent.press(app.getByRole('tab', { name: /^Reports/ }));
    await flush();
    expect(app.getByText('A video')).toBeTruthy();
    expect(app.getByText('Spam or misleading')).toBeTruthy();
    expect(app.getByText('“Not a set”')).toBeTruthy();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons?: AlertButton[]) => buttons?.find((b) => b.text === 'Take it down')?.onPress?.());
    await fireEvent.press(app.getByLabelText('Take the video down'));
    await flush();
    alert.mockRestore();
    expect(mockSocial.memories.has(shared.id)).toBe(false);
    expect(app.getByText('Nothing reported. All clear.')).toBeTruthy();
  });

  it('reads a reported comment, opens a reported profile, and never loses an open report under newer ones', async () => {
    await person('maya', 'Maya');
    const shared = await s().shareMemory({ memoryId: 'm1', videoUri: 'file:///m1.mp4', festivalId: 'cyclops-cove-4', capturedAt: new Date(2026, 10, 7).toISOString() });
    await s().signOut();
    await person('sam', 'Sam');
    const c = await s().comment(shared.id, shared.uid, 'You call this a set?');
    await s().signOut();
    await as('maya');
    await s().report({ kind: 'comment', id: c.id, ownerUid: c.uid }, 'harassment');
    await s().report({ kind: 'profile', id: c.uid, ownerUid: c.uid }, 'offensive');
    await s().signOut();
    await supportAccount();
    // An open report is still listed when more newer ones than the page holds were dealt with.
    for (let i = 0; i < 3; i++) await s().report({ kind: 'memory', id: shared.id, ownerUid: shared.uid }, 'spam');
    for (const r of (await s().reports(10)).filter((x) => x.kind === 'memory')) await s().resolveReport(r.id);
    expect((await s().reports(2)).filter((r) => r.status === 'open').map((r) => r.kind).sort()).toEqual(['comment', 'profile']);

    const app = await renderApp('/admin');
    await flush();
    await fireEvent.press(app.getByRole('tab', { name: /^Reports/ }));
    await flush();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent.press(app.getByLabelText('Read the comment'));
    await flush();
    expect(alert).toHaveBeenCalledWith('@sam’s comment', '“You call this a set?”');
    alert.mockRestore();
    await fireEvent.press(app.getByLabelText('Look at the profile'));
    await flush();
    expect(app.getByText('@sam')).toBeTruthy();
  });

  it('reads a reported comment on a clip in Discover and takes it down', async () => {
    await person('sam', 'Sam');
    const c = await s().clipComment('yt-abc', 'Worst set ever, loser');
    await s().signOut();
    await person('maya', 'Maya');
    await s().report({ kind: 'clipComment', id: c.id, ownerUid: c.uid }, 'harassment');
    await s().signOut();
    await supportAccount();
    const app = await renderApp('/admin');
    await flush();
    await fireEvent.press(app.getByRole('tab', { name: /^Reports/ }));
    await flush();
    expect(app.getByText('A comment on a clip in Discover')).toBeTruthy();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent.press(app.getByLabelText('Read the comment'));
    await flush();
    expect(alert).toHaveBeenCalledWith('@sam’s comment', '“Worst set ever, loser”');
    alert.mockImplementation((_t, _m, buttons?: AlertButton[]) => buttons?.find((b) => b.text === 'Take it down')?.onPress?.());
    await fireEvent.press(app.getByLabelText('Remove the comment'));
    await flush();
    alert.mockRestore();
    expect(mockSocial.clipComments.has(c.id)).toBe(false);
    expect(app.getByText('Nothing reported. All clear.')).toBeTruthy();
  });

  it('keeps every reply, links only a real-looking email, and a message goes with the account', async () => {
    expect(mailtoLink('maya@example.com', 'Afterglow support')).toBe('mailto:maya@example.com?subject=Afterglow%20support');
    expect(mailtoLink('maya@example.com?cc=x@y.z', 'Hi')).toBeUndefined();
    expect(mailtoLink('not an email', 'Hi')).toBeUndefined();
    await person('maya', 'Maya');
    const m = await s().contactSupport({ topic: 'help', text: 'How do I add a festival?' });
    await s().signOut();
    await supportAccount();
    await s().answerSupport(m.id, 'From the Festivals tab.');
    await s().answerSupport(m.id, 'Or send us the lineup.');
    expect(mockSocial.support.get(m.id)?.replies?.map((r) => r.text)).toEqual(['From the Festivals tab.', 'Or send us the lineup.']);
    const app = await renderApp('/admin');
    await flush();
    await fireEvent.press(app.getByRole('tab', { name: /^Support/ }));
    await flush();
    await fireEvent.press(app.getByLabelText('All messages, 1'));
    await flush();
    expect(app.getByLabelText('Email maya@example.com')).toBeTruthy();
    expect(app.getByText('From the Festivals tab.')).toBeTruthy();
    expect(app.getByText('Or send us the lineup.')).toBeTruthy();
    await app.unmount();
    await s().signOut();
    await as('maya');
    await s().deleteAccount('password123');
    expect(mockSocial.support.size).toBe(0);
  });

  it('nobody else can read the inbox', async () => {
    await person('maya', 'Maya');
    await expect(s().supportInbox(10)).rejects.toThrow();
    await expect(s().adminCounts('2026-01-01')).rejects.toThrow();
  });
});
