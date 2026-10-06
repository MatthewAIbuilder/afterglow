/**
 * Updates published from HQ (anyone can read them), oldest first, for the
 * nightly scripts: websites and set times set there count too. Reads the
 * public `published` collection through Firestore's REST API with the web
 * key (FIREBASE_PROJECT_ID and FIREBASE_API_KEY); nothing without them.
 */
const TIMEOUT_MS = 15_000;

export async function livePatches(): Promise<{ file: string }[]> {
  const project = process.env.FIREBASE_PROJECT_ID;
  const key = process.env.FIREBASE_API_KEY;
  if (!project || !key) return [];
  type Page = { documents?: { fields?: { file?: { stringValue?: string }; publishedAt?: { timestampValue?: string } } }[]; nextPageToken?: string };
  const docs: NonNullable<Page['documents']> = [];
  // Every page of them (a page holds at most 300), up to a sensible limit.
  let token: string | undefined;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/published?pageSize=300&key=${key}${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) break;
    const json = (await res.json()) as Page;
    docs.push(...(json.documents ?? []));
    token = json.nextPageToken;
    if (!token) break;
  }
  return docs
    .map((d) => ({ file: d.fields?.file?.stringValue ?? '', at: d.fields?.publishedAt?.timestampValue ?? '' }))
    .filter((p) => p.file)
    .sort((a, b) => a.at.localeCompare(b.at));
}
