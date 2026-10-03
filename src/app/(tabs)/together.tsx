import { FriendsHub } from '../../features/friends/FriendsHub';
import { useFestivalMode } from '../../state/festivalMode';

/** The Friends tab: inviting friends, codes, crews and people (at a festival, your crew there first). */
export default function FriendsTab() {
  const { active } = useFestivalMode();
  return <FriendsHub festival={active?.festival} inTab />;
}
