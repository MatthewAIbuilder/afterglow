import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert, Linking, Share } from 'react-native';
import { renderRouter } from 'expo-router/testing-library';
import RootLayout from '../_layout';
import TabsLayout from '../(tabs)/_layout';
import DiscoverScreen from '../(tabs)/index';
import FestivalsScreen from '../(tabs)/festivals';
import SoundScreen from '../(tabs)/sound';
import ArtistScreen from '../artist/[id]';
import FestivalScreen from '../festival/[id]';
import PosterScreen from '../poster/[id]';
import SavedScreen from '../saved';
import WelcomeScreen from '../welcome';
import TuneScreen from '../tune/[id]';
import DiscoverFocusScreen from '../discover-focus';
import LineupScreen from '../(tabs)/lineup';
import ProfileScreen from '../(tabs)/profile';
import NotificationsScreen from '../notifications';
import YourSoundScreen from '../your-sound';

/**
 * Smoke tests for every screen: rendered with the real catalogue through the
 * real routes and providers, the way Expo Router does it on the phone. They
 * catch a screen that crashes or shows nothing before anyone opens the app.
 */
function renderApp(initialUrl: string) {
  return renderRouter(
    {
      _layout: RootLayout,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': DiscoverScreen,
      '(tabs)/sound': SoundScreen,
      '(tabs)/festivals': FestivalsScreen,
      'artist/[id]': ArtistScreen,
      'festival/[id]': FestivalScreen,
      'poster/[id]': PosterScreen,
      saved: SavedScreen,
      welcome: WelcomeScreen,
      'tune/[id]': TuneScreen,
      'discover-focus': DiscoverFocusScreen,
      '(tabs)/lineup': LineupScreen,
      '(tabs)/profile': ProfileScreen,
      notifications: NotificationsScreen,
      'your-sound': YourSoundScreen,
    },
    { initialUrl },
  );
}

/** Let effects, storage reads and the next animation frame run. */
const settle = () =>
  act(async () => {
    jest.advanceTimersByTime(50);
    await Promise.resolve();
  });

beforeEach(async () => {
  // Every test starts as a fresh install: nothing liked, rated or planned. Past the welcome, except where it's tested.
  await AsyncStorage.clear();
  await AsyncStorage.setItem('welcomed.v1', 'true');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Welcome', () => {
  const firstRun = async (url = '/') => {
    await AsyncStorage.removeItem('welcomed.v1');
    const app = await renderApp(url);
    await settle();
    await settle();
    return app;
  };

  it('walks a newcomer from hello to their festival, then into Tune', async () => {
    const app = await firstRun();
    expect(app.getByText('Get started')).toBeTruthy();
    await fireEvent.press(app.getByText('Get started'));
    await settle();
    expect(app.getByText('Where are you going?')).toBeTruthy();
    expect(app.getByText('Not sure yet')).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^EDC Orlando 2026, /));
    await settle();
    await fireEvent.press(app.getByText('Continue'));
    await settle();
    expect(app.getByText('Tell us what you love')).toBeTruthy();
    await fireEvent.press(app.getByText('Tune your lineup'));
    await settle();
    expect(app.getByText(/1 of 110/)).toBeTruthy();
    expect(await AsyncStorage.getItem('welcomed.v1')).toBe('true');
    expect(JSON.parse((await AsyncStorage.getItem('going.v1')) ?? '[]')).toEqual(['edc-orlando-26']);
  });

  it('can be skipped, and is remembered', async () => {
    const app = await firstRun();
    await fireEvent.press(app.getByLabelText('Skip the welcome'));
    await settle();
    expect(app.queryByText('Get started')).toBeNull();
    // Remembered, so the next launch goes straight in (see the test for people who've used the app).
    expect(await AsyncStorage.getItem('welcomed.v1')).toBe('true');
  });

  it('starts watching without a festival picked', async () => {
    const app = await firstRun();
    await fireEvent.press(app.getByText('Get started'));
    await settle();
    await fireEvent.press(app.getByText('Not sure yet'));
    await settle();
    expect(app.getByText('Start with the sets')).toBeTruthy();
    await fireEvent.press(app.getByText('Start watching'));
    await settle();
    expect(app.queryByText('Start with the sets')).toBeNull();
    expect(app.getByText(/Live sets from the lineup/)).toBeTruthy();
  });

  it('is never shown to someone who has used the app', async () => {
    await AsyncStorage.removeItem('welcomed.v1');
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ wooli: 'love' }));
    const app = await renderApp('/');
    await settle();
    await settle();
    expect(app.queryByText('Get started')).toBeNull();
    expect(await AsyncStorage.getItem('welcomed.v1')).toBe('true');
  });
});

