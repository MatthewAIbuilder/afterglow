import { PageTitle } from '../../components/PageTitle';
import { DiscoverFeed } from '../../features/discover/DiscoverFeed';
import { t } from '../../i18n';

export default function DiscoverScreen() {
  return (
    <>
      <PageTitle title={t('Discover')} />
      <DiscoverFeed />
    </>
  );
}
