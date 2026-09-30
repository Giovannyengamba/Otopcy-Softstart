// frontend/src/lib/server/cron/auth.ts — Phase 5 D-06.
//
// Vercel Cron automatically attaches `Authorization: Bearer ${CRON_SECRET}`
// to scheduled requests (CRON_SECRET is read by Vercel from the project's
// env vars). Locally (next dev) tests + curl invocations attach it manually.
//
// Mirrors verifyCsrf signature: returns null on pass, NextResponse(401) on fail.
// Timing-safe compare prevents secret-length / byte-by-byte timing oracles.
import 'server-only';
import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

export function verifyCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) {
    // Boot-time misconfiguration — fail closed loudly. Production deploys
    // without CRON_SECRET set are a security regression (any anonymous POST
    // to /api/cron/* would otherwise queue work).
    return NextResponse.json(
      {
        error: 'CRON_NOT_CONFIGURED',
        message: 'CRON_SECRET env var is required',
      },
      { status: 500 },
    );
  }

  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const presented = header.slice('Bearer '.length);
  if (presented.length === 0) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Constant-time compare. Buffer.from on differing-length strings would
  // produce different-length buffers — timingSafeEqual throws in that case,
  // so guard with a length-mismatch fast-path that itself runs in constant
  // time relative to the secret.
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  return null;
}
