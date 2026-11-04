# Complete administration interface

## Objective and authorized scope

Expose all existing Users, Areas and Audit API actions in the local frontend and
verify the flows in a real browser against the local API and database. Preserve
all pre-existing uncommitted changes. No API expansion or remote operations. Authorized bounded backend correction:
apps/api/src/org/org.service.ts and apps/api/src/org/org.service.spec.ts, because
real browser rename plus reparent returned P2028 transaction timeout. Resolve slug
queries before opening the hierarchy write transaction; preserve collision handling.

## Plan and acceptance

- [x] ADM-1 Complete Users permissions, supported actions and error feedback.
- [x] ADM-2 Complete Areas editing, memberships and quick replies.
- [x] ADM-3 Complete supported Audit queries, paging, details and integrity checks.
- [x] ADM-4 Verify real local browser flows, applicable checks and document usage.

Each task uses delegated direct implementation by one writer: preparation for
writing and multiple nontrivial files trigger delegation. A separate verifier
will inspect and exercise the completed candidate. New test fixtures must be
clearly marked and isolated from existing business data.

## Verification

Use meaningful RED then GREEN tests for permission logic with Bun where feasible.
Run web type checking, API existing tests, formatting checks on edited files and
real Playwright browser flows with the actual local API and database. Observe
Users creation/edit/password/activation, Areas create/edit/member/quick-reply
operations and Audit tabs/paging/integrity/error feedback. Do not claim untested
flows passed. Existing web lint failure: missing @babel/preset-typescript in JS
configuration. No production data resets or remote access.

## Delivery and recovery

Branch: codex/complete-admin-ui. Base: eed0beb6272f81e54bbb8e306216ce4f8b12f033.
Initial dirty state saved outside the repository in /tmp/tickets-admin-before.patch
and /tmp/tickets-admin-before.status. Existing changes are not this work's commits.
Forecast: 800–1200 authored lines, generated output excluded; coherent tasks are
not artificially split to meet the advisory 400-line planning heuristic.
Delivery strategy: ask-on-risk. Chain strategy pending; no commit until resolved.
RDD explicitly off globally; no native review lifecycle will be started.
Engram unavailable; mirror odd/complete-admin-ui/tasks pending. Local document is
the recovery record. No matching project skills or registry available.

## Progress

Read-only API/frontend exploration completed. Browser runtime and existing local
Chromium found; no download required. Implementation and verification completed;
work-unit commits await the required delivery strategy decision.
Commit evidence: pending. Running authored line count: 1740 (writer implementation and checks).

Writer progress: permission helper RED then GREEN observed (3 tests). Users actual
browser creation, duplicate error, name/role/password changes, reset login,
deactivation/rejection/reactivation and non-admin redirect passed. Areas parent
delete rejection passed. Combined rename/reparent reproduced backend P2028;
regression test observed RED for root-connection access inside transaction.

## Writer verification completed

Users, Areas and Audit UI implementation is complete. Existing backend routes
remain unchanged. Bounded area service correction passed RED then GREEN: slug
collision resolution occurs before the libSQL transaction, preventing P2028 during
combined rename and reparent while preserving descendant paths.

Observed checks after normalization:

- Permission tests: 3 passed, with initial missing-export RED observed.
- API regression tests: 19 passed across 3 files, including the new transaction test.
- API e2e health: 1 passed; API production build passed.
- Web check-types passed; edited-file Prettier check passed.
- API lint passed with two existing warnings outside this work.
- Web lint failed: existing missing @babel/preset-typescript configuration now
  also prevents parsing the new browser script. No dependencies were changed.
- Global git diff --check reports a pre-existing trailing blank line in
  apps/api/src/tickets/tickets.service.ts at line 1000; it was preserved.

Real Chromium against localhost completed all 14 browser smoke groups: user
creation/edit/password reset/activation, duplicate error, non-admin route rejection;
area create/edit/reparent/lead and cycle-safe choices; blocked parent deletion;
members add/edit/remove; quick replies create/list/delete; own-area cleanup;
audit tabs/page-size/previous/next/complete-details/integrity; simulated network
failure display and retry against the actual API; Spanish mobile layout with no
browser runtime errors. The simulated network failure is deliberately injected;
all normal flows use the real local API and database.

Main screenshots directory:
/var/folders/xw/4tsdmpzx1cg07t1qswmd38xm0000gn/T/tickets-admin-1793459583324
Final mobile captures with animations settled: /tmp/users-mobile-es.png,
/tmp/areas-mobile-es.png and /tmp/audit-mobile-es.png. Writer inspected captures.
Fixture users have emails ui-test-1793459*.@example.test (numeric timestamp before
@, no literal dot); all created fixture accounts were deactivated, since no user
DELETE exists. Own test areas and replies were removed. Audit events remain as
expected immutable history. Existing business records were not edited.

Current authored change count relative the saved initial dirty snapshot: 1740
additions plus deletions excluding this task document. The complete browser smoke
script and the existing-page rewrites explain the higher forecast; no changes were
split or omitted to satisfy the advisory line heuristic. Independent verification
and the parent-requested spot check are complete. No commits were created;
delivery strategy and Engram mirror remain pending.

## Independent verification and parent readback

Independent verifier reran permission tests (3 passed), the focused organization
transaction regression (1 passed), and all 14 real Chromium smoke groups against
the local API/database. No severe candidate-caused defect identified. Additional
checks confirmed self-edit preserves ADMIN, inherited leaders can manage descendant
memberships, cyclic hierarchy changes are rejected, and combined rename/reparent
updates grandchild paths and depths. Own fixtures were removed or deactivated.

Populated mobile tables at 390px retain document width and all actions are reachable
through internal horizontal scrolling. Desktop and mobile screenshots were inspected.
The parent read back permission helpers and the transaction correction, inspected
the mobile Areas screenshot, and commissioned the independent permission rerun as
its command spot check. Self-edit was inspected without changing the real admin;
security/load testing was not exhaustive.

Native risk assessment returned high/unassessable due to the untracked inventory.
The conservative independent verification requirement was fulfilled. RDD remains
explicitly off; no native review was started and no approval receipt is claimed.
Local delivery is ready; commits, chain strategy and unavailable Engram mirror are
the outstanding administrative items. No push, pull request or merge authorized.
