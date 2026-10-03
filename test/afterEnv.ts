import { beforeEach } from '@jest/globals';
import { forgetDailyQuests } from '../src/state/dailyQuests';
import { forgetSecrets } from '../src/state/secrets';
import { forgetQuestReminder } from '../src/state/questReminder';
import { forgetQuestTip } from '../src/state/questTip';
import { forgetCareTip } from '../src/state/careTip';
import { forgetShowLevel } from '../src/state/showLevel';

// Shared stores (daily quests, secrets, tips): start every test with fresh ones.
beforeEach(() => {
  forgetDailyQuests();
  forgetSecrets();
  forgetQuestReminder();
  forgetQuestTip();
  forgetCareTip();
  forgetShowLevel();
});
