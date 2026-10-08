import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { GlassCircleButton as Button } from '../GlassCircleButton';

// Liquid Glass switched on (App theme page): read as the app starts.
jest.mock('../../theme/storedTheme', () => ({ readStoredTheme: () => undefined, writeStoredTheme: () => true, readStoredGlass: () => true, writeStoredGlass: () => true }));

// Reduce transparency, as the phone reports it (listened to once, the first time glass is drawn).
const changes: ((on: boolean) => void)[] = [];
jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, handler: (on: boolean) => void) => {
  if (event === 'reduceTransparencyChanged') changes.push(handler);
  return { remove: () => {} };
}) as never);

const glass = () => jest.requireMock<{ __state: { available: boolean } }>('expo-glass-effect').__state;

describe('Liquid Glass', () => {
  it("draws Apple's glass on a phone that has it, and the button still works", async () => {
    glass().available = true;
    try {
      const press = jest.fn();
      const view = await render(
        <Button label="Back" onPress={press}>
          <Text>‹</Text>
        </Button>,
      );
      expect(view.getByTestId('liquid-glass')).toBeTruthy();
      await fireEvent.press(view.getByLabelText('Back'));
      expect(press).toHaveBeenCalledTimes(1);
    } finally {
      glass().available = false;
    }
  });

  it('draws the copy everywhere else', async () => {
    const view = await render(
      <Button label="Search" onPress={() => {}} selected>
        <Text>⌕</Text>
      </Button>,
    );
    expect(view.queryByTestId('liquid-glass')).toBeNull();
    expect(view.getByLabelText('Search').props.accessibilityState).toEqual({ selected: true });
  });

  it('turns solid while Reduce transparency is on, and back to glass when it goes off', async () => {
    const view = await render(
      <Button label="Back" onPress={() => {}}>
        <Text>‹</Text>
      </Button>,
    );
    expect(view.queryByTestId('glass-solid')).toBeNull();
    expect(changes.length).toBeGreaterThan(0);
    await act(async () => changes.forEach((c) => c(true)));
    expect(view.getByTestId('glass-solid')).toBeTruthy();
    await act(async () => changes.forEach((c) => c(false)));
    expect(view.queryByTestId('glass-solid')).toBeNull();
  });
});
