import { PageTitle } from '../../components/PageTitle';
import { DiscoverFeed } from '../../features/discover/DiscoverFeed';

export default function DiscoverScreen() {
  return (
    <>
      <PageTitle title="Discover" />
      <DiscoverFeed />
    </>
  );
}
