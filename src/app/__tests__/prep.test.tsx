import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp, showTab } from './appRoutes';

const flush = async () => {
  for (let i = 0; i < 6; i++)
    await act(async () => {
      await Promise.resolve();
    });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('get ready', () => {
  it('a festival you are going to has a checklist you can tick, kept on the phone', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    const app = await renderApp('/festival/cyclops-cove-4');
    await flush();
    await showTab(app, 'Info');
    await fireEvent.press(app.getByLabelText(/^Get ready for Cyclops Cove 4\. 0 of \d+ done\. Opens the checklist\.$/));
    await flush();
    expect(app.getByText('Get ready')).toBeTruthy();
    expect(app.getByLabelText('Get tickets for Cyclops Cove 4. Opens the official ticket page.')).toBeTruthy();
    await fireEvent.press(app.getByRole('checkbox', { name: 'Earplugs' }));
    await flush();
    expect(app.getByRole('checkbox', { name: 'Earplugs' }).props.accessibilityState.checked).toBe(true);
    expect(app.getByText(/^1 of \d+ done/)).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('prep.v1'))!)).toEqual({ 'cyclops-cove-4': ['earplugs'] });
  });

  it('is not offered for a festival you are not going to', async () => {
    const app = await renderApp('/festival/cyclops-cove-4');
    await flush();
    expect(app.queryByLabelText(/^Get ready for Cyclops Cove 4/)).toBeNull();
  });
});