describe('Festivals', () => {
  it('lists EDC Orlando first, with every festival', async () => {
    const app = await renderApp('/festivals');
    await settle();
    expect(app.getByText('EDC Orlando 2026')).toBeTruthy();
    expect(app.getByText('Solstice 2026')).toBeTruthy();
    expect(app.getByText('Horizon 2027')).toBeTruthy();
  });

  it('jumps from a festival card straight into its clips', async () => {
    const app = await renderApp('/festivals');
    await settle();
    await fireEvent.press(app.getByLabelText('Discover the lineup, 2 clips'));
    await settle();
    await settle();
    expect(app.getByLabelText(/^EDC Orlando 2026, live sets from the lineup/)).toBeTruthy();
  });

  it('finds an artist at any festival from the Festivals tab', async () => {
    const app = await renderApp('/festivals');
    await settle();
    await fireEvent.changeText(app.getByLabelText('Find an artist at any festival'), 'wool');
    await settle();
    expect(app.getByLabelText(/^WOOLI, \d+ percent match, Plays EDC Orlando 2026$/)).toBeTruthy();
    expect(app.queryByText('Solstice 2026')).toBeNull();
    await fireEvent.changeText(app.getByLabelText('Find an artist at any festival'), 'zzz');
    await settle();
    expect(app.getByText('No artist matches “zzz”.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Clear the search'));
    await settle();
    expect(app.getByText('Solstice 2026')).toBeTruthy();
  });

  it('opens EDC Orlando with its plan, a short explore list and the full lineup', async () => {
    const app = await renderApp('/festival/edc-orlando-26');
    await settle();
    expect(app.getByText('EDC Orlando 2026')).toBeTruthy();
    expect(app.getByText('Tune your lineup')).toBeTruthy();
    expect(app.getByText('110 to rate')).toBeTruthy();
    expect(app.getByText('Your festival')).toBeTruthy();
    expect(app.getByText(/more to explore in the full lineup below/)).toBeTruthy();
    expect(app.getByText('Full lineup')).toBeTruthy();
    expect(app.getAllByText('WOOLI').length).toBeGreaterThan(0);
    // The countdown and the poster's set notes.
    expect(app.getByText(/^(In \d+ (days|months)|Tomorrow|Happening now|Over)$/)).toBeTruthy();
    expect(app.getAllByText('Sunset set').length).toBeGreaterThan(0);
  });

  it('marks a festival you are going to, and lists it first under Going', async () => {
    const page = await renderApp('/festival/horizon-27');
    await settle();
    await fireEvent.press(page.getByLabelText("I'm going to Horizon 2027"));
    await settle();
    expect(page.getByText('Going')).toBeTruthy();

    const list = await renderApp('/festivals');
    await settle();
    const titles = () =>
      list.getAllByText(/^(Going|More festivals|EDC Orlando 2026|Solstice 2026|Horizon 2027)$/).map((t) => t.props.children);
    // The rest wait behind "More festivals" until you open it.
    expect(titles()).toEqual(['Going', 'Horizon 2027', 'More festivals']);
    await fireEvent.press(list.getByLabelText('More festivals, 2. Show them'));
    await settle();
    expect(titles()).toEqual(['Going', 'Horizon 2027', 'More festivals', 'EDC Orlando 2026', 'Solstice 2026']);
    await fireEvent.press(list.getByLabelText('More festivals, 2. Hide them'));
    await settle();
    expect(titles()).toEqual(['Going', 'Horizon 2027', 'More festivals']);
  });

  it('finds an artist on a big lineup', async () => {
    const app = await renderApp('/festival/edc-orlando-26');
    await settle();
    const row = (name: string) => app.queryByLabelText(new RegExp(`^${name}, \\d+ percent match`));
    expect(row('ALESSO')).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Find an artist on the EDC Orlando 2026 lineup'), 'wool');
    await settle();
    expect(row('WOOLI')).toBeTruthy();
    expect(row('ALESSO')).toBeNull();
    await fireEvent.changeText(app.getByLabelText('Find an artist on the EDC Orlando 2026 lineup'), 'zzz');
    await settle();
    expect(app.getByText('No one on the lineup matches “zzz”.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Clear the search'));
    await settle();
    expect(row('ALESSO')).toBeTruthy();
  });

  it('shows your ratings in the lineup', async () => {
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ wooli: 'love', alesso: 'pass' }));
    const app = await renderApp('/festival/edc-orlando-26');
    await settle();
    expect(app.getByLabelText(/^WOOLI, \d+ percent match, you love their sound/)).toBeTruthy();
    expect(app.getByLabelText(/^ALESSO, \d+ percent match, .*Not for you$/)).toBeTruthy();
  });

  it('narrows a big lineup to one sound', async () => {
    const app = await renderApp('/festival/edc-orlando-26');
    await settle();
    const row = (name: string) => app.queryByLabelText(new RegExp(`^${name}, \\d+ percent match`));
    await fireEvent.press(app.getByLabelText(/^Dubstep, \d+ artists on the EDC Orlando 2026 lineup$/));
    await settle();
    expect(row('WOOLI')).toBeTruthy();
    expect(row('ALESSO')).toBeNull();
    await fireEvent.changeText(app.getByLabelText('Find an artist on the EDC Orlando 2026 lineup'), 'alesso');
    await settle();
    expect(app.getByText('No dubstep artist on the lineup matches “alesso”.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('All sounds on the EDC Orlando 2026 lineup'));
    await settle();
    expect(row('ALESSO')).toBeTruthy();
    expect(row('WOOLI')).toBeNull();
  });

  it('shares your plan from the share sheet', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const app = await renderApp('/festival/solstice-26');
    await settle();
    await fireEvent.press(app.getByLabelText('Share your plan for Solstice 2026'));
    expect(share).toHaveBeenCalledTimes(1);
    const { message } = share.mock.calls[0][0] as { message: string };
    expect(message.startsWith('My Solstice 2026')).toBe(true);
    expect(message).toContain('ILLENIUM');
    share.mockRestore();
  });

  it('shows the day-by-day plan for a festival with set times', async () => {
    const app = await renderApp('/festival/solstice-26');
    await settle();
    expect(app.getByText('Solstice 2026')).toBeTruthy();
    expect(app.getByText('Set times are out')).toBeTruthy();
    expect(app.getAllByText(/Friday/).length).toBeGreaterThan(0);
  });
});

