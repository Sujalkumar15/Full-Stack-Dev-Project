import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const workspaceParamsSchema = z.object({
  workspaceId: uuidSchema,
});

export const pageParamsSchema = workspaceParamsSchema.extend({
  pageId: uuidSchema,
});
