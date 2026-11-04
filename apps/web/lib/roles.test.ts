import { describe, test } from "node:test";
import assert from "node:assert/strict";
const expect = (actual: unknown) => ({
  toBe: (expected: unknown) => assert.strictEqual(actual, expected),
  toEqual: (expected: unknown) => assert.deepStrictEqual(actual, expected),
});
import {
  canEditUser,
  assignableRoles,
  canManageAreaTree,
  validAreaParents,
} from "./roles";

describe("administration permissions", () => {
  const admin = { id: "a", globalRole: "ADMIN" as const };
  test("administrators edit themselves and lower ranks, not peers", () => {
    expect(canEditUser(admin, admin)).toBe(true);
    expect(canEditUser(admin, { id: "b", globalRole: "ADMIN" })).toBe(false);
    expect(canEditUser(admin, { id: "e", globalRole: "EMPLOYEE" })).toBe(true);
    expect(assignableRoles("ADMIN")).toEqual([
      "MANAGEMENT",
      "AREA_LEAD",
      "EMPLOYEE",
    ]);
    expect(assignableRoles("EMPLOYEE")).toEqual([]);
  });
  test("area leaders inherit scope without matching sibling prefixes", () => {
    const areas = [
      { id: "x", parentId: null },
      { id: "y", parentId: "x" },
      { id: "z", parentId: null },
    ];
    expect(
      canManageAreaTree(
        { globalRole: "AREA_LEAD", leadAreaIds: ["x"] },
        "y",
        areas,
      ),
    ).toBe(true);
    expect(
      canManageAreaTree(
        { globalRole: "AREA_LEAD", leadAreaIds: ["x"] },
        "z",
        areas,
      ),
    ).toBe(false);
  });
  test("parent choices exclude self and descendants", () => {
    const areas = [
      { id: "x", parentId: null },
      { id: "y", parentId: "x" },
      { id: "z", parentId: "y" },
      { id: "r", parentId: null },
    ];
    expect(validAreaParents("x", areas).map((a) => a.id)).toEqual(["r"]);
  });
});
