import { FriendsHub } from '../../features/friends/FriendsHub';
import { useFestivalMode } from '../../state/festivalMode';

/** Festival mode's Friends tab: your crew at the festival first, adding friends by code, then everything social. */
export default function FriendsTab() {
  const { active } = useFestivalMode();
  return <FriendsHub festival={active?.festival} inTab />;
}
