import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { renderApp } from './appRoutes';

const flush = async () => {
  for (let i = 0; i < 6; i++)
    await act(async () => {
      await Promise.resolve();
    });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ illenium: 'love', excision: 'love', subtronics: 'like' }));
});

describe('comparing festivals', () => {
  it('opens from a festival page, adds another and shows who plays both', async () => {
    const app = await renderApp('/festival/solstice-26');
    await flush();
    await fireEvent.press(app.getByLabelText('Compare Solstice 2026 with other festivals'));
    await flush();
    expect(app.getAllByText('Compare festivals').length).toBeGreaterThan(0);
    expect(app.getByText('Add a festival to compare.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Compare Horizon 2027, /));
    await flush();
    // Both side by side, each with its fit and favourites.
    expect(app.getByLabelText(/^Solstice 2026\. .*percent fit for your sound/)).toBeTruthy();
    expect(app.getByLabelText(/^Horizon 2027\. /)).toBeTruthy();
    expect(app.getByText('Playing more than one')).toBeTruthy();
    expect(app.getAllByText(/Solstice 2026 and Horizon 2027/).length).toBeGreaterThan(0);
    // Solstice has ILLENIUM and EXCISION, whom you love: it fits best.
    expect(app.getByText(/^Solstice 2026 fits your sound best/)).toBeTruthy();
    // Take one away again.
    await fireEvent.press(app.getByLabelText('Remove Horizon 2027'));
    await flush();
    expect(app.queryByLabelText(/^Horizon 2027\. /)).toBeNull();
  });

  it("an artist's festivals put yours first, with the countdown", async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['horizon-27']));
    const app = await renderApp('/artist/subtronics');
    await flush();
    const names = app.getAllByText(/^(Solstice 2026|Horizon 2027|Cyclops Cove 4)$/).map((n) => n.props.children);
    expect(names[0]).toBe('Horizon 2027');
    expect(app.getByText('Going')).toBeTruthy();
  });
});
