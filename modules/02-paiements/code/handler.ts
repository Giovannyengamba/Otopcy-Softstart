/**
 * Idempotent webhook handler factory — Next.js port.
 *
 * Provider-agnostic. Each integration (Stripe, PayPal, a local aggregator…)
 * implements `WebhookProvider` with its own signature scheme + payload
 * parser. The handler then:
 *
 *   1. Reads the raw body via `req.arrayBuffer()` (byte-identical to what
 *      the provider signed — never `await req.json()` first).
 *   2. Verifies the signature → 401 if bad.
 *   3. Parses payload, extracts (externalId, eventType).
 *   4. Opens a Serializable transaction:
 *      a. Upsert WebhookLog on @@unique([externalId, eventType]).
 *      b. If `processedAt` already set, short-circuit `deduped:true`.
 *      c. Dispatch to onPaid / onRefunded / onFailed.
 *      d. Set processedAt.
 *   5. After commit, run any postCommit hook (errors swallowed — work is
 *      already done; new code should use the outbox instead).
 *   6. Respond 200 `{ ok: true, deduped }`.
 *
 * In Next.js, the route file MUST set `export const runtime = 'nodejs'`
 * (Buffer + crypto APIs unavailable on edge) and read the raw body via
 * `await req.arrayBuffer()` BEFORE any other body access.
 */
import 'server-only';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { PrismaClient, Prisma } from '@prisma/client';
import { createLogger } from '../logger';

export type WebhookEventType = 'paid' | 'refunded' | 'failed' | 'other';

export interface ParsedIds {
  externalId: string;
  eventType: string;
  kind?: WebhookEventType;
}

export interface WebhookProvider<TPayload> {
  name: string;
  verifySignature(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): { valid: boolean; reason?: string };
  parsePayload(rawBody: Buffer): TPayload;
  extractIds(payload: TPayload): ParsedIds;
}

export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface WebhookHandlerResult {
  postCommit?: () => Promise<void>;
}

export type WebhookEventHandler<TPayload> = (
  payload: TPayload,
  tx: PrismaTransactionClient,
) => Promise<WebhookHandlerResult>;

export interface WebhookHandlerOptions<TPayload> {
  prisma: PrismaClient;
  provider: WebhookProvider<TPayload>;
  onPaid?: WebhookEventHandler<TPayload>;
  onRefunded?: WebhookEventHandler<TPayload>;
  onFailed?: WebhookEventHandler<TPayload>;
}

const logger = createLogger();

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

/**
 * Returns a Next.js route-handler-compatible function.
 *
 * Usage in app/api/webhooks/<provider>/route.ts:
 *   export const runtime = 'nodejs';
 *   export const dynamic = 'force-dynamic';
 *   const handler = createWebhookHandler({ prisma, provider, onPaid });
 *   export const POST = handler;
 */
export function createWebhookHandler<TPayload>(
  opts: WebhookHandlerOptions<TPayload>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req) => {
    const rawBody = Buffer.from(await req.arrayBuffer());
    const headers = headersToRecord(req.headers);

    const sig = opts.provider.verifySignature(rawBody, headers);
    if (!sig.valid) {
      logger.warn(`[webhook:${opts.provider.name}] invalid signature`, {
        reason: sig.reason,
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: TPayload;
    try {
      payload = opts.provider.parsePayload(rawBody);
    } catch (err) {
      logger.warn(`[webhook:${opts.provider.name}] payload parse failed`, {
        err: String(err),
      });
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { externalId, eventType, kind } = opts.provider.extractIds(payload);

    let deduped = false;
    let postCommit: (() => Promise<void>) | undefined;

    try {
      await opts.prisma.$transaction(
        async (tx) => {
          const existing = await tx.webhookLog.findUnique({
            where: { externalId_eventType: { externalId, eventType } },
            select: { id: true, processedAt: true },
          });

          if (existing?.processedAt) {
            deduped = true;
            return;
          }

          if (!existing) {
            await tx.webhookLog.create({
              data: {
                provider: opts.provider.name,
                externalId,
                eventType,
                payload: payload as unknown as Prisma.InputJsonValue,
              },
            });
          }

          let handler: WebhookEventHandler<TPayload> | undefined;
          if (kind === 'paid') handler = opts.onPaid;
          else if (kind === 'refunded') handler = opts.onRefunded;
          else if (kind === 'failed') handler = opts.onFailed;

          if (handler) {
            const result = await handler(payload, tx as unknown as PrismaTransactionClient);
            postCommit = result.postCommit;
          }

          await tx.webhookLog.update({
            where: { externalId_eventType: { externalId, eventType } },
            data: { processedAt: new Date() },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (err) {
      logger.error(`[webhook:${opts.provider.name}] transaction failed`, {
        err: String(err),
      });
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }

    if (postCommit) {
      try {
        await postCommit();
      } catch (err) {
        logger.error(`[webhook:${opts.provider.name}] postCommit failed`, {
          err: String(err),
        });
      }
    }

    return NextResponse.json({ ok: true, deduped }, { status: 200 });
  };
}
