/**
 * Outbox writer — call from inside a transaction to enqueue a side-effect
 * that should run AFTER the tx commits.
 *
 * Pattern (as used by routes/webhooks.ts onPaid):
 *
 *   await prisma.$transaction(async (tx) => {
 *     await tx.order.update({ ... });
 *     await enqueueOutbox(tx, {
 *       kind: 'notification.payment_received',
 *       payload: { userId, orderId, amount, currency },
 *     });
 *   });
 *
 * The row is committed atomically with the state change. A separate worker
 * (lib/outbox/dispatcher.ts → drainOutbox) reads PENDING rows, dispatches
 * them, and marks SENT. Crashes between commit-and-dispatch are recovered
 * because the row stays PENDING; the next dispatcher run picks it up.
 */
import type { Prisma } from '@prisma/client';
import type { OutboxEvent } from './types';

export type OutboxTxClient = Pick<Prisma.TransactionClient, 'outboxEvent'>;

export async function enqueueOutbox(
  tx: OutboxTxClient,
  event: OutboxEvent,
): Promise<{ id: string }> {
  const row = await tx.outboxEvent.create({
    data: {
      kind: event.kind,
      payload: event.payload as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return row;
}

export type { OutboxEvent } from './types';
