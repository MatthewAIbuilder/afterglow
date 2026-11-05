/**
 * Afterglow's web push sender: a Cloudflare Worker (docs/web-push.md).
 *
 *  GET  /vapid         the public key browsers subscribe with
 *  POST /subscribe     a signed-in person's browser says yes → returns its address `WebPush[id]`
 *  POST /unsubscribe   that address goes away
 *  POST /send          the sender's phone/browser asks for a notification to a few addresses
 *
 * Every call except /vapid carries the person's Firebase sign-in (an ID token), checked here.
 * What's kept: only the browser's own push address, under an unguessable id, for 60 days after
 * its last check-in. No messages are stored.
 */
import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push';

type KV = { get(key: string): Promise<string | null>; put(key: string, value: string, o?: { expirationTtl?: number }): Promise<void>; delete(key: string): Promise<void> };
interface Env {
  SUBS: KV;
  ALLOWED_ORIGIN: string;
  FIREBASE_PROJECT: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

const TTL = 60 * 24 * 3600;
const SEND_MAX = 100;
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const b64urlToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const bytesToB64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let jwks: { at: number; keys: (JsonWebKey & { kid: string })[] } | undefined;

/** The uid inside a valid Firebase ID token, or undefined. */
async function uidOf(token: string, project: string): Promise<string | undefined> {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return undefined;
    const head = JSON.parse(new TextDecoder().decode(b64urlToBytes(h))) as { alg?: string; kid?: string };
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as { aud?: string; iss?: string; sub?: string; exp?: number; iat?: number };
    if (head.alg !== 'RS256' || !head.kid) return undefined;
    const now = Date.now() / 1000;
    if (claims.aud !== project || claims.iss !== `https://securetoken.google.com/${project}` || !claims.sub || !claims.exp || claims.exp < now || (claims.iat ?? 0) > now + 300) return undefined;
    if (!jwks || now * 1000 - jwks.at > 3600_000 || !jwks.keys.some((k) => k.kid === head.kid)) {
      const res = await fetch(JWKS_URL);
      if (!res.ok) return undefined;
      jwks = { at: Date.now(), keys: ((await res.json()) as { keys: (JsonWebKey & { kid: string })[] }).keys };
    }
    const jwk = jwks.keys.find((k) => k.kid === head.kid);
    if (!jwk) return undefined;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
    return ok ? claims.sub : undefined;
  } catch {
    return undefined;
  }
}

const idOf = async (endpoint: string) => bytesToB64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))).slice(0, 32);
const tokenId = (t: unknown) => (typeof t === 'string' ? /^WebPush\[([A-Za-z0-9_-]{16,64})\]$/.exec(t)?.[1] : undefined);
const isSub = (x: unknown): x is PushSubscription => {
  const s = x as PushSubscription | null;
  return !!s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') && s.endpoint.length < 1000 && typeof s.keys?.auth === 'string' && typeof s.keys?.p256dh === 'string';
};
const cut = (x: unknown, n: number) => (typeof x === 'string' ? x.slice(0, n) : '');

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    };
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(req.url).pathname;

    if (req.method === 'GET' && path === '/vapid') return json({ publicKey: env.VAPID_PUBLIC_KEY });
    if (req.method !== 'POST') return json({ error: 'not found' }, 404);

    const auth = req.headers.get('Authorization') ?? '';
    const uid = auth.startsWith('Bearer ') ? await uidOf(auth.slice(7), env.FIREBASE_PROJECT) : undefined;
    if (!uid) return json({ error: 'sign in first' }, 401);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return json({ error: 'bad request' }, 400);

    if (path === '/subscribe') {
      if (!isSub(body.subscription)) return json({ error: 'bad subscription' }, 400);
      const id = await idOf(body.subscription.endpoint);
      await env.SUBS.put(`s:${id}`, JSON.stringify({ uid, subscription: body.subscription }), { expirationTtl: TTL });
      return json({ token: `WebPush[${id}]` });
    }

    if (path === '/unsubscribe') {
      const id = tokenId(body.token);
      if (!id) return json({ error: 'bad token' }, 400);
      const had = await env.SUBS.get(`s:${id}`);
      if (had && (JSON.parse(had) as { uid: string }).uid === uid) await env.SUBS.delete(`s:${id}`);
      return json({ ok: true });
    }

    if (path === '/send') {
      const ids = (Array.isArray(body.tokens) ? body.tokens : []).map(tokenId).filter((x): x is string => !!x).slice(0, SEND_MAX);
      const title = cut(body.title, 120);
      const text = cut(body.body, 240);
      const href = cut(body.href, 200);
      if (!ids.length || !title || !href.startsWith('/')) return json({ error: 'bad message' }, 400);
      const data = { title, body: text, href };
      const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
      let sent = 0;
      await Promise.all(
        ids.map(async (id) => {
          const stored = await env.SUBS.get(`s:${id}`);
          if (!stored) return;
          const { subscription } = JSON.parse(stored) as { subscription: PushSubscription };
          try {
            const p = await buildPushPayload({ data, options: { ttl: 3600, urgency: 'high' } }, subscription, vapid);
            const res = await fetch(subscription.endpoint, { method: p.method, headers: p.headers, body: p.body });
            if (res.status === 404 || res.status === 410) await env.SUBS.delete(`s:${id}`);
            else if (res.ok) sent++;
          } catch {
            /* one browser failing never stops the others */
          }
        }),
      );
      return json({ sent });
    }

    return json({ error: 'not found' }, 404);
  },
};
