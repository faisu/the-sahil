// Server-side guard for the 3D models. The GLBs live outside /public and are only served,
// AES-encrypted, to a browser that first opened a short-lived scene session from this site.
// This keeps the models off crawlers, AI scrapers and plain "save link" downloads; anything a
// browser can render can still be captured by a determined person with devtools.
import crypto from 'node:crypto';

export const MODEL_FILES = { core: 'sahil_core.glb', detail: 'sahil_detail.glb' };
const TTL_MS = 5 * 60 * 1000;

// Set SCENE_SECRET in Vercel (Project → Settings → Environment Variables). The fallback only
// exists so local dev works; serverless instances must share one secret to verify tokens.
const SECRET = process.env.SCENE_SECRET || 'the-sahil-local-dev-secret';

// Crawlers, AI agents and scripted clients that should never receive the model.
const BLOCKED_UA = /bot|crawl|spider|slurp|scrap|headless|phantom|puppeteer|playwright|selenium|python|curl|wget|httpie|go-http|java\/|okhttp|axios|node-fetch|undici|libwww|gptbot|chatgpt|oai-searchbot|claude|anthropic|perplexity|ccbot|bytespider|amazonbot|applebot-extended|google-extended|cohere|diffbot|imagesift|omgili|youbot|meta-external/i;

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (...parts) => crypto.createHmac('sha256', SECRET).update(parts.join('|')).digest();
const uaHash = (req) => b64u(hmac('ua', req.headers.get('user-agent') || '')).slice(0, 16);

/** Returns a reason string when the request does not look like this site's own page in a real browser. */
export function rejectReason(req) {
  const ua = req.headers.get('user-agent') || '';
  if (!ua || BLOCKED_UA.test(ua)) return 'client';
  // Browsers send Fetch Metadata on every fetch(); a same-origin page fetch is the only one allowed.
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return 'origin';
  if (req.headers.get('sec-fetch-mode') !== 'cors' && req.headers.get('sec-fetch-mode') !== 'same-origin') return 'mode';
  if (req.headers.get('sec-fetch-dest') !== 'empty') return 'dest';
  return null;
}

/** Issues a token bound to this browser's user agent, plus the key its model bytes are encrypted with. */
export function issueSession(req) {
  const payload = `${Date.now() + TTL_MS}.${b64u(crypto.randomBytes(12))}.${uaHash(req)}`;
  const token = `${payload}.${b64u(hmac('tok', payload))}`;
  return { token, key: b64u(hmac('key', payload)), ttl: TTL_MS };
}

/** Verifies a token and returns the AES key for it, or null. */
export function keyForToken(req, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4) return null;
  const payload = parts.slice(0, 3).join('.');
  const sig = Buffer.from(parts[3], 'base64url');
  const want = hmac('tok', payload);
  if (sig.length !== want.length || !crypto.timingSafeEqual(sig, want)) return null;
  if (Number(parts[0]) < Date.now() || parts[2] !== uaHash(req)) return null;
  return hmac('key', payload);
}

/** AES-256-CTR; output is a 16-byte counter block followed by the ciphertext. */
export function encrypt(key, bytes) {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-ctr', key, iv);
  return Buffer.concat([iv, c.update(bytes), c.final()]);
}

export const NO_STORE = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, noai, noimageai',
  'X-Content-Type-Options': 'nosniff',
};
