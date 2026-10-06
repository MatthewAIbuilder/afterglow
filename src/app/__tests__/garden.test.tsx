import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { fakeSocial } from '../../features/social/__tests__/fakeSocial';
import { meadow, nearestSpot, placeResidents } from '../../features/sprouts/gardenLayout';
import { renderApp } from './appRoutes';

let mockSocial = fakeSocial();
jest.mock('../../features/social/services', () => ({ defaultSocialService: () => mockSocial.service }));

const settle = (ms = 50) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
const flush = async (rounds = 10) => {
  for (let i = 0; i < rounds; i++) await settle();
};
const s = () => mockSocial.service;
const person = async (handle: string, name: string) => {
  const u = await s().signUp(`${handle}@example.com`, 'password123');
  await s().saveProfile({ handle, displayName: name, bio: '', showFestivals: false, showSound: false }, { festivals: [], sounds: [] });
  return u.uid;
};
const NOW = new Date(2026, 9, 3, 20, 0);
/** The width the garden has in tests: the window is 750 wide, the page at most 640 with 24 each side. */
const WIDTH = 640 - 48;
const PLUR = 'plurplurplurplurplur';
const BASS = 'bassbassbassbassbass';

/** A garden with two sprouts from Maya, a sprout from Sam, and the first sprout. */
const gardenOf = (account: string) =>
  AsyncStorage.setItem(
    'sprouts.v1',
    JSON.stringify({
      gifts: [],
      claims: [],
      garden: [
        { id: PLUR, kind: 'plur', from: 'maya-uid', handle: 'maya', name: 'Maya', note: 'So glad we met', at: NOW.getTime() - 3 * 86_400_000, account },
        { id: BASS, kind: 'bass', from: 'maya-uid', handle: 'maya', name: 'Maya', at: NOW.getTime() - 2 * 86_400_000, account },
        { id: 'seedseedseedseedseed', kind: 'seedling', from: 'sam-uid', handle: 'sam', name: 'Sam', at: NOW.getTime() - 86_400_000, account },
      ],
      bloomed: {},
      bloomsShown: [],
      starterAt: NOW.getTime() - 10 * 86_400_000,
    }),
  );
const stored = async () => JSON.parse((await AsyncStorage.getItem('gardenLayout.v1')) ?? '{}') as Record<string, Record<string, number>>;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
  mockSocial = fakeSocial();
});

describe('the living garden', () => {
  it('shows every sprout in the meadow, and a tap opens its sheet', async () => {
    const me = await person('jojo', 'Jo');
    await gardenOf(me);
    const app = await renderApp('/garden');
    await flush();
    expect(app.getByLabelText('A night meadow with 4 sprouts. Hold and drag one to move it.')).toBeTruthy();
    expect(app.getByLabelText('PLUR sprout, from Maya. In bloom.')).toBeTruthy();
    expect(app.getByLabelText('Bass sprout, from Maya. In bloom.')).toBeTruthy();
    expect(app.getByLabelText(/^Sprout, from Sam\. Seed/)).toBeTruthy();
    expect(app.getByLabelText(/^Sprout, Your first sprout\. Seed/)).toBeTruthy();
    expect(app.getByLabelText('PLUR sprout, from Maya. In bloom.').props.accessibilityHint).toBe('Hold and drag to move');
    // Everyone has a spot, saved for this account.
    await flush();
    const saved = (await stored())[me];
    expect(Object.keys(saved).sort()).toEqual([BASS, PLUR, 'seedseedseedseedseed', 'starter'].sort());
    expect(new Set(Object.values(saved)).size).toBe(4);
    await fireEvent.press(app.getByLabelText('PLUR sprout, from Maya. In bloom.'));
    await flush();
    expect(app.getByText('“So glad we met”')).toBeTruthy();
    expect(app.getByText('Peace, love, unity, respect. Grown by passing the love on.')).toBeTruthy();
    await fireEvent.press(app.getByText('Done'));
    await flush();
    expect(app.queryByText('“So glad we met”')).toBeNull();
  });

  it('an empty garden shows your first sprout alone', async () => {
    const app = await renderApp('/garden');
    await flush();
    expect(app.getByLabelText('A night meadow with 1 sprout. Hold and drag one to move it.')).toBeTruthy();
    expect(app.getByLabelText(/^Sprout, Your first sprout\. Seed/)).toBeTruthy();
    expect((await stored()).guest).toEqual({ starter: 1 });
  });

  it('holding a sprout and carrying it to another spot keeps it there, swapping with whoever stood there', async () => {
    const me = await person('jojo', 'Jo');
    await gardenOf(me);
    const app = await renderApp('/garden');
    await flush();
    const m = meadow(4, WIDTH);
    const before = placeResidents([ 'seedseedseedseedseed', BASS, PLUR, 'starter'], undefined, m);
    expect((await stored())[me]).toEqual(before);
    const from = m.spots[before[PLUR]];
    // Carry the PLUR sprout one spot to the left, onto the newest sprout's spot.
    const to = nearestSpot(m.spots, from.x - m.colWidth, from.y);
    expect(to).not.toBe(before[PLUR]);
    const wasThere = Object.entries(before).find(([, at]) => at === to)?.[0];
    expect(wasThere).toBe('seedseedseedseedseed');
    await act(async () =>
      fireGestureHandler(getByGestureTestId(`garden-move-${PLUR}`), [
        { state: State.BEGAN, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, translationX: -m.colWidth, translationY: 0 },
        { state: State.END, translationX: -m.colWidth, translationY: 0 },
      ]),
    );
    await flush();
    const after = (await stored())[me];
    expect(after[PLUR]).toBe(to);
    expect(after[wasThere!]).toBe(before[PLUR]);
    // Everyone still has their own spot.
    expect(new Set(Object.values(after)).size).toBe(4);
    // Back on the garden later, it's still there.
    app.unmount();
    const again = await renderApp('/garden');
    await flush();
    expect((await stored())[me][PLUR]).toBe(to);
    expect(again.getByLabelText('PLUR sprout, from Maya. In bloom.')).toBeTruthy();
  });

  it('an artist collectible lives in the meadow too, and opens its sheet', async () => {
    const me = await person('jojo', 'Jo');
    await gardenOf(me);
    const at = new Date(2026, 8, 20, 22).toISOString();
    await AsyncStorage.setItem('memories.v1', JSON.stringify([{ id: 'm1', file: 'm1.mov', capturedAt: at, addedAt: at, artistId: 'subtronics' }]));
    const app = await renderApp('/garden');
    await flush();
    expect(app.getByLabelText('A night meadow with 4 sprouts and 1 artist collectible. Hold and drag one to move it.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('SUBTRONICS collectible, 1 video.'));
    await flush();
    expect(app.getByText('2 more videos of them for bronze. First filmed Sep 20, 2026.')).toBeTruthy();
    expect((await stored())[me]['artist:subtronics']).toBeDefined();
  });
});