describe('Tune your lineup', () => {
  it('goes through the lineup, rates, undoes and skips', async () => {
    const app = await renderApp('/tune/edc-orlando-26');
    await settle();
    expect(app.getByText('A LITTLE SOUND')).toBeTruthy();
    expect(app.getByText(/1 of 110/)).toBeTruthy();

    await fireEvent.press(app.getByLabelText("Love A LITTLE SOUND's sound"));
    await settle();
    expect(app.getByText('AARON HIBELL')).toBeTruthy();
    expect(app.getByText(/2 of 110/)).toBeTruthy();

    await fireEvent.press(app.getByLabelText('Undo the last answer'));
    await settle();
    expect(app.getByText('A LITTLE SOUND')).toBeTruthy();

    await fireEvent.press(app.getByLabelText("I don't know A LITTLE SOUND. Skip without rating."));
    await settle();
    await fireEvent.press(app.getByLabelText('AARON HIBELL is not for me'));
    await settle();
    expect(app.getByText('AAT')).toBeTruthy();
    expect(app.getByText(/3 of 110/)).toBeTruthy();
  });

  it('offers to listen on YouTube before answering', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp('/tune/edc-orlando-26');
    await settle();
    await fireEvent.press(app.getByLabelText('Listen to A LITTLE SOUND on YouTube'));
    expect(open).toHaveBeenCalledWith('https://www.youtube.com/results?search_query=A%20LITTLE%20SOUND%20live%20set');
    // Still on the same card, nothing answered.
    expect(app.getByText(/1 of 110/)).toBeTruthy();
    open.mockRestore();
  });

  it('says who an artist sounds like among ones you love', async () => {
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ alesso: 'love' }));
    const app = await renderApp('/tune/edc-orlando-26');
    await settle();
    // No sound known for A LITTLE SOUND, so no hint.
    expect(app.getByText('A LITTLE SOUND')).toBeTruthy();
    expect(app.queryByText(/^Sounds like /)).toBeNull();
    await fireEvent.press(app.getByLabelText("I don't know A LITTLE SOUND. Skip without rating."));
    await settle();
    // AARON HIBELL is house, like ALESSO.
    expect(app.getByText('AARON HIBELL')).toBeTruthy();
    expect(app.getByText(/^Sounds like .*ALESSO/)).toBeTruthy();
  });
});

