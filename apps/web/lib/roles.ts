export const GLOBAL_ROLES = [
  "ADMIN",
  "MANAGEMENT",
  "AREA_LEAD",
  "EMPLOYEE",
] as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export function isAdmin(role: GlobalRole) {
  return role === "ADMIN";
}

export function canOverseeAllTickets(role: GlobalRole) {
  return role === "ADMIN" || role === "MANAGEMENT";
}
