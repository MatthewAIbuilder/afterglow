import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { ClipPlayer } from '../ClipPlayer';
import { clipMedia, type SoundCloudMedia } from '../media';
import { soundcloudClip } from '../soundcloud';
import { SoundCloudPlayer } from '../SoundCloudPlayer';

/** The SoundCloud card's player: plays only while its card is live, and follows your own play and pause. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const injected = (require('react-native-webview') as { __injected: string[] }).__injected;
const media = clipMedia(soundcloudClip('levity', { url: 'https://soundcloud.com/levity' })) as SoundCloudMedia;
const progress = { set: jest.fn(), get: () => 0, value: 0 } as unknown as SharedValue<number>;

type Props = { active: boolean; live: boolean; paused: boolean };
const handlers = () => ({ onPausedChange: jest.fn(), onReady: jest.fn(), onStarted: jest.fn(), onFail: jest.fn() });

afterEach(() => {
  injected.length = 0;
});

async function player(p: Props, h = handlers()) {
  const view = await render(<SoundCloudPlayer media={media} progress={progress} {...p} {...h} />);
  const web = view.getByLabelText('SoundCloud player');
  const send = (m: object) => act(() => web.props.onMessage({ nativeEvent: { data: JSON.stringify(m) } }));
  return { view, web, send, h, rerender: (q: Props) => view.rerender(<SoundCloudPlayer media={media} progress={progress} {...q} {...h} />) };
}

describe('the SoundCloud player', () => {
  it('opens SoundCloud’s embed of the artist’s page', async () => {
    const { web } = await player({ active: true, live: true, paused: false });
    expect(web.props.source.html).toContain('w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Flevity');
    expect(web.props.source.html).toContain('auto_play=true');
  });

  it('plays once ready while live, and pauses when you pause or leave', async () => {
    const { send, rerender, h } = await player({ active: true, live: true, paused: false });
    await send({ type: 'ready' });
    expect(h.onReady).toHaveBeenCalled();
    expect(injected.at(-1)).toContain('afterglow.play()');
    await rerender({ active: true, live: true, paused: true });
    expect(injected.at(-1)).toContain('afterglow.pause()');
    await rerender({ active: true, live: false, paused: false });
    expect(injected.at(-1)).toContain('afterglow.pause()');
  });

  it('a pause with SoundCloud’s own button is yours; progress moves the line', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const { send, h } = await player({ active: true, live: true, paused: false });
    await send({ type: 'ready' });
    now.mockReturnValue(1_010_000);
    await send({ type: 'progress', share: 0.25 });
    expect(progress.set).toHaveBeenCalledWith(0.25);
    await send({ type: 'pause' });
    expect(h.onPausedChange).toHaveBeenCalledWith(true);
    now.mockRestore();
  });

  it('an error falls back to the card’s stage', async () => {
    const { send, h } = await player({ active: true, live: true, paused: false });
    await send({ type: 'error' });
    expect(h.onFail).toHaveBeenCalled();
  });
});

describe('ClipPlayer with a SoundCloud page', () => {
  it('loads the player only while its card is on screen, so two never play at once', async () => {
    const h = handlers();
    const common = { media, progress, live: true, paused: false, load: true, onPausedChange: h.onPausedChange, onFail: h.onFail };
    const view = await render(<ClipPlayer {...common} active={false} />);
    expect(view.queryByLabelText('SoundCloud player')).toBeNull();
    await view.rerender(<ClipPlayer {...common} active />);
    expect(view.getByLabelText('SoundCloud player')).toBeTruthy();
    await view.rerender(<ClipPlayer {...common} active={false} />);
    expect(view.queryByLabelText('SoundCloud player')).toBeNull();
  });
});
