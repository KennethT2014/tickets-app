# Ticket audit

## Objective and authorized scope

Add an authenticated audit screen showing how long people take to first read,
start handling, and resolve tickets. The user selected: read = successfully open
the ticket detail; start = transition to IN_PROGRESS; resolve = RESOLVED.
Durations start at ticket creation. Preserve existing ticket visibility.

## Problem and constraints

Status changes already record actors and timestamps, but detail reads are not
recorded. Missing historical evidence must remain missing, never become zero.
Record first reads per ticket and actor idempotently using existing TicketEvent
storage; derive first starts and resolutions from real status events. Keep GET
requests free of writes. Remain local; do not access or modify remote databases.
Technical artifacts default to English; support the existing EN/ES UI.

## Work and route

- [ ] AUD-1: Implement access-controlled recording and reporting, audit screen,
  navigation, translations, focused deterministic tests, and usage documentation.
  Route: delegated direct, one writer. Trigger: new logic across multiple files
  and reading in preparation for writing. Implementation and writer checks
  complete; independent verification passed. Delivery strategy and final commit
  pending, so the work unit remains open.

## Acceptance criteria

- A successful detail display records the authenticated user's first read once.
- Unauthorized users cannot record or obtain audit data for hidden tickets.
- Report first read, start, and resolution times with responsible people.
- Show useful per-person durations and sample counts, plus per-ticket evidence.
- Repeated status transitions and missing evidence do not distort first milestones.
- Audit navigation, loading, empty, error, and responsive states are usable.

## Verification

Use RED -> GREEN for applicable deterministic service tests. Run Prisma client
generation locally, API focused/full tests, API lint/build, web lint/typecheck/build.
Normalize edited sources before final checks. Build commands may take several
minutes and create local generated outputs. Never run db:setup or remote tooling.
RDD is disabled by global preference; do not start native review. After writer
completion assess risk read-only; independent verification is required for high
or unassessable risk. Parent must spot-check one reported command via a worker.

## Delivery and recovery

Current branch: codex/documentacion-fases-1-5. Existing clean checkout reused.
Initial boundary: ae16bd6. Initial forecast approximately 400 authored changed
lines; writer revised forecast to 650–800. Actual implementation is 952 authored
changed lines (excluding this document and generated files). This remains one
coherent behavior with meaningful tests and bilingual UI; no artificial splitting
or minification was used to satisfy the advisory per-task heuristic.
Delivery strategy: ask-on-risk. The delivery threshold is exceeded; chain strategy
must be resolved with the user before committing. No push, PR, or merge is
authorized. Commit evidence: pending.

Engram is unavailable in this session. Mirror topic odd/ticket-audit/tasks pending;
the complete local document is the recovery record.

## Progress and next step

Exploration completed; user confirmed milestone semantics (option 1).
Writer completed implementation, including visible-tab detail recording, retry,
atomic first-read persistence with duplicate-insert recovery, first historical
status milestones, per-person averages and counts, audit route and navigation.

Writer verification evidence:
- Initial 10 deterministic tests failed for missing methods, then passed.
- Concurrent-insert recovery test also observed RED then GREEN.
- API db:generate, focused tests (13), full tests (14), lint, and build passed.
- Web check-types and production build passed; /audit is generated.
- Web lint failed on existing JS config files: missing @babel/preset-typescript.
  Failure reproduced using the committed HEAD eslint.config.js. Existing ESLint
  also ignores the changed TS/TSX files, so changed-file lint cannot verify them.
- Changed-source formatting and git diff --check passed.

RDD remains disabled globally. Read-only native risk assessment returned high /
unassessable because untracked files need explicit inventory. No review lifecycle
was started. Independent verifier assigned with the focused service command as
the parent-requested spot check, plus optional local mocked browser checks.

Independent verification completed with no blocking functional findings:
- Focused API test command rerun as parent spot check: 13/13 passed.
- Production web build exercised using local Chromium and a synthetic API.
- Desktop/mobile tables, navigation, Spanish localization, missing evidence,
  loading, empty, and error states passed without browser JavaScript errors.
- Detail recording, error/retry, forbidden access without writes, hidden-tab
  deferral, and visibility-change deduplication passed.
- Screenshots inspected by verifier; parent inspected desktop screenshot at
  /tmp/ticket-audit-desktop.png. Mobile: /tmp/ticket-audit-mobile.png.
- No real database integration exercised; storage and concurrency tests use
  mocks. Report currently loads all visible tickets without pagination.
- Final git diff --check passed. No source changes followed final verification.

Next: ask the required delivery strategy choice before any commit. Existing web
lint failure and Engram mirror remain pending; no remote operation performed.
