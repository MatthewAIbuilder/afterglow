import { PageTitle } from '../../components/PageTitle';
import { DiscoverFeed } from '../../features/discover/DiscoverFeed';
import { t } from '../../i18n';
import { OrgFeed } from '../../features/organizers/OrgFeed';
import { useMyOrg, useOrg } from '../../state/orgs';
import { useSocial } from '../../state/social';

export default function DiscoverScreen() {
  // An event organizer's account: only what's posted at its events, not the feed of everything.
  const { user } = useSocial();
  const runs = useOrg(useMyOrg(user?.uid) ?? undefined);
  return (
    <>
      <PageTitle title={t('Discover')} />
      {runs ? <OrgFeed org={runs} /> : <DiscoverFeed />}
    </>
  );
}
