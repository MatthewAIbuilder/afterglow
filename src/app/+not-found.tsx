import { Missing } from '../components/Missing';

/** A link to a page that doesn't exist (a typo, or an old link): say so in plain words, with a way on. */
export default function NotFoundScreen() {
  return <Missing title="Page not found" line="This link isn’t quite right, or the page has moved." wait={false} />;
}
