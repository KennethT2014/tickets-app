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

export const ROLE_RANK: Record<GlobalRole, number> = {
  ADMIN: 4,
  MANAGEMENT: 3,
  AREA_LEAD: 2,
  EMPLOYEE: 1,
};
export function canEditUser(
  actor: { id: string; globalRole: GlobalRole },
  target: { id: string; globalRole: GlobalRole },
) {
  return (
    actor.id === target.id ||
    ROLE_RANK[actor.globalRole] > ROLE_RANK[target.globalRole]
  );
}
export function assignableRoles(role: GlobalRole) {
  return GLOBAL_ROLES.filter((target) => ROLE_RANK[target] < ROLE_RANK[role]);
}
type AreaReference = { id: string; parentId: string | null };
function belongsTo(areaId: string, ancestorId: string, areas: AreaReference[]) {
  const visited = new Set<string>();
  let current: string | null = areaId;
  while (current && !visited.has(current)) {
    if (current === ancestorId) return true;
    visited.add(current);
    current = areas.find((area) => area.id === current)?.parentId ?? null;
  }
  return false;
}
export function canManageAreaTree(
  actor: { globalRole: GlobalRole; leadAreaIds: string[] },
  areaId: string,
  areas: AreaReference[],
) {
  return (
    canOverseeAllTickets(actor.globalRole) ||
    actor.leadAreaIds.some((id) => belongsTo(areaId, id, areas))
  );
}
export function validAreaParents<T extends AreaReference>(
  areaId: string,
  areas: T[],
): T[] {
  return areas.filter((area) => !belongsTo(area.id, areaId, areas));
}
