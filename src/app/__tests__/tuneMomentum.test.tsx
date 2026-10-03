import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { answerPop, milestoneLine } from '../../features/tune/TuneFeedback';
import { renderApp } from './appRoutes';

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++) await settle();
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 3, 12) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('Tune keeps you going', () => {
  it('names each answer as it floats away', () => {
    expect(answerPop('love')).toEqual({ text: '♥ Love', tint: '#FF7EB6' });
    expect(answerPop('unsure').text).toBe('Skipped');
    expect(milestoneLine(10)).toBe('10 rated · your plan just got sharper');
    expect(milestoneLine(20)).toBe('20 rated · you’re on a roll');
  });

  it('celebrates every ten answers', async () => {
    const app = await renderApp('/tune/acl-26');
    await flush();
    for (let i = 0; i < 10; i++) {
      await fireEvent.press(app.getByLabelText(/^I don't know .*\. Skip without rating\.$/));
      await flush(2);
    }
    expect(app.getByLabelText('10 rated · your plan just got sharper')).toBeTruthy();
  });
});
