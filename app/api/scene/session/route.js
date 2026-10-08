import { issueSession, rejectReason, NO_STORE } from '@/lib/sceneGuard';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (rejectReason(req)) return new Response('Forbidden', { status: 403, headers: NO_STORE });
  return Response.json(issueSession(req), { headers: NO_STORE });
}
