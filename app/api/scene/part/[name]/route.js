import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MODEL_FILES, keyForToken, encrypt, rejectReason, NO_STORE } from '@/lib/sceneGuard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const cache = new Map();
const readModel = (file) => {
  if (!cache.has(file)) cache.set(file, readFile(path.join(process.cwd(), 'private', 'models', file)));
  return cache.get(file);
};

export async function GET(req, { params }) {
  const { name } = await params;
  const file = MODEL_FILES[name];
  if (!file || rejectReason(req)) return new Response('Not found', { status: 404, headers: NO_STORE });
  const key = keyForToken(req, req.headers.get('x-scene-token'));
  if (!key) return new Response('Not found', { status: 404, headers: NO_STORE });
  const body = encrypt(key, await readModel(file));
  return new Response(body, {
    headers: { ...NO_STORE, 'Content-Type': 'application/octet-stream', 'Content-Length': String(body.length) },
  });
}
