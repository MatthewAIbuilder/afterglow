import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp, showTab } from './appRoutes';

const flush = async () => {
  for (let i = 0; i < 6; i++)
    await act(async () => {
      await Promise.resolve();
    });
};

const notifications = jest.requireMock<{ __scheduled: Map<string, { content: { title: string; body: string; data?: { href?: string } } }> }>('expo-notifications');

beforeEach(async () => {
  notifications.__scheduled.clear();
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

  it('you can add your own items, tick them and take them off again; they’re kept on the phone', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    const app = await renderApp('/prep/cyclops-cove-4');
    await flush();
    const before = app.getByText(/^\d+ of (\d+) done/).props.children as string;
    const total = Number(/of (\d+) done/.exec(String(before))?.[1]);
    await fireEvent.changeText(app.getByLabelText('Add your own item'), '  Poncho for the rain ');
    await fireEvent.press(app.getByLabelText('Add to the list'));
    await flush();
    expect(app.getByRole('checkbox', { name: 'Poncho for the rain' })).toBeTruthy();
    expect(app.getByText(new RegExp(`^0 of ${total + 1} done`))).toBeTruthy();
    // The same thing twice, or nothing, adds nothing.
    await fireEvent.changeText(app.getByLabelText('Add your own item'), 'poncho for the rain');
    await fireEvent.press(app.getByLabelText('Add to the list'));
    await flush();
    expect(app.getAllByRole('checkbox', { name: 'Poncho for the rain' })).toHaveLength(1);
    await fireEvent.press(app.getByRole('checkbox', { name: 'Poncho for the rain' }));
    await flush();
    const saved = JSON.parse((await AsyncStorage.getItem('prepCustom.v1'))!)['cyclops-cove-4'] as { id: string; text: string }[];
    expect(saved.map((x) => x.text)).toEqual(['Poncho for the rain']);
    expect(JSON.parse((await AsyncStorage.getItem('prep.v1'))!)['cyclops-cove-4']).toEqual([saved[0].id]);
    await fireEvent.press(app.getByLabelText('Remove Poncho for the rain from the list'));
    await flush();
    expect(app.queryByRole('checkbox', { name: 'Poncho for the rain' })).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('prep.v1'))!)['cyclops-cove-4']).toEqual([]);
  });

  it('the checklist notifies the evening before and the morning it starts, saying how much is left', async () => {
    jest.useFakeTimers({ now: new Date(2026, 11, 1, 12, 0) });
    await AsyncStorage.setItem('going.v1', JSON.stringify(['cyclops-cove-4']));
    await renderApp('/festivals');
    await flush();
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    await flush();
    const prep = [...notifications.__scheduled.entries()].filter(([id]) => id.includes(':prep:cyclops-cove-4:'));
    expect(prep.map(([id]) => id.split(':')[3] + ':' + id.split(':')[4])).toEqual(['2026-12-04:eve', '2026-12-04:day']);
    expect(prep[0][1].content.title).toBe('Packed for Cyclops Cove 4?');
    expect(prep[0][1].content.body).toMatch(/things left on your checklist/);
    expect(prep[1][1].content.title).toBe('Cyclops Cove 4 starts today');
    expect(prep[1][1].content.data?.href).toBe('/prep/cyclops-cove-4');
  });
});

