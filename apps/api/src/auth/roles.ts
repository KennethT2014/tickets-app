export const GLOBAL_ROLES = [
  'ADMIN',
  'MANAGEMENT',
  'AREA_LEAD',
  'EMPLOYEE',
] as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const ROLE_RANKS: Record<GlobalRole, number> = {
  ADMIN: 4,
  MANAGEMENT: 3,
  AREA_LEAD: 2,
  EMPLOYEE: 1,
};

export function getRoleRank(role: GlobalRole): number {
  return ROLE_RANKS[role] ?? 1;
}

export function isAdminRole(role: GlobalRole) {
  return role === 'ADMIN';
}

export function isCompanyWideRole(role: GlobalRole) {
  return role === 'ADMIN' || role === 'MANAGEMENT';
}
