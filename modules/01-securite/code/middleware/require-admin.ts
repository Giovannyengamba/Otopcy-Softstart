/**
 * App-wide role hierarchy used by the admin back-office.
 * Precedence: SUPERADMIN > ADMIN > USER.
 *
 * The actual gate logic now lives in `./index.ts` (`requireAdmin`,
 * `requireSuperadmin`) — this file only exports the role type + rank
 * function so audit/route code can do role math without pulling in the
 * full middleware module.
 */
import 'server-only';

export type AdminRole = 'USER' | 'ADMIN' | 'SUPERADMIN';

const ROLE_RANK: Record<AdminRole, number> = {
  USER: 0,
  ADMIN: 1,
  SUPERADMIN: 2,
};

export function roleRank(role: AdminRole): number {
  return ROLE_RANK[role] ?? 0;
}
