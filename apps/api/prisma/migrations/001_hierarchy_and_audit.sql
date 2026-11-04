-- 001: hierarchical scoping (Area.path), session revocation (User.tokenVersion),
-- structured ticket events and the append-only system audit log.

-- Session revocation -------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Materialized area paths ----------------------------------------------------
ALTER TABLE "Area" ADD COLUMN "path" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Area" ADD COLUMN "depth" INTEGER NOT NULL DEFAULT 0;

WITH RECURSIVE tree(id, path, depth) AS (
  SELECT "id", '/' || "id" || '/', 0 FROM "Area" WHERE "parentId" IS NULL
  UNION ALL
  SELECT a."id", tree.path || a."id" || '/', tree.depth + 1
  FROM "Area" a JOIN tree ON a."parentId" = tree.id
)
UPDATE "Area"
SET "path" = (SELECT tree.path FROM tree WHERE tree.id = "Area"."id"),
    "depth" = (SELECT tree.depth FROM tree WHERE tree.id = "Area"."id")
WHERE "id" IN (SELECT id FROM tree);

-- Areas unreachable from a root can only exist inside a parent cycle. Promote
-- them to roots so the tree is valid again (an administrator can re-parent them).
UPDATE "Area"
SET "parentId" = NULL, "path" = '/' || "id" || '/', "depth" = 0
WHERE "path" = '';

CREATE UNIQUE INDEX "Area_path_key" ON "Area"("path");

-- Structured ticket events ---------------------------------------------------
ALTER TABLE "TicketEvent" ADD COLUMN "fromStatus" TEXT;
ALTER TABLE "TicketEvent" ADD COLUMN "toStatus" TEXT;
ALTER TABLE "TicketEvent" ADD COLUMN "metadata" TEXT;

-- Backfill from the legacy server-authored message format "Status A → B".
UPDATE "TicketEvent"
SET "fromStatus" = substr("message", 8, instr("message", ' → ') - 8),
    "toStatus" = substr("message", instr("message", ' → ') + 3)
WHERE "type" IN ('STATUS_CHANGED', 'CLOSED')
  AND "message" LIKE 'Status % → %';

-- Ticket events are history: content can never be rewritten or deleted.
CREATE TRIGGER "TicketEvent_immutable_update"
BEFORE UPDATE ON "TicketEvent"
WHEN OLD."ticketId" IS NOT NEW."ticketId"
  OR OLD."actorId" IS NOT NEW."actorId"
  OR OLD."type" IS NOT NEW."type"
  OR OLD."message" IS NOT NEW."message"
  OR OLD."fromStatus" IS NOT NEW."fromStatus"
  OR OLD."toStatus" IS NOT NEW."toStatus"
  OR OLD."metadata" IS NOT NEW."metadata"
  OR OLD."createdAt" IS NOT NEW."createdAt"
BEGIN
  SELECT RAISE(ABORT, 'TicketEvent is immutable');
END;

CREATE TRIGGER "TicketEvent_immutable_delete"
BEFORE DELETE ON "TicketEvent"
BEGIN
  SELECT RAISE(ABORT, 'TicketEvent is immutable');
END;

-- System audit log -----------------------------------------------------------
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "actorRank" INTEGER,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "areaId" TEXT,
    "areaPath" TEXT,
    "before" TEXT,
    "after" TEXT,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL
);

CREATE UNIQUE INDEX "AuditLog_seq_key" ON "AuditLog"("seq");
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");
CREATE INDEX "AuditLog_actorId_occurredAt_idx" ON "AuditLog"("actorId", "occurredAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_areaPath_idx" ON "AuditLog"("areaPath");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

CREATE TRIGGER "AuditLog_append_only_update"
BEFORE UPDATE ON "AuditLog"
BEGIN
  SELECT RAISE(ABORT, 'AuditLog is append-only');
END;

CREATE TRIGGER "AuditLog_append_only_delete"
BEFORE DELETE ON "AuditLog"
BEGIN
  SELECT RAISE(ABORT, 'AuditLog is append-only');
END;
