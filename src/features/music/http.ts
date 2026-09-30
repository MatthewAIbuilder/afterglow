import { MusicServiceError, statusKind } from './service';

/**
 * A tiny JSON-over-HTTPS helper shared by the adapters. `fetch` is passed in
 * so tests run against fixtures, never a real account. Errors carry only the
 * kind and status: no token, header or body ever goes into a message.
 */
export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  status: number;
  ok: boolean;
  json: () => Promise<unknown>;
}>;

/** An HTTP answer that wasn't a success, kept apart from network failures so adapters can treat 403/404 as "not offered". */
export class HttpStatusError extends MusicServiceError {
  readonly status: number;
  constructor(status: number, what: string) {
    super(statusKind(status), `${what} answered ${status}`);
    this.status = status;
  }
}

export async function requestJson(fetchFn: FetchLike, url: string, init: Parameters<FetchLike>[1], what: string): Promise<unknown> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchFn(url, init);
  } catch {
    throw new MusicServiceError('network', `${what}: no answer`);
  }
  if (!res.ok) throw new HttpStatusError(res.status, what);
  try {
    return await res.json();
  } catch {
    throw new MusicServiceError('unknown', `${what}: unreadable answer`);
  }
}

/** A section that the service doesn't offer this account, or wasn't granted: 403 or 404. */
export const notOffered = (e: unknown) => e instanceof HttpStatusError && (e.status === 403 || e.status === 404);

/** Read a JSON object field without trusting the shape. */
export const field = (o: unknown, key: string): unknown =>
  o && typeof o === 'object' ? (o as Record<string, unknown>)[key] : undefined;
export const list = (o: unknown): unknown[] => (Array.isArray(o) ? o : []);
