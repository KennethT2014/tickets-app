import { describe, expect, it, vi } from 'vitest';
import { OrgService } from './org.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PolicyService } from '../auth/policy.service.js';

describe('Area hierarchy update', () => {
  it('resolves the unique renamed slug before entering a hierarchy transaction', async () => {
    let active = false;
    const area = {
      id: 'child',
      name: 'Old',
      slug: 'old',
      parentId: 'old-parent',
      path: '/old-parent/child/',
      depth: 1,
    };
    const rootFindUnique = vi.fn(
      async ({ where }: { where: { id?: string; slug?: string } }) => {
        if (active)
          throw new Error(
            'Root connection queried while transaction holds the database',
          );
        if (where.id === area.id) return area;
        if (where.slug === 'renamed') return { id: 'existing-collision' };
        return null;
      },
    );
    const update = vi.fn(async (query: unknown) => query);
    const prisma = {
      area: { findUnique: rootFindUnique },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        active = true;
        try {
          return await callback({
            area: {
              update,
              findMany: async () => [
                { id: 'descendant', path: '/old-parent/child/descendant/' },
              ],
            },
          });
        } finally {
          active = false;
        }
      },
    };
    const service = new OrgService(
      prisma as unknown as PrismaService,
      { isAdmin: () => true } as unknown as PolicyService,
    );
    await service.update(
      {
        id: 'admin',
        globalRole: 'ADMIN',
        email: 'admin@example.test',
        name: 'Admin',
      },
      'child',
      { name: 'Renamed', parentId: null },
    );
    expect(
      rootFindUnique.mock.calls
        .map(([query]) => query.where.slug)
        .filter(Boolean),
    ).toEqual(['renamed', 'renamed-2']);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'child' },
      data: {
        name: 'Renamed',
        slug: 'renamed-2',
        parentId: null,
        leadUserId: undefined,
        path: '/child/',
        depth: 0,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'descendant' },
      data: { path: '/child/descendant/', depth: 1 },
    });
  });
});
