import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { NewsAlerts, NEWS_ALERTED_KEY } from '../NewsAlerts';

let mockList: { id: string; kind: string; title: string; body: string; href: string }[] = [];
jest.mock('../../../state/notices', () => ({ useNotices: () => ({ list: mockList, hydrated: true }) }));
const scheduled = (Notifications as unknown as { __scheduled: Map<string, { content: { title: string } }> }).__scheduled;

const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => Promise.resolve());
};

beforeEach(async () => {
  await AsyncStorage.clear();
  scheduled.clear();
});

describe('news alerts', () => {
  it('takes note of what’s there at first, then alerts new lineup news and set times once each', async () => {
    mockList = [{ id: 'lineup:f:1', kind: 'lineup', title: 'Old news', body: '', href: '/festival/f' }];
    const app = await render(<NewsAlerts />);
    await settle();
    expect(scheduled.size).toBe(0);
    expect(JSON.parse((await AsyncStorage.getItem(NEWS_ALERTED_KEY)) ?? '[]')).toEqual(['lineup:f:1']);
    mockList = [
      ...mockList,
      { id: 'lineup:show:x:2', kind: 'lineup', title: 'ALPHA plays near you', body: 'Alpha at The Vanguard', href: '/festival/show:x' },
      { id: 'sets:edc', kind: 'setTimes', title: 'Set times are out for EDC', body: '', href: '/festival/edc' },
      { id: 'follow:1', kind: 'follow', title: 'Sam followed you', body: '', href: '/u/sam' },
    ];
    await app.rerender(<NewsAlerts />);
    await settle();
    expect([...scheduled.values()].map((n) => n.content.title).sort()).toEqual(['ALPHA plays near you', 'Set times are out for EDC']);
    await app.rerender(<NewsAlerts />);
    await settle();
    expect(scheduled.size).toBe(2);
  });
});
