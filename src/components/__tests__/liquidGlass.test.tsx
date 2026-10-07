import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GlassCircleButton as Button } from '../GlassCircleButton';

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
});