describe('Artist', () => {
  it('rates an artist from their page, in a festival’s context', async () => {
    const app = await renderApp('/artist/wooli?festival=edc-orlando-26');
    await settle();
    expect(app.getByText('WOOLI')).toBeTruthy();
    expect(app.getByText('Mark as must see')).toBeTruthy();
    await fireEvent.press(app.getByText('Love their sound'));
    await settle();
    expect(app.getByText('You love their sound')).toBeTruthy();
    await fireEvent.press(app.getByText('You love their sound'));
    await settle();
    expect(app.getByText('Love their sound')).toBeTruthy();
  });

  it('suggests similar artists from the same lineup, keeping the festival', async () => {
    const app = await renderApp('/artist/wooli?festival=edc-orlando-26');
    await settle();
    expect(app.getByText('Similar sound at EDC Orlando 2026')).toBeTruthy();
    const [first] = app.getAllByLabelText(/, \d+ percent match$/);
    await fireEvent.press(first);
    await settle();
    // Still in EDC's context: the must-see star is there.
    expect(app.getAllByText('Mark as must see').length).toBeGreaterThan(0);
    expect(app.getAllByText('Similar sound at EDC Orlando 2026').length).toBeGreaterThan(0);
  });

  it('says what a match rests on', async () => {
    const fresh = await renderApp('/artist/wooli');
    await settle();
    expect(fresh.getByText(/^(From sounds you like|A first guess)/)).toBeTruthy();
    fresh.unmount();

    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ illenium: 'love' }));
    await AsyncStorage.setItem('reactions.v1', JSON.stringify({ c1: { liked: true, saved: false, skipped: false } }));
    const app = await renderApp('/artist/illenium');
    await settle();
    expect(app.getByText('From your rating and 1 like')).toBeTruthy();
  });

  it('links out to listen to an artist', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp('/artist/wooli');
    await settle();
    await fireEvent.press(app.getByLabelText('Listen to WOOLI on Spotify'));
    expect(open).toHaveBeenCalledWith('https://open.spotify.com/search/WOOLI');
    open.mockRestore();
  });

  it('shows a demo artist with clips and similar sounds', async () => {
    const app = await renderApp('/artist/levity');
    await settle();
    expect(app.getByText('LEVITY')).toBeTruthy();
    expect(app.getByText('Live clips')).toBeTruthy();
    expect(app.getByText('Similar sound')).toBeTruthy();
    expect(app.getByText('Playing')).toBeTruthy();
  });
});

