import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Linking, Share } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { renderApp, showTab } from './appRoutes';

/**
 * Smoke tests for every screen: rendered with the real catalogue through the
 * real routes and providers, the way Expo Router does it on the phone. They
 * catch a screen that crashes or shows nothing before anyone opens the app.
 */

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

  it('asks which weekend when you pick a two-weekend festival', async () => {
    const app = await firstRun();
    await fireEvent.press(app.getByText('Get started'));
    await settle();
    await fireEvent.press(app.getByLabelText(/^Austin City Limits 2026, /));
    await settle();
    await fireEvent.press(app.getByLabelText('Weekend 1 of Austin City Limits 2026, Oct 2 to 4'));
    await settle();
    expect(JSON.parse((await AsyncStorage.getItem('weekends.v1')) ?? '{}')).toEqual({ 'acl-26': 1 });
  });

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
    await fireEvent.press(app.getByText('Rate the lineup one by one'));
    await settle();
    expect(app.getByText(/1 of 110/)).toBeTruthy();
    expect(await AsyncStorage.getItem('welcomed.v1')).toBe('true');
    expect(JSON.parse((await AsyncStorage.getItem('going.v1')) ?? '[]')).toEqual(['edc-orlando-26']);
  });

  it('picks the artists you know from your festival, as loves', async () => {
    const app = await firstRun();
    await fireEvent.press(app.getByText('Get started'));
    await settle();
    await fireEvent.press(app.getByLabelText(/^Cyclops Cove 4, /));
    await settle();
    await fireEvent.press(app.getByText('Continue'));
    await settle();
    await fireEvent.press(app.getByText('Pick artists you know'));
    await settle();
    expect(app.getByText('Tap the artists you love')).toBeTruthy();
    expect(app.getByText('Skip for now')).toBeTruthy();
    await fireEvent.press(app.getByLabelText("Love HEDEX's sound"));
    await fireEvent.press(app.getByLabelText("Love HVDES's sound"));
    await fireEvent.press(app.getByLabelText('HVDES, you love their sound'));
    await settle();
    expect(app.getByText('Done · 1 picked')).toBeTruthy();
    await fireEvent.press(app.getByText('Done · 1 picked'));
    await settle();
    expect(JSON.parse((await AsyncStorage.getItem('artistRatings.v1')) ?? '{}')).toEqual({ hedex: 'love' });
    expect(await AsyncStorage.getItem('welcomed.v1')).toBe('true');
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
    expect(app.getByText('Pick artists you know')).toBeTruthy();
    await fireEvent.press(app.getByText('Start watching instead'));
    await settle();
    expect(app.queryByText('Pick artists you know')).toBeNull();
    expect(app.getByLabelText(/, live sets from the lineup\. Choose what to discover\.$/)).toBeTruthy();
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
    await fireEvent.press(app.getByLabelText('Discover the EDC Orlando 2026 lineup, 2 clips'));
    await settle();
    await settle();
    expect(app.getByLabelText(/^EDC Orlando 2026, live sets from the lineup/)).toBeTruthy();
  });

  it('finds an artist at any festival from the Festivals tab', async () => {
    const app = await renderApp('/festivals');
    await settle();
    await fireEvent.changeText(app.getByLabelText('Find an artist or festival'), 'wool');
    await settle();
    expect(app.getByLabelText(/^WOOLI, \d+ percent match, Plays EDC Orlando 2026$/)).toBeTruthy();
    expect(app.queryByText('Solstice 2026')).toBeNull();
    await fireEvent.changeText(app.getByLabelText('Find an artist or festival'), 'zzz');
    await settle();
    expect(app.getByText('No festival or artist matches “zzz”.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Clear the search'));
    await settle();
    expect(app.getByText('Solstice 2026')).toBeTruthy();
  });

  it('finds festivals by name or place, and offers to request one that is missing', async () => {
    const app = await renderApp('/festivals');
    await settle();
    await fireEvent.changeText(app.getByLabelText('Find an artist or festival'), 'orlando');
    await settle();
    expect(app.getByLabelText(/^EDC Orlando 2026, Nov 6 to 8, Tinker Field, Orlando/)).toBeTruthy();
    expect(app.getByLabelText(/^Eternal NYE 2026, /)).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Find an artist or festival'), 'Lost Lands');
    await settle();
    await fireEvent.press(app.getByLabelText("Can't find it? Request Lost Lands"));
    await settle();
    expect(app.getByText('Request a festival')).toBeTruthy();
    expect(app.getByLabelText('Festival name').props.value).toBe('Lost Lands');
  });

  it('sends a festival request by email to the team, and says thanks', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp('/request');
    await settle();
    await fireEvent.changeText(app.getByLabelText('Festival name'), 'Lost Lands 2027');
    await fireEvent.press(app.getByLabelText('Send request for Lost Lands 2027'));
    await settle();
    const url = open.mock.calls[0][0] as string;
    expect(url.startsWith('mailto:afterglowmusic.support@gmail.com?')).toBe(true);
    expect(decodeURIComponent(url)).toContain('Please add Lost Lands 2027 to Afterglow.');
    expect(app.getByText('Thanks for asking')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('festivalRequests.v1')) ?? '[]')[0].name).toBe('Lost Lands 2027');
    open.mockRestore();
  });

  it('without a mail app, a request goes through the share sheet instead', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no mail app'));
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const app = await renderApp('/request');
    await settle();
    await fireEvent.changeText(app.getByLabelText('Festival name'), 'Lost Lands 2027');
    await fireEvent.press(app.getByLabelText('Send request for Lost Lands 2027'));
    await settle();
    expect((share.mock.calls[0][0] as { message: string }).message).toContain('Please add Lost Lands 2027 to Afterglow.');
    expect(app.getByText('Thanks for asking')).toBeTruthy();
    open.mockRestore();
    share.mockRestore();
  });

  it('narrows a two-weekend festival to the weekend you are going to', async () => {
    const app = await renderApp('/festival/acl-26');
    await settle();
    expect(app.getByText('Your weekend')).toBeTruthy();
    await showTab(app, 'Lineup');
    await fireEvent.changeText(app.getByLabelText('Find an artist on the Austin City Limits 2026 lineup'), 'skrillex');
    await settle();
    expect(app.getAllByText('SKRILLEX').length).toBeGreaterThan(0);
    await fireEvent.press(app.getByLabelText('Weekend 2, Oct 9 to 11'));
    await settle();
    // SKRILLEX only plays weekend 1.
    expect(app.queryAllByText('SKRILLEX')).toHaveLength(0);
    expect(app.getByText(/Your plan and the lineup show weekend 2: \d+ of 138 acts\./)).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('weekends.v1')) ?? '{}')).toEqual({ 'acl-26': 2 });
  });

  it('lays out your picks day by day before set times, when the poster says who plays when', async () => {
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ lorde: 'love', skrillex: 'love' }));
    const app = await renderApp('/festival/acl-26');
    await settle();
    expect(app.getByLabelText('Your picks by day').props.accessibilityState).toEqual({ selected: true });
    expect(app.getAllByText(/^\d+ for you$/).length).toBeGreaterThan(0);
    expect(app.getByLabelText(/^LORDE, \d+% match/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Your picks ranked by match'));
    await settle();
    expect(app.queryAllByText(/^\d+ for you$/)).toHaveLength(0);
  });

  it('filters a big lineup by day', async () => {
    const app = await renderApp('/festival/acl-26');
    await settle();
    await showTab(app, 'Lineup');
    await fireEvent.press(app.getByLabelText(/^Sunday, \d+ artists$/));
    await settle();
    expect(app.getAllByText(/^Sunday/).length).toBeGreaterThan(0);
    expect(app.queryByText('Friday · Weekend 1 only')).toBeNull();
  });

  it('switches to square tiles, and remembers it', async () => {
    const app = await renderApp('/festivals');
    await settle();
    await fireEvent.press(app.getByLabelText('Show festivals as tiles'));
    await settle();
    expect(app.getByLabelText('Show festivals as cards')).toBeTruthy();
    expect(app.getByLabelText(/^EDC Orlando 2026, Nov 6 to 8, /)).toBeTruthy();
    expect(await AsyncStorage.getItem('festivalsView.v1')).toBe('grid');
  });

  it('opens EDC Orlando with its plan, a short explore list and the full lineup', async () => {
    const app = await renderApp('/festival/edc-orlando-26');
    await settle();
    expect(app.getByText('EDC Orlando 2026')).toBeTruthy();
    expect(app.getByLabelText(/^Tune your lineup\. Rate 110 artists/)).toBeTruthy();
    // For you first: your plan, with the rest of the explore picks in the Lineup tab.
    expect(app.getByRole('tab', { name: 'For you' }).props.accessibilityState).toEqual({ selected: true });
    expect(app.getByText(/more to explore in the Lineup tab/)).toBeTruthy();
    // The countdown, then the full lineup with the poster's set notes.
    expect(app.getByText(/^(In \d+ (days|months)|Tomorrow|Happening now|Over)$/)).toBeTruthy();
    await showTab(app, 'Lineup');
    expect(app.getByText('110 acts')).toBeTruthy();
    expect(app.getAllByText('WOOLI').length).toBeGreaterThan(0);
    expect(app.getAllByText('Sunset set').length).toBeGreaterThan(0);
  });

  it('opens Austin City Limits with the poster’s day and weekend for each act', async () => {
    const app = await renderApp('/festival/acl-26');
    await settle();
    expect(app.getByText('Austin City Limits 2026')).toBeTruthy();
    expect(app.getByLabelText(/^Tune your lineup\. Rate 138 artists/)).toBeTruthy();
    await showTab(app, 'Lineup');
    // Its pop, indie and rock acts can be picked out with the sound filter.
    expect(app.getByLabelText(/^Pop, \d+ artists on the Austin City Limits 2026 lineup$/)).toBeTruthy();
    expect(app.getByLabelText(/^Indie, \d+ artists on the Austin City Limits 2026 lineup$/)).toBeTruthy();
    expect(app.getByLabelText(/^Rock, \d+ artists on the Austin City Limits 2026 lineup$/)).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Find an artist on the Austin City Limits 2026 lineup'), 'skrillex');
    await settle();
    expect(app.getAllByText('Friday · Weekend 1 only').length).toBeGreaterThan(0);
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
      list.getAllByText(/^(Going|More festivals|EDC Orlando 2026|Austin City Limits 2026|Cyclops Cove 4|Eternal NYE 2026|Countdown NYE 2026|Solstice 2026|Horizon 2027)$/).map((t) => t.props.children);
    // The rest wait behind "More festivals" until you open it.
    expect(titles()).toEqual(['Going', 'Horizon 2027', 'More festivals']);
    await fireEvent.press(list.getByLabelText('More festivals, 6. Show them'));
    await settle();
    expect(titles()).toEqual(['Going', 'Horizon 2027', 'More festivals', 'EDC Orlando 2026', 'Austin City Limits 2026', 'Cyclops Cove 4', 'Eternal NYE 2026', 'Countdown NYE 2026', 'Solstice 2026']);
    await fireEvent.press(list.getByLabelText('More festivals, 6. Hide them'));
    await settle();
    expect(titles()).toEqual(['Going', 'Horizon 2027', 'More festivals']);
  });

  it('finds an artist on a big lineup', async () => {
    const app = await renderApp('/festival/edc-orlando-26');
    await settle();
    await showTab(app, 'Lineup');
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
    await showTab(app, 'Lineup');
    expect(app.getByLabelText(/^WOOLI, \d+ percent match, you love their sound/)).toBeTruthy();
    expect(app.getByLabelText(/^ALESSO, \d+ percent match, .*Not for you$/)).toBeTruthy();
  });

  it('narrows a big lineup to one sound', async () => {
    const app = await renderApp('/festival/edc-orlando-26');
    await settle();
    await showTab(app, 'Lineup');
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
    await settle();
    // A picture of the plan first, with the text one tap away.
    expect(app.getByText('Share your plan')).toBeTruthy();
    expect(app.getByLabelText('Your plan for Solstice 2026')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Share your plan as an image'));
    await settle();
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/plan.png', expect.objectContaining({ mimeType: 'image/png' }));
    await fireEvent.press(app.getByLabelText('Share your plan as text'));
    expect(share).toHaveBeenCalledTimes(1);
    const { message } = share.mock.calls[0][0] as { message: string };
    expect(message.startsWith('My Solstice 2026')).toBe(true);
    expect(message).toContain('ILLENIUM');
    share.mockRestore();
  });

  it('opens a warm-up playlist of live sets from your artists on YouTube', async () => {
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ illenium: 'love', subtronics: 'love', excision: 'like' }));
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const app = await renderApp('/festival/solstice-26');
    await settle();
    const card = app.getByLabelText(/^Warm-up playlist: live sets from .+\. Opens YouTube\.$/);
    await fireEvent.press(card);
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/www\.youtube\.com\/watch_videos\?video_ids=[\w-]{11}(,[\w-]{11})+$/));
    open.mockRestore();
  });

  it('turns your lineup into a festival poster to share', async () => {
    await AsyncStorage.setItem('artistRatings.v1', JSON.stringify({ illenium: 'love', subtronics: 'love', levity: 'like' }));
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const app = await renderApp('/festival/solstice-26');
    await settle();
    await fireEvent.press(app.getByLabelText('Share your plan for Solstice 2026'));
    await settle();
    await fireEvent.press(app.getByRole('tab', { name: 'Lineup poster' }));
    await settle();
    expect(app.getByLabelText(/^Your Solstice 2026 lineup poster: .*ILLENIUM/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Share your lineup as text'));
    const { message } = share.mock.calls[0][0] as { message: string };
    expect(message.split('\n')[0]).toBe('My Solstice 2026 lineup');
    expect(message).toContain('SUBTRONICS');
    share.mockRestore();
  });

  it('shows the day-by-day plan for a festival with set times', async () => {
    const app = await renderApp('/festival/solstice-26');
    await settle();
    expect(app.getByText('Solstice 2026')).toBeTruthy();
    expect(app.getByText(/^Your night, set to set\./)).toBeTruthy();
    expect(app.getAllByText(/Friday/).length).toBeGreaterThan(0);
  });

  it('lays out the full day set to set, with your picks one tap away', async () => {
    const app = await renderApp('/festival/solstice-26');
    await settle();
    // The full day comes first: a summary, and every stop says where and for how long.
    expect(app.getByLabelText('Full day, set to set').props.accessibilityState.selected).toBe(true);
    expect(app.getByText(/Where to be all day\.$/)).toBeTruthy();
    expect(app.getAllByLabelText(/^\d{1,2}:\d{2} [AP]M to \d{1,2}:\d{2} [AP]M, .+ at .+, (whole set|first \d+ min|last \d+ min|\d+ min)/).length).toBeGreaterThan(1);
    await fireEvent.press(app.getByLabelText('Your picks and clashes'));
    await settle();
    expect(app.queryByText(/Where to be all day/)).toBeNull();
  });

  it('shows every set of the day as a timetable', async () => {
    const app = await renderApp('/festival/solstice-26');
    await settle();
    await fireEvent.press(app.getByLabelText('All sets, as a timetable'));
    await settle();
    expect(app.getByText('Bass Tent')).toBeTruthy();
    expect(app.getByText('The Warehouse')).toBeTruthy();
    const block = app.getByLabelText(/^ILLENIUM, 11:40 PM to 1:10 AM, Main Stage, /);
    expect(app.getByText('10 PM', { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(block);
    await settle();
    expect(app.getAllByText('ILLENIUM').length).toBeGreaterThan(0);
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

  it('tunes one day of a big lineup at a time', async () => {
    const app = await renderApp('/tune/acl-26');
    await settle();
    expect(app.getByText(/1 of 138/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Tune only Sunday, \d+ to rate$/));
    await settle();
    expect(app.getByText(/Austin City Limits 2026 · Sunday · 1 of \d+/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Love .+'s sound$/));
    await settle();
    // Once you've started, the day is set.
    expect(app.queryByLabelText(/^Tune only /)).toBeNull();
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
  it('rates an artist from their page with one Rate button, in a festival’s context', async () => {
    // Pick the n-th choice in the sheet the Rate button opens.
    const choose = (n: number) => jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(n));
    const app = await renderApp('/artist/wooli?festival=edc-orlando-26');
    await settle();
    expect(app.getByText('WOOLI')).toBeTruthy();
    expect(app.getByText('Mark as must see')).toBeTruthy();
    choose(0);
    await fireEvent.press(app.getByLabelText('Rate WOOLI'));
    await settle();
    expect(app.getByLabelText('Your rating of WOOLI: Love them. Change it')).toBeTruthy();
    expect(JSON.parse((await AsyncStorage.getItem('artistRatings.v1'))!)).toEqual({ wooli: 'love' });
    // The in-between answers, then clearing it (the choice after the five).
    choose(3);
    await fireEvent.press(app.getByLabelText('Your rating of WOOLI: Love them. Change it'));
    await settle();
    expect(app.getByLabelText('Your rating of WOOLI: Not really. Change it')).toBeTruthy();
    choose(5);
    await fireEvent.press(app.getByLabelText('Your rating of WOOLI: Not really. Change it'));
    await settle();
    expect(app.getByLabelText('Rate WOOLI')).toBeTruthy();
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
    // Listen opens YouTube or Spotify: the second is Spotify.
    jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementationOnce((_o, cb) => cb(1));
    await fireEvent.press(app.getByLabelText('Listen to WOOLI'));
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
    expect(app.getByLabelText('Your sound across every artist. Choose a festival')).toBeTruthy();
    expect(app.queryByText(/on your map (yet|so far)/)).toBeNull();
    await fireEvent.press(app.getByLabelText('Your sound across every artist. Choose a festival'));
    await settle();
    expect(app.getByText('Show my sound for')).toBeTruthy();
    expect(app.getByLabelText('Your sound across every artist').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(app.getByLabelText('Your sound at EDC Orlando 2026'));
    await settle();
    await settle();
    expect(app.getByLabelText('Your sound at EDC Orlando 2026. Choose a festival')).toBeTruthy();
    expect(app.getByText(/of EDC Orlando 2026’s 110 artists (is|are) on your map so far\. Rate the lineup/)).toBeTruthy();
    await fireEvent.press(app.getByLabelText(/^Tune your lineup\. Rate 110 artists/));
    await settle();
    expect(app.getByText('Tune your lineup')).toBeTruthy();
  });

  it('opens on a festival from a link', async () => {
    const app = await renderApp('/sound?festival=edc-orlando-26');
    await settle();
    expect(app.getByLabelText('Your sound at EDC Orlando 2026. Choose a festival')).toBeTruthy();
  });

  it('searches the map for a sound or an artist, bringing matches onto it', async () => {
    const app = await renderApp('/sound');
    await settle();
    await fireEvent.press(app.getByLabelText('Search your map for an artist or a sound'));
    await settle();
    await fireEvent.changeText(app.getByLabelText('Search your map for an artist or a sound'), 'dubstep');
    await settle();
    expect(app.getByText(/^\d+ dubstep artists(, \d+ new to your map)?\. Tap one to see more\.$/)).toBeTruthy();
    // An artist not on the map yet joins it.
    await fireEvent.changeText(app.getByLabelText('Search your map for an artist or a sound'), 'wooli');
    await settle();
    expect(app.getByText('1 artist, 1 new to your map. Tap one to see more.')).toBeTruthy();
    expect(app.getByLabelText(/^WOOLI, \d+ percent match$/)).toBeTruthy();
    await fireEvent.changeText(app.getByLabelText('Search your map for an artist or a sound'), 'zzz');
    await settle();
    expect(app.getByText('No artist or sound matches “zzz”.')).toBeTruthy();
    await fireEvent.press(app.getByLabelText('Done searching'));
    await settle();
    expect(app.queryByText(/No artist or sound matches/)).toBeNull();
  });

  it('narrows a festival map to one day, when the poster says who plays when', async () => {
    const app = await renderApp('/sound?festival=acl-26');
    await settle();
    expect(app.getByLabelText('Every day at Austin City Limits 2026').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(app.getByLabelText('Only Saturday at Austin City Limits 2026'));
    await settle();
    expect(app.getByLabelText('Only Saturday at Austin City Limits 2026').props.accessibilityState).toEqual({ selected: true });
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
    expect(app.getByLabelText(/, live sets from the lineup\. Choose what to discover\.$/)).toBeTruthy();
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
    // They know swiping and liking; the only tip left is the new one, adding your own video.
    expect(regular.queryByLabelText('Tip: Swipe up for the next clip')).toBeNull();
    expect(regular.queryByLabelText('Tip: Double-tap a clip to like it')).toBeNull();
    expect(regular.getByLabelText('Tip: Swipe right, or tap the camera button, to film your own video')).toBeTruthy();
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
    expect(app.getByText('Every lineup')).toBeTruthy();
    expect(await AsyncStorage.getItem('discoverFocus.v1')).toBe('mix');
  });

  it('focuses Discover on one sound from every lineup', async () => {
    const app = await renderApp('/');
    await settle();
    await settle();
    await fireEvent.press(app.getByLabelText(/^Solstice 2026, live sets from the lineup\. Choose what to discover\.$/));
    await settle();
    expect(app.getByText('By sound')).toBeTruthy();
    const chip = app.getAllByLabelText(/^[A-Z][a-z ]+, \d+ clips from every lineup$/)[0];
    const label = chip.props.accessibilityLabel.split(',')[0] as string;
    await fireEvent.press(chip);
    await settle();
    await settle();
    expect(app.getByText(label)).toBeTruthy();
    expect(app.getByText('Every lineup')).toBeTruthy();
    expect(await AsyncStorage.getItem('discoverFocus.v1')).toMatch(/^sound:/);
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
    expect(app.getByRole('tab', { name: /^Lineup, \d+$/ })).toBeTruthy();
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
  it('shows what you have built so far, with tabs for your videos, festivals and saved clips', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['edc-orlando-26']));
    const app = await renderApp('/profile');
    await settle();
    expect(app.getByLabelText('1 festival')).toBeTruthy();
    expect(app.getByLabelText('0 artists rated')).toBeTruthy();
    // Videos first: nothing filmed yet, so it says what goes here.
    expect(app.getByText('Your festival videos')).toBeTruthy();
    await fireEvent.press(app.getByRole('tab', { name: 'Saved' }));
    expect(app.getByLabelText('Your clips, 0')).toBeTruthy();
    // Everything else is behind the menu.
    await fireEvent.press(app.getByLabelText('Settings and more'));
    await settle();
    expect(app.getByLabelText('Memories, 0')).toBeTruthy();
    expect(app.getByLabelText('Music connections, none connected')).toBeTruthy();
  });

  it('shows your sound as chips and the festivals you are going to, with your weekend', async () => {
    await AsyncStorage.setItem('going.v1', JSON.stringify(['acl-26']));
    await AsyncStorage.setItem('weekends.v1', JSON.stringify({ 'acl-26': 2 }));
    const app = await renderApp('/profile');
    await settle();
    expect(app.getByLabelText(/^Your sound: .+ percent/)).toBeTruthy();
    await fireEvent.press(app.getByRole('tab', { name: 'Festivals, 1' }));
    // The round shortcut and the row in the Festivals tab.
    expect(app.getAllByLabelText(/^Austin City Limits 2026, Weekend 2 · /)).toHaveLength(2);
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

  it('schedules phone reminders when you are going, and removes them when you are not', async () => {
    const scheduled = (Notifications as unknown as { __scheduled: Map<string, { content: { title: string } }> }).__scheduled;
    scheduled.clear();
    // A fixed "today", more than a week before EDC.
    jest.useFakeTimers({ now: new Date(2026, 8, 29, 12) });
    const page = await renderApp('/festival/edc-orlando-26');
    await settle();
    await fireEvent.press(page.getByLabelText("I'm going to EDC Orlando 2026"));
    await settle();
    await settle();
    expect([...scheduled.values()].map((r) => r.content.title)).toEqual(['EDC Orlando 2026 is a week away', 'EDC Orlando 2026 is tomorrow']);
    await fireEvent.press(page.getByLabelText("You're going to EDC Orlando 2026. Tap to undo."));
    await settle();
    await settle();
    expect(scheduled.size).toBe(0);
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
