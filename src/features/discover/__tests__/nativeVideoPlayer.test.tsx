import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { NativeVideoPlayer } from '../NativeVideoPlayer';

/** A crowd video in Discover: sized to its frame (a video tag on the website doesn't stretch by itself), and shown whole until its real shape is known. */
describe('the crowd video player', () => {
  it('fills its frame with a size of its own and shows the whole picture at first', async () => {
    const progress = { get: () => 0, set: () => {}, value: 0 } as never;
    const media = { provider: 'video', uri: 'https://x.test/v.mp4', community: {}, lengthSec: 10, vertical: true, credit: '', posterUrl: '' } as never;
    const app = await render(
      <NativeVideoPlayer media={media} active live={false} paused progress={progress} onPlayed={() => {}} onReady={() => {}} onStarted={() => {}} onFail={() => {}} onPausedChange={() => {}} />,
    );
    const view = app.getByTestId('video-view');
    expect(StyleSheet.flatten(view.props.style)).toMatchObject({ position: 'absolute', width: '100%', height: '100%' });
    // Marked upright, but nothing's known of its real shape yet: whole, not cropped.
    expect(view.props.contentFit).toBe('contain');
    await app.unmount();
  });
});