describe('My Sound', () => {
  it('draws the map', async () => {
    const app = await renderApp('/sound');
    await settle();
    // The title, and the tab bar's label.
    expect(app.getAllByText('My Sound').length).toBeGreaterThan(0);
    expect(app.getByText(/Bigger means a closer match/)).toBeTruthy();
    expect(app.queryByLabelText('Start your sound over')).toBeNull();
  });

  it('rates an artist from the map, which reshapes when the sheet closes', async () => {
    const app = await renderApp('/sound');
    await settle();
    await fireEvent(app.getByLabelText(/^ILLENIUM, \d+ percent match$/), 'accessibilityTap');
    await settle();
    await fireEvent.press(app.getByLabelText("Love ILLENIUM's sound"));
    await settle();
    expect(app.getByLabelText("You love ILLENIUM's sound. Tap to undo.")).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('artistRatings.v1')) ?? '{}')).toEqual({ illenium: 'love' });
    await fireEvent.press(app.getByLabelText('Close artist details'));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(app.getByText(/^Shaped by your 1 rated artist\. Leaning [a-z ]+\.$/)).toBeTruthy();
  });

  it('narrows the map to one festival, and offers to rate a sparse lineup', async () => {
    const app = await renderApp('/sound');
    await settle();
    expect(app.getByLabelText('Your sound across every artist').props.accessibilityState).toEqual({ selected: true });
    expect(app.queryByText(/on your map (yet|so far)/)).toBeNull();
    await fireEvent.press(app.getByLabelText('Your sound at EDC Orlando 2026'));
    await settle();
    expect(app.getByText(/of EDC Orlando 2026’s 110 artists (is|are) on your map so far\. Rate the lineup/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Tune your lineup\. Rate 110 artists/));
    await settle();
    expect(app.getByText('Tune your lineup')).toBeTruthy();
  });

  it('opens on a festival from a link', async () => {
    const app = await renderApp('/sound?festival=edc-orlando-26');
    await settle();
    expect(app.getByLabelText('Your sound at EDC Orlando 2026').props.accessibilityState).toEqual({ selected: true });
  });

  it('starts your sound over, keeping your plans', async () => {
    await AsyncStorage.setItem('reactions.v1', JSON.stringify({ c1: { liked: true, saved: false, skipped: false } }));
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ wooli: 'love' }));
    await AsyncStorage.setItem('going.v1', JSON.stringify(['edc-orlando-26']));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const app = await renderApp('/sound');
    await settle();
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(app.getByText(/^Shaped by your 1 like and 1 rated artist\. Leaning [a-z ]+\.$/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Start your sound over'));
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(app.getByText(/^Bigger means a closer match/)).toBeTruthy();
    expect(app.queryByLabelText('Start your sound over')).toBeNull();
    await settle();
    expect(JSON.parse((await AsyncStorage.getItem('reactions.v1')) ?? 'null')).toEqual({});
    expect(JSON.parse((await AsyncStorage.getItem('artistRatings.v1')) ?? 'null')).toEqual({});
    expect(JSON.parse((await AsyncStorage.getItem('going.v1')) ?? 'null')).toEqual(['edc-orlando-26']);
    alert.mockRestore();
  });
});

