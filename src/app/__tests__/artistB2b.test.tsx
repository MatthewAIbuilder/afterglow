import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { builtInCatalog } from '../../state/catalog';
import { renderApp } from './appRoutes';

/** A b2b act's page names the artists playing it, opens each, and shows each one's collectible. */
const flush = async () => {
  for (let i = 0; i < 10; i++)
    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 6, 20, 0) });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

describe('a b2b act’s page', () => {
  it('lists its artists and both their collectibles', async () => {
    const act_ = builtInCatalog.artists.find((a) => builtInCatalog.membersOf(a.id).length >= 2)!;
    const members = builtInCatalog.membersOf(act_.id).map((id) => builtInCatalog.artist(id)!);
    const app = await renderApp(`/artist/${act_.id}`);
    await flush();
    expect(app.getByText('Back to back')).toBeTruthy();
    expect(app.queryByText('Their collectible')).toBeNull();
    for (const m of members) expect(app.getAllByText(m.name).length).toBeGreaterThan(0);
    expect(app.getAllByText('Playing in this set')).toHaveLength(members.length);
    await app.unmount();
  });
});
