import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { GlobalRole } from '../auth/roles.js';
import { getRoleRank } from '../auth/roles.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuditRecordInput = {
  actor?: {
    id: string;
    globalRole: GlobalRole;
  } | null;
  action: string;
  result: 'SUCCESS' | 'DENIED' | 'ERROR';
  entityType: string;
  entityId?: string | null;
  areaId?: string | null;
  areaPath?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an audit log entry with SHA-256 hash chaining.
   * If a transaction client (tx) is provided, operations run inside that transaction.
   */
  async record(
    input: AuditRecordInput,
    tx?: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
  ) {
    const client = tx ?? this.prisma;
    const occurredAt = new Date();

    // Find the latest audit record to get previous seq and hash
    const last = await client.auditLog.findFirst({
      orderBy: { seq: 'desc' },
      select: { seq: true, hash: true },
    });

    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? 'GENESIS_HASH_00000000000000000000000000000000000000000000000000000000';

    const actorId = input.actor?.id ?? null;
    const actorRole = input.actor?.globalRole ?? null;
    const actorRank = input.actor ? getRoleRank(input.actor.globalRole) : null;

    const beforeStr = input.before ? JSON.stringify(input.before) : null;
    const afterStr = input.after ? JSON.stringify(input.after) : null;

    // Canonical payload for hash calculation
    const payload = JSON.stringify({
      seq,
      occurredAt: occurredAt.toISOString(),
      prevHash,
      actorId,
      actorRole,
      action: input.action,
      result: input.result,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      areaId: input.areaId ?? null,
      areaPath: input.areaPath ?? null,
      before: beforeStr,
      after: afterStr,
      reason: input.reason ?? null,
    });

    const hash = createHash('sha256').update(payload).digest('hex');

    return client.auditLog.create({
      data: {
        seq,
        occurredAt,
        actorId,
        actorRole,
        actorRank,
        action: input.action,
        result: input.result,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        areaId: input.areaId ?? null,
        areaPath: input.areaPath ?? null,
        before: beforeStr,
        after: afterStr,
        reason: input.reason ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
        prevHash,
        hash,
      },
    });
  }

  /**
   * Verifies the cryptographic integrity of the entire audit chain.
   */
  async verifyChain(): Promise<{ valid: boolean; totalChecked: number; brokenSeq?: number }> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { seq: 'asc' },
    });

    let prevHash = 'GENESIS_HASH_00000000000000000000000000000000000000000000000000000000';
    for (let i = 0; i < logs.length; i++) {
      const entry = logs[i];
      if (entry.seq !== i + 1) {
        return { valid: false, totalChecked: i, brokenSeq: entry.seq };
      }
      if (entry.prevHash !== prevHash) {
        return { valid: false, totalChecked: i, brokenSeq: entry.seq };
      }

      const payload = JSON.stringify({
        seq: entry.seq,
        occurredAt: entry.occurredAt.toISOString(),
        prevHash: entry.prevHash,
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        result: entry.result,
        entityType: entry.entityType,
        entityId: entry.entityId,
        areaId: entry.areaId,
        areaPath: entry.areaPath,
        before: entry.before,
        after: entry.after,
        reason: entry.reason,
      });

      const expectedHash = createHash('sha256').update(payload).digest('hex');
      if (entry.hash !== expectedHash) {
        return { valid: false, totalChecked: i, brokenSeq: entry.seq };
      }

      prevHash = entry.hash;
    }

    return { valid: true, totalChecked: logs.length };
  }
}
