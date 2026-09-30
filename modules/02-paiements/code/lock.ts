/**
 * Postgres advisory lock helpers — serialize concurrent withdrawal attempts
 * per user without a real row lock.
 *
 *   SELECT pg_advisory_xact_lock(hashtext($userId))
 *
 * The lock is held for the duration of the surrounding transaction. Any
 * other transaction trying to lock the same user blocks until the first
 * commits or rolls back. This makes the read-then-write cycle below race-free:
 *
 *   BEGIN;
 *   SELECT pg_advisory_xact_lock(hashtext(userId));   -- queue the user
 *   -- now safe: balance computation + withdrawal insert see consistent state
 *   compute balance from Orders/Withdrawals
 *   validate guards
 *   INSERT INTO Withdrawal (userId, amount, ...) VALUES (...)
 *   COMMIT;
 *
 * Two concurrent POST /api/withdrawals for the same user end up serialized:
 * the second one waits for the first to commit, then sees the PENDING row
 * the first one inserted (so its balance shrinks by that amount and any
 * over-spend is correctly rejected as INSUFFICIENT_BALANCE).
 *
 * `hashtext()` is a Postgres builtin that maps a string to int4. Collisions
 * across users are rare (~10^-9) and harmless — they just cause two unrelated
 * users to occasionally serialize, never to share state.
 */
import type { Prisma } from '@prisma/client';

export type TxClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Acquire a transaction-scoped advisory lock for the given user. Released
 * automatically when the surrounding transaction commits or rolls back.
 */
export async function lockUserTx(tx: TxClient, userId: string): Promise<void> {
  // pg_advisory_xact_lock takes (key1, key2) bigints OR a single int4 / int8.
  // hashtext(text) returns int4, which fits the single-arg form.
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', userId);
}
