/**
 * Audit-log helper. Call from every back-office mutation:
 *
 *   await logAdminAction(prisma, {
 *     actorId: req.adminUser!.id,
 *     action: 'withdrawal.cancel',
 *     targetType: 'Withdrawal',
 *     targetId: withdrawal.id,
 *     metadata: { reason: 'fraudulent', previousStatus: 'PENDING' },
 *     ip: req.ip,
 *     userAgent: req.headers['user-agent'],
 *   });
 *
 * Action naming convention: dotted "domain.verb" — e.g. "user.role_change",
 * "order.refund", "withdrawal.cancel". Keep it stable (the admin UI groups
 * by these strings).
 */
import type { Prisma, PrismaClient } from '@prisma/client';

export interface AdminActionInput {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export type AuditClient = Pick<PrismaClient, 'adminAction'>;

export async function logAdminAction(prisma: AuditClient, input: AdminActionInput): Promise<void> {
  await prisma.adminAction.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: (input.metadata ?? null) as unknown as Prisma.InputJsonValue,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
