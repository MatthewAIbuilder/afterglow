import { FriendsHub } from '../../features/friends/FriendsHub';
import { OrgMessages } from '../../features/organizers/OrgMessages';
import { useFestivalMode } from '../../state/festivalMode';
import { useMyOrg, useOrg } from '../../state/orgs';
import { useSocial } from '../../state/social';

/**
 * The Friends tab: inviting friends, codes, crews and people (at a festival,
 * your crew there first). An event organizer's account has Messages here: its
 * inbox and updates to its followers.
 */
export default function FriendsTab() {
  const { active } = useFestivalMode();
  const { user } = useSocial();
  const org = useOrg(useMyOrg(user?.uid) ?? undefined);
  if (org && !active) return <OrgMessages org={org} />;
  return <FriendsHub festival={active?.festival} inTab />;
}
