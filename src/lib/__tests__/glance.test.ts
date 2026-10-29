import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Glance } from '../../features/glance/glance';

/** The app's AfterglowLive module, as a stand-in: what the app asked of it. */
const mockNative = {
  saved: null as string | null,
  setGlance: jest.fn((json: string) => {
    mockNative.saved = json;
  }),
  lastGlance: jest.fn(() => mockNative.saved),
  activitiesEnabled: jest.fn(() => true),
  showActivity: jest.fn(async (_f: string, _n: string, _s: string, _t: number) => true),
  endActivities: jest.fn(async () => {}),
};
jest.mock('expo', () => ({ ...jest.requireActual<object>('expo'), requireOptionalNativeModule: () => mockNative }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { hasGlance, refreshLiveActivity, shareGlance, syncLiveActivity } = require('../glance') as typeof import('../glance');

const at = (h: number, m = 0) => new Date(2026, 10, 6, h, m);
const live: Glance = {
  kind: 'live',
  festivalId: 'edco',
  festival: 'EDC Orlando 2026',
  night: 'Friday',
  sets: [{ artist: 'Subtronics', stage: 'circuitGROUNDS', start: at(22).getTime(), end: at(23).getTime() }],
  until: at(23, 59).getTime(),
};

beforeEach(() => {
  mockNative.saved = null;
  jest.clearAllMocks();
});

describe('Afterglow outside the app', () => {
  it('hands the glance to the widgets and the Watch as JSON', () => {
    expect(hasGlance()).toBe(true);
    shareGlance(live);
    expect(JSON.parse(mockNative.saved!)).toEqual(live);
  });

  it('shows the Live Activity on a festival night, and ends it after', async () => {
    await syncLiveActivity(live, at(22, 30));
    expect(mockNative.showActivity).toHaveBeenCalledWith('EDC Orlando 2026', 'Friday', JSON.stringify({ nowArtist: 'Subtronics', nowStage: 'circuitGROUNDS', nowEnd: at(23).getTime() }), at(23).getTime());
    await syncLiveActivity(live, at(23, 30));
    expect(mockNative.endActivities).toHaveBeenCalledTimes(1);
    await syncLiveActivity({ kind: 'none' }, at(12));
    expect(mockNative.endActivities).toHaveBeenCalledTimes(2);
  });

  it('brings the Live Activity up to date in the background from the last glance, and never throws', async () => {
    shareGlance(live);
    await refreshLiveActivity(at(22, 5));
    expect(mockNative.showActivity).toHaveBeenCalledTimes(1);
    mockNative.showActivity.mockRejectedValueOnce(new Error('Live Activities are off'));
    await expect(refreshLiveActivity(at(22, 6))).resolves.toBeUndefined();
  });
});