describe('Your clips', () => {
  it('opens your clips from My Sound, and unsaves with an undo', async () => {
    await AsyncStorage.setItem('reactions.v1', JSON.stringify({ c1: { liked: false, saved: true, skipped: false } }));
    const app = await renderApp('/sound');
    await settle();
    await fireEvent.press(app.getByLabelText('Your clips, 1'));
    await settle();
    expect(app.getByText('What you saved to watch again, and what you liked.')).toBeTruthy();
    expect(app.queryByText('Liked')).toBeNull();
    expect(app.getByLabelText(/^Play ILLENIUM, /)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Remove ILLENIUM from saved'));
    await settle();
    // Still listed, so the slip can be undone.
    await fireEvent.press(app.getByLabelText('Save ILLENIUM again'));
    await settle();
    expect(app.getByLabelText('Remove ILLENIUM from saved')).toBeTruthy();
  });

  it('lists liked clips under Liked, and unlikes with an undo', async () => {
    await AsyncStorage.setItem(
      'reactions.v1',
      JSON.stringify({
        c1: { liked: true, saved: true, skipped: false },
        c2: { liked: true, saved: false, skipped: false },
      }),
    );
    const app = await renderApp('/sound');
    await settle();
    // Saved and liked counts once.
    await fireEvent.press(app.getByLabelText('Your clips, 2'));
    await settle();
    expect(app.getByText('Saved')).toBeTruthy();
    expect(app.getByText('Liked')).toBeTruthy();
    expect(app.getByLabelText('Remove ILLENIUM from saved')).toBeTruthy();
    const unlike = app.getByLabelText(/^Unlike /);
    const name = String(unlike.props.accessibilityLabel).replace('Unlike ', '');
    await fireEvent.press(unlike);
    await settle();
    await fireEvent.press(app.getByLabelText(`Like ${name} again`));
    await settle();
    expect(app.getByLabelText(`Unlike ${name}`)).toBeTruthy();
  });

  it('explains how to fill it when there is nothing yet', async () => {
    const app = await renderApp('/saved');
    await settle();
    expect(app.getByText(/Nothing here yet/)).toBeTruthy();
  });
});

describe('Discover', () => {
  it('opens on the festival with the most clips and shows the first clip', async () => {
    const app = await renderApp('/');
    await settle();
    await settle();
    expect(app.getByText('Solstice 2026')).toBeTruthy();
    expect(app.getByText(/Live sets from the lineup/)).toBeTruthy();
    expect(app.getAllByText('ILLENIUM').length).toBeGreaterThan(0);
  });

  it('shares a clip with a link to that moment on YouTube', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const app = await renderApp('/');
    await settle();
    await settle();
    await fireEvent.press(app.getAllByLabelText('Share this clip of ILLENIUM')[0]);
    expect(share).toHaveBeenCalledTimes(1);
    const { message } = share.mock.calls[0][0] as { message: string };
    expect(message).toMatch(/^ILLENIUM, /);
    expect(message).toMatch(/https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}&t=\d+s/);
    expect(message).toContain('Playing Solstice 2026');
    expect(message).toContain('Found on Afterglow');
    share.mockRestore();
  });

  it('shows a first-time tip, and none to someone who already uses the app', async () => {
    const fresh = await renderApp('/');
    await settle();
    await settle();
    expect(fresh.getByLabelText('Tip: Swipe up for the next clip')).toBeTruthy();
    fresh.unmount();

    await AsyncStorage.setItem('seen.v1', JSON.stringify({ c1: 1, c2: 2 }));
    await AsyncStorage.setItem('reactions.v1', JSON.stringify({ c1: { liked: true, saved: false, skipped: false } }));
    const regular = await renderApp('/');
    await settle();
    await settle();
    expect(regular.queryByLabelText(/^Tip: /)).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('hints.v1')) ?? '[]')).toEqual(['swipe', 'like']);
  });

  it('keeps the swipe tip when Discover opens straight on a clip', async () => {
    const app = await renderApp('/?clip=c2');
    await settle();
    await settle();
    expect(app.getByLabelText('Tip: Swipe up for the next clip')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('hints.v1')) ?? '[]')).toEqual([]);
  });

  it('moves on to the next tip once you have swiped', async () => {
    await AsyncStorage.setItem('seen.v1', JSON.stringify({ c1: 1, c2: 2 }));
    const app = await renderApp('/');
    await settle();
    await settle();
    expect(app.getByLabelText('Tip: Double-tap a clip to like it')).toBeTruthy();
  });

  it('moves to a festival the artist plays when a clip needs it', async () => {
    // ILLENIUM doesn't play Horizon, so asking for their clip there moves Discover to Solstice.
    const app = await renderApp('/?festival=horizon-27');
    await settle();
    expect(app.getByText('Horizon 2027')).toBeTruthy();
    const next = await renderApp('/?clip=c1');
    await settle();
    expect(next.getByText('Solstice 2026')).toBeTruthy();
  });

  it('ends the feed with where to go next', async () => {
    // EDC has only LEVITY's two demo clips, so the end of its feed is in view.
    const app = await renderApp('/?festival=edc-orlando-26');
    await settle();
    expect(app.getByText('You’ve seen every clip from EDC Orlando 2026')).toBeTruthy();
    expect(app.getByLabelText('Tune your lineup, 110 to rate')).toBeTruthy();
    expect(app.getByLabelText('See your festival')).toBeTruthy();
    expect(app.getByLabelText('Discover Solstice 2026')).toBeTruthy();
    expect(app.getByLabelText('Watch again from the top')).toBeTruthy();
  });

  it('picks what to discover from the header, including your mix, and remembers it', async () => {
    const app = await renderApp('/');
    await settle();
    await settle();
    await fireEvent.press(app.getByLabelText(/^Solstice 2026, live sets from the lineup\. Choose what to discover\.$/));
    await settle();
    expect(app.getByText('What to discover')).toBeTruthy();
    expect(app.getByLabelText(/^EDC Orlando 2026, 2 clips/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Your mix, A bit of everything, from every lineup'));
    await settle();
    await settle();
    expect(app.getByText('Your mix')).toBeTruthy();
    expect(app.getByText('A bit of everything, from every lineup')).toBeTruthy();
    expect(await AsyncStorage.getItem('discoverFocus.v1')).toBe('mix');
  });

  it('opens where you left it', async () => {
    await AsyncStorage.setItem('discoverFocus.v1', 'mix');
    const app = await renderApp('/');
    await settle();
    await settle();
    expect(app.getByText('Your mix')).toBeTruthy();
  });

  it('opens on a festival you are going to', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['horizon-27']));
    const app = await renderApp('/');
    await settle();
    await settle();
    expect(app.getByText('Horizon 2027')).toBeTruthy();
  });

  it('refocuses on a festival from its page', async () => {
    const app = await renderApp('/?festival=horizon-27');
    await settle();
    await settle();
    expect(app.getByText('Horizon 2027')).toBeTruthy();
  });
});

