import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GlassCircleButton as Button } from '../GlassCircleButton';
import { accentEdge, color, GLASS } from '../../theme/tokens';

const glass = () => jest.requireMock<{ __state: { available: boolean } }>('expo-glass-effect').__state;

describe('Liquid Glass off (the default)', () => {
  it("is off unless chosen: plain cards and buttons, and no Apple glass even on a phone that has it", async () => {
    expect(GLASS).toBe(false);
    expect(color.rim).toBe(color.hairline);
    expect(accentEdge).toEqual({});
    glass().available = true;
    try {
      const press = jest.fn();
      const view = await render(
        <Button label="Back" onPress={press}>
          <Text>‹</Text>
        </Button>,
      );
      expect(view.queryByTestId('liquid-glass')).toBeNull();
      expect(view.getByTestId('glass-off')).toBeTruthy();
      await fireEvent.press(view.getByLabelText('Back'));
      expect(press).toHaveBeenCalledTimes(1);
    } finally {
      glass().available = false;
    }
  });
});
