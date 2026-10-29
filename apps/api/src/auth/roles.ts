export const GLOBAL_ROLES = [
  'ADMIN',
  'MANAGEMENT',
  'AREA_LEAD',
  'EMPLOYEE',
] as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export function isAdminRole(role: GlobalRole) {
  return role === 'ADMIN';
}

export function isCompanyWideRole(role: GlobalRole) {
  return role === 'ADMIN' || role === 'MANAGEMENT';
}
