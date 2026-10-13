import { z } from 'zod';

export const ticketStatuses = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
] as const;

export const ticketPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export const createTicketSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(10000),
  areaId: z.string().min(1),
  priority: z.enum(ticketPriorities).optional(),
  category: z.string().max(100).optional(),
  dueAt: z.string().datetime().optional(),
  assigneeId: z.string().optional(),
});

export const updateTicketSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  body: z.string().min(1).max(10000).optional(),
  priority: z.enum(ticketPriorities).optional(),
  category: z.string().max(100).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

export const assignTicketSchema = z.object({
  assigneeId: z.string().nullable(),
});

export const statusTicketSchema = z.object({
  status: z.enum(ticketStatuses),
});

export const commentTicketSchema = z.object({
  body: z.string().min(1).max(5000),
});

export type CreateTicketDto = z.infer<typeof createTicketSchema>;
export type UpdateTicketDto = z.infer<typeof updateTicketSchema>;
export type AssignTicketDto = z.infer<typeof assignTicketSchema>;
export type StatusTicketDto = z.infer<typeof statusTicketSchema>;
export type CommentTicketDto = z.infer<typeof commentTicketSchema>;
