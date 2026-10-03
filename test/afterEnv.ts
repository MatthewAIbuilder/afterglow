import { beforeEach } from '@jest/globals';
import { forgetDailyQuests } from '../src/state/dailyQuests';
import { forgetSecrets } from '../src/state/secrets';

// Daily quests and secrets live in shared stores: start every test with fresh ones.
beforeEach(() => {
  forgetDailyQuests();
  forgetSecrets();
});