describe('Lineup tab', () => {
  it('shows every lineup with a nudge until you pick a festival', async () => {
    const app = await renderApp('/lineup');
    await settle();
    expect(app.getByText('Lineups')).toBeTruthy();
    expect(app.getByText(/Tap “I’m going” on a festival/)).toBeTruthy();
    expect(app.getByText('Full lineup')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Show the Horizon 2027 lineup'));
    await settle();
    expect(app.getAllByText('Horizon 2027').length).toBeGreaterThan(1);
  });

  it('becomes your lineup for the festival you are going to', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['edc-orlando-26']));
    const app = await renderApp('/lineup');
    await settle();
    expect(app.getByText('Your lineup')).toBeTruthy();
    expect(app.getByText('EDC Orlando 2026')).toBeTruthy();
    expect(app.queryByLabelText(/^Show the /)).toBeNull();
  });
});

describe('Profile tab', () => {
  it('shows what you have built so far and what is coming', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['edc-orlando-26']));
    const app = await renderApp('/profile');
    await settle();
    expect(app.getByLabelText('1 festival')).toBeTruthy();
    expect(app.getByLabelText('0 artists rated')).toBeTruthy();
    expect(app.getByText('Your festival profile')).toBeTruthy();
  });
});

describe('Notifications', () => {
  it('rings for set times at a festival you are going to, and clears once read', async () => {
    // Solstice's demo lineup has set times.
    await AsyncStorage.setItem('going.v1', JSON.stringify(['solstice-26']));
    const app = await renderApp('/festivals');
    await settle();
    await settle();
    await fireEvent.press(app.getByLabelText(/^Notifications, \d+ new$/));
    await settle();
    expect(app.getByText('Set times are out for Solstice 2026')).toBeTruthy();
    await settle();
    expect(JSON.parse((await AsyncStorage.getItem('noticesRead.v1')) ?? '[]')).toContain('sets:solstice-26');
  });

  it('explains what will show when there is nothing yet', async () => {
    const app = await renderApp('/festivals');
    await settle();
    await fireEvent.press(app.getByLabelText('Notifications'));
    await settle();
    expect(app.getByText(/Nothing new/)).toBeTruthy();
  });
});

describe('Sound breakdowns', () => {
  it('shows an artist’s sound as a mix', async () => {
    const app = await renderApp('/artist/illenium');
    await settle();
    expect(app.getByText('Their sound')).toBeTruthy();
    expect(app.getByLabelText('Melodic bass, 80 percent')).toBeTruthy();
    expect(app.getByLabelText('Dubstep, 20 percent')).toBeTruthy();
  });

  it('breaks your sound down from My Sound, for everyone or one festival', async () => {
    const app = await renderApp('/sound');
    await settle();
    await fireEvent.press(app.getByLabelText('Your sound, as a breakdown'));
    await settle();
    expect(app.getByText('Your sound')).toBeTruthy();
    expect(app.getByText(/A first guess/)).toBeTruthy();
    expect(app.getAllByLabelText(/, \d+ percent$/).length).toBeGreaterThan(1);
  });

  it('breaks down your sound at one festival', async () => {
    const app = await renderApp('/your-sound?festival=solstice-26');
    await settle();
    expect(app.getByText('Your sound at Solstice 2026')).toBeTruthy();
  });
});
