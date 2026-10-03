import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { canDo, dailyPicks, questDay } from '../../features/quests/daily';
import { renderApp } from './appRoutes';

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};

/** A day (from Oct 3 2026 on) whose quests include this one, at noon. */
function dayWith(id: string): Date {
  for (let i = 0; i < 200; i++) {
    const d = new Date(2026, 9, 3 + i, 12);
    if (dailyPicks(questDay(d.getTime()), canDo({ planning: false, enoughSets: true })).some((q) => q.id === id)) return d;
  }
  throw new Error(`no day with ${id}`);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('daily quests', () => {
  it('Discover’s quest ring opens your quests: level, streak, today’s three and the week', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 3, 12) });
    const app = await renderApp('/');
    await flush();
    await fireEvent.press(app.getByTestId('quest-button'));
    await flush();
    expect(app.getByText('Glow level')).toBeTruthy();
    expect(app.getByText('Spark')).toBeTruthy();
    expect(app.getByText('Start a streak')).toBeTruthy();
    expect(app.getByText('Today')).toBeTruthy();
    const picks = dailyPicks('2026-10-03', canDo({ planning: false, enoughSets: true }));
    for (const q of picks) expect(app.getByTestId(`quest-${q.id}`)).toBeTruthy();
    expect(app.getByText('This week')).toBeTruthy();
    expect(app.getByText(/^New quests in/)).toBeTruthy();
  });

  it('finishing one shows a toast and adds its glow', async () => {
    jest.useFakeTimers({ now: dayWith('map') });
    const app = await renderApp('/quests');
    await flush();
    expect(app.getByTestId('quest-map').props.accessibilityLabel).toMatch(/Not done yet/);
    await fireEvent.press(app.getByTestId('quest-map'));
    await flush();
    expect(app.getByTestId('festival-map')).toBeTruthy();
    expect(app.getByTestId('quest-toast').props.accessibilityLabel).toMatch(/^Explorer\. Look around the festival map · 1 of 3 today\. Plus 10 glow\./);
    const saved = JSON.parse((await AsyncStorage.getItem('dailyQuests.v1'))!);
    expect(saved.done).toEqual(['map']);
    expect(saved.glow).toBe(10);
  });

  it('a like counts for the like quest, from Discover', async () => {
    jest.useFakeTimers({ now: dayWith('like') });
    await AsyncStorage.setItem('reactions.v1', JSON.stringify({ x: { liked: true, saved: false, skipped: false } }));
    const app = await renderApp('/quests');
    await flush();
    // Likes from before today don't count.
    expect(app.getByTestId('quest-like').props.accessibilityLabel).toMatch(/0 of 3/);
  });
});

describe('the evening nudge', () => {
  it('switching it on schedules one for 8 PM', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 3, 12) });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const notifications = require('expo-notifications');
    const app = await renderApp('/quests');
    await flush();
    await fireEvent(app.getByTestId('quest-reminder'), 'valueChange', true);
    await flush(30);
    const ids = [...notifications.__scheduled.keys()] as string[];
    expect(ids.some((id: string) => id.includes('quests:2026-10-03'))).toBe(true);
    expect(await AsyncStorage.getItem('questReminder.v1')).toBe('true');
  });
});

describe('the quests tip', () => {
  it('comes after the other tips, and goes once you open your quests', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 3, 12) });
    await AsyncStorage.setItem('hints.v1', JSON.stringify(['swipe', 'like', 'hold']));
    await AsyncStorage.setItem('careTip.v1', '1');
    const app = await renderApp('/');
    await flush(20);
    expect(app.getByLabelText('Tip: The ring at the top right holds your daily quests. Tap it to see them')).toBeTruthy();
    await fireEvent.press(app.getByTestId('quest-button'));
    await flush();
    expect(await AsyncStorage.getItem('questTip.v1')).toBe('1');
  });
});
