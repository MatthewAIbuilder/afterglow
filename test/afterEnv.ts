import { beforeEach } from '@jest/globals';
import { forgetDailyQuests } from '../src/state/dailyQuests';

// Daily quests live in a shared store: start every test with a fresh one.
beforeEach(() => forgetDailyQuests());
