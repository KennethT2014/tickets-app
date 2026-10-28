import { z } from 'zod';
import { GLOBAL_ROLES } from '../auth/roles.js';

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  password: z.string().min(8).max(120),
  globalRole: z.enum(GLOBAL_ROLES).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
  globalRole: z.enum(GLOBAL_ROLES).optional(),
  password: z.string().min(8).max(120).optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
