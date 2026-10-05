import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { forgetScouted, loadScouted, setScouted } from '../scouted';

beforeEach(async () => {
  await AsyncStorage.clear();
  forgetScouted();
});

describe('thanks for set times you sent', () => {
  it('thanks once per festival, after the first look on this phone', async () => {
    await loadScouted();
    // The first look (a new phone, a reinstall): notes what's already live, no thanks again.
    expect(setScouted('me', ['edc'])).toEqual([]);
    expect(setScouted('me', ['edc', 'acl'])).toEqual(['acl']);
    expect(setScouted('me', ['edc', 'acl'])).toEqual([]);
  });

  it('a fan noted when sending is thanked even if the first look finds it live', async () => {
    await loadScouted();
    setScouted('me', []);
    expect(setScouted('me', ['edc'])).toEqual(['edc']);
    expect(JSON.parse((await AsyncStorage.getItem('scouted.v1')) ?? '{}')).toEqual({ me: ['edc'] });
  });
});
