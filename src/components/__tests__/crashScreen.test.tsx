import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Slot } from 'expo-router';
import { CrashScreen, crashMailto } from '../CrashScreen';
import { ErrorBoundary } from '../../app/(tabs)/_layout';

describe('when a screen breaks', () => {
  it('says so plainly, with Try again', async () => {
    const retry = jest.fn<() => void>();
    const app = await render(<CrashScreen error={new Error('boom')} retry={retry} />);
    expect(app.getByText('Something went wrong')).toBeTruthy();
    await fireEvent.press(app.getByText('Try again'));
    expect(retry).toHaveBeenCalled();
    await fireEvent.press(app.getByText('Go to Discover'));
    expect(retry).toHaveBeenCalledTimes(2);
    expect(crashMailto(new Error('boom'))).toMatch(/^mailto:afterglowmusic\.support@gmail\.com\?subject=Afterglow%20crashed&body=.*boom/);
    expect(crashMailto(new Error('x'), '')).toBeUndefined();
  });

  it('a broken screen shows it instead of a white screen', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const Broken = () => {
      throw new Error('nope');
    };
    const app = await renderRouter({ _layout: { default: () => <Slot />, ErrorBoundary } as never, index: { default: Broken, ErrorBoundary } as never }, { initialUrl: '/' });
    expect(app.getByTestId('crash-screen')).toBeTruthy();
  });
});
