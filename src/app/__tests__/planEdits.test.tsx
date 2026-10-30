import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';
import { renderApp } from './appRoutes';

/** Your own plan, through the real festival page: take an act out, bring it back, only your picks. */
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

afterEach(() => {
  jest.useRealTimers();
});

const subtronics = /^\d{1,2}:\d{2} [AP]M to \d{1,2}:\d{2} [AP]M, SUBTRONICS at Bass Tent, /;

describe('making the plan yours', () => {
  it('takes an act out of your plan and brings it back', async () => {
    await AsyncStorage.setItem('mustSees.v2', JSON.stringify({ 'solstice-26': ['subtronics'] }));
    const app = await renderApp('/festival/solstice-26');
    await settle();
    expect(app.getAllByLabelText(subtronics).length).toBe(1);

    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((o, cb) => cb(o.options.indexOf('Not this one')));
    await fireEvent.press(app.getAllByLabelText('Change SUBTRONICS in your plan')[0]);
    await settle();
    expect(app.queryAllByLabelText(subtronics)).toHaveLength(0);
    // Out of the plan and unstarred, kept on the phone; their match is untouched.
    expect(JSON.parse((await AsyncStorage.getItem('planEdits.v1')) ?? '{}')).toEqual({ 'solstice-26': { out: ['subtronics'] } });
    expect(JSON.parse((await AsyncStorage.getItem('mustSees.v2')) ?? '{}')).toEqual({});

    await fireEvent.press(app.getByLabelText('1 act taken out of your plan. Show them'));
    await fireEvent.press(app.getByLabelText('Bring SUBTRONICS back into your plan'));
    await settle();
    expect(app.queryByText('Taken out (1)')).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('planEdits.v1')) ?? '{}')).toEqual({});
    await app.unmount();
  });

  it('with only your picks, the day holds just what you starred', async () => {
    await AsyncStorage.setItem('mustSees.v2', JSON.stringify({ 'solstice-26': ['subtronics'] }));
    const app = await renderApp('/festival/solstice-26');
    await settle();
    expect(app.getByText(/^\d+ sets, .+ Where to be all day\.$/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Only your picks: just the acts you starred'));
    await settle();
    expect(app.getByText(/^1 set, .+ Where to be all day\.$/)).toBeTruthy();
    expect(app.getAllByLabelText(subtronics).length).toBe(1);
    await fireEvent.press(app.getByLabelText('Suggested plan: your matches and your stars'));
    await settle();
    expect(app.getByText(/^\d+ sets, .+ Where to be all day\.$/)).toBeTruthy();
    await app.unmount();
  });
});
