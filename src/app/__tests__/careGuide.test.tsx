import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { forgetCareTip } from '../../state/careTip';
import { renderApp } from './appRoutes';

/** The care guide's stopwatches, body checks and timing guide; festival mode's Profile and the held camera button. */
const settle = (ms = 0) =>
  act(async () => {
    if (ms) jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async () => {
  for (let i = 0; i < 8; i++) await settle();
};
const START = new Date(2026, 11, 5, 22, 0);
const saved = async () => JSON.parse((await AsyncStorage.getItem('care.v1')) ?? '{}');

beforeEach(async () => {
  jest.useFakeTimers({ now: START });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  forgetCareTip();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('stopwatches with the timing guide', () => {
  it('with the guide switched off from HQ: stopwatches in your own words, no substance list, timings, mixes or guide', async () => {
    await AsyncStorage.setItem('appSettings.v1', JSON.stringify({ careGuide: false }));
    await AsyncStorage.setItem('care.v1', JSON.stringify({ timers: [{ id: 't1', label: 'MDMA / molly', guide: 'mdma', startedAt: START.getTime() - 40 * 60_000 }] }));
    const app = await renderApp('/care');
    await flush();
    // A stopwatch started with the guide on just counts now.
    expect(app.getByText('40:00')).toBeTruthy();
    expect(app.queryByText('Coming up')).toBeNull();
    expect(app.queryByLabelText(/^Timing guide/)).toBeNull();
    await fireEvent.press(app.getByLabelText('Start a stopwatch'));
    await flush();
    expect(app.getByText('Name it so you remember what it’s for. It stays on this phone.')).toBeTruthy();
    expect(app.queryByText('What did you take?')).toBeNull();
    expect(app.queryByLabelText(/^Alcohol\. Usually starts in/)).toBeNull();
  });

  it('says when it usually kicks in, warns before taking more too soon, and flags a risky mix', async () => {
    const alerts = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const app = await renderApp('/care');
    await flush();
    await fireEvent.press(app.getByLabelText('Start a stopwatch'));
    await fireEvent.press(app.getByLabelText(/^MDMA \/ molly\. Usually starts in 30 to 90 min$/));
    await flush();
    expect(app.getByText('0:00')).toBeTruthy();
    expect(app.getByText('Waiting')).toBeTruthy();
    expect(app.getByText('Usually starts in 30 to 90 min. Not feeling it yet is normal.')).toBeTruthy();

    // 40 minutes on: coming up, and taking more now asks first.
    await settle(40 * 60_000);
    await flush();
    expect(app.getAllByText('Coming up').length).toBeGreaterThan(0);
    expect(app.getByText('40:00')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('I took more MDMA / molly'));
    const [title, body, buttons] = alerts.mock.calls[0] as [string, string, AlertButton[]];
    expect(title).toBe('Wait a bit longer?');
    expect(body).toMatch(/^It’s only been 40 min\. MDMA \/ molly can take up to 90 min to start\./);
    expect(buttons.map((b) => b.text)).toEqual(['I’ll wait', 'Log it anyway']);
    await act(async () => buttons[1].onPress?.());
    await flush();
    expect((await saved()).timers[0]).toMatchObject({ guide: 'mdma', doses: [START.getTime() + 40 * 60_000] });

    // Alcohol as well: the mix warning shows above the stopwatches.
    await fireEvent.press(app.getByLabelText('Start a stopwatch'));
    await fireEvent.press(app.getByLabelText(/^Alcohol\. Usually starts in/));
    await flush();
    expect(app.getByText('Careful: MDMA / molly and Alcohol')).toBeTruthy();
    expect(app.getByText('Both dry you out and make overheating harder to notice.')).toBeTruthy();
  });

  it('counts steps, checks a pulse by tapping, and keeps the timing guide readable offline', async () => {
    const app = await renderApp('/care');
    await flush();
    expect(app.getByText('4,210')).toBeTruthy();
    // Three readings of 8 taps each make the result.
    for (let i = 0; i < 24; i++) {
      if (i === 8) expect(app.getByText('Reading 2 of 3')).toBeTruthy();
      await fireEvent.press(app.getByLabelText(/^Tap with each heartbeat/));
      await settle(750);
    }
    expect(app.getByText('That’s in the usual resting range.')).toBeTruthy();
    expect(app.getByText('Average of 3 readings.')).toBeTruthy();
    expect(app.getByLabelText('Pulse checked')).toBeTruthy();
    // Check again starts over.
    await fireEvent.press(app.getByLabelText('Check your pulse again from the start'));
    expect(app.getByText('Reading 1 of 3')).toBeTruthy();
    expect(app.queryByText('That’s in the usual resting range.')).toBeNull();
    expect(app.getByText('Before you take anything')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Ketamine, snorted\./));
    await flush();
    expect(app.getByText('Riskier mixed with')).toBeTruthy();
  });
});

describe('how you are feeling', () => {
  it('gives a tip for how you feel, and logs feelings on a stopwatch as a graph', async () => {
    const app = await renderApp('/care');
    await flush();
    await fireEvent.press(app.getByLabelText("I'm feeling too hot"));
    await flush();
    expect(app.getByLabelText(/^Last check-in: Too hot, Just now ago\./)).toBeTruthy();
    expect((await saved()).log).toEqual([{ kind: 'checkin', at: START.getTime(), mood: 'hot' }]);
    await settle(10 * 60_000);

    await fireEvent.press(app.getByLabelText('Start a stopwatch'));
    await fireEvent.press(app.getByLabelText(/^MDMA \/ molly\. Usually starts in/));
    await flush();
    expect(app.getByLabelText('No check-ins on this stopwatch yet.')).toBeTruthy();
    await settle(45 * 60_000);
    await flush();
    await fireEvent.press(app.getByLabelText('How do you feel now? Log it on MDMA / molly'));
    await fireEvent.press(app.getAllByLabelText("I'm feeling anxious").at(-1)!);
    await flush();
    expect(app.getByLabelText('How you felt since you started: 45 min in, anxious.')).toBeTruthy();
    expect(app.getAllByText(/Breathe slowly/).length).toBeGreaterThan(0);
    // Two check-ins tonight: the night's graph shows too.
    expect(app.getByText('2 check-ins')).toBeTruthy();
    expect(app.getByLabelText('Tonight, 2 check-ins: 10 PM too hot, 10:55 PM anxious.')).toBeTruthy();
  });

  it('checks in with an orb, shows how you feel, changes it, and draws the night', async () => {
    const app = await renderApp('/care');
    await flush();
    // Picking: the good ones as orbs, the rest in their groups.
    expect(app.getByText('How are you right now?')).toBeTruthy();
    expect(app.getByText('Something’s off')).toBeTruthy();
    expect(app.getByText('Need a hand')).toBeTruthy();
    await fireEvent.press(app.getByLabelText("I'm feeling too hot"));
    await flush();

    // After: the feeling, when, the tip, and Change (no crew here, so no Tell my crew).
    expect(app.getByLabelText(/^Last check-in: Too hot, Just now ago\. Get out of the crowd/)).toBeTruthy();
    expect(app.getByText('Checked in just now')).toBeTruthy();
    expect(app.queryByLabelText("I'm feeling great")).toBeNull();
    expect(app.queryByLabelText('Tell my crew how I am')).toBeNull();
    expect(app.queryByText(/check-ins$/)).toBeNull();

    await settle(20 * 60_000);
    await flush();
    expect(app.getByText('Checked in 20 min ago')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Change how I feel'));
    expect(app.getByText('How are you now?')).toBeTruthy();
    // A way back without changing anything.
    await fireEvent.press(app.getByLabelText('Keep how I said I feel'));
    expect(app.getByText('Checked in 20 min ago')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Change how I feel'));
    await fireEvent.press(app.getByLabelText("I'm feeling great"));
    await flush();
    await settle(60_000);
    await flush();

    // A new check-in (the first stays), the night as a line, and the note about feeling better.
    expect((await saved()).log.map((e: { mood: string }) => e.mood)).toEqual(['hot', 'great']);
    expect(app.getByLabelText(/^Last check-in: Great, /)).toBeTruthy();
    expect(app.getByText('2 check-ins')).toBeTruthy();
    expect(app.getByLabelText('Tonight, 2 check-ins: 10 PM too hot, 10:20 PM great.')).toBeTruthy();
    expect(app.getByText('You felt too hot at 10 PM, and you’ve been feeling better since.')).toBeTruthy();

    // A while later: the picker again, with what you said last.
    await settle(50 * 60_000);
    await flush();
    expect(app.getByText('It’s been a while. How are you now?')).toBeTruthy();
    expect(app.getByText('Earlier: Great · 51 min ago')).toBeTruthy();
    expect(app.getByLabelText("I'm feeling good")).toBeTruthy();
  });

  it('jumps to each part of the page', async () => {
    const app = await renderApp('/care');
    await flush();
    for (const part of ['Feelings', 'Stopwatches', 'Water', 'Body', 'Get help', 'Timing guide']) expect(app.getByLabelText(new RegExp(`^${part}(,|\\.)`))).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Timing guide/));
    expect(app.getByText('Before you take anything')).toBeTruthy();
  });
});

describe('festival mode', () => {
  it('keeps Profile simple, and holding the camera button opens Look after yourself', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    await AsyncStorage.setItem('festivalMode.v1', JSON.stringify({ choices: { 'cyclops-cove-4': 'on' } }));
    // Tonight has already opened by itself tonight.
    await AsyncStorage.setItem('tonightShown.v1', 'cyclops-cove-4:2026-12-05');
    const app = await renderApp('/profile');
    await flush();
    expect(app.getByText('At Cyclops Cove 4')).toBeTruthy();
    expect(app.getByText('Your videos')).toBeTruthy();
    // No counts or shortcuts (just Moments and Badges).
    expect(app.queryByRole('tab', { name: /Videos/ })).toBeNull();
    // A tip above the camera button says what holding it does, until you have.
    expect(app.getByText('Hold for Look after yourself', { includeHiddenElements: true })).toBeTruthy();
    // Held, the button turns into a heart that blooms; the page opens a moment later.
    await fireEvent(app.getByLabelText('Film a video'), 'pressIn');
    await fireEvent(app.getByLabelText('Film a video'), 'longPress');
    await settle(400);
    await flush();
    expect(app.getByText('Look after yourself')).toBeTruthy();
    expect(app.getAllByText('Stopwatches').length).toBeGreaterThan(0);
    expect(app.queryByText('Hold for Look after yourself', { includeHiddenElements: true })).toBeNull();
    expect(await AsyncStorage.getItem('careTip.v1')).toBe('1');
  });
});

describe('the camera on Discover', () => {
  it('teaches holding it once the other tips are done, and held it opens Look after yourself', async () => {
    await AsyncStorage.setItem('hints.v1', JSON.stringify(['swipe', 'like', 'hold']));
    const app = await renderApp('/');
    await flush();
    expect(app.getByLabelText('Tip: Press and hold the camera button to open Look after yourself')).toBeTruthy();
    await fireEvent(app.getByLabelText('Open the camera to film a memory'), 'longPress');
    await flush();
    expect(app.getByText('Look after yourself')).toBeTruthy();
    expect(app.getByText('Tip: hold the camera button to get back here quickly.')).toBeTruthy();
    expect(await AsyncStorage.getItem('careTip.v1')).toBe('1');
  });
});
