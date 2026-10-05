import { beforeEach } from '@jest/globals';
import { forgetDailyQuests } from '../src/state/dailyQuests';
import { forgetSecrets } from '../src/state/secrets';
import { forgetQuestReminder } from '../src/state/questReminder';
import { forgetQuestTip } from '../src/state/questTip';
import { forgetCareTip } from '../src/state/careTip';
import { forgetFestivalWeek } from '../src/state/festivalWeek';
import { forgetShowLevel } from '../src/state/showLevel';
import { forgetCloseFriends } from '../src/state/closeFriends';
import { forgetBadgeClaims } from '../src/state/badgeClaims';
import { forgetScouted } from '../src/state/scouted';
import { forgetLastKnown } from '../src/state/lastKnown';

// Shared stores (daily quests, secrets, tips): start every test with fresh ones.
beforeEach(() => {
  forgetDailyQuests();
  forgetSecrets();
  forgetQuestReminder();
  forgetQuestTip();
  forgetCareTip();
  forgetFestivalWeek();
  forgetShowLevel();
  forgetCloseFriends();
  forgetBadgeClaims();
  forgetScouted();
  forgetLastKnown();
});
