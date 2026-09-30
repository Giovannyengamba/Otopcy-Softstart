/**
 * Org role hierarchy used by the multi-tenancy primitives.
 * Precedence: OWNER > ADMIN > MEMBER.
 *
 * The gate logic lives in `./index.ts` (`requireOrgRole`) — this file only
 * exports the role type + rank table.
 */
import 'server-only';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export const ORG_ROLE_RANK: Record<OrgRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};
