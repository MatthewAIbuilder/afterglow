import { Missing } from '../components/Missing';
import { t } from '../i18n';

/** A link to a page that doesn't exist (a typo, or an old link): say so in plain words, with a way on. */
export default function NotFoundScreen() {
  return <Missing title={t('Page not found')} line={t('This link isn’t quite right, or the page has moved.')} wait={false} />;
}
