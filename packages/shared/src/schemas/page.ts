import { z } from 'zod';

import { uuidSchema } from './identifiers.js';
import { pageAccessLevels } from '../types/permissions.js';

export const pageVisibilitySchema = z.enum(['WORKSPACE', 'RESTRICTED']);
export const pageAccessSchema = z.enum(pageAccessLevels);
export const pageTitleSchema = z.string().trim().min(1).max(200);

export const createPageRequestSchema = z
  .object({
    title: pageTitleSchema.default('Untitled'),
    parentId: uuidSchema.nullable().optional(),
    visibility: pageVisibilitySchema.default('WORKSPACE'),
    sortOrder: z.number().finite().optional(),
  })
  .strict();

export const updatePageRequestSchema = z
  .object({
    title: pageTitleSchema.optional(),
    parentId: uuidSchema.nullable().optional(),
    visibility: pageVisibilitySchema.optional(),
    sortOrder: z.number().finite().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const setPagePermissionRequestSchema = z
  .object({
    access: pageAccessSchema,
  })
  .strict();

export const pageSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  parentId: uuidSchema.nullable(),
  title: z.string(),
  visibility: pageVisibilitySchema,
  sortOrder: z.number(),
  archivedAt: z.string().datetime().nullable(),
  access: pageAccessSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreatePageRequest = z.input<typeof createPageRequestSchema>;
export type UpdatePageRequest = z.infer<typeof updatePageRequestSchema>;
export type SetPagePermissionRequest = z.infer<typeof setPagePermissionRequestSchema>;
export type PageSummary = z.infer<typeof pageSchema>;
