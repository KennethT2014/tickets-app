import { z } from 'zod';

export const createAreaSchema = z.object({
  name: z.string().min(2).max(120),
  parentId: z.string().nullable().optional(),
  leadUserId: z.string().nullable().optional(),
});

export const updateAreaSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  parentId: z.string().nullable().optional(),
  leadUserId: z.string().nullable().optional(),
});

export const upsertMemberSchema = z.object({
  userId: z.string().min(1),
  canAssign: z.boolean().optional(),
  canClose: z.boolean().optional(),
});

export const patchMemberSchema = z.object({
  canAssign: z.boolean().optional(),
  canClose: z.boolean().optional(),
});

export type CreateAreaDto = z.infer<typeof createAreaSchema>;
export type UpdateAreaDto = z.infer<typeof updateAreaSchema>;
export type UpsertMemberDto = z.infer<typeof upsertMemberSchema>;
export type PatchMemberDto = z.infer<typeof patchMemberSchema>;
