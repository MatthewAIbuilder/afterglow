import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Platform, Share } from 'react-native';
import { DialogHost } from '../../components/DialogHost';
import { pickVideo, deviceMemoryFiles } from '../../features/memories/device.web';
import { closeDialog, showActionSheet, showAlert, subscribeDialogs, type WebDialog } from '../dialog';
import { shareMessage } from '../share';
import { versionLine } from '../version';

/** The pieces that make Afterglow work in a browser: dialogs, sharing, the version line, Memories saying where it works. */
const asWeb = () => jest.replaceProperty(Platform, 'OS', 'web');
const current = () => {
  let q: WebDialog[] = [];
  subscribeDialogs((x) => (q = x))();
  return q;
};

afterEach(() => {
  jest.restoreAllMocks();
  for (const d of current()) closeDialog(d.id);
});

describe('dialogs', () => {
  it('on a phone: the system alert, with exactly what was given', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    showAlert('Copied', 'Paste it wherever you like.');
    expect(alert).toHaveBeenCalledWith('Copied', 'Paste it wherever you like.');
    const buttons = [{ text: 'OK' }];
    showAlert('Title', undefined, buttons);
    expect(alert).toHaveBeenLastCalledWith('Title', undefined, buttons);
  });

  it('on an iPhone a sheet is the action sheet, dark', () => {
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation((_o, cb) => cb(1));
    const picked: number[] = [];
    showActionSheet({ options: ['A', 'B', 'Cancel'], cancelButtonIndex: 2 }, (i) => picked.push(i));
    expect(sheet).toHaveBeenCalledWith(expect.objectContaining({ options: ['A', 'B', 'Cancel'], userInterfaceStyle: 'dark' }), expect.any(Function));
    expect(picked).toEqual([1]);
  });

  it('in a browser: queued for the app to show; a button runs its action, dismissing runs cancel', () => {
    asWeb();
    const ran: string[] = [];
    showAlert('Block @maya?', 'They aren’t told.', [
      { text: 'Cancel', style: 'cancel', onPress: () => ran.push('cancel') },
      { text: 'Block', style: 'destructive', onPress: () => ran.push('block') },
    ]);
    const [d] = current();
    expect(d).toMatchObject({ title: 'Block @maya?', sheet: false, cancelable: true });
    closeDialog(d.id, d.buttons[1]);
    expect(ran).toEqual(['block']);
    showAlert('Again', undefined, [{ text: 'Cancel', style: 'cancel', onPress: () => ran.push('cancel') }, { text: 'Go' }]);
    closeDialog(current()[0].id);
    expect(ran).toEqual(['block', 'cancel']);
    expect(current()).toEqual([]);
  });

  it('in a browser a sheet lists its choices; dismissing picks cancel', () => {
    asWeb();
    const picked: number[] = [];
    showActionSheet({ title: 'Add a memory', options: ['Record', 'Choose', 'Cancel'], cancelButtonIndex: 2, destructiveButtonIndex: 0 }, (i) => picked.push(i));
    const [d] = current();
    expect(d.sheet).toBe(true);
    expect(d.buttons.map((b) => b.style)).toEqual(['destructive', 'default', 'cancel']);
    closeDialog(d.id);
    expect(picked).toEqual([2]);
  });

  it('on Android: three choices or fewer are the system alert; a longer list is the app’s own sheet, so none go missing', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const picked: number[] = [];
    showActionSheet({ options: ['A', 'B', 'Cancel'], cancelButtonIndex: 2 }, (i) => picked.push(i));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(current()).toEqual([]);
    const options = ['Love them', 'Like them', 'They’re OK', 'Not really', 'Not for me', 'Cancel'];
    const app = await render(<DialogHost />);
    await act(async () => showActionSheet({ title: 'How do you feel about SUBTRONICS?', options, cancelButtonIndex: 5 }, (i) => picked.push(i)));
    expect(alert).toHaveBeenCalledTimes(1);
    for (const o of options) expect(app.getByRole('button', { name: o })).toBeTruthy();
    await fireEvent.press(app.getByRole('button', { name: 'Not really' }));
    expect(picked).toEqual([3]);
  });

  it('DialogHost shows one at a time in a browser, and nothing on a phone', async () => {
    const phone = await render(<DialogHost />);
    expect(phone.toJSON()).toBeNull();
    await phone.unmount();
    asWeb();
    const ran: string[] = [];
    const app = await render(<DialogHost />);
    await act(async () => {
      showAlert('Start over?', 'This clears your likes.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Start over', style: 'destructive', onPress: () => ran.push('start') }]);
      showAlert('Second');
    });
    expect(app.getByText('Start over?')).toBeTruthy();
    expect(app.queryByText('Second')).toBeNull();
    await fireEvent.press(app.getByRole('button', { name: 'Start over' }));
    expect(ran).toEqual(['start']);
    expect(await app.findByText('Second')).toBeTruthy();
  });
});

describe('sharing', () => {
  it('on a phone: the share sheet; a dismissed sheet says so', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction } as never);
    expect(await shareMessage('hi', 'Title')).toBe('dismissed');
    expect(share).toHaveBeenCalledWith({ title: 'Title', message: 'hi' });
  });

  it('in a browser without a share sheet: copied, and we say so', async () => {
    asWeb();
    const writeText = jest.fn(async (_t: string) => {});
    const nav = globalThis.navigator as unknown as Record<string, unknown>;
    const had = { share: nav.share, clipboard: nav.clipboard };
    Object.defineProperty(nav, 'share', { value: undefined, configurable: true });
    Object.defineProperty(nav, 'clipboard', { value: { writeText }, configurable: true });
    try {
      expect(await shareMessage('afterglowmusic.app/u/maya')).toBe('copied');
      expect(writeText).toHaveBeenCalledWith('afterglowmusic.app/u/maya');
      expect(current()[0]).toMatchObject({ title: 'Copied' });
    } finally {
      Object.defineProperty(nav, 'share', { value: had.share, configurable: true });
      Object.defineProperty(nav, 'clipboard', { value: had.clipboard, configurable: true });
    }
  });
});

describe('the rest', () => {
  it('the version line names the build it came from', () => {
    expect(versionLine('1.0.0', '3f2a9c1d8e')).toBe('Afterglow 1.0.0 · build 3f2a9c1');
    expect(versionLine('1.0.0', undefined)).toBe('Afterglow 1.0.0');
    expect(versionLine(undefined, undefined)).toBe('Afterglow');
  });

  it('Memories on the website say they’re in the app, and keep nothing', async () => {
    expect(await pickVideo('library')).toEqual({ ok: false, reason: 'app-only' });
    expect(deviceMemoryFiles.list()).toEqual([]);
    await expect(deviceMemoryFiles.keep('x', 'y')).rejects.toThrow();
  });
});
