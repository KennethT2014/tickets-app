-- 002: Internal comments, ticket timing milestones, and links

-- Add waitingUntil, resolvedAt, closedAt to Ticket
ALTER TABLE "Ticket" ADD COLUMN "waitingUntil" DATETIME;
ALTER TABLE "Ticket" ADD COLUMN "resolvedAt" DATETIME;
ALTER TABLE "Ticket" ADD COLUMN "closedAt" DATETIME;

-- Add visibility to TicketComment (PUBLIC or INTERNAL)
ALTER TABLE "TicketComment" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';

-- TicketLink table for Parent/Child, Related, and Duplicate links
CREATE TABLE "TicketLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RELATED',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketLink_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketLink_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TicketLink_fromId_toId_type_key" ON "TicketLink"("fromId", "toId", "type");
CREATE INDEX "TicketLink_fromId_idx" ON "TicketLink"("fromId");
CREATE INDEX "TicketLink_toId_idx" ON "TicketLink"("toId");
